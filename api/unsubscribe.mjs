/* =========================================================
   GET /api/unsubscribe?u=<user_id>&s=<signature>
   会員への案内メール（/api/newsletter）の配信停止リンクの行き先。

   サインインは求めません。メールを開いた本人がそのまま押せるように
   するためです。その代わり、署名（signUserToken）が合っていないと
   効きません。他人の u を書き換えても止められないようにするためです。

   予約の確認メールや開催前の案内（reminder.mjs）はここでは止まりません。
   それらは予約そのものに必要な連絡なので、別の仕組みです。
   ========================================================= */

import { send, sb, missingEnv, verifyUserToken } from './_lib.mjs';

export default async function handler(req, res) {
  const missing = missingEnv('SUPABASE_URL', 'SERVICE_KEY');
  if (missing) return html(res, 500, page('Not set up yet.', 'Please try again later.'));

  const u = String(new URL(req.url, 'https://x').searchParams.get('u') || '').trim();
  const s = String(new URL(req.url, 'https://x').searchParams.get('s') || '').trim();
  if (!u || !s || !(await verifyUserToken(u, s))) {
    return html(res, 400, page('This link isn’t valid.', 'It may have been copied incorrectly. You can also update this from your profile once signed in.'));
  }

  try {
    await sb('profiles?id=eq.' + encodeURIComponent(u), {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ marketing_opt_out: true })
    });
    return html(res, 200, page('You’re unsubscribed.', 'You won’t get event announcement emails any more. You’ll still receive booking confirmations and reminders for events you’ve booked.'));
  } catch (err) {
    console.error('unsubscribe failed:', err.message);
    return html(res, 500, page('Something went wrong.', 'Please try again, or email info@asiansocials.nl.'));
  }
}

function html(res, status, body) {
  res.statusCode = status;
  res.setHeader('content-type', 'text/html; charset=utf-8');
  res.end(body);
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function page(title, body) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>${esc(title)} — Asian Socials</title>
<style>
  body{margin:0;background:#faf7f2;color:#0e0b14;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
  .wrap{max-width:460px;margin:0 auto;padding:72px 24px}
  h1{font-size:1.6rem;margin:0 0 14px}
  p{color:#6b6478;line-height:1.6;margin:0 0 24px}
  a{color:#c10e2e;font-weight:600;text-decoration:none}
</style></head>
<body><div class="wrap">
  <h1>${esc(title)}</h1>
  <p>${esc(body)}</p>
  <a href="/">← Back to asiansocials.nl</a>
</div></body></html>`;
}
