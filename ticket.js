/* =========================================================
   Asian Social Rotterdam — チケット（ticket.html?t=<secret>）
   core.js が必要です。

   スクリーンショット対策は4段構えの上2段をここで担います。
     1. 秒まで動く時計 … 止まっている画面は受付が一目で見分けられます
     2. 予約者名を大きく … 友達へ転送しても名前が一致しません
     3. スライドで1回だけ消し込み（DB側の1文のUPDATE）
     4. 名簿での突合（checkin.html）

   スライドにしたのはQRより強いからです。スクショはスライドできません。
   ただし通信が要るので、受付側からの手動チェックインを必ず併用します。
   ========================================================= */

const T_SECRET = new URLSearchParams(location.search).get('t') || '';

/* 開始1時間前から受付できます。電車の中で誤って滑らせても消えないように。 */
const CHECKIN_WINDOW_MS = 60 * 60 * 1000;

function ticketShell(inner, cls) {
  return `<section class="tk ${cls || ''}"><div class="wrap tk__inner">${inner}</div></section>`;
}

function notFoundHTML() {
  return ticketShell(`
    <h1 class="tk__msg">${esc(t('ticket.notFound'))}</h1>
    <a class="btn btn--line" href="index.html">${esc(t('booked.home'))}</a>`);
}

function ticketHTML(tk) {
  const ev    = findEvent(tk.event_id);
  const start = ev ? startOf(ev) : (tk.event_date ? new Date(tk.event_date) : null);
  const date  = tk.event_date
    ? new Date(tk.event_date).toLocaleDateString(dateLocale(), { weekday: 'long', day: 'numeric', month: 'long' })
    : '';
  const used  = tk.status === 'used';
  const void_ = tk.status === 'void';
  const early = start ? Date.now() < start.getTime() - CHECKIN_WINDOW_MS : false;

  let foot;
  if (void_) {
    foot = `<p class="tk__state tk__state--off">${esc(t('ticket.void'))}</p>`;
  } else if (used) {
    const time = tk.checked_in_at
      ? new Date(tk.checked_in_at).toLocaleTimeString(dateLocale(), { hour: '2-digit', minute: '2-digit' })
      : '';
    foot = `<p class="tk__state tk__state--done">
              ${esc(time ? t('ticket.doneAt', { time }) : t('ticket.done'))}</p>`;
  } else if (early) {
    foot = `<p class="tk__state tk__state--off">${esc(t('ticket.tooEarly'))}</p>`;
  } else {
    foot = `
      <div class="slider" id="slider">
        <input type="range" id="slide" min="0" max="100" value="0"
               aria-label="${esc(t('ticket.slide'))}">
        <span class="slider__label" id="slideLabel">${esc(t('ticket.slide'))}</span>
      </div>`;
  }

  return ticketShell(`
    <p class="label label--brand">${esc(t('ticket.label'))}</p>

    <h1 class="tk__name">${esc(tk.holder_name)}</h1>
    <p class="tk__admits">${esc(t('ticket.admits', { n: tk.quantity }))}</p>

    <div class="tk__event">
      <b>${esc(tk.event_title || '')}</b>
      <span>${esc(date)}${ev ? ' · ' + esc(fmtTime(ev)) : ''}</span>
      ${ev && ev.venue ? `<span>${esc(ev.venue)}</span>` : ''}
    </div>

    <!-- 秒まで動きます。止まっていればスクリーンショットです -->
    <div class="tk__live"><span class="tk__dot"></span><time id="tkClock"></time></div>

    ${foot}

    <p class="tk__hint">${esc(t('ticket.showStaff'))}</p>`, used ? 'tk--used' : '');
}

function startClock() {
  const el = $('#tkClock');
  if (!el) return;
  const tick = () => {
    el.textContent = new Date().toLocaleTimeString(dateLocale(), {
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
  };
  tick();
  clearInterval(startClock._t);
  startClock._t = setInterval(tick, 1000);
}

function wireSlider(tk) {
  const input = $('#slide'), label = $('#slideLabel');
  if (!input) return;

  const reset = () => { input.value = 0; label.textContent = t('ticket.slide'); };

  input.addEventListener('input', () => {
    label.textContent = input.value > 8 ? '' : t('ticket.slide');
  });

  const release = async () => {
    if (Number(input.value) < 98) { reset(); return; }
    input.disabled = true;
    label.textContent = t('ticket.checking');
    try {
      const res = await checkInTicket(T_SECRET);
      if (res.ok) {
        render(Object.assign({}, tk, { status: 'used', checked_in_at: res.at_time }));
      } else if (res.reason === 'used') {
        render(Object.assign({}, tk, { status: 'used', checked_in_at: res.at_time }));
      } else if (res.reason === 'void') {
        render(Object.assign({}, tk, { status: 'void' }));
      } else {
        toast(t('ticket.notFound'), true);
        input.disabled = false; reset();
      }
    } catch (err) {
      toast(t('ticket.err'), true);
      input.disabled = false; reset();
    }
  };

  input.addEventListener('change', release);
  input.addEventListener('pointerup', release);
}

function render(tk) {
  $('#ticketMain').innerHTML = tk ? ticketHTML(tk) : notFoundHTML();
  if (tk) { startClock(); wireSlider(tk); }
  initShell();
}

document.addEventListener('DOMContentLoaded', async () => {
  const y = $('#year'); if (y) y.textContent = new Date().getFullYear();

  /* 翻訳プロキシは入力欄を止めるうえ、当日ここで詰まると入場できません。
     自前ドメインの同じ言語へ送ります。 */
  if (onProxy()) { location.href = nativeUrl(currentLang()) ; return; }

  if (!T_SECRET) { render(null); return; }

  $('#ticketMain').innerHTML = ticketShell('<div class="empty">…</div>');
  /* イベントの時刻と会場を出すために内容も読みます（失敗しても表示は続けます） */
  loadContent().catch(() => {});
  try {
    render(await fetchTicket(T_SECRET));
  } catch (err) {
    render(null);
  }
});
