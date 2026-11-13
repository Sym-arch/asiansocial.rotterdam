/* =========================================================
   Asian Socials — イベントポリシーとプライバシー（policy.html）
   core.js が必要です。

   本文はもう policy.html に直接書いてあります（英語がサイトの本体。
   オランダ語・日本語は core.js の applyI18n() が data-i18n-html で差し替えます）。
   以前はここで全文を組み立てて #policyMain に流し込んでいましたが、
   JavaScript を実行しない検索エンジンや AI には中身が空に見えてしまっていました。
   このファイルがするのは、更新日の表示と、#tickets などへのリンクの調整だけです。

   文言を変えたら、policy.html の本文と i18n.js の policy.* の両方、
   そして下の POLICY_UPDATED を合わせて直してください。
   ========================================================= */

const POLICY_UPDATED = '2026-11-15';

document.addEventListener('DOMContentLoaded', () => {
  const y = $('#year'); if (y) y.textContent = new Date().getFullYear();
  initShell();

  /* 日付は言語に関わらず常に書き直します（policy.html の英語の日付表記は
     JS が動かないときだけのための控えです） */
  const dateEl = $('#policyDate');
  if (dateEl) {
    dateEl.textContent = new Date(POLICY_UPDATED + 'T12:00:00')
      .toLocaleDateString(dateLocale(), { year: 'numeric', month: 'long', day: 'numeric' });
  }

  /* 本文はもう最初から HTML にあるので、#privacy などへのリンクはそのまま効きます。
     念のため、ページを開いた直後にもう一度合わせておきます */
  if (location.hash) {
    const target = document.getElementById(location.hash.slice(1));
    if (target) target.scrollIntoView();
  }
});
