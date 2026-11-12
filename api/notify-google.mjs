/* =========================================================
   POST /api/notify-google
   イベントを公開・更新したときに、Google にサイトマップを読み直してもらいます。

   なぜこの形か:
   - 以前あった「サイトマップの URL を Google に ping する」仕組みは、
     Google が 2023 年に廃止しました（いま叩いても何も起きません）。
   - いまの正式な手段は Search Console API の sitemaps.submit です。
     サイトマップ（/sitemap.xml）は毎回 DB から作っていて、新しい回も
     <lastmod> 付きで載るので、「読み直して」と伝えれば新しいページに気づきます。
   - Indexing API は求人とライブ配信のページ専用なので、使いません。

   準備（本人の作業）:
   Google Cloud でサービスアカウントを作り、その JSON キーを Vercel の
   環境変数 GOOGLE_SERVICE_ACCOUNT_JSON に入れ、Search Console の
   www.asiansocials.nl のプロパティにそのアカウントを「オーナー」で追加します。
   入っていない間は何もせず { skipped: 'not_configured' } を返します
   （公開の操作そのものは止めません）。

   呼べるのは主催者だけです。誰でも叩けると、Google の呼び出し回数を
   他人に使い切られてしまいます。
   ========================================================= */

import { createSign } from 'node:crypto';
import { send, sb, missingEnv, userFromToken, env } from './_lib.mjs';

const SITE    = 'https://www.asiansocials.nl/';
const SITEMAP = SITE + 'sitemap.xml';
const SCOPE   = 'https://www.googleapis.com/auth/webmasters';

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'method_not_allowed' });

  const missing = missingEnv('SUPABASE_URL', 'SERVICE_KEY');
  if (missing) return send(res, 500, { error: 'not_configured', missing });

  try {
    const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    const user  = await userFromToken(token);
    if (!user || !user.id) return send(res, 401, { error: 'sign_in_required' });
    const admins = await sb('admins?select=user_id&user_id=eq.' + encodeURIComponent(user.id));
    if (!admins.length) return send(res, 403, { error: 'not_an_organiser' });

    const raw = env('GOOGLE_SERVICE_ACCOUNT_JSON');
    if (!raw) return send(res, 200, { skipped: 'not_configured' });

    let key;
    try { key = JSON.parse(raw); }
    catch { return send(res, 500, { error: 'bad_service_account_json' }); }

    const access = await googleAccessToken(key);
    const url = 'https://www.googleapis.com/webmasters/v3/sites/' + encodeURIComponent(SITE) +
                '/sitemaps/' + encodeURIComponent(SITEMAP);
    const put = await fetch(url, { method: 'PUT', headers: { Authorization: 'Bearer ' + access } });
    if (!put.ok) {
      const text = await put.text().catch(() => '');
      /* 403 はたいてい「Search Console にサービスアカウントを追加していない」です */
      return send(res, 502, { error: 'google_rejected', status: put.status, message: text.slice(0, 300) });
    }
    return send(res, 200, { submitted: SITEMAP });
  } catch (err) {
    console.error('notify-google failed:', err.message);
    return send(res, 500, { error: 'notify_failed', message: err.message });
  }
}

/* サービスアカウントの鍵で署名した JWT を、アクセストークンに引き換えます。
   ライブラリを入れずに済むよう、node:crypto だけで作ります。 */
async function googleAccessToken(key) {
  const now = Math.floor(Date.now() / 1000);
  const b64 = obj => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const head = b64({ alg: 'RS256', typ: 'JWT' });
  const body = b64({
    iss: key.client_email, scope: SCOPE,
    aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 600
  });
  const signer = createSign('RSA-SHA256');
  signer.update(head + '.' + body);
  const jwt = head + '.' + body + '.' + signer.sign(key.private_key).toString('base64url');

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) throw new Error('google token: ' + (data.error_description || data.error || res.status));
  return data.access_token;
}
