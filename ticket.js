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

/* 鍵は「?t=」ではなく「#」で渡します。メールの本文は quoted-printable で
   運ばれるので、「?」や「=」を含む URL はデコードの甘いメールアプリで
   壊れます（?t=3D... のまま開かれる）。「#」だけなら壊れようがありません。
   すでに送ってしまった「?t=」形式のリンクも読めるようにしておきます。 */
const T_SECRET = decodeURIComponent(location.hash.slice(1)) ||
                 new URLSearchParams(location.search).get('t') || '';

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
        : `<p class="tk__hint tk__hint--lead">${esc(t('ticket.showStaff'))}</p>`}

    ${cancelBlockHTML(tk)}`,
    used ? 'tk--used' : '');
}

/* 取り消しの導線。
   まだ有効で、これからの回のときだけ出します。終わった回や
   受付済みのものに取り消しボタンを見せても、押せば断られるだけです。

   サインインしていない人には出しません。このページは鍵さえあれば
   誰でも開けるので、他人のチケットに取り消しボタンが並ぶことになります。 */
function cancelBlockHTML(tk) {
  if (tk.status !== 'valid') return '';
  const ev = findEvent(tk.event_id);
  if (ev && isPast(ev)) return '';

  if (!isSignedIn()) {
    return `<p class="tk__manage">
      <a href="profile.html">${esc(t('ticket.signInToManage'))}</a></p>`;
  }
  return `<p class="tk__manage">
    <button type="button" class="linkish" id="tkCancel">${esc(t('ticket.cancel'))}</button></p>`;
}

async function wireCancel(tk) {
  const btn = $('#tkCancel');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    const ev = findEvent(tk.event_id);
    const when = tk.event_date
      ? new Date(tk.event_date).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'long' })
      : '';
    /* 押した瞬間には消しません。戻せない操作なので一度確かめます */
    const ask = t('ticket.cancelAsk', { title: tk.event_title || (ev && ev.title) || '', date: when })
              + '\n\n' + t('ticket.cancelWarn');
    if (!confirm(ask)) return;

    const label = btn.textContent;
    btn.disabled = true; btn.textContent = t('ticket.cancelling');
    try {
      await cancelMyBooking(T_SECRET);
      location.href = 'profile.html' + (uiLang() === 'en' ? '' : '?lang=' + uiLang());
    } catch (err) {
      toast(err.message, true);
      btn.disabled = false; btn.textContent = label;
    }
  });
}

function render(tk) {
  $('#ticketMain').innerHTML = tk ? ticketHTML(tk) : notFoundHTML();
  initShell();
  if (tk) wireCancel(tk);
}

document.addEventListener('DOMContentLoaded', async () => {
  const y = $('#year'); if (y) y.textContent = new Date().getFullYear();

  /* 翻訳プロキシで開かれると当日ここで詰まるので、自前ドメインへ送ります */
  if (onProxy()) { location.href = nativeUrl(currentLang(), T_SECRET); return; }

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
