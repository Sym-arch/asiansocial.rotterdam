/* =========================================================
   POST /api/announce   { eventId, dryRun }
   新しいイベントを、お知らせを受け取る設定の会員全員へメールします。

   dryRun: true なら送らずに、届く人数と前回の送信だけを返します。
   管理画面はまずこれで「何人に届くか」「前に送っていないか」を見せ、
   確認を取ってから本送信します。一斉送信は取り消せないためです。

   宛先はサーバ側で profiles から作ります（リマインダーと同じ理由で、
   ブラウザから宛先を受け取ると誰にでも当団体名で送れてしまいます）。
   1人ずつ別便で送り、どのメールにも配信停止のリンクを付けます。
   ========================================================= */

import {
  send, sb, missingEnv, userFromToken, readJson,
  priceFor, priceLabel, sendMailBatch, env, unsubToken
} from './_lib.mjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'method_not_allowed' });

  const missing = missingEnv('SUPABASE_URL', 'SERVICE_KEY', 'RESEND_KEY');
  if (missing) return send(res, 500, { error: 'not_configured', missing });

  let body;
  try { body = await readJson(req); }
  catch { return send(res, 400, { error: 'bad_request' }); }

  const eventId = String(body.eventId || '');
  const dryRun  = body.dryRun === true;
  if (!eventId) return send(res, 400, { error: 'missing_event' });

  try {
    /* --- 主催者本人か ---------------------------------------------------- */
    const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    const user  = await userFromToken(token);
    if (!user || !user.id) return send(res, 401, { error: 'sign_in_required' });

    const admins = await sb('admins?select=user_id&user_id=eq.' + encodeURIComponent(user.id));
    if (!admins.length) return send(res, 403, { error: 'not_an_organiser' });

    /* --- 何を ------------------------------------------------------------ */
    const events = await sb('events?select=*&id=eq.' + encodeURIComponent(eventId));
    const ev = events[0];
    if (!ev) return send(res, 404, { error: 'event_not_found' });

    /* --- 誰に ------------------------------------------------------------ */
    let members;
    try {
      members = await sb('profiles?select=id,email,name&news_opt_in=eq.true&order=created_at.asc');
    } catch (err) {
      /* 13-announcements.sql が未適用だと列が無く、ここで落ちます */
      if (/news_opt_in/.test(err.message)) return send(res, 409, { error: 'not_migrated' });
      throw err;
    }

    /* 同じアドレスが二つあっても、届くのは1通です */
    const byEmail = new Map();
    for (const m of members || []) {
      const key = String(m.email || '').trim().toLowerCase();
      if (!key.includes('@') || byEmail.has(key)) continue;
      byEmail.set(key, { id: m.id, email: m.email.trim(), name: m.name || '' });
    }
    const people = [...byEmail.values()];
    const last = { at: ev.announced_at || null, count: ev.announced_count || 0 };

    if (dryRun) return send(res, 200, { recipients: people.length, last });
    if (!people.length) return send(res, 200, { sent: 0, recipients: 0 });

    /* --- 送る ------------------------------------------------------------ */
    const origin  = (env('SITE_URL') || 'https://www.symarch-llc.com').replace(/\/+$/, '');
    const link    = origin + '/event.html?id=' + encodeURIComponent(ev.id);
    const subject = 'New event: ' + (ev.title || 'our next meetup') + ' — ' + longDate(ev.date);

    let sent = 0, failure = null;
    try {
      const result = await sendMailBatch(people.map(p => {
        const unsub = origin + '/api/unsubscribe?u=' + encodeURIComponent(p.id) + '&t=' + unsubToken(p.id);
        return {
          to: p.email,
          subject,
          html: announceHTML({ ev, name: p.name, link, unsub, origin }),
          /* Gmail などが件名の横に出す「配信停止」。一斉送信には付けるのが決まりです */
          headers: {
            'List-Unsubscribe': '<' + unsub + '>',
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
          }
        };
      }));
      sent = result.sent || 0;
    } catch (err) {
      failure = err;
      sent = Number((String(err.message).match(/\(sent (\d+)\)/) || [])[1] || 0);
    }

    /* 途中で止まっても、届いた分は記録します。もう一度押したときに
       「前に送ってある」と確認に出せるようにするためです */
    if (sent) {
      await sb('events?id=eq.' + encodeURIComponent(ev.id), {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ announced_at: new Date().toISOString(), announced_count: sent })
      }).catch(e => console.error('announce record failed:', e.message));
    }

    if (failure) {
      console.error('announce stopped:', failure.message);
      return send(res, 502, { error: 'partly_sent', sent, recipients: people.length, message: failure.message });
    }
    return send(res, 200, { sent, recipients: people.length });
  } catch (err) {
    console.error('announce failed:', err.message);
    return send(res, 500, { error: 'announce_failed', message: err.message });
  }
}

