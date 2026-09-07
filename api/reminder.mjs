/* =========================================================
   POST /api/reminder   { eventId }
   そのイベントを予約した人へ、開催前の案内を送ります。

   これまでは Gmail の下書きを開く方式でした。下書きは本文が
   ただの文字なので、カレンダーの登録先を長い URL のまま貼るしか
   なく、読みづらいものになっていました。ここから送れば、
   確認メールと同じ体裁でボタンとして置けます。

   宛先はサーバ側で名簿から作ります。ブラウザから宛先を受け取ると、
   管理画面を開けた人が任意の相手へ当団体名で送れてしまいます。

   一人ずつ別便で送ります。BCC でまとめると、返信や転送のときに
   他の参加者のアドレスが見えることがあります。
   ========================================================= */

import {
  send, sb, missingEnv, userFromToken, readJson,
  priceFor, priceLabel, sendMailBatch, env
} from './_lib.mjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'method_not_allowed' });

  const missing = missingEnv('SUPABASE_URL', 'SERVICE_KEY', 'RESEND_KEY');
  if (missing) return send(res, 500, { error: 'not_configured', missing });

  let body;
  try { body = await readJson(req); }
  catch { return send(res, 400, { error: 'bad_request' }); }

  const eventId = String(body.eventId || '');
  if (!eventId) return send(res, 400, { error: 'missing_event' });

  try {
    /* --- 主催者本人か ---------------------------------------------------- */
    const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    const user  = await userFromToken(token);
    if (!user || !user.id) return send(res, 401, { error: 'sign_in_required' });

    const admins = await sb('admins?select=user_id&user_id=eq.' + encodeURIComponent(user.id));
    if (!admins.length) return send(res, 403, { error: 'not_an_organiser' });

    /* --- 何を、誰に ------------------------------------------------------ */
    const events = await sb('events?select=*&id=eq.' + encodeURIComponent(eventId));
    const ev = events[0];
    if (!ev) return send(res, 404, { error: 'event_not_found' });

    const rows = await sb(
      'rsvps?select=name,email,guests&event_id=eq.' + encodeURIComponent(eventId)
    );

    /* 同じ人が二度予約していても、届くのは1通です */
    const byEmail = new Map();
    for (const r of rows) {
      const key = String(r.email || '').trim().toLowerCase();
      if (!key || !key.includes('@')) continue;
      if (!byEmail.has(key)) byEmail.set(key, { email: r.email.trim(), name: r.name || '' });
    }
    const people = [...byEmail.values()];
    if (!people.length) return send(res, 200, { sent: 0, recipients: 0 });

    /* --- 送る ------------------------------------------------------------ */
    const origin   = env('SITE_URL') || 'https://www.symarch-llc.com';
    const calendar = googleCalendarUrl(ev, origin);
    const subject  = 'Reminder: ' + (ev.title || 'our next meetup') + ' — ' + longDate(ev.date);

    const result = await sendMailBatch(people.map(p => ({
      to: p.email,
      subject,
      html: reminderHTML({ ev, name: p.name, calendar, origin })
    })));

    return send(res, 200, { sent: result.sent || people.length, recipients: people.length });
  } catch (err) {
    console.error('reminder failed:', err.message);
    return send(res, 500, { error: 'reminder_failed', message: err.message });
  }
}

/* --- 日付まわり ---------------------------------------------------------
   イベントの時刻は現地の壁掛け時計の時刻です。ctz を付けて渡せば
   Google 側が解釈してくれるので、こちらで時差を計算しません。 */

const TZ = 'Europe/Amsterdam';

function longDate(date) {
  if (!date) return '';
  const d = new Date(date + 'T12:00:00Z');
  if (isNaN(d)) return date;
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
}

function plusTwoHours(hm) {
  const [h, m] = String(hm || '19:00').split(':').map(Number);
  return String((h + 2) % 24).padStart(2, '0') + ':' + String(m || 0).padStart(2, '0');
}

function stamp(date, hm) {
  return String(date).replace(/-/g, '') + 'T' + String(hm).replace(':', '') + '00';
}

function googleCalendarUrl(ev, origin) {
  const start = ev.start_time || '19:00';
  const end   = ev.end_time || plusTwoHours(start);
  const price = priceFor(ev, 'guest');
  const p = new URLSearchParams({
    action: 'TEMPLATE',
    text: (ev.title || '') + ' | Asian Social Rotterdam',
    dates: stamp(ev.date, start) + '/' + stamp(ev.date, end),
    ctz: TZ,
    details: [
      ev.description || '',
      '',
      'Venue: ' + (ev.venue || ''),
      ev.address ? 'Address: ' + ev.address : '',
      'Price: ' + priceLabel(price.cents, ev.currency || 'EUR'),
      '',
      'Hosted by Asian Social Rotterdam · info@sym-arch.com'
    ].filter(Boolean).join('\n'),
    location: [ev.venue, ev.address].filter(Boolean).join(', '),
    sprop: 'website:' + origin
  });
  return 'https://calendar.google.com/calendar/render?' + p.toString();
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function reminderHTML({ ev, name, calendar, origin }) {
  const first = String(name || '').split(' ')[0] || 'there';
  const when  = [longDate(ev.date),
                 [ev.start_time, ev.end_time].filter(Boolean).join('–')]
                  .filter(Boolean).join(' · ');
  const price = priceFor(ev, 'guest');

  return `
  <div style="margin:0;padding:32px 12px;background:#f2ece3;font-family:Helvetica,Arial,sans-serif">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"
           style="width:600px;max-width:100%;margin:0 auto;background:#faf7f2">
      <tr><td style="padding:30px 32px 0">
        <div style="font-size:11px;font-weight:bold;letter-spacing:2.4px;text-transform:uppercase;color:#c10e2e">
          Coming up</div>
        <h1 style="margin:16px 0 0;font-size:34px;line-height:1.1;color:#0e0b14">See you soon, ${esc(first)}.</h1>
        <p style="margin:18px 0 0;font-size:16px;line-height:1.6;color:#3a3348">
          Just a quick reminder about ${esc(ev.title || 'our next meetup')}.</p>
      </td></tr>

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
                ${esc(priceLabel(price.cents, ev.currency || 'EUR'))}</td></tr>
        </table>
      </td></tr>

      <tr><td style="padding:26px 32px 0">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
          <td bgcolor="#c10e2e" style="padding:0">
            <a href="${calendar}"
               style="display:inline-block;padding:15px 30px;color:#fff;text-decoration:none;
                      font-size:14px;font-weight:bold">Add to Google Calendar</a>
          </td>
        </tr></table>
      </td></tr>

      <tr><td style="padding:30px 32px 34px">
        <p style="margin:0;font-size:16px;line-height:1.6;color:#3a3348">
          Can't make it any more? Just reply to this email so we can free up your spot.</p>
        <p style="margin:22px 0 0;font-size:16px;color:#3a3348">
          See you in Rotterdam,<br><strong style="color:#0e0b14">Asian Social Rotterdam</strong></p>
        <p style="margin:20px 0 0;font-size:12px;color:#9a93a6">
          <a href="${origin}" style="color:#9a93a6">${esc(String(origin).replace(/^https?:\/\//, ''))}</a></p>
      </td></tr>
    </table>
  </div>`;
}
