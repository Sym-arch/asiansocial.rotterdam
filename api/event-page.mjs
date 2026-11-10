/* =========================================================
   GET /e/<イベントID>   （vercel.json で /api/event-page?id=... に書き換え）

   イベントのページを、1件ずつ固有の見出しで返します。

   これまでは全イベントが同じ <title> でした。そのため検索結果でも
   SNS のリンクプレビューでも「Event — Asian Socials」としか
   出ず、Search Console では表示16回でクリック0でした。写真も出ません。

   画面の中身はこれまでどおり event.html と event.js が描きます。
   ここでするのは <head> の差し替えと、イベントの構造化データの追加だけです。

   どこかで失敗したら、元の event.html をそのまま返します。
   ここは予約の入口なので、見出しのために真っ白にするわけにはいきません。
   ========================================================= */

import { readFile } from 'node:fs/promises';
import { sb } from './_lib.mjs';

const SITE = 'https://www.asiansocials.nl';
const TZ = 'Europe/Amsterdam';
const DEFAULT_IMAGE = SITE + '/assets/og-image.jpg';

export default async function handler(req, res) {
  const origin = originOf(req);
  let shell;

  try {
    shell = await loadShell(origin);
  } catch (err) {
    /* 土台が読めないときは、静的ファイルに任せます */
    console.error('event shell unavailable:', err.message);
    res.statusCode = 302;
    res.setHeader('location', '/event.html' + (req.url.includes('id=') ? '?' + req.url.split('?')[1] : ''));
    return res.end();
  }

  try {
    const id = String(new URL(req.url, SITE).searchParams.get('id') || '').trim();
    if (!id) return html(res, shell, 200);

    const rows = await sb('events?select=*&id=eq.' + encodeURIComponent(id));
    const ev = rows && rows[0];
    if (!ev) return html(res, shell, 404);

    return html(res, decorate(shell, ev, origin), 200);
  } catch (err) {
    console.error('event page failed:', err.message);
    return html(res, shell, 200);
  }
}

/* --- 土台の HTML ---------------------------------------------------------
   まず同じ配置に入っているファイルを読み、だめなら自分のサイトから取りに
   行きます。/event.html は（id が付いていなければ）静的なまま配信されます。 */
async function loadShell(origin) {
  try {
    return await readFile(process.cwd() + '/event.html', 'utf8');
  } catch {
    const res = await fetch(origin + '/event.html');
    if (!res.ok) throw new Error('shell fetch ' + res.status);
    return res.text();
  }
}

function originOf(req) {
  const proto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0];
  const host  = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0];
  return host ? proto + '://' + host : SITE;
}

function html(res, body, status) {
  res.statusCode = status || 200;
  res.setHeader('content-type', 'text/html; charset=utf-8');
  /* 数分だけ配信側に持たせます。イベントを直したら、すぐ新しいものが出ます */
  res.setHeader('cache-control', 'public, s-maxage=300, stale-while-revalidate=3600');
  res.end(body);
}

/* --- 見出しの差し替え --------------------------------------------------- */

function decorate(shell, ev, origin) {
  const url   = origin + '/e/' + encodeURIComponent(ev.id);
  const when  = longDate(ev.date);
  const time  = [ev.start_time, ev.end_time].filter(Boolean).join('–');
  const image = absUrl(ev.image, origin) || DEFAULT_IMAGE;

  /* イベント名と日付が主役です。ブランド名は入りきるときだけ足します
     （足りないまま切ると「| Asian Soci…」のような見苦しい形で終わります）。 */
  const base  = `${ev.title} — ${when}`;
  const title = base.length + 24 <= 110 ? `${base} | Asian Socials` : cut(base, 110);
  const desc  = cut([
    [when, time].filter(Boolean).join(' '),
    [ev.venue, 'Rotterdam'].filter(Boolean).join(', '),
    priceLabel(ev)
  ].filter(Boolean).join(' · ') + '. ' + firstLine(ev.description), 180);

  const head = [
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(desc)}">`,
    `<link rel="canonical" href="${esc(url)}">`,
    `<meta property="og:title" content="${esc(title)}">`,
    `<meta property="og:description" content="${esc(desc)}">`,
    `<meta property="og:url" content="${esc(url)}">`,
    `<meta name="twitter:title" content="${esc(title)}">`,
    `<meta name="twitter:description" content="${esc(desc)}">`,
    `<script type="application/ld+json">${jsonLd(ev, url, image)}</script>`
  ].join('\n');

  /* /e/<id> は1階層深いので、HTML 内の相対パス（core.js、styles.css、
     index.html など）がそのままだと /e/ の下を指して全部 404 になります。
     基準をサイトの root に戻します。これを外すと画面が真っ白になります。 */
  return shell
    .replace('<meta charset="utf-8">', '<meta charset="utf-8"><base href="/">')
    .replace('<title>Event — Asian Socials</title>', head)
    .replace('<meta name="description" content="Event details and RSVP — Asian Socials.">', '')
    .replace(`<meta property="og:image" content="${DEFAULT_IMAGE}">`,
             `<meta property="og:image" content="${esc(image)}">`);
}

