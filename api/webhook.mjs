/* =========================================================
   POST /api/webhook  — Stripe からの通知

   発券はここでだけ行います。決済後のリダイレクトでは行いません。
   リダイレクトはブラウザ任せなので、閉じられれば届かず、
   逆に URL を直接叩けば払わずに呼べてしまいます。

   本物の通知かどうかは二段構えで確かめます。

   1. 署名。生の本文に対して計算されるので、本文が丸ごと必要です。
   2. 生の本文が手に入らないときは、届いた中身を信じず、
      そこにあるセッションIDだけを取り出して Stripe に問い合わせ直します。
      返ってきた内容が本物です。

   2 が要るのは、Vercel の Node ランタイムが本文を先に読んで
   オブジェクトにしてしまうからです。そうなると生の本文は復元できません
   （空白や文字の書き方まで一致させないと署名は合いません）。
   Next.js の bodyParser: false はここでは効きません。
   ========================================================= */

import {
  send, env, sb, priceLabel, randomHex, sendMail, verifyStripeSignature, readRaw, stripe
} from './_lib.mjs';

const WEBHOOK_SECRET = env('STRIPE_WEBHOOK_SECRET');

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'method_not_allowed' });

  const raw = await readRaw(req);

  let event, verified = false;

  if (raw) {
    if (!WEBHOOK_SECRET) return send(res, 500, { error: 'not_configured', missing: ['STRIPE_WEBHOOK_SECRET'] });
    verified = await verifyStripeSignature(raw, req.headers['stripe-signature'], WEBHOOK_SECRET);
    if (!verified) return send(res, 400, { error: 'bad_signature' });
    try { event = JSON.parse(raw); }
    catch { return send(res, 400, { error: 'bad_json' }); }
  } else {
    /* 生の本文が取れませんでした。中身はまだ信用できません */
    event = req.body && typeof req.body === 'object' ? req.body : null;
    if (!event) return send(res, 400, { error: 'no_body' });
  }

  if (event.type !== 'checkout.session.completed') {
    return send(res, 200, { received: true, ignored: event.type });
  }

  let session = (event.data && event.data.object) || {};
  if (!/^cs_[A-Za-z0-9_]{10,}$/.test(String(session.id || ''))) {
    return send(res, 400, { error: 'bad_session_id' });
  }

  /* 署名で確かめられていないので、Stripe 本人に聞き直します。
     ここから先は、届いた本文ではなく返ってきた内容だけを使います。 */
  if (!verified) {
    try {
      session = await stripe('checkout/sessions/' + session.id, null, 'GET');
    } catch (err) {
      console.error('session lookup failed:', err.message);
      return send(res, 400, { error: 'unknown_session' });
    }
  }

  if (session.payment_status !== 'paid') {
    return send(res, 200, { received: true, ignored: 'not_paid' });
  }

  try {
    await fulfil(session);
  } catch (err) {
    /* 500 を返すと Stripe が再送してくれます。握り潰すと注文が消えます */
    console.error('fulfil failed:', err.message);
    return send(res, 500, { error: 'fulfil_failed', message: err.message });
  }
  return send(res, 200, { received: true });
}

