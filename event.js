/* =========================================================
   Asian Socials — event detail page (event.html)
   Requires core.js
   ========================================================= */

/* /e/<id> で開かれます。古いリンク（?id=...）からも読めるようにしておきます */
const EV_ID = new URLSearchParams(location.search).get('id') ||
  decodeURIComponent((location.pathname.match(/^\/e\/([^/]+)/) || [])[1] || '');

/* 割引が効いているときだけ、元の値段に取り消し線を引きます。
   効いていないときに二つ並べると、かえって分かりにくくなります。

   線を引かないと、二つ並んだ数字のどちらを払うのか読み取れません。
   実際に払う額を少し大きく、元の額に線を引いて、一目で決まるようにします。 */
function priceBlockHTML(ev) {
  const p = priceFor(ev);
  if (!p.reason) return `<b class="price-now">${esc(p.label)}</b>`;
  /* 元の値段が先、実際に払う額が最後です。
     目は下から読み上げないので、最後に見た数字が残ります。 */
  return `<span class="price-was"><s>${esc(p.baseLabel)}</s>
      <em>${esc(t(p.reason === 'member' ? 'price.member' : 'price.early'))}</em></span>
    <b class="price-now">${esc(p.label)}</b>`;
}

function priceInlineHTML(ev) {
  const p = priceFor(ev);
  if (!p.reason) return esc(p.label) + '.';
  return `<b>${esc(p.label)}</b> <s>${esc(p.baseLabel)}</s>
    <em class="price-tag">${esc(t(p.reason === 'member' ? 'price.member' : 'price.early'))}</em>.`;
}

/* サインインするとその人の価格に変わるので、会員状態が動いたら描き直します */
function notFound() {
  $('#eventMain').innerHTML = `
    <div class="wrap" style="padding:90px 0 60px">
      <div style="max-width:560px">
        <h1 style="font-size:clamp(1.6rem,4vw,2.4rem);margin-bottom:12px">${esc(t('ev.gone'))}</h1>
        <p style="color:var(--muted);margin-bottom:24px">${esc(t('ev.goneBody'))}</p>
        <a class="btn btn--brand" href="index.html#events">${esc(t('ev.back'))}</a>
      </div>
    </div>`;
}

/**
 * 予約欄の中身。
 *
 * Google 翻訳のプロキシは <input> にフォーカスが入った時点で警告を出し、
 * 入力を止めてしまいます（<form> の有無は無関係。実測で確認済み）。
 * そのため翻訳ページでは入力欄を出さず、母語の案内と
 * 「自前ドメイン ＋ ?lang=xx」へのボタンだけを見せます。
 * 移動先では下のフォームが同じ言語で表示され、警告も出ません。
 */
function bookingHTML(ev) {
  if (onProxy()) {
    return `<p class="label label--brand">${esc(t('rsvp.label'))}</p>
      <h2 style="font-size:1.5rem;margin:14px 0 10px;font-weight:500">${esc(t('cta.rsvp.title'))}</h2>
      <p style="color:var(--muted);font-size:.9rem;margin-bottom:20px">${esc(t('cta.rsvp.body'))}</p>
      <a class="btn btn--brand btn--block" href="${esc(nativeUrl(currentLang(), '#book'))}">
        ${esc(t('cta.rsvp.button'))}</a>`;
  }

  const signed = isSignedIn();
  const myName = (MEMBER && MEMBER.profile && MEMBER.profile.name || '').trim();

  return `<p class="label label--brand">${esc(t('rsvp.label'))}</p>
    <h2 style="font-size:1.5rem;margin:14px 0 10px;font-weight:500">${esc(t('rsvp.title'))}</h2>
    <p style="color:var(--muted);font-size:.9rem;margin-bottom:18px">
      ${priceInlineHTML(ev)}</p>

    <form id="bookForm" novalidate>
      ${signed ? `
      <p class="book-as">
        ${esc(t('rsvp.asMember', { name: myName || signedInAs() }))}
        <button type="button" class="linkish" data-member>${esc(t('rsvp.notYou'))}</button>
      </p>
` : `
      <div class="form-grid" style="grid-template-columns:1fr">
        <div class="field">
          <label for="bName">${esc(t('rsvp.name'))} <span class="req">*</span></label>
          <input id="bName" type="text" autocomplete="name" required>
        </div>
        <div class="field">
          <label for="bEmail">${esc(t('rsvp.email'))} <span class="req">*</span></label>
          <input id="bEmail" type="email" autocomplete="email" required>
        </div>
        <div class="field">
          <label for="bPass">${esc(t('account.password'))} <span class="req">*</span></label>
          <input id="bPass" type="password" autocomplete="new-password"
                 placeholder="${esc(t('account.passwordPh'))}" required>
          <small class="field__hint">${esc(t('rsvp.passwordWhy'))}</small>
        </div>
      </div>`}

      <div class="form-grid" style="grid-template-columns:1fr">
        <div class="field">
          <label for="bGuests">${esc(t('rsvp.guests'))}</label>
          <select id="bGuests">
            <option value="1">${esc(t('rsvp.justme'))}</option>
            <option value="2">2</option><option value="3">3</option>
            <option value="4">4</option><option value="5">5+</option>
          </select>
        </div>
      </div>

      ${consentHTML('bConsent', 'consent.booking')}

      <button class="btn btn--brand btn--block" type="submit" id="bSubmit" style="margin-top:18px">
        ${esc(isPaid(ev) ? t('rsvp.title')
                         : t(signed ? 'rsvp.submit' : 'rsvp.bookBtn'))}</button>

      ${isPaid(ev) ? `
      <p class="pay-help"><button type="button" class="linkish" data-pay-help>${esc(t('rsvp.payHelp'))}</button></p>` : ''}

      ${signed ? '' : `
      <p class="acct-swap" style="margin-top:16px">
        ${esc(t('rsvp.haveAccount'))}
        <button type="button" class="linkish" data-member>${esc(t('account.toSignin'))}</button>
      </p>`}
    </form>`;
}

