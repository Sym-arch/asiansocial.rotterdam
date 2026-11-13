/* =========================================================
   Asian Socials — For partners (partners.html)
   core.js が必要です。

   1. コミュニティの数字（PARTNER_STATS を書き換えるだけで変わります）
   2. 過去に一緒に開いたお店（イベントのデータベースから自動で並べます）
   3. 問い合わせフォーム（core.js の deliver = EmailJS で届きます）
   ========================================================= */

/* ---------------------------------------------------------
   コミュニティの数字
   ここだけ書き換えれば、ページの数字が変わります。
   確かめた数字だけを載せます（平均の参加人数や年間の延べ人数などは載せません）。
   - 700+ : コミュニティのメンバー数（2026-11 時点）
   - 70+  : 1回の参加人数として過去にあった最大の人数（平均ではありません）
   --------------------------------------------------------- */
const PARTNER_STATS = [
  { value: '700+', label: 'pt.stat.members' },
  { value: '70+',  label: 'pt.stat.guests' }
];

function renderStats() {
  const box = $('#ptStats');
  if (!box) return;
  box.innerHTML = PARTNER_STATS.map(s => `
    <div class="pt-stat"><dt data-count="${esc(s.value)}">${esc(s.value)}</dt><dd>${esc(t(s.label))}</dd></div>`).join('');
  countUpWhenSeen(box);
}

/* 数字は、画面に入ったときに 0 から数え上げます（約1.6秒）。
   最初から最終の数字を書いておくので、動かない環境でも正しい数字が読めます。
   動きを減らす設定の人には、数え上げをしません */
function countUpWhenSeen(box) {
  if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const els = $$('[data-count]', box);
  const parts = el => {
    const m = String(el.dataset.count).match(/^(\D*)(\d[\d,]*)(.*)$/);
    return m ? { pre: m[1], n: Number(m[2].replace(/,/g, '')), post: m[3] } : null;
  };
  els.forEach(el => { const p = parts(el); if (p) el.textContent = p.pre + '0' + p.post; });
  const io = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (!en.isIntersecting) return;
      io.unobserve(en.target);
      const el = en.target, p = parts(el);
      if (!p) return;
      const start = performance.now(), dur = 1600;
      const step = now => {
        const k = Math.min(1, (now - start) / dur);
        const eased = 1 - Math.pow(1 - k, 3);       /* 最後はゆっくり止まります */
        el.textContent = p.pre + Math.round(p.n * eased).toLocaleString('en') + p.post;
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
      /* タブが裏に回ると requestAnimationFrame が止まり、途中の数字で残ることがあります。
         終わる時刻には、必ず最後の数字にしておきます */
      setTimeout(() => { el.textContent = el.dataset.count; }, dur + 100);
    });
  }, { threshold: 0.5 });
  els.forEach(el => io.observe(el));
}

/* ---------------------------------------------------------
   過去のコラボ
   終わった回から、お店ごとに1回（いちばん新しい回）を選び、3軒まで並べます。
   同じお店が何度も並ばないようにするためです。

   載せるのは、管理画面で当日の写真を足した回だけです。表紙の画像は告知用の
   バナーなので、「実際の回の様子」として見せると誤解を招くためです。
   写真を足せば、ここにも自動で増えます。
   人数は、管理画面の Past events で入れた「実際に来た人数」があるときだけ出します。
   --------------------------------------------------------- */
const COLLAB_LIMIT = 3;
let COLLAB_PHOTOS = {};   /* event_id → 当日の写真（いちばん新しい1枚） */

async function loadCollabPhotos() {
  try {
    const photos = await loadPhotos(null, 300);
    COLLAB_PHOTOS = {};
    for (const p of photos) if (!COLLAB_PHOTOS[p.event_id]) COLLAB_PHOTOS[p.event_id] = p.url;
  } catch (err) {
    console.info('collab photos not loaded:', err.message);
  }
}

function pickCollabs() {
  const seen = new Set();
  const out = [];
  for (const ev of EVENTS.filter(isPast).sort(byDate).reverse()) {
    const venue = String(ev.venue || '').trim().toLowerCase();
    if (!venue || seen.has(venue) || !COLLAB_PHOTOS[ev.id]) continue;
    seen.add(venue);
    out.push(ev);
    if (out.length === COLLAB_LIMIT) break;
  }
  return out;
}

