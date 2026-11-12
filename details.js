/* =========================================================
   Your details（details.html）
   core.js が必要です。中身（detailsHTML / wireDetails）は core.js にあります。

   予約の一覧（profile.html）とは別のページにしました。
   予約を確かめに来た人の前に入力欄が並ぶと、見たいものが埋もれるためです。
   ========================================================= */

async function renderDetails() {
  const body = $('#detailsBody');
  if (!body) return;

  /* サインイン前は、入口のボタンだけを出します。押すと会員モーダルが開きます */
  if (!isSignedIn()) {
    body.innerHTML = `
      <p style="color:var(--muted);margin-bottom:20px">${esc(t('details.signin'))}</p>
      <button class="btn btn--brand" type="button" data-member>${esc(t('account.signin'))}</button>`;
    initMemberLinks();
    return;
  }

  /* サインインに使った会員モーダルが開いたままだと、このページの上に残ります */
  closeMemberModal();
  body.innerHTML = '<div class="empty" style="padding:40px 0">…</div>';
  await loadMember();
  body.innerHTML = detailsHTML((MEMBER && MEMBER.profile) || {});
  wireDetails();
}

document.addEventListener('DOMContentLoaded', async () => {
  /* 翻訳プロキシでは入力欄が使えません。ここは入力しかないので、自前ドメインへ送ります */
  if (onProxy()) { location.href = nativeUrl(currentLang()); return; }

  initShell();
  await renderDetails();
  document.addEventListener('member:changed', renderDetails);
});