/* --- 本文 --------------------------------------------------------------- */

function longDate(date) {
  if (!date) return '';
  const d = new Date(date + 'T12:00:00Z');
  if (isNaN(d)) return date;
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function announceHTML({ ev, name, link, unsub, origin }) {
  const first = String(name || '').split(' ')[0] || 'there';
  const when  = [longDate(ev.date),
                 [ev.start_time, ev.end_time].filter(Boolean).join('–')]
                  .filter(Boolean).join(' · ');
  /* 受け取るのは会員なので、会員価格があればそれを出します */
  const price = priceFor(ev, 'free');
  const note  = price.reason === 'member' ? ' (member price)' : price.reason === 'early' ? ' (early bird)' : '';
  const image = !ev.image ? ''
    : /^https?:\/\//.test(ev.image) ? ev.image : origin + '/' + String(ev.image).replace(/^\/+/, '');

  return `
  <div style="margin:0;padding:32px 12px;background:#f2ece3;font-family:Helvetica,Arial,sans-serif">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"
           style="width:600px;max-width:100%;margin:0 auto;background:#faf7f2">
      <tr><td style="padding:30px 32px 0">
        <div style="font-size:11px;font-weight:bold;letter-spacing:2.4px;text-transform:uppercase;color:#c10e2e">
          New event</div>
        <h1 style="margin:16px 0 0;font-size:32px;line-height:1.12;color:#0e0b14">${esc(ev.title || '')}</h1>
        <p style="margin:18px 0 0;font-size:16px;line-height:1.6;color:#3a3348">
          Hi ${esc(first)}, bookings are open for our next event.</p>
      </td></tr>

      ${image ? `
      <tr><td style="padding:24px 32px 0">
        <a href="${esc(link)}"><img src="${esc(image)}" alt="${esc(ev.title || '')}" width="536"
             style="display:block;width:100%;max-width:536px;height:auto;border:0"></a>
      </td></tr>` : ''}

      <tr><td style="padding:26px 32px 0">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
               style="font-size:15px;color:#0e0b14">
          <tr><td style="padding:11px 0;border-top:1px solid #ddd5c8;width:96px;font-size:10px;
                         letter-spacing:1.8px;text-transform:uppercase;color:#7a7288">When</td>
              <td style="padding:11px 0;border-top:1px solid #ddd5c8">${esc(when)}</td></tr>
          <tr><td style="padding:11px 0;border-top:1px solid #ddd5c8;font-size:10px;
                         letter-spacing:1.8px;text-transform:uppercase;color:#7a7288">Where</td>
              <td style="padding:11px 0;border-top:1px solid #ddd5c8">${esc(ev.venue || '')}${ev.address ? ', ' + esc(ev.address) : ''}</td></tr>
          <tr><td style="padding:11px 0;border-top:1px solid #ddd5c8;border-bottom:1px solid #ddd5c8;
                         font-size:10px;letter-spacing:1.8px;text-transform:uppercase;color:#7a7288">Tickets</td>
              <td style="padding:11px 0;border-top:1px solid #ddd5c8;border-bottom:1px solid #ddd5c8">
                ${esc(priceLabel(price.cents, ev.currency || 'EUR') + note)}</td></tr>
        </table>
      </td></tr>

      <tr><td style="padding:26px 32px 0">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
          <td bgcolor="#c10e2e" style="padding:0">
            <a href="${esc(link)}"
               style="display:inline-block;padding:15px 30px;color:#fff;text-decoration:none;
                      font-size:14px;font-weight:bold">See the event and book</a>
          </td>
        </tr></table>
      </td></tr>

      <tr><td style="padding:30px 32px 34px">
        <p style="margin:0;font-size:16px;color:#3a3348">
          See you in Rotterdam,<br><strong style="color:#0e0b14">Asian Social Rotterdam</strong></p>
        <p style="margin:26px 0 0;font-size:12px;line-height:1.6;color:#9a93a6">
          You're getting this because you're a member of Asian Social Rotterdam.
          <a href="${esc(unsub)}" style="color:#9a93a6">Unsubscribe from new-event emails</a>.<br>
          Booking confirmations and tickets still arrive either way.</p>
        <p style="margin:12px 0 0;font-size:12px;color:#9a93a6">
          <a href="${esc(origin)}" style="color:#9a93a6">${esc(origin.replace(/^https?:\/\//, ''))}</a></p>
      </td></tr>
    </table>
  </div>`;
}
