/* =========================================================
   Asian Social Rotterdam — チケット（ticket.html?t=<secret>）
   core.js が必要です。

   来場者はこの画面を受付で見せるだけです。ここでは何も消し込みません。
   防ぎたいのは「販売数より多く入ること」で、それは受付側の名簿と
   名前の突合で防げるためです。スクリーンショットが出回っても、
   名簿で1人しか通さなければ被害は出ません。

   だから来場者側に凝った仕掛けは要らず、
   「名前・人数・イベント」がはっきり読めることだけが要件です。
   ========================================================= */

const T_SECRET = new URLSearchParams(location.search).get('t') || '';

function ticketShell(inner, cls) {
  return `<section class="tk ${cls || ''}"><div class="wrap tk__inner">${inner}</div></section>`;
}

function notFoundHTML() {
  return ticketShell(`
    <h1 class="tk__msg">${esc(t('ticket.notFound'))}</h1>
    <a class="btn btn--line" href="index.html">${esc(t('booked.home'))}</a>`);
}

function ticketHTML(tk) {
  const ev   = findEvent(tk.event_id);
  const date = tk.event_date
    ? new Date(tk.event_date).toLocaleDateString(dateLocale(), { weekday: 'long', day: 'numeric', month: 'long' })
    : '';
  const used = tk.status === 'used';
  const time = used && tk.checked_in_at
    ? new Date(tk.checked_in_at).toLocaleTimeString(dateLocale(), { hour: '2-digit', minute: '2-digit' })
    : '';

  return ticketShell(`
    <p class="label label--brand">${esc(t('ticket.label'))}</p>

    <h1 class="tk__name">${esc(tk.holder_name)}</h1>
    <p class="tk__admits">${esc(t('ticket.admits', { n: tk.quantity }))}</p>

    <div class="tk__event">
      <b>${esc(tk.event_title || '')}</b>
      <span>${esc(date)}${ev ? ' · ' + esc(fmtTime(ev)) : ''}</span>
      ${ev && ev.venue ? `<span>${esc(ev.venue)}</span>` : ''}
    </div>

    ${tk.status === 'void'
      ? `<p class="tk__state tk__state--off">${esc(t('ticket.void'))}</p>`
      : used
        ? `<p class="tk__state tk__state--done">
             ${esc(time ? t('ticket.doneAt', { time }) : t('ticket.done'))}</p>`
        : `<p class="tk__hint tk__hint--lead">${esc(t('ticket.showStaff'))}</p>`}`,
    used ? 'tk--used' : '');
}

function render(tk) {
  $('#ticketMain').innerHTML = tk ? ticketHTML(tk) : notFoundHTML();
  initShell();
}

document.addEventListener('DOMContentLoaded', async () => {
  const y = $('#year'); if (y) y.textContent = new Date().getFullYear();

  /* 翻訳プロキシで開かれると当日ここで詰まるので、自前ドメインへ送ります */
  if (onProxy()) { location.href = nativeUrl(currentLang()); return; }

  if (!T_SECRET) { render(null); return; }

  $('#ticketMain').innerHTML = ticketShell('<div class="empty">…</div>');
  /* 会場と時刻を出すために内容も読みます（失敗しても表示は続けます） */
  loadContent().catch(() => {});
  try {
    render(await fetchTicket(T_SECRET));
  } catch (err) {
    render(null);
  }
});
