/* =========================================================
   Asian Social Rotterdam — About & partners (about.html)
   core.js が必要です。

   このページにあるのは読み物とパートナー問い合わせだけです。
   イベントの描画も管理画面もここには要らないので、app.js は読みません。
   ========================================================= */

/* 翻訳プロキシでは入力欄が使えないので、フォームの代わりに
   自前ドメインへ渡す案内を出します（ホームと同じ扱いです）。 */
function swapPartnerFormForCta() {
  const box = $('#partnerBox');
  if (!box || !onProxy()) return;
  box.innerHTML =
    `<p class="label label--brand">${esc(t('partner.label'))}</p>
     <h3 style="font-size:1.6rem;margin:16px 0 18px">${esc(t('cta.partner.title'))}</h3>
     <p style="color:var(--muted);max-width:46ch;margin-bottom:26px">${esc(t('cta.partner.body'))}</p>
     <a class="btn btn--brand" href="${esc(nativeUrl(currentLang(), '#partners'))}">
       ${esc(t('cta.partner.button'))}</a>`;
}

async function submitPartner(e) {
  e.preventDefault();
  const f = e.target;
  const get = id => (($(id) || {}).value || '').trim();

  const data = {
    name: get('#pName'), email: get('#pEmail'), company: get('#pCompany'),
    topic: get('#pType'), website: get('#pSite'), message: get('#pMsg')
  };
  if (!data.name || !data.email || !data.message) return toast(t('partner.err.required'), true);
  if (!isEmail(data.email)) return toast(t('partner.err.email'), true);

  /* 管理画面はこの端末の控えを読みます。送信に失敗しても残るようにします */
  MSGS.push(Object.assign({ id: uid(), kind: 'partner', createdAt: new Date().toISOString() }, data));
  saveMsgs();

  const btn = f.querySelector('button[type=submit]');
  const label = btn.textContent;
  btn.disabled = true; btn.textContent = t('partner.sending');

  const subject = `[Partner inquiry] ${data.company} — ${data.topic}`;
  const body = Object.entries(data)
    .map(([k, v]) => k.replace(/^\w/, c => c.toUpperCase()) + ': ' + (v || '—')).join('\n');

  let mode = 'manual';
  try {
    mode = await deliver('partner', Object.assign(
      { type: 'partner', subject, to_email: CONFIG.contactEmail, reply_to: data.email }, data));
  } catch (err) {
    console.warn('Email delivery failed:', err);
  }

  btn.disabled = false; btn.textContent = label;

  if (mode === 'manual') {
    /* 送信の口が無いときは、書いた内容を捨てずにメールアプリへ渡します */
    window.location.href = mailtoUrl(CONFIG.contactEmail, subject, body);
    toast('Opening your mail app to send the message to ' + CONFIG.contactEmail);
  } else {
    f.reset();
    toast(t('partner.sent'));
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initShell();
  swapPartnerFormForCta();
  const pf = $('#partnerForm');
  if (pf) pf.addEventListener('submit', submitPartner);
});