/* 「支払いがうまくいかないとき」の説明。
   カードや Apple Pay の決済は、カード自体に問題が無くても、決済会社（Stripe）の
   自動の安全チェックで止められることがあります（新しいアカウントの少額決済で
   起きやすい）。止められた画面は Stripe の中なので、こちらから説明を差し込めません。
   そこで、押す前に読める場所に置きます。決済の流れそのものは変えません。 */
function openPayHelp() {
  let el = $('#payHelpModal');
  if (!el) {
    el = document.createElement('div');
    el.className = 'modal modal--sm';
    el.id = 'payHelpModal';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-labelledby', 'payHelpTitle');
    document.body.appendChild(el);
    el.addEventListener('click', e => {
      if (e.target === el || e.target.closest('[data-close]')) {
        el.classList.remove('is-open');
        /* 予約欄のモーダルの上から開いたときは、そちらが開いたままなので
           背景のスクロールは止めたままにします */
        if (!BOOK_MODAL_OPEN) document.body.style.overflow = '';
      }
    });
  }
  /* 言語を切り替えたあとでも合うよう、開くたびに描き直します */
  el.innerHTML = `
    <div class="modal__scrim" data-close></div>
    <div class="modal__panel">
      <div class="modal__head"><h3 id="payHelpTitle">${esc(t('rsvp.payHelpTitle'))}</h3>
        <button class="modal__close" type="button" data-close aria-label="Close">\u2715</button></div>
      <div class="modal__body pay-help__body">
        <p>${esc(t('rsvp.payHelp1'))}</p>
        <p><b>${esc(t('rsvp.payHelp2'))}</b></p>
        <p>${esc(t('rsvp.payHelp3'))}
          <a href="mailto:${esc(CONFIG.contactEmail)}">${esc(CONFIG.contactEmail)}</a></p>
        <button class="btn btn--brand btn--block" type="button" data-close>${esc(t('rsvp.payHelpOk'))}</button>
      </div>
    </div>`;
  el.classList.add('is-open');
  document.body.style.overflow = 'hidden';
}

/* 「席を予約する」を押したら、予約欄をその場で中央に開きます。
   以前は同じページの下へ飛ぶだけでした。電話では本文がとても長いので、
   押しても何も起きていないように見えていました。

   欄は作り直さず、そのまま動かします。作り直すと、入力中の内容も
   組み込んだ動きも消えてしまうためです。 */
let BOOK_MODAL_OPEN = false;

function bookingModalEl() {
  let el = $('#bookModal');
  if (el) return el;
  el = document.createElement('div');
  el.className = 'modal modal--sm';
  el.id = 'bookModal';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.innerHTML =
    '<div class="modal__scrim" data-close></div>' +
    '<div class="modal__panel">' +
      '<div class="modal__head"><h3 id="bookModalTitle"></h3>' +
        '<button class="modal__close" type="button" data-close aria-label="Close">\u2715</button></div>' +
      '<div class="modal__body" id="bookModalBody"></div>' +
    '</div>';
  document.body.appendChild(el);
  el.addEventListener('click', e => {
    if (e.target === el || e.target.closest('[data-close]')) closeBookingModal();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && BOOK_MODAL_OPEN) closeBookingModal();
  });
  return el;
}

