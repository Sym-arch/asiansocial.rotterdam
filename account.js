/* =========================================================
   Asian Social Rotterdam — 会員ページ（account.html）
   core.js が必要です。

   画面は2つだけです。
     サインインしていない → メールアドレス → 6桁コード
     サインインしている   → 会員証・名前の変更・予約の履歴

   翻訳ページ（*.translate.goog）ではセッションが持ち越せないため、
   このページは自前ドメインでのみ意味を持ちます。プロキシ経由で来た人は
   自前ドメインへ送ります。
   ========================================================= */

let PENDING_EMAIL = '';   /* コード入力中のメールアドレス */

/* ---------------------------------------------------------
   サインインしていないとき
   --------------------------------------------------------- */
function signInHTML() {
  return `
  <section class="section">
    <div class="wrap" style="max-width:560px">
      <p class="label label--brand">${esc(t('account.title'))}</p>
      <h1 style="font-size:clamp(1.8rem,4vw,2.6rem);margin:14px 0 16px">${esc(t('account.signin.title'))}</h1>
      <p style="color:var(--muted);margin-bottom:32px">${esc(t('account.signin.body'))}</p>

      <div id="stepEmail">
        <div class="field">
          <label for="acEmail">${esc(t('rsvp.email'))}</label>
          <input id="acEmail" type="email" autocomplete="email" inputmode="email">
        </div>
        <button class="btn btn--brand" type="button" id="acSend" style="margin-top:18px">
          ${esc(t('account.sendCode'))}</button>
      </div>

      <div id="stepCode" hidden>
        <p style="color:var(--muted);font-size:.9rem;margin-bottom:22px">${esc(t('account.codeSent'))}</p>
        <div class="field">
          <label for="acCode">${esc(t('account.code'))}</label>
          <input id="acCode" type="text" inputmode="numeric" autocomplete="one-time-code"
                 maxlength="6" pattern="[0-9]*"
                 style="letter-spacing:.5em;font-size:1.3rem">
        </div>
        <button class="btn btn--brand" type="button" id="acVerify" style="margin-top:18px">
          ${esc(t('account.verify'))}</button>
        <button class="mini" type="button" id="acRestart" style="margin-top:18px;margin-left:14px">
          ${esc(t('account.resend'))}</button>
      </div>
    </div>
  </section>`;
}

/* ---------------------------------------------------------
   サインインしているとき
   --------------------------------------------------------- */
function memberHTML(rsvps) {
  const profile = (MEMBER && MEMBER.profile) || {};
  const ship    = (MEMBER && MEMBER.membership) || {};
  const tier    = memberTier();
  const since   = ship.started_at
    ? new Date(ship.started_at).toLocaleDateString(dateLocale(), { year: 'numeric', month: 'long', day: 'numeric' })
    : '';

  return `
  <section class="section">
    <div class="wrap" style="max-width:720px">
      <p class="label label--brand">${esc(t('account.card'))}</p>

      <div class="card-member">
        <div class="card-member__top">
          <img src="assets/logo.jpg" alt="" width="46" height="46">
          <div>
            <b>Asian Social</b>
            <span>Rotterdam</span>
          </div>
        </div>
        <div class="card-member__name">${esc(profile.name || profile.email || signedInAs())}</div>
        <div class="card-member__meta">
          <span>${esc(t(tier === 'premium' ? 'account.tier.premium' : 'account.tier.free'))}</span>
          ${since ? `<span>${esc(t('account.since'))} ${esc(since)}</span>` : ''}
        </div>
        <p class="card-member__note">${esc(t('account.enNote'))}</p>
      </div>

      <div class="acct-block">
        <h2>${esc(t('account.name'))}</h2>
        <div class="field">
          <label for="acName" class="sr-only">${esc(t('account.name'))}</label>
          <input id="acName" type="text" value="${esc(profile.name || '')}"
                 placeholder="${esc(t('account.namePh'))}">
        </div>
        <button class="mini" type="button" id="acSave" style="margin-top:14px">${esc(t('account.save'))}</button>
      </div>

      <div class="acct-block">
        <h2>${esc(t('account.bookings'))}</h2>
        ${rsvps.length ? `
        <ul class="acct-list">
          ${rsvps.map(r => `
          <li>
            <b>${esc(r.event_title || '—')}</b>
            <span>${esc(r.event_date ? new Date(r.event_date).toLocaleDateString(dateLocale(), { year:'numeric', month:'long', day:'numeric' }) : '')}
              · ${esc(r.guests)} ${esc(t(r.guests > 1 ? 'meta.people' : 'meta.person'))}</span>
          </li>`).join('')}
        </ul>` : `<p style="color:var(--muted)">${esc(t('account.noBookings'))}</p>`}
      </div>

      <div class="acct-foot">
        <a class="btn btn--line" href="index.html">${esc(t('booked.home'))}</a>
        <button class="mini" type="button" id="acSignOut">${esc(t('account.signout'))}</button>
      </div>
    </div>
  </section>`;
}

