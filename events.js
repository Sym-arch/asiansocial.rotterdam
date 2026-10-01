/* =========================================================
   Asian Social Rotterdam — すべてのイベント（events.html）
   core.js が必要です。

   ホームの一覧は「これから行ける回」だけを出しています。
   過去の回も見たい人のために、こちらで両方を並べます。
   ========================================================= */

function allEventsHTML() {
  const next = upcoming();
  const past = EVENTS.filter(isPast).sort(byDate).reverse();

  const group = (title, list, empty) => `
    <h2 class="ev-group">${esc(title)}</h2>
    ${list.length
      ? `<div class="ev-grid">${list.map(eventCardHTML).join('')}</div>`
      : `<p class="empty">${esc(empty)}</p>`}`;

  return `
    <div class="sec__head">
      <p class="label label--brand">${esc(t('events.label'))}</p>
      <div>
        <h1>${esc(t('events.allTitle'))}</h1>
        <p>${esc(t('events.allBody'))}</p>
      </div>
    </div>
    ${group(t('events.upcomingTitle'), next, t('events.none'))}
    ${group(t('events.pastTitle'), past, t('events.noPast'))}`;
}

function renderAllEvents() {
  const box = $('#eventsAll');
  if (!box) return;
  box.innerHTML = allEventsHTML();
  initShell();
}

document.addEventListener('DOMContentLoaded', async () => {
  const y = $('#year'); if (y) y.textContent = new Date().getFullYear();
  initShell();

  /* 控えがあれば先に出し、読み込めたら並べ直します。
     待っている間に真っ白な画面を見せないためです。 */
  renderAllEvents();
  await loadContent().catch(() => {});
  renderAllEvents();
});
