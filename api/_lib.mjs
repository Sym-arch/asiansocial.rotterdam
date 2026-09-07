/* =========================================================
   api/ 共通の部品

   ここはブラウザではなく Vercel のサーバー側で動きます。
   決済の秘密鍵と Supabase の service_role キーは、ここにしかありません。

   npm の Stripe SDK は入れていません。REST を直接叩けば依存がゼロになり、
   ビルドもバージョン追従も不要になるためです。
   ========================================================= */

/** 環境変数の名前は人によって違うので、よくある候補を順に見ます。 */
export function env(...names) {
  for (const n of names) {
    if (process.env[n]) return process.env[n];
  }
  return '';
}

export const SUPABASE_URL = env('SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'VITE_SUPABASE_URL');
export const SERVICE_KEY  = env('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_KEY');
export const ANON_KEY     = env('SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY');
export const STRIPE_KEY   = env('STRIPE_SECRET_KEY');
export const RESEND_KEY   = env('RESEND_API_KEY');

export const FROM_EMAIL   = env('MAIL_FROM')     || 'Asian Social Rotterdam <noreply@symarch-llc.com>';
export const REPLY_TO     = env('MAIL_REPLY_TO') || 'info@sym-arch.com';

/* Vercel の Node ランタイムは (req, res) 形のハンドラを期待します。
   Web の Response を返す形にすると、呼ばれても応答せず固まります。 */
export function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(body));
}

/** 本文をそのまま読みます。webhook の署名は生の本文に対して計算されるため。 */
export function readRaw(req) {
  if (typeof req.body === 'string') return Promise.resolve(req.body);
  if (req.body && Buffer.isBuffer(req.body)) return Promise.resolve(req.body.toString('utf8'));
  return new Promise((resolve, reject) => {
    let data = '';
    req.setEncoding('utf8');
    req.on('data', c => { data += c; });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

export async function readJson(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
  const raw = await readRaw(req);
  return raw ? JSON.parse(raw) : {};
}

/** 設定漏れは起動時に気づきたいので、足りないものを名指しで返します。 */
export function missingEnv(...required) {
  const map = { SUPABASE_URL, SERVICE_KEY, STRIPE_KEY, RESEND_KEY };
  const missing = required.filter(k => !map[k]);
  return missing.length ? missing : null;
}

/* --- Supabase（service_role。RLS を迂回するのでサーバー側だけ） --------- */

export async function sb(path, init = {}) {
  const res = await fetch(SUPABASE_URL.replace(/\/+$/, '') + '/rest/v1/' + path, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: 'Bearer ' + SERVICE_KEY,
      'Content-Type': 'application/json',
      ...(init.headers || {})
    }
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error('supabase ' + path + ' → ' + res.status + ' ' + detail.slice(0, 200));
  }
  return res.status === 204 ? null : res.json();
}

/** ブラウザから届いたトークンが本物か、Supabase に確かめます。 */
export async function userFromToken(token) {
  if (!token) return null;
  const res = await fetch(SUPABASE_URL.replace(/\/+$/, '') + '/auth/v1/user', {
    headers: { apikey: ANON_KEY || SERVICE_KEY, Authorization: 'Bearer ' + token }
  });
  if (!res.ok) return null;
  return res.json();
}

/* --- 価格 ---------------------------------------------------------------
   client の core.js と同じ規則です。ただし採用するのは常にこちらの結果で、
   ブラウザから届いた金額は一切信用しません。
   金額をブラウザから受け取ると、誰でも1セントに書き換えられます。 */

export function earlyBirdActive(ev) {
  if (!ev || !ev.early_bird || !ev.early_bird_until) return false;
  const [y, m, d] = String(ev.early_bird_until).split('-').map(Number);
  return Date.now() <= Date.UTC(y, (m || 1) - 1, d || 1, 23, 59, 59);
}

/** @returns {{cents:number, reason:string}} */
export function priceFor(ev, tier) {
  const base = ev.price_cents || 0;
  const options = [{ cents: base, reason: '' }];

  if (ev.member_discount && ev.price_member_cents != null && tier !== 'guest') {
    options.push({ cents: ev.price_member_cents, reason: 'member' });
  }
  if (earlyBirdActive(ev) && ev.price_early_cents != null) {
    options.push({ cents: ev.price_early_cents, reason: 'early' });
  }
  /* 割引が重なったら一番安いものを採ります。会員なのに高い、が起きないため */
  const best = options.reduce((a, b) => (b.cents < a.cents ? b : a));
  return { cents: best.cents, reason: best.cents < base ? best.reason : '' };
}

/* --- Stripe（REST を直接） ---------------------------------------------- */

/** ネストしたオブジェクトを Stripe の form 形式に落とします。 */
export function toForm(obj, prefix = '', out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === 'object' && !Array.isArray(v)) toForm(v, key, out);
    else if (Array.isArray(v)) v.forEach((item, i) => {
      if (typeof item === 'object') toForm(item, `${key}[${i}]`, out);
      else out.append(`${key}[${i}]`, String(item));
    });
    else out.append(key, String(v));
  }
  return out;
}

export async function stripe(path, body, method = 'POST') {
  const res = await fetch('https://api.stripe.com/v1/' + path, {
    method,
    headers: {
      Authorization: 'Bearer ' + STRIPE_KEY,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: body ? toForm(body).toString() : undefined
  });
  const data = await res.json();
  if (!res.ok) throw new Error('stripe ' + path + ' → ' + (data.error && data.error.message || res.status));
  return data;
}

/* --- Webhook の署名確認 -------------------------------------------------
   これを省くと、誰でも「支払われた」という偽の通知を送れます。
   Web Crypto だけで書けるので、SDK は要りません。 */

export async function verifyStripeSignature(rawBody, header, secret, toleranceSec = 300) {
  if (!header) return false;
  const parts = Object.fromEntries(
    header.split(',').map(p => p.split('=').map(x => x.trim()))
  );
  const ts = Number(parts.t);
  if (!ts || !parts.v1) return false;
  /* 古い通知の使い回しを防ぎます */
  if (Math.abs(Date.now() / 1000 - ts) > toleranceSec) return false;

  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const mac = await crypto.subtle.sign(
    'HMAC', key, new TextEncoder().encode(ts + '.' + rawBody)
  );
  const expected = [...new Uint8Array(mac)].map(b => b.toString(16).padStart(2, '0')).join('');

  /* 長さで早期に抜けず、全桁を比較します（タイミングで漏らさないため） */
  if (expected.length !== parts.v1.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ parts.v1.charCodeAt(i);
  return diff === 0;
}

/* --- メール ------------------------------------------------------------- */

export async function sendMail({ to, subject, html, replyTo }) {
  if (!RESEND_KEY) return { skipped: 'no RESEND_API_KEY' };
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + RESEND_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [to],
      bcc: [REPLY_TO],
      reply_to: replyTo || REPLY_TO,
      subject,
      html
    })
  });
  if (!res.ok) throw new Error('resend → ' + res.status + ' ' + (await res.text()).slice(0, 200));
  return res.json();
}

export const randomHex = (bytes = 24) => {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return [...a].map(b => b.toString(16).padStart(2, '0')).join('');
};

export const priceLabel = (cents, currency = 'EUR') => {
  const n = Number(cents) || 0;
  if (n <= 0) return 'Free';
  const sign = { EUR: '€', USD: '$', GBP: '£' }[currency] || currency + ' ';
  return sign + (n / 100).toFixed(2).replace(/\.00$/, '');
};
