/* =========================================================
   POST /api/organiser   { email, note }
   主催者を招きます。

   相手に先に会員登録してもらう必要はありません。
   ここでアカウントを用意し、本人がパスワードを決めるリンクを送ります。
   こちらが相手のパスワードを作って渡す形にはしません。
   人づてに渡ったパスワードは、たいてい変えられないまま残ります。

   すでにアカウントがある人なら、そのアカウントに権限を足すだけです。
   その場合は「パスワードを設定し直す」リンクを送ります。

   宛先はブラウザから受け取りますが、呼べるのは主催者だけです。
   ========================================================= */

import {
  send, sb, missingEnv, userFromToken, readJson, sendMail, env,
  SUPABASE_URL, SERVICE_KEY
} from './_lib.mjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'method_not_allowed' });

  const missing = missingEnv('SUPABASE_URL', 'SERVICE_KEY', 'RESEND_KEY');
  if (missing) return send(res, 500, { error: 'not_configured', missing });

  let body;
  try { body = await readJson(req); }
  catch { return send(res, 400, { error: 'bad_request' }); }

  const email = String(body.email || '').trim().toLowerCase();
  const note  = String(body.note || '').trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return send(res, 400, { error: 'bad_email' });

  try {
    /* --- 呼んでいるのは主催者か -------------------------------------- */
    const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    const user  = await userFromToken(token);
    if (!user || !user.id) return send(res, 401, { error: 'sign_in_required' });

    /* 主催者どうしが対等だと、招いた相手が招いた人を外せます。
       「運営する人」と「運営する人を決める人」を分けています。 */
    const admins = await sb('admins?select=user_id,role&user_id=eq.' + encodeURIComponent(user.id));
    if (!admins.length) return send(res, 403, { error: 'not_an_organiser' });
    if (admins[0].role !== 'owner') return send(res, 403, { error: 'owner_only' });

    /* --- 相手のアカウントを用意して、設定リンクを作ります -------------
       invite は「まだ居ない人」を作ってリンクを返します。
       すでに居る人には recovery（設定し直し）のリンクを作ります。 */
    const origin = env('SITE_URL') || siteOrigin(req);
    const target = origin + '/reset.html';

    let link = '', existed = false;
    try {
      link = await generateLink('invite', email, target);
    } catch (err) {
      if (!/already|exists|registered/i.test(err.message)) throw err;
      existed = true;
      link = await generateLink('recovery', email, target);
    }

    /* --- 権限を足します ---------------------------------------------- */
    const uid = await userIdByEmail(email);
    if (!uid) return send(res, 500, { error: 'no_user_id' });

    await sb('admins', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ user_id: uid, note: note || null })
    });

    /* --- 案内を送ります ---------------------------------------------- */
    await sendMail({
      to: email,
      subject: 'You can now manage Asian Social Rotterdam',
      html: inviteHTML({ link, existed, origin })
    });

    return send(res, 200, { ok: true, existed, user_id: uid });
  } catch (err) {
    console.error('organiser invite failed:', err.message);
    return send(res, 500, { error: 'invite_failed', message: err.message });
  }
}

function siteOrigin(req) {
  const proto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0];
  const host  = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0];
  return proto + '://' + host;
}

/** GoTrue の管理APIでリンクだけ作ります（メールは自分たちで送ります）。 */
async function generateLink(type, email, redirectTo) {
  const base = String(SUPABASE_URL).replace(/\/+$/, '');
  const key  = SERVICE_KEY;
  const res = await fetch(base + '/auth/v1/admin/generate_link', {
    method: 'POST',
    headers: { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, email, redirect_to: redirectTo })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.msg || data.error_description || data.error || ('generate_link ' + res.status));
  const link = data.action_link || (data.properties && data.properties.action_link);
  if (!link) throw new Error('no action_link');
  return link;
}

async function userIdByEmail(email) {
  const base = String(SUPABASE_URL).replace(/\/+$/, '');
  const key  = SERVICE_KEY;
  const res = await fetch(base + '/auth/v1/admin/users?page=1&per_page=200', {
    headers: { apikey: key, Authorization: 'Bearer ' + key }
  });
  if (!res.ok) return '';
  const data = await res.json().catch(() => ({}));
  const list = data.users || data || [];
  const hit = list.find(u => String(u.email || '').toLowerCase() === email);
  return hit ? hit.id : '';
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function inviteHTML({ link, existed, origin }) {
  return `
  <div style="margin:0;padding:32px 12px;background:#f2ece3;font-family:Helvetica,Arial,sans-serif">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"
           style="width:600px;max-width:100%;margin:0 auto;background:#faf7f2">
      <tr><td style="padding:30px 32px 0">
        <div style="font-size:11px;font-weight:bold;letter-spacing:2.4px;text-transform:uppercase;color:#c10e2e">
          Organiser access</div>
        <h1 style="margin:16px 0 0;font-size:32px;line-height:1.1;color:#0e0b14">
          You can now manage the site.</h1>
        <p style="margin:18px 0 0;font-size:16px;line-height:1.6;color:#3a3348">
          ${existed
            ? 'Your existing account at Asian Social Rotterdam is now an organiser account. Use the button below if you need to set a new password.'
            : 'An organiser account has been created for you at Asian Social Rotterdam. Set your password to get started.'}
        </p>
      </td></tr>

      <tr><td style="padding:26px 32px 0">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
          <td bgcolor="#c10e2e" style="padding:0">
            <a href="${link}" style="display:inline-block;padding:15px 30px;color:#fff;
                      text-decoration:none;font-size:14px;font-weight:bold">Set your password</a>
          </td>
        </tr></table>
        <p style="margin:14px 0 0;font-size:13px;color:#7a7288">
          This link works once and expires. If it has expired, go to
          <a href="${origin}/profile.html" style="color:#7a7288">${esc(String(origin).replace(/^https?:\/\//, ''))}/profile.html</a>
          and use “Forgot your password?”.</p>
      </td></tr>

      <tr><td style="padding:26px 32px 0">
        <p style="margin:0;font-size:15px;line-height:1.7;color:#3a3348">
          As an organiser you can create events, read the booking list, send reminders and
          run the door check-in. The Admin button appears in the header once you are signed in.</p>
      </td></tr>

      <tr><td style="padding:26px 32px 34px">
        <p style="margin:0;font-size:16px;color:#3a3348">
          See you in Rotterdam,<br><strong style="color:#0e0b14">Asian Social Rotterdam</strong></p>
        <p style="margin:18px 0 0;font-size:12px;color:#9a93a6">
          If you were not expecting this, you can ignore this email — nothing changes until
          you set a password.</p>
      </td></tr>
    </table>
  </div>`;
}