function openBookingModal() {
  const panel = $('#book > div');
  if (!panel) return;
  const el = bookingModalEl();
  /* 中の見出しが「席を予約する」なので、上にはイベント名を出します。
     同じ言葉が上下に並ぶと、どちらが見出しなのか分からなくなります */
  const h1 = document.querySelector('.ev-hero h1');
  $('#bookModalTitle').textContent = (h1 && h1.textContent.trim()) || t('rsvp.title');
  /* 描き直しの前に開いていた欄が残っていることがあります。入れ替えます */
  $('#bookModalBody').innerHTML = '';
  $('#bookModalBody').appendChild(panel);
  el.classList.add('is-open');
  document.body.style.overflow = 'hidden';
  BOOK_MODAL_OPEN = true;
  const first = $('#bookModalBody input:not([type=checkbox]), #bookModalBody select');
  if (first) first.focus();
}

function closeBookingModal() {
  const el = $('#bookModal');
  if (!el) return;
  /* 閉じたら元の位置へ戻します。置き去りにすると、次に開いたときに空になります */
  const panel = $('#bookModalBody > *');
  const home = $('#book');
  if (panel && home) home.appendChild(panel);
  el.classList.remove('is-open');
  document.body.style.overflow = '';
  BOOK_MODAL_OPEN = false;
}