function loadingHTML() {
  return '<div class="wrap" style="padding:90px 0 60px"><div class="empty">…</div></div>';
}

/* ---------------------------------------------------------
   描画と配線
   --------------------------------------------------------- */
async function renderAccount() {
  const main = $('#accountMain');

  if (!isSignedIn()) {
    main.innerHTML = signInHTML();
    wireSignIn();
  } else {
    main.innerHTML = loadingHTML();
    const [, rsvps] = await Promise.all([loadMember(), loadMyRsvps()]);
    main.innerHTML = memberHTML(rsvps);
    wireMember();
  }
  initShell();
}

function wireSignIn() {
  const send = $('#acSend'), verify = $('#acVerify');

  const doSend = async () => {
    const email = $('#acEmail').value.trim();
    const label = send.textContent;
    send.disabled = true; send.textContent = t('account.sending');
    try {
      await requestCode(email);
      PENDING_EMAIL = email;
      $('#stepEmail').hidden = true;
      $('#stepCode').hidden = false;
      $('#acCode').focus();
    } catch (err) {
      toast(err.message, true);
    }
    send.disabled = false; send.textContent = label;
  };

  const doVerify = async () => {
    const label = verify.textContent;
    verify.disabled = true; verify.textContent = t('account.verifying');
    try {
      await verifyCode(PENDING_EMAIL, $('#acCode').value);
      renderAccount();
      return;
    } catch (err) {
      toast(err.message, true);
    }
    verify.disabled = false; verify.textContent = label;
  };

  send.addEventListener('click', doSend);
  verify.addEventListener('click', doVerify);
  $('#acRestart').addEventListener('click', () => {
    $('#stepCode').hidden = true;
    $('#stepEmail').hidden = false;
    $('#acEmail').focus();
  });

  /* Enter でも進めるように */
  $('#acEmail').addEventListener('keydown', e => { if (e.key === 'Enter') doSend(); });
  $('#acCode').addEventListener('keydown', e => { if (e.key === 'Enter') doVerify(); });
}

function wireMember() {
  $('#acSave').addEventListener('click', async () => {
    const btn = $('#acSave'), label = btn.textContent;
    btn.disabled = true;
    try {
      await saveProfile({ name: $('#acName').value.trim(), locale: currentLang() });
      toast(t('account.saved'));
    } catch (err) {
      toast(err.message, true);
    }
    btn.disabled = false; btn.textContent = label;
  });

  $('#acSignOut').addEventListener('click', () => {
    signOut();
    renderAccount();
  });
}

document.addEventListener('DOMContentLoaded', () => {
  /* 翻訳プロキシではセッションが別オリジンになり成立しないので、
     自前ドメインの同じ言語へ送ります */
  if (onProxy()) { location.href = nativeUrl(currentLang()); return; }
  renderAccount();
});
