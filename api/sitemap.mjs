/* =========================================================
   GET /sitemap.xml   （vercel.json で /api/sitemap に書き換え）

   固定ページに加えて、公開中のイベントを毎回 DB から並べます。

   以前は静的ファイルで、固定ページ4件しか載っていませんでした。
   イベントのページこそ検索で見つかってほしいものなので、
   イベントを作るたびに手で足す運用にならないよう、ここで作ります。

   読めなかったときは固定ページだけを返します。
   サイトマップが一時的に短いのは、500 を返すより害がありません。
   ========================================================= */

import { sb } from './_lib.mjs';

const SITE = 'https://www.asiansocials.nl';

/* 本人だけのページ（profile / ticket / booked / reset / checkin）は載せません */
const PAGES = [
  { loc: '/',            changefreq: 'weekly',  priority: '1.0' },
  { loc: '/events.html', changefreq: 'weekly',  priority: '0.9' },
  { loc: '/about.html',  changefreq: 'monthly', priority: '0.7' },
  { loc: '/policy.html', changefreq: 'yearly',  priority: '0.3' }
];

export default async function handler(req, res) {
  const urls = PAGES.map(p => ({ loc: SITE + p.loc, changefreq: p.changefreq, priority: p.priority }));

  try {
    const events = await sb('events?select=id,date,created_at&order=date.desc');
    for (const ev of events || []) {
      urls.push({
        loc: SITE + '/e/' + encodeURIComponent(ev.id),
        /* Google は <lastmod> が正確なら使います。新しい回に早く気づいてもらうためです */
        lastmod: String(ev.created_at || '').slice(0, 10),
        /* 終わった回も残します。過去の回も検索から見つかってよいためです */
        changefreq: isPast(ev.date) ? 'monthly' : 'daily',
        priority: isPast(ev.date) ? '0.4' : '0.8'
      });
    }
  } catch (err) {
    console.error('sitemap events failed:', err.message);
  }

  const xml = '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.map(u =>
      '  <url>\n' +
      '    <loc>' + esc(u.loc) + '</loc>\n' +
      (u.lastmod ? '    <lastmod>' + esc(u.lastmod) + '</lastmod>\n' : '') +
      '    <changefreq>' + u.changefreq + '</changefreq>\n' +
      '    <priority>' + u.priority + '</priority>\n' +
      '  </url>'
    ).join('\n') + '\n</urlset>\n';

  res.statusCode = 200;
  res.setHeader('content-type', 'application/xml; charset=utf-8');
  res.setHeader('cache-control', 'public, s-maxage=3600, stale-while-revalidate=86400');
  res.end(xml);
}

function isPast(date) {
  const d = new Date(String(date) + 'T23:59:59Z');
  return !isNaN(d) && d.getTime() < Date.now();
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
