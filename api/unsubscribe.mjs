/* =========================================================
   /api/unsubscribe?u=<会員ID>&t=<署名>
   新しいイベントのお知らせメールを止めます。

   GET  … 確認の画面を出すだけで、まだ止めません。
          メールソフトやウイルス対策はリンクを先に開いて中身を確かめます。
          開いただけで止まると、本人が押していないのに止まってしまいます。
   POST … 止めます。画面のボタンと、Gmail などの「配信停止」
          （List-Unsubscribe-Post）の両方がここに来ます。

   署名はサーバだけが知る鍵で作るので、他人の ID を入れても通りません。
   ========================================================= */

import { sb, missingEnv, unsubOk, env } from './_lib.mjs';

export default async function handler(req, res) {
  const url   = new URL(req.url, 'http://localhost');
  const id    = url.searchParams.get('u') || '';
  const token = url.searchParams.get('t') || '';
  const origin = (env('SITE_URL') || 'https://www.symarch-llc.com').replace(/\/+$/, '');

  const valid = !missingEnv('SUPABASE_URL', 'SERVICE_KEY')
             && /^[0-9a-f-]{36}$/i.test(id) && unsubOk(id, token);

  if (req.method === 'POST') {
    let done = false;
    if (valid) {
      try {
        await sb('profiles?id=eq.' + id, {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({ news_opt_in: false })
        });
        done = true;
      } catch (err) {
        console.error('unsubscribe failed:', err.message);
      }
    }
    return page(res, done ? 200 : 400, done ? doneHTML(origin) : badHTML(origin));
  }

  if (req.method !== 'GET') return page(res, 405, badHTML(origin));
  return page(res, valid ? 200 : 400, valid ? askHTML(url.pathname + url.search) : badHTML(origin));
}

function page(res, status, inner) {
  res.statusCode = status;
  res.setHeader('content-type', 'text/html; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.setHeader('x-robots-tag', 'noindex');
  res.end(`<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Email settings — Asian Social Rotterdam</title>
<style>
  body{margin:0;background:#faf7f2;color:#0e0b14;font:16px/1.6 Helvetica,Arial,sans-serif}
  main{max-width:520px;margin:0 auto;padding:72px 24px}
  .k{font-size:11px;font-weight:bold;letter-spacing:2.4px;text-transform:uppercase;color:#c10e2e}
  h1{font-size:28px;line-height:1.15;margin:14px 0 14px}
  p{color:#3a3348;margin:0 0 14px}
  button,.b{display:inline-block;margin-top:10px;padding:14px 26px;border:0;background:#c10e2e;color:#fff;
    font:bold 14px Helvetica,Arial,sans-serif;text-decoration:none;cursor:pointer}
  a{color:#c10e2e}
</style></head><body><main>${inner}</main></body></html>`);
}

function askHTML(action) {
  return `<p class="k">Asian Social Rotterdam</p>
    <h1>Stop new-event emails?</h1>
    <p>You won't hear from us when a new event is announced. Booking confirmations and tickets still arrive.</p>
    <form method="post" action="${action.replace(/"/g, '&quot;')}"><button type="submit">Unsubscribe</button></form>`;
}

function doneHTML(origin) {
  return `<p class="k">Asian Social Rotterdam</p>
    <h1>You're unsubscribed.</h1>
    <p>You won't get new-event emails any more. Booking confirmations and tickets still arrive.</p>
    <p>Changed your mind? You can turn them back on in <a href="${origin}/profile.html">your profile</a>.</p>`;
}

function badHTML(origin) {
  return `<p class="k">Asian Social Rotterdam</p>
    <h1>This link doesn't work.</h1>
    <p>It may be incomplete. You can turn new-event emails off in <a href="${origin}/profile.html">your profile</a>,
       or email <a href="mailto:info@sym-arch.com">info@sym-arch.com</a> and we'll do it for you.</p>`;
}