/* 検索結果に日付・会場・料金を出すための印です（Google のイベント表示） */
function jsonLd(ev, url, image) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: ev.title,
    startDate: stamp(ev.date, ev.start_time || '19:00'),
    endDate: ev.end_time ? stamp(ev.date, ev.end_time) : undefined,
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    image: [image],
    description: cut(firstLine(ev.description) || ev.title, 500),
    url,
    location: {
      '@type': 'Place',
      name: ev.venue || 'Rotterdam',
      address: {
        '@type': 'PostalAddress',
        streetAddress: ev.address || undefined,
        addressLocality: 'Rotterdam',
        addressCountry: 'NL'
      }
    },
    organizer: { '@type': 'Organization', name: 'Asian Socials', url: SITE },
    /* Search Console が「performer がありません」と出していた箇所です。
       音楽の出演者はいませんが、その晩を主催して進めるのは私たちなので、
       主催団体をそのまま出演者として書きます。 */
    performer: { '@type': 'Organization', name: 'Asian Socials', url: SITE },
    offers: {
      '@type': 'Offer',
      price: ((ev.price_cents || 0) / 100).toFixed(2),
      priceCurrency: ev.currency || 'EUR',
      url,
      availability: 'https://schema.org/InStock',
      /* 同じく「validFrom がありません」の箇所です。
         申し込みを受け付け始めた日＝イベントを公開した日です。
         記録が無い回は、当日より前であることだけは確かなので開始時刻を使います。 */
      validFrom: saleStart(ev)
    }
  };
  /* </script> を含む文字が混ざると、そこで印が切れてしまいます */
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

/**
 * 申し込みを受け付け始めた日時を ISO 8601 で返します。
 * events.created_at（公開した時刻）を使い、読めない回だけ開始時刻に寄せます。
 * 開始より後になることは無いので、Google に矛盾した組み合わせを渡しません。
 */
function saleStart(ev) {
  const start = stamp(ev.date, ev.start_time || '19:00');
  const made = Date.parse(ev.created_at || '');
  if (isNaN(made)) return start;
  const begins = Date.parse(start);
  if (!isNaN(begins) && made > begins) return start;
  return new Date(made).toISOString();
}

/* --- 日付と文字 --------------------------------------------------------- */

function longDate(date) {
  if (!date) return '';
  const d = new Date(date + 'T12:00:00Z');
  if (isNaN(d)) return date;
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

/** 2026-10-01 + 19:00 → 2026-10-01T19:00:00+02:00（夏時間も合わせます） */
function stamp(date, time) {
  const hhmm = String(time || '19:00').slice(0, 5);
  let offset = '+01:00';
  try {
    const d = new Date(`${date}T${hhmm}:00Z`);
    const name = new Intl.DateTimeFormat('en-US', { timeZone: TZ, timeZoneName: 'longOffset' })
      .formatToParts(d).find(p => p.type === 'timeZoneName');
    if (name && name.value.startsWith('GMT') && name.value.length > 3) offset = name.value.slice(3);
  } catch { /* 取れなければ冬時間で出します */ }
  return `${date}T${hhmm}:00${offset}`;
}

function priceLabel(ev) {
  const cents = ev.price_cents || 0;
  if (cents <= 0) return 'Free';
  const sign = { EUR: '€', USD: '$', GBP: '£' }[ev.currency || 'EUR'] || '';
  return sign + (cents / 100).toFixed(2).replace(/\.00$/, '');
}

function firstLine(text) {
  return String(text || '').split('\n').map(s => s.trim()).filter(Boolean)[0] || '';
}

function cut(s, max) {
  const v = String(s || '').replace(/\s+/g, ' ').trim();
  return v.length > max ? v.slice(0, max - 1).trimEnd() + '…' : v;
}

function absUrl(src, origin) {
  const v = String(src || '').trim();
  if (!v) return '';
  if (/^https?:\/\//i.test(v)) return v;
  return origin + '/' + v.replace(/^\/+/, '');
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
