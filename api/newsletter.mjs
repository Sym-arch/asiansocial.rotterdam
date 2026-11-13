/* =========================================================
   POST /api/newsletter   { eventIds: string[], subject?: string, intro?: string }
   会員全員に、これからのイベントを知らせるメールを送ります。

   reminder.mjs（予約した人への開催前の案内）とは別物です。
   こちらは「会員であれば誰にでも」送るお知らせで、本人が配信停止に
   していない人にだけ届きます（marketing_opt_out、23-newsletter.sql）。

   reminder.mjs と同じく、宛先はサーバー側で名簿から作ります。
   ========================================================= */

import {
  send, sb, missingEnv, userFromToken, readJson,
  priceFor, priceLabel, sendMailBatch, env, signUserToken
} from './_lib.mjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'method_not_allowed' });

  const missing = missingEnv('SUPABASE_URL', 'SERVICE_KEY', 'RESEND_KEY');
  if (missing) return send(res, 500, { error: 'not_configured', missing });

  let body;
  try { body = await readJson(req); }
  catch { return send(res, 400, { error: 'bad_request' }); }

  const eventIds = Array.isArray(body.eventIds) ? body.eventIds.map(String).filter(Boolean) : [];
  if (!eventIds.length) return send(res, 400, { error: 'missing_events' });
  const subject = String(body.subject || '').trim().slice(0, 150);
  const intro   = String(body.intro || '').trim().slice(0, 2000);
  if (!subject) return send(res, 400, { error: 'missing_subject' });

  try {
    /* --- 主催者本人か ---------------------------------------------------- */
    const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    const user  = await userFromToken(token);
    if (!user || !user.id) return send(res, 401, { error: 'sign_in_required' });

    const admins = await sb('admins?select=user_id&user_id=eq.' + encodeURIComponent(user.id));
    if (!admins.length) return send(res, 403, { error: 'not_an_organiser' });

    /* --- 何を、誰に ------------------------------------------------------
       in.() を組み立てるより、全件読んで選んだ id だけに絞るほうが単純で、
       書式の間違いも起きません。イベントの件数はたかが知れています。 */
    const allEvents = await sb('events?select=*&order=date.asc');
    const idSet = new Set(eventIds);
    const events = allEvents.filter(ev => idSet.has(String(ev.id)));
    if (!events.length) return send(res, 404, { error: 'events_not_found' });

    /* 配信停止していない会員だけ。メールが無い行は送りようがないので外します */
    const profiles = await sb(
      'profiles?select=id,email,name&marketing_opt_out=eq.false&email=not.is.null'
    );
    const people = profiles.filter(p => String(p.email || '').includes('@'));
    if (!people.length) return send(res, 200, { sent: 0, recipients: 0 });

    /* --- 送る ------------------------------------------------------------ */
    const origin = env('SITE_URL') || 'https://www.asiansocials.nl';

    /* 配信停止のリンクは、受け取った人ごとに1つ作ります（他人を外せないように） */
    const messages = await Promise.all(people.map(async p => {
      const unsub = origin + '/api/unsubscribe?u=' + encodeURIComponent(p.id) +
                    '&s=' + encodeURIComponent(await signUserToken(p.id));
      return {
        to: p.email,
        subject,
        html: newsletterHTML({ events, name: p.name, intro, origin, unsub })
      };
    }));

    const result = await sendMailBatch(messages);
    return send(res, 200, { sent: result.sent || people.length, recipients: people.length });
  } catch (err) {
    console.error('newsletter failed:', err.message);
    return send(res, 500, { error: 'newsletter_failed', message: err.message });
  }
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function longDate(date) {
  if (!date) return '';
  const d = new Date(date + 'T12:00:00Z');
  if (isNaN(d)) return date;
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
}

function absUrl(src, origin) {
  const v = String(src || '').trim();
  if (!v) return '';
  if (/^https?:\/\//i.test(v)) return v;
  return origin + '/' + v.replace(/^\/+/, '');
}

function eventRowHTML(ev, origin) {
  const price = priceFor(ev, 'guest');
  const when  = [longDate(ev.date), [ev.start_time, ev.end_time].filter(Boolean).join('–')]
                  .filter(Boolean).join(' · ');
  const img   = absUrl(ev.image, origin);
  const url   = origin + '/e/' + encodeURIComponent(ev.id);
  return `
  <tr><td style="padding:22px 0;border-top:1px solid #ddd5c8">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      ${img ? `<td width="96" style="padding-right:18px;vertical-align:top">
        <img src="${esc(img)}" width="96" height="96" alt=""
             style="display:block;width:96px;height:96px;object-fit:cover;border-radius:6px">
      </td>` : ''}
      <td style="vertical-align:top">
        <p style="margin:0;font-size:10px;letter-spacing:1.6px;text-transform:uppercase;color:#c10e2e">
          ${esc(when)}</p>
        <p style="margin:6px 0 0;font-size:18px;line-height:1.3;color:#0e0b14;font-weight:bold">
          ${esc(ev.title || '')}</p>
        <p style="margin:6px 0 0;font-size:14px;color:#7a7288">
          ${esc(ev.venue || '')} · ${esc(priceLabel(price.cents, ev.currency || 'EUR'))}</p>
        <p style="margin:12px 0 0">
          <a href="${esc(url)}" style="font-size:13px;font-weight:bold;color:#c10e2e;text-decoration:none">
            View &amp; book →</a></p>
      </td>
    </tr></table>
  </td></tr>`;
}

function newsletterHTML({ events, name, intro, origin, unsub }) {
  const first = String(name || '').split(' ')[0] || 'there';
  return `
  <div style="margin:0;padding:32px 12px;background:#f2ece3;font-family:Helvetica,Arial,sans-serif">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"
           style="width:600px;max-width:100%;margin:0 auto;background:#faf7f2">
      <tr><td style="padding:30px 32px 0">
        <div style="font-size:11px;font-weight:bold;letter-spacing:2.4px;text-transform:uppercase;color:#c10e2e">
          What's coming up</div>
        <h1 style="margin:16px 0 0;font-size:30px;line-height:1.15;color:#0e0b14">Hi ${esc(first)},</h1>
        ${intro ? `<p style="margin:18px 0 0;font-size:16px;line-height:1.6;color:#3a3348;white-space:pre-line">${esc(intro)}</p>` : ''}
      </td></tr>

      <tr><td style="padding:10px 32px 0">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          ${events.map(ev => eventRowHTML(ev, origin)).join('')}
        </table>
      </td></tr>

      <tr><td style="padding:30px 32px 0">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
          <td bgcolor="#0e0b14" style="padding:0">
            <a href="${esc(origin)}/events.html"
               style="display:inline-block;padding:15px 30px;color:#fff;text-decoration:none;
                      font-size:14px;font-weight:bold">See all events</a>
          </td>
        </tr></table>
      </td></tr>

      <tr><td style="padding:30px 32px 34px">
        <p style="margin:0;font-size:16px;color:#3a3348">
          See you in Rotterdam,<br><strong style="color:#0e0b14">Asian Socials</strong></p>
        <p style="margin:20px 0 0;font-size:12px;color:#9a93a6">
          <a href="${esc(origin)}" style="color:#9a93a6">${esc(String(origin).replace(/^https?:\/\//, ''))}</a>
          &nbsp;·&nbsp;
          <a href="${esc(unsub)}" style="color:#9a93a6">Unsubscribe from these emails</a></p>
      </td></tr>
    </table>
  </div>`;
}
