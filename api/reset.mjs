/* =========================================================
   POST /api/reset   { email }
   パスワード再設定のリンクを送ります。

   なぜ自前で送るのか:
     Supabase の SMTP 経由（/auth/v1/recover）が
     "Error sending recovery email" で落ちており、メールが
     一通も出ていませんでした。設定が壊れると、こちらからは
     直せず、利用者にも何も届きません。

     予約の確認メールはすでに Resend で送れています。
     同じ経路に寄せれば、動いている道が一本になります。
     文面もこちらで作れます。

   誰でも呼べます（パスワードを忘れた人は当然サインインできません）。
   返す内容は常に同じで、そのアドレスが登録済みかどうかは答えません。
   ここで答えると、総当たりで会員名簿を作られます。
   ========================================================= */

import {
  send, missingEnv, readJson, sendMail, env, SUPABASE_URL, SERVICE_KEY
} from './_lib.mjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'method_not_allowed' });

  const missing = missingEnv('SUPABASE_URL', 'SERVICE_KEY', 'RESEND_KEY');
  if (missing) return send(res, 500, { error: 'not_configured', missing });

  let body;
  try { body = await readJson(req); }
  catch { return send(res, 400, { error: 'bad_request' }); }

  const email = String(body.email || '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return send(res, 400, { error: 'bad_email' });

  const origin = env('SITE_URL') || siteOrigin(req);

  try {
    const link = await generateLink('recovery', email, origin + '/reset.html');
    await sendMail({
      to: email,
      subject: 'Set a new password — Asian Social Rotterdam',
      html: resetHTML({ link, origin })
    });
    return send(res, 200, { ok: true });
  } catch (err) {
    /* アカウントが無い場合もここに来ます。理由は返しません */
    if (/user not found|not found|no user/i.test(err.message)) {
      return send(res, 200, { ok: true });
    }
    console.error('reset link failed:', err.message);
    return send(res, 500, { error: 'send_failed', message: err.message });
  }
}

function siteOrigin(req) {
  const proto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0];
  const host  = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0];
  return proto + '://' + host;
}

async function generateLink(type, email, redirectTo) {
  const base = String(SUPABASE_URL).replace(/\/+$/, '');
  const res = await fetch(base + '/auth/v1/admin/generate_link', {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: 'Bearer ' + SERVICE_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ type, email, redirect_to: redirectTo })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.msg || data.error_description || data.error || ('generate_link ' + res.status));
  const link = data.action_link || (data.properties && data.properties.action_link);
  if (!link) throw new Error('no action_link');
  return link;
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function resetHTML({ link, origin }) {
  return `
  <div style="margin:0;padding:32px 12px;background:#f2ece3;font-family:Helvetica,Arial,sans-serif">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"
           style="width:600px;max-width:100%;margin:0 auto;background:#faf7f2">
      <tr><td style="padding:30px 32px 0">
        <div style="font-size:11px;font-weight:bold;letter-spacing:2.4px;text-transform:uppercase;color:#c10e2e">
          Password</div>
        <h1 style="margin:16px 0 0;font-size:32px;line-height:1.1;color:#0e0b14">
          Set a new password.</h1>
        <p style="margin:18px 0 0;font-size:16px;line-height:1.6;color:#3a3348">
          Someone asked to reset the password for this email at Asian Social Rotterdam.
          Use the button below to choose a new one.</p>
      </td></tr>

      <tr><td style="padding:26px 32px 0">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
          <td bgcolor="#c10e2e" style="padding:0">
            <a href="${link}" style="display:inline-block;padding:15px 30px;color:#fff;
                      text-decoration:none;font-size:14px;font-weight:bold">Set a new password</a>
          </td>
        </tr></table>
      </td></tr>

      <tr><td style="padding:26px 32px 34px">
        <p style="margin:0;font-size:16px;color:#3a3348">
          See you in Rotterdam,<br><strong style="color:#0e0b14">Asian Social Rotterdam</strong></p>
        <p style="margin:18px 0 0;font-size:12px;color:#9a93a6">
          If this was not you, you can ignore this email — your password stays as it is.
          <br><a href="${origin}" style="color:#9a93a6">${esc(String(origin).replace(/^https?:\/\//, ''))}</a></p>
      </td></tr>
    </table>
  </div>`;
}