async function fulfil(session) {
  const meta    = session.metadata || {};
  const orderId = 'o_' + session.id.slice(-24);

  /* Stripe は同じ通知を複数回送ることがあります。
     すでに作ってあれば、そこで終わりにします。 */
  const existing = await sb('orders?select=id&id=eq.' + encodeURIComponent(orderId));
  if (existing.length) return;

  const eventId = meta.event_id || '';
  const events  = await sb('events?select=*&id=eq.' + encodeURIComponent(eventId));
  const ev      = events[0] || {};

  const quantity = parseInt(meta.quantity, 10) || 1;
  const unit     = parseInt(meta.unit_amount, 10) || 0;
  const details  = session.customer_details || {};
  const email    = details.email || session.customer_email || '';
  const name     = details.name || '';
  const currency = (session.currency || 'eur').toUpperCase();

  await sb('orders', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      id: orderId,
      user_id: meta.user_id || null,
      email,
      name,
      event_id: eventId,
      event_title: ev.title || '',
      event_date: ev.date || null,
      quantity,
      unit_price_cents: unit,
      total_cents: session.amount_total == null ? unit * quantity : session.amount_total,
      currency,
      tier_at_purchase: meta.tier || 'free',
      status: 'paid',
      stripe_checkout_session_id: session.id,
      stripe_payment_intent_id: session.payment_intent || null
    })
  });

  const secret = randomHex(24);
  await sb('tickets', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      id: 't_' + session.id.slice(-24),
      order_id: orderId,
      user_id: meta.user_id || null,
      email,
      event_id: eventId,
      event_title: ev.title || '',
      event_date: ev.date || null,
      holder_name: name || email,
      quantity,
      secret,
      status: 'valid'
    })
  });

  /* メールは発券の後です。送信に失敗しても注文は残ります */
  const origin = env('SITE_URL') || 'https://www.symarch-llc.com';
  try {
    await sendMail({
      to: email,
      subject: 'You’re in — ' + (ev.title || 'Asian Social Rotterdam'),
      html: confirmationHTML({ ev, name, quantity, unit, currency, secret, origin, meta })
    });
  } catch (err) {
    console.error('mail failed:', err.message);
  }
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function confirmationHTML({ ev, name, quantity, unit, currency, secret, origin, meta }) {
  const first = String(name || '').split(' ')[0] || 'there';
  const when  = [ev.date, [ev.start_time, ev.end_time].filter(Boolean).join('–')]
                  .filter(Boolean).join(' · ');
  const tag = meta.discount === 'member' ? ' (member price)'
            : meta.discount === 'early'  ? ' (early bird)' : '';

  return `
  <div style="margin:0;padding:32px 12px;background:#f2ece3;font-family:Helvetica,Arial,sans-serif">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"
           style="width:600px;max-width:100%;margin:0 auto;background:#faf7f2">
      <tr><td style="padding:30px 32px 0">
        <div style="font-size:11px;font-weight:bold;letter-spacing:2.4px;text-transform:uppercase;color:#15803d">
          Booking confirmed</div>
        <h1 style="margin:16px 0 0;font-size:34px;line-height:1.1;color:#0e0b14">You're in, ${esc(first)}.</h1>
        <p style="margin:18px 0 0;font-size:16px;line-height:1.6;color:#3a3348">
          Thank you for booking &mdash; we are really glad you are coming.</p>
      </td></tr>

      <tr><td style="padding:26px 32px 0">
        <h2 style="margin:0 0 16px;font-size:22px;color:#0e0b14">${esc(ev.title || '')}</h2>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
               style="font-size:15px;color:#0e0b14">
          <tr><td style="padding:11px 0;border-top:1px solid #ddd5c8;width:96px;font-size:10px;
                         letter-spacing:1.8px;text-transform:uppercase;color:#7a7288">When</td>
              <td style="padding:11px 0;border-top:1px solid #ddd5c8">${esc(when)}</td></tr>
          <tr><td style="padding:11px 0;border-top:1px solid #ddd5c8;font-size:10px;
                         letter-spacing:1.8px;text-transform:uppercase;color:#7a7288">Where</td>
              <td style="padding:11px 0;border-top:1px solid #ddd5c8">${esc(ev.venue || '')}${ev.address ? ', ' + esc(ev.address) : ''}</td></tr>
          <tr><td style="padding:11px 0;border-top:1px solid #ddd5c8;border-bottom:1px solid #ddd5c8;
                         font-size:10px;letter-spacing:1.8px;text-transform:uppercase;color:#7a7288">Paid</td>
              <td style="padding:11px 0;border-top:1px solid #ddd5c8;border-bottom:1px solid #ddd5c8">
                ${esc(quantity)} &times; ${esc(priceLabel(unit, currency))}${esc(tag)}</td></tr>
        </table>
      </td></tr>

      <tr><td style="padding:26px 32px 0">
        <a href="${origin}/ticket.html?t=${esc(secret)}"
           style="display:inline-block;padding:15px 30px;background:#c10e2e;color:#fff;
                  text-decoration:none;font-size:14px;font-weight:bold">Open my ticket</a>
        <p style="margin:14px 0 0;font-size:13px;color:#7a7288">
          Show this at the door. Keep this email &mdash; the link works on your phone.</p>
      </td></tr>

      <tr><td style="padding:30px 32px 34px">
        <p style="margin:0;font-size:16px;line-height:1.6;color:#3a3348">
          Bring a friend if you like &mdash; just reply to this email so we can keep the numbers right.</p>
        <p style="margin:22px 0 0;font-size:16px;color:#3a3348">
          See you in Rotterdam,<br><strong style="color:#0e0b14">Asian Social Rotterdam</strong></p>
      </td></tr>
    </table>
  </div>`;
}
