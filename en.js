/* =========================================================
   En. Japanese Social Club（en.html）
   core.js が必要です。

   このページで動くのは「En. の回だけを並べる」ところだけです。
   イベントは events テーブルの brand 列で見分けます。
   ========================================================= */

function enEventsHTML(list) {
  if (!list.length) {
    return `<div class="empty">
      <b>Nothing on the En. calendar yet.</b>
      <span>The next one will show up here. Meanwhile, everything Asian Social runs is
        open to you too.</span>
    </div>`;
  }
  return list.map(ev => `
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
}

function renderEnEvents() {
  const box = $('#enEvents');
  if (!box) return;
  /* 過去回は出しません。初めて見る人には「次いつ行けるか」しか要りません */
  const list = upcoming().filter(ev => ev.brand === 'en');
  box.innerHTML = enEventsHTML(list);
  keepLangOnLinks(box);
}

document.addEventListener('DOMContentLoaded', () => {
  const y = $('#year'); if (y) y.textContent = new Date().getFullYear();
  initShell();
  bootstrapContent(renderEnEvents);
});