function renderEvent(ev) {
  const done = isPast(ev);
  const others = upcoming().filter(e => e.id !== ev.id).slice(0, 3);
  const mapUrl = ev.address
    ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(ev.address) : '';

  /* /e/<id> ではサーバー側が日付入りの見出しを付けています（api/event-page.mjs）。
     Google は画面を描いたあとの <title> を見るので、ここで上書きすると
     せっかく付けた日付が消えます。共通の見出しのときだけ入れます。 */
  if (!document.title || /^Event — /.test(document.title)) {
    document.title = ev.title + ' — Asian Socials';
  }

  $('#eventMain').innerHTML = `
  <section class="ev-hero">
    <div class="wrap">
      <a class="crumb" href="index.html#events">${esc(t('ev.crumb'))}</a>

      <div class="ev-hero__grid">
        <div>
          ${done ? `<p class="label label--brand">${esc(t('ev.past'))}</p>` : ''}
          <h1>${esc(ev.title)}</h1>
          <p class="lead" style="margin-top:14px">${esc(mdLead(ev.description))}</p>

          <div class="ev-facts">
            <div><span class="lbl">${esc(t('meta.date'))}</span><div><b>${esc(fmtLong(ev))}</b><span>${esc(fmtTime(ev))} · ${esc(CONFIG.timezone)}</span></div></div>
            <div><span class="lbl">${esc(t('meta.venue'))}</span><div><b>${esc(ev.venue)}</b><span>${esc(ev.address || 'Rotterdam')}</span></div></div>
            <div><span class="lbl">${esc(t('meta.tickets'))}</span><div>${priceBlockHTML(ev)}${done ? `<span>${esc(t('ev.finished'))}</span>` : ''}</div></div>
          </div>

          <div class="hero__cta">
            ${done ? '' : `<a class="btn btn--brand" href="#book" data-book-open>${esc(t('hero.cta1'))}</a>`}
            <a class="btn btn--line" href="${esc(googleCalendarUrl(ev))}" target="_blank" rel="noopener">${esc(t('ev.gcal'))}</a>
            ${mapUrl ? `<a class="btn btn--line" href="${esc(mapUrl)}" target="_blank" rel="noopener">${esc(t('ev.maps'))}</a>` : ''}
          </div>
        </div>

        <div class="ev-hero__img">
          ${ev.image
            ? `<img src="${esc(ev.image)}" alt="${esc(ev.title)}">`
            : `<div class="ev-hero__ph">Asian Socials</div>`}
        </div>
      </div>
    </div>
  </section>

  <section class="section" style="padding-top:clamp(32px,4vw,56px)">
    <div class="wrap ev-body">
      <div>
        <div class="prose reveal">
          <h2>${esc(t('ev.about'))}</h2>
          <div class="md">${mdToHtml(ev.description)}</div>

          <h3>${esc(t('ev.know'))}</h3>
          <ul class="ticks">
            <li>${esc(t('ev.know1'))}</li>
            <li>${esc(t('ev.know2'))}</li>
            <li>${esc(t('ev.know3'))}</li>
            <li>${esc(t('ev.know4'))} <a href="mailto:${esc(CONFIG.contactEmail)}">${esc(CONFIG.contactEmail)}</a>.</li>
          </ul>
        </div>

        ${others.length ? `
        <div style="margin-top:38px">
          <h2 style="font-size:1.4rem;font-weight:500;margin-bottom:24px">${esc(t('ev.others'))}</h2>
          <div class="events__grid">
            ${others.map(eventCardHTML).join('')}
          </div>
        </div>` : ''}
      </div>

      <aside class="ev-side" id="book">
        <div>
          ${done
            ? `<h2 style="font-size:1.25rem;margin-bottom:10px">This event has finished</h2>
               <p style="color:var(--muted);font-size:.94rem;margin-bottom:18px">
                 Take a look at what is coming up next instead.</p>
               <a class="btn btn--brand btn--block" href="index.html#events">See upcoming events</a>`
            : bookingHTML(ev)}
        </div>
      </aside>
    </div>
  </section>`;

  /* wiring */
  const bookLabel = () => isPaid(ev)
    ? t('rsvp.title')
    : t(isSignedIn() ? 'rsvp.submit' : 'rsvp.bookBtn');

  $$('[data-pay-help]').forEach(b => b.addEventListener('click', openPayHelp));

  /* JavaScript が動かないときは、これまでどおり下の予約欄へ飛びます */
  $$('[data-book-open]').forEach(b => b.addEventListener('click', e => {
    e.preventDefault();
    openBookingModal();
  }));
  /* サインインなどで描き直したときは、開いたままにします。
     「#book」付きで開かれたとき（翻訳ページからの案内など）も開きます */
  if (BOOK_MODAL_OPEN || location.hash === '#book') openBookingModal();

  const form = $('#bookForm');
  if (form) form.addEventListener('submit', async e => {
    e.preventDefault();
    /* 返金なしの条件に同意してもらってから、アカウント作成や決済へ進みます */
    const agreed = $('#bConsent');
    if (agreed && !agreed.checked) { toast(t('consent.err'), true); agreed.focus(); return; }
    const btn = $('#bSubmit');
    btn.disabled = true; btn.textContent = t('rsvp.sending');
    try {
      const guests = $('#bGuests').value;

      if (isPaid(ev)) {
        /* 有料は先にアカウントを作ってから決済へ。
           発券は Stripe からの通知を受けてサーバー側で行います。
           ここで発券すると、払わずに取れてしまいます。 */
        if (!isSignedIn()) {
          await signUpForBooking(
            ($('#bEmail') || {}).value || '',
            ($('#bPass')  || {}).value || '',
            ($('#bName')  || {}).value || ''
          );
        }
        btn.textContent = t('rsvp.toPayment');
        track('begin_checkout', {
          currency: ev.currency || 'EUR',
          value: ((priceFor(ev).cents || 0) * (Number(guests) || 1)) / 100,
          items: [{ item_id: ev.id, item_name: ev.title, quantity: Number(guests) || 1 }]
        });
        location.href = await startCheckout(ev.id, guests);
        return;
      }

      const { rsvp, mode } = await submitRsvp({
        eventId: ev.id,
        name:     ($('#bName')  || {}).value || '',
        email:    ($('#bEmail') || {}).value || '',
        password: ($('#bPass')  || {}).value || '',
        guests
      });
      location.href = bookedUrl(rsvp, mode);
    } catch (err) {
      toast(err.message, true);
      /* すでに登録済みのアドレスだったときは、その場でサインインできるように
         モーダルを開き、入力済みのアドレスを引き継ぎます。
         文章だけ出して終わると、当日その場で払えません。 */
      if (err && err.code === 'sign_in_needed') {
        await openMemberModal('signin');
        const box = $('#mmEmail');
        if (box) { box.value = ($('#bEmail') || {}).value || ''; box.focus(); }
      }
      btn.disabled = false; btn.textContent = bookLabel();
    }
  });

  initShell();
}

function loadingState() {
  $('#eventMain').innerHTML =
    '<div class="wrap" style="padding:90px 0 60px"><div class="empty">Loading the event…</div></div>';
}

document.addEventListener('DOMContentLoaded', () => {
  const y = $('#year'); if (y) y.textContent = new Date().getFullYear();
  /* ヘッダーは中身が何であれ動かします。「見つかりません」や読み込み中に
     ここを通らないと、ハンバーガーも言語切替も効かなくなります。
     二重登録は bindOnce が防ぎます。 */
  initShell();

  /* モーダルでサインインしたら、予約欄を「名前で予約」に差し替えます */
  document.addEventListener('member:changed', () => {
    const ev = EV_ID ? findEvent(EV_ID) : null;
    if (ev) { renderEvent(ev); closeMemberModal(); }
  });

  bootstrapContent(() => {
    const ev = EV_ID ? findEvent(EV_ID) : null;
    if (ev) renderEvent(ev);
    else if (contentSource === 'loading') loadingState();
    else notFound();
  });
});