function collabCardHTML(ev) {
  const n = Number(ev.attendance) || 0;
  return `<a class="pt-collab" href="${esc(eventUrl(ev.id))}">
    <span class="pt-collab__img"><img src="${esc(COLLAB_PHOTOS[ev.id])}"
      alt="${esc('Guests at ' + ev.title + ', ' + ev.venue)}" loading="lazy"></span>
    <span class="pt-collab__venue">${esc(ev.venue)}</span>
    <b class="pt-collab__title">${esc(ev.title)}</b>
    <span class="pt-collab__meta">${esc(fmtDate(ev, { month: 'long', year: 'numeric' }))}${
      n ? ' · ' + esc(t('pt.past.guests', { n })) : ''}</span>
  </a>`;
}

function renderCollabs() {
  const sec = $('#collaborations'), box = $('#ptCollabs');
  if (!sec || !box) return;
  const list = pickCollabs();
  sec.hidden = !list.length;
  /* 2軒しかないときは2列にして、右に穴を空けません */
  box.style.setProperty('--n', Math.max(list.length, 2));
  box.innerHTML = list.map(collabCardHTML).join('');
  keepLangOnLinks(box);
}

/* ---------------------------------------------------------
   問い合わせフォーム
   送れたときだけ「送れました」と出します。送れなかったときは、
   入力を残したまま、エラーと直接のメールアドレスを出します。
   --------------------------------------------------------- */

/* 翻訳プロキシでは入力欄が使えないので、自前ドメインのフォームへ案内します */
function swapPartnerFormForCta() {
  const box = $('#partnerBox');
  if (!box || !onProxy()) return;
  box.innerHTML =
    `<p style="color:var(--muted);max-width:46ch;margin-bottom:22px">${esc(t('cta.partner.body'))}</p>
     <a class="btn btn--brand" href="${esc(nativeUrl(currentLang(), '#contact'))}">${esc(t('cta.partner.button'))}</a>`;
}

function setStatus(kind, html) {
  const el = $('#partnerStatus');
  if (!el) return;
  el.hidden = !kind;
  el.className = 'pt-status' + (kind ? ' pt-status--' + kind : '');
  el.innerHTML = html || '';
}

async function submitPartner(e) {
  e.preventDefault();
  const f = e.target;
  const get = id => (($(id) || {}).value || '').trim();
  const data = {
    company: get('#pCompany'), name: get('#pName'), email: get('#pEmail'),
    topic: get('#pType') || 'Not specified', message: get('#pMsg')
  };

  /* 未入力の欄に印を付け、最初の欄へ移ります */
  const missing = [['#pCompany', data.company], ['#pName', data.name], ['#pEmail', data.email], ['#pMsg', data.message]]
    .filter(([, v]) => !v).map(([id]) => id);
  $$('#partnerForm [aria-invalid]').forEach(el => el.removeAttribute('aria-invalid'));
  if (missing.length) {
    missing.forEach(id => $(id).setAttribute('aria-invalid', 'true'));
    $(missing[0]).focus();
    return setStatus('error', esc(t('partner.err.required')));
  }
  if (!isEmail(data.email)) {
    $('#pEmail').setAttribute('aria-invalid', 'true');
    $('#pEmail').focus();
    return setStatus('error', esc(t('partner.err.email')));
  }

  const btn = $('#partnerSubmit');
  const label = btn.textContent;
  btn.disabled = true;
  btn.textContent = t('partner.sending');
  setStatus('info', esc(t('pt.st.sending')));

  const subject = `[Partner inquiry] ${data.company} — ${data.topic}`;
  let ok = false;
  try {
    const mode = await deliver('partner', Object.assign(
      { type: 'partner', subject, to_email: CONFIG.contactEmail, reply_to: data.email, website: '' }, data));
    ok = mode !== 'manual';
  } catch (err) {
    console.warn('Partner inquiry failed:', err);
  }

  btn.disabled = false;
  btn.textContent = label;
  if (ok) {
    f.reset();
    setStatus('ok', esc(t('pt.st.sent')));
  } else {
    const mail = `<a href="mailto:${esc(CONFIG.contactEmail)}">${esc(CONFIG.contactEmail)}</a>`;
    setStatus('error', esc(t('pt.st.err')).replace('{email}', mail));
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  initShell();
  renderStats();
  swapPartnerFormForCta();
  const pf = $('#partnerForm');
  if (pf) pf.addEventListener('submit', submitPartner);

  await Promise.all([loadContent().catch(() => {}), loadCollabPhotos()]);
  renderCollabs();
});
