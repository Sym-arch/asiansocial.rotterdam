/* =========================================================
   Asian Socials — About us (about.html)
   core.js が必要です。

   読み物が中心のページですが、En. のセクションだけは実際の回を
   並べます（events の brand 列が 'en' のもの。以前はホームにあった
   一覧を、説明を移したこちらに合わせて持ってきました）。
   ========================================================= */

/* En. の回だけを、近い順に並べます。1件も無いときは枠ごと隠します
   （空の枠は場所を取るだけで、何も伝えません） */
function renderEnEvents() {
  const box = $('#enEvents');
  if (!box) return;
  const list = upcoming().filter(ev => ev.brand === 'en');
  box.hidden = !list.length;
  if (!list.length) { box.innerHTML = ''; return; }
  box.innerHTML = list.slice(0, 3).map(ev => `
    <a class="en-event" href="${esc(eventUrl(ev.id))}">
      <span class="en-event__img">
        ${ev.image ? `<img src="${esc(ev.image)}" alt="" loading="lazy">` : ''}
      </span>
      <span class="en-event__body">
        <span class="en-event__date">${esc(fmtDate(ev, { weekday: 'short', day: 'numeric', month: 'short' }))}</span>
        <b>${esc(ev.title)}</b>
        <span class="en-event__meta">${esc(fmtTime(ev))} · ${esc(ev.venue)}</span>
      </span>
      <span class="en-event__price">${esc(priceFor(ev).label)}</span>
    </a>`).join('');
  keepLangOnLinks(box);
}

document.addEventListener('DOMContentLoaded', () => {
  initShell();
  /* 控え（前回の読み込み分）があれば先に出し、読み込めたら並べ直します。
     待っている間に空のまま見せないためです（bootstrapContent が両方やります） */
  bootstrapContent(renderEnEvents);
});
