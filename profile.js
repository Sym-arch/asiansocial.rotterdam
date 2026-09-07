/* =========================================================
   マイページ（profile.html）
   core.js が必要です。

   中身は会員モーダルと同じものを使います。二つ書くと、
   片方だけ直して食い違う、が必ず起きます。
   renderMemberModal() は #memberBody に描くだけなので、
   モーダルの外でもそのまま使えます。
   ========================================================= */

function syncTitle() {
  const h = $('#profileTitle');
  if (h) h.textContent = isSignedIn() ? t('account.title') : t('account.signin.title');
}

document.addEventListener('DOMContentLoaded', async () => {
  const y = $('#year'); if (y) y.textContent = new Date().getFullYear();

  /* 翻訳プロキシでは入力欄が使えません。ここは入力しかないので、
     読み込んだ時点で自前ドメインへ送ります */
  if (onProxy()) { location.href = nativeUrl(currentLang()); return; }

  initShell();
  await renderMemberModal();
  syncTitle();

  /* サインイン・サインアウトで見出しも切り替えます */
  document.addEventListener('member:changed', syncTitle);
});
