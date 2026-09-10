/* =========================================================
   パスワードの設定（reset.html）
   core.js が必要です。

   メールのリンクから来る人だけが開くページです。
   受けるのは2種類あります。

     recovery … パスワードを忘れた人
     invite   … 主催者として招かれた人（アカウントはまだ無い）

   どちらも「トークンを session に変える → 新しいパスワードを保存」
   という同じ手順なので、画面だけ文言を変えています。

   リンクの形は Supabase の設定で2通りあります。
     #access_token=...&type=recovery      … そのまま session になる
     ?token_hash=...&type=recovery        … verify を通すと session になる
   どちらで来ても動くようにしてあります。片方しか見ていないと
   「メールは届くのにリンクを開いても何も起きない」になります。
   ========================================================= */

const RS = { mode: '', ready: false };

function rsShell(inner) {
  return `<div style="max-width:460px">${inner}</div>`;
}

function rsForm() {
  const invite = RS.mode === 'invite';
  return rsShell(`
    <p class="label label--brand">${esc(t(invite ? 'reset.invite' : 'reset.label'))}</p>
    <h1 class="acct-h1">${esc(t(invite ? 'reset.inviteTitle' : 'reset.title'))}</h1>
    <p style="color:var(--muted);margin:-24px 0 30px">
      ${esc(t(invite ? 'reset.inviteBody' : 'reset.body'))}</p>

    <div class="field">
      <label for="rsPass">${esc(t('account.password'))}</label>
      <input id="rsPass" type="password" autocomplete="new-password"
             placeholder="${esc(t('account.passwordPh'))}">
    </div>
    <div class="field" style="margin-top:18px">
      <label for="rsPass2">${esc(t('reset.again'))}</label>
      <input id="rsPass2" type="password" autocomplete="new-password">
    </div>

    <button class="btn btn--brand btn--block" type="button" id="rsSave" style="margin-top:24px">
      ${esc(t('reset.save'))}</button>`);
}

function rsBad() {
  return rsShell(`
    <p class="label label--brand">${esc(t('reset.label'))}</p>
    <h1 class="acct-h1">${esc(t('reset.expired'))}</h1>
    <p style="color:var(--muted);margin:-24px 0 30px">${esc(t('reset.expiredBody'))}</p>
    <a class="btn btn--brand" href="profile.html">${esc(t('reset.backToSignin'))}</a>`);
}

function rsDone() {
  return rsShell(`
    <p class="label label--brand">${esc(t('reset.label'))}</p>
    <h1 class="acct-h1">${esc(t('reset.done'))}</h1>
    <p style="color:var(--muted);margin:-24px 0 30px">${esc(t('reset.doneBody'))}</p>
    <a class="btn btn--brand" href="profile.html">${esc(t('reset.toProfile'))}</a>`);
}

/** リンクに載っているトークンを session に変えます。 */
async function rsConsumeLink() {
  const hash  = new URLSearchParams(location.hash.slice(1));
  const query = new URLSearchParams(location.search);

  RS.mode = hash.get('type') || query.get('type') || 'recovery';

  /* 1. すでに session の形で来ている場合 */
  const token = hash.get('access_token');
  if (token) {
    storeSession({
      access_token: token,
      refresh_token: hash.get('refresh_token') || '',
      expires_in: Number(hash.get('expires_in')) || 3600
    }, '');
    return true;
  }

  /* 2. 引き換えが要る形の場合 */
  const hashed = query.get('token_hash') || query.get('token');
  if (hashed) {
    const res = await fetch(authBase() + '/verify', {
      method: 'POST',
      headers: { apikey: CONFIG.supabase.anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: RS.mode, token_hash: hashed })
    });
    if (!res.ok) return false;
    const data = await res.json().catch(() => ({}));
    if (!data.access_token) return false;
    storeSession(data, '');
    return true;
  }

  /* 3. エラーが載っていることもあります（期限切れなど） */
  return false;
}

async function rsSave() {
  const pass = $('#rsPass').value;
  const again = $('#rsPass2').value;

  if (pass.length < 8) return toast(t('account.err.password'), true);
  if (pass !== again) return toast(t('reset.mismatch'), true);

  const btn = $('#rsSave'), label = btn.textContent;
  btn.disabled = true; btn.textContent = t('reset.saving');
  try {
    const res = await fetch(authBase() + '/user', {
      method: 'PUT',
      headers: {
        apikey: CONFIG.supabase.anonKey,
        Authorization: 'Bearer ' + SESSION.access_token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ password: pass })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.msg || data.error_description || t('reset.failed'));

    /* パスワードを変えたので、いまの session はそのまま使えます。
       メールアドレスを控えておかないと、マイページの表示が空になります。 */
    if (data.email) { SESSION.email = data.email; SESSION.user_id = data.id || SESSION.user_id; DB.set('session', SESSION); }

    $('#resetMain').innerHTML = rsDone();
    initShell();
  } catch (err) {
    toast(err.message, true);
    btn.disabled = false; btn.textContent = label;
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const y = $('#year'); if (y) y.textContent = new Date().getFullYear();

  /* 翻訳プロキシでは入力欄が使えません。入力しかないページなので送り返します */
  if (onProxy()) { location.href = nativeUrl(currentLang()); return; }

  $('#resetMain').innerHTML = rsShell('<div class="empty">…</div>');
  initShell();

  let ok = false;
  try { ok = await rsConsumeLink(); }
  catch (err) { console.warn('reset link failed:', err.message); }

  /* トークンは履歴に残さず消します。戻るボタンで再利用されないためです */
  history.replaceState(null, '', location.pathname);

  $('#resetMain').innerHTML = ok ? rsForm() : rsBad();
  initShell();
  if (ok) {
    $('#rsSave').addEventListener('click', rsSave);
    $('#resetMain').addEventListener('keydown', e => {
      if (e.key === 'Enter' && e.target.matches('input')) rsSave();
    });
    const first = $('#rsPass'); if (first) first.focus();
  }
});
