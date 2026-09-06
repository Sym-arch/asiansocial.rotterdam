/* =========================================================
   Asian Social Rotterdam — 会員ページ（account.html）
   core.js が必要です。

   このページは2つの役割を持ちます。
     1. 会員になると何が得られるかを示す（訪問者向け）
     2. 戻ってきた会員のサインイン先（会員向け）

   ただし、実際の入口はここではありません。イベントを予約した人が
   その場で会員になるので、獲得は予約フォームで起きます。
   このページは「戻ってくる場所」であり「説明する場所」です。

   翻訳ページ（*.translate.goog）ではセッションが別オリジンになり
   成立しないため、プロキシ経由で来た人は自前ドメインへ送ります。
   ========================================================= */

let AUTH_MODE = 'create';   /* 'create' | 'signin' */

/* ---------------------------------------------------------
   サインインしていないとき — 説明 ＋ フォーム
   --------------------------------------------------------- */
function guestHTML() {
  const perk = (label, items) => `
    <div class="perks__group">
      <p class="perks__when">${esc(label)}</p>
      <ul class="ticks">
        ${items.map(x => `<li>${esc(x)}</li>`).join('')}
      </ul>
    </div>`;

  return `
  <section class="sec sec--flush band band--day acct-hero">
    <div class="band__bg" style="background-image:url(assets/bg-day.jpg)"></div>
    <div class="wrap acct-hero__inner">
      <p class="label label--brand">${esc(t('account.title'))}</p>
      <h1>${esc(t('account.hero'))}</h1>
      <p class="lead">${esc(t('account.heroBody'))}</p>
    </div>
  </section>

  <section class="sec">
    <div class="wrap acct-grid">
      <div>
        <h2 class="acct-h2">${esc(t('account.perks'))}</h2>
        <div class="perks">
          ${perk(t('account.now'),   [t('account.now1'),  t('account.now2')])}
          ${perk(t('account.soon'),  [t('account.soon1'), t('account.soon2')])}
          ${perk(t('account.later'), [t('account.later1')])}
        </div>
      </div>

      <aside class="acct-form" id="authBox">
        ${authFormHTML()}
      </aside>
    </div>
  </section>`;
}

function authFormHTML() {
  const creating = AUTH_MODE === 'create';
  return `
    <h2>${esc(t(creating ? 'account.create' : 'account.signin.title'))}</h2>

    ${creating ? `
    <div class="field">
      <label for="auName">${esc(t('account.name'))}</label>
      <input id="auName" type="text" autocomplete="name">
    </div>` : ''}

    <div class="field">
      <label for="auEmail">${esc(t('rsvp.email'))}</label>
      <input id="auEmail" type="email" autocomplete="email" inputmode="email">
    </div>

    <div class="field">
      <label for="auPass">${esc(t('account.password'))}</label>
      <input id="auPass" type="password"
             autocomplete="${creating ? 'new-password' : 'current-password'}"
             placeholder="${creating ? esc(t('account.passwordPh')) : ''}">
    </div>

    <button class="btn btn--brand btn--block" type="button" id="auSubmit" style="margin-top:20px">
      ${esc(t(creating ? 'account.createBtn' : 'account.signinBtn'))}</button>

    <p class="acct-swap">
      ${esc(t(creating ? 'account.haveAccount' : 'account.noAccount'))}
      <button type="button" class="linkish" id="auSwap">
        ${esc(t(creating ? 'account.toSignin' : 'account.toCreate'))}</button>
    </p>

    ${creating ? '' : `
    <p class="acct-swap">
      <button type="button" class="linkish" id="auForgot">${esc(t('account.forgot'))}</button>
    </p>`}`;
}

/* ---------------------------------------------------------
   サインインしているとき — 会員証
   --------------------------------------------------------- */
function memberHTML(rsvps) {
  const profile = (MEMBER && MEMBER.profile) || {};
  const ship    = (MEMBER && MEMBER.membership) || {};
  const tier    = memberTier();
  const since   = ship.started_at
    ? new Date(ship.started_at).toLocaleDateString(dateLocale(), { year: 'numeric', month: 'long', day: 'numeric' })
    : '';

  return `
  <section class="sec sec--flush acct-member">
    <div class="wrap" style="max-width:760px">
      <p class="label label--brand">${esc(t('account.card'))}</p>

      <div class="card-member">
        <div class="card-member__top">
          <img src="assets/logo.jpg" alt="" width="46" height="46">
          <div><b>Asian Social</b><span>Rotterdam</span></div>
        </div>
        <div class="card-member__name">${esc(profile.name || profile.email || signedInAs())}</div>
        <div class="card-member__meta">
          <span>${esc(t(tier === 'premium' ? 'account.tier.premium' : 'account.tier.free'))}</span>
          ${since ? `<span>${esc(t('account.since'))} ${esc(since)}</span>` : ''}
        </div>
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

/* ---------------------------------------------------------
   描画と配線
   --------------------------------------------------------- */
async function renderAccount() {
  const main = $('#accountMain');

  if (!isSignedIn()) {
    main.innerHTML = guestHTML();
    wireAuth();
  } else {
    main.innerHTML = '<div class="wrap" style="padding:110px 0 90px"><div class="empty">…</div></div>';
    const [, rsvps] = await Promise.all([loadMember(), loadMyRsvps()]);
    main.innerHTML = memberHTML(rsvps);
    wireMember();
  }
  initShell();
}

function wireAuth() {
  const box = $('#authBox');

  const submit = async () => {
    const btn = $('#auSubmit'), label = btn.textContent;
    const creating = AUTH_MODE === 'create';
    btn.disabled = true;
    btn.textContent = t(creating ? 'account.creating' : 'account.signingIn');
    try {
      if (creating) {
        await signUp($('#auEmail').value, $('#auPass').value, ($('#auName') || {}).value);
        toast(t('account.welcome'));
      } else {
        await signIn($('#auEmail').value, $('#auPass').value);
      }
      renderAccount();
      return;
    } catch (err) {
      toast(err.message, true);
    }
    btn.disabled = false; btn.textContent = label;
  };

  $('#auSubmit').addEventListener('click', submit);
  box.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.matches('input')) submit();
  });

  $('#auSwap').addEventListener('click', () => {
    AUTH_MODE = AUTH_MODE === 'create' ? 'signin' : 'create';
    box.innerHTML = authFormHTML();
    applyI18n(box);
    wireAuth();
    $('#auEmail').focus();
  });

  const forgot = $('#auForgot');
  if (forgot) forgot.addEventListener('click', async () => {
    try {
      await sendPasswordReset($('#auEmail').value);
      toast(t('account.resetSent'));
    } catch (err) {
      toast(err.message, true);
    }
  });
}

function wireMember() {
  $('#acSave').addEventListener('click', async () => {
    const btn = $('#acSave');
    btn.disabled = true;
    try {
      await saveProfile({ name: $('#acName').value.trim(), locale: currentLang() });
      toast(t('account.saved'));
    } catch (err) {
      toast(err.message, true);
    }
    btn.disabled = false;
  });

  $('#acSignOut').addEventListener('click', () => {
    signOut();
    AUTH_MODE = 'signin';
    renderAccount();
  });
}

document.addEventListener('DOMContentLoaded', () => {
  if (onProxy()) { location.href = nativeUrl(currentLang()); return; }
  renderAccount();
});
