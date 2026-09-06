/* =========================================================
   Asian Social Rotterdam — 受付チェックリスト（checkin.html）
   core.js が必要です。運営専用なので英語のみです。

   考え方:
     防ぎたいのは「販売数より多く入ること」だけです。それは
     名簿と名前の突合で防げるので、来場者側の消し込みは使いません。
     受付の人が名前を聞き、この一覧でチェックを入れていきます。

     チェックは取り消せます。押し間違いは必ず起きるからです。
     5秒ごとに読み直すので、受付を2台で分担しても互いの状況が見えます。
   ========================================================= */

let CI_EVENT   = '';
let CI_TICKETS = [];
let CI_TIMER   = null;

const CI_POLL_MS = 5000;

function ciShell(inner) {
  return `<section class="sec sec--flush ci"><div class="wrap">${inner}</div></section>`;
}

function signInPrompt() {
  return ciShell(`
    <h1 class="ci__h1">Door check-in</h1>
    <p class="ci__lead">Sign in with the organiser account to open the guest list.</p>
    <button class="btn btn--brand" type="button" data-member>Sign in</button>`);
}

function notAdmin() {
  return ciShell(`
    <h1 class="ci__h1">Door check-in</h1>
    <p class="ci__lead">This account is not an organiser account.</p>
    <button class="mini" type="button" id="ciOut">Sign out</button>`);
}

function listHTML() {
  const evs = EVENTS.slice().sort(byDate).reverse();
  const inCount = CI_TICKETS.filter(r => r.status === 'used')
                            .reduce((n, r) => n + (r.quantity || 1), 0);
  const total   = CI_TICKETS.reduce((n, r) => n + (r.quantity || 1), 0);

  return ciShell(`
    <h1 class="ci__h1">Door check-in</h1>

    <div class="ci__controls">
      <select id="ciEvent" aria-label="Event">
        ${evs.map(e => `<option value="${esc(e.id)}" ${e.id === CI_EVENT ? 'selected' : ''}>
          ${esc(fmtDate(e))} — ${esc(e.title)}</option>`).join('')}
      </select>
      <input id="ciSearch" type="search" placeholder="Search by name" autocomplete="off">
    </div>

    <div class="ci__bar">
      <p class="ci__count"><b id="ciIn">${inCount}</b> of <span id="ciTotal">${total}</span> people in</p>
      <button class="mini" type="button" id="ciRefresh">Refresh</button>
    </div>

    <ul class="ci__list" id="ciList">
      ${CI_TICKETS.length ? CI_TICKETS.map(rowHTML).join('')
                          : '<li class="ci__empty">No bookings for this event yet.</li>'}
    </ul>`);
}

function rowHTML(t) {
  const used = t.status === 'used';
  const at = used && t.checked_in_at
    ? new Date(t.checked_in_at).toLocaleTimeString(dateLocale(), { hour: '2-digit', minute: '2-digit' })
    : '';
  return `
    <li class="ci__row ${used ? 'is-in' : ''}" data-name="${esc((t.holder_name || '').toLowerCase())}">
      <label>
        <input type="checkbox" data-id="${esc(t.id)}" ${used ? 'checked' : ''}>
        <span class="ci__who">
          <b>${esc(t.holder_name)}</b>
          <span>${esc(t.quantity)} ${t.quantity > 1 ? 'people' : 'person'}${at ? ' · ' + esc(at) : ''}</span>
        </span>
      </label>
    </li>`;
}

/* 一覧を作り直さず、数と行だけ差し替えます。
   検索の入力中に一覧が消えると使いものにならないためです。 */
function paintRows() {
  const list = $('#ciList');
  if (!list) return;
  const q = ($('#ciSearch') || {}).value || '';
  list.innerHTML = CI_TICKETS.length
    ? CI_TICKETS.map(rowHTML).join('')
    : '<li class="ci__empty">No bookings for this event yet.</li>';
  applyFilter(q);

  const inCount = CI_TICKETS.filter(r => r.status === 'used')
                            .reduce((n, r) => n + (r.quantity || 1), 0);
  const total   = CI_TICKETS.reduce((n, r) => n + (r.quantity || 1), 0);
  if ($('#ciIn'))    $('#ciIn').textContent = inCount;
  if ($('#ciTotal')) $('#ciTotal').textContent = total;
}

function applyFilter(q) {
  const needle = (q || '').trim().toLowerCase();
  $$('#ciList .ci__row').forEach(li => {
    li.hidden = needle && !li.dataset.name.includes(needle);
  });
}

async function pull(repaintOnly) {
  if (!CI_EVENT) return;
  try {
    CI_TICKETS = await adminListTickets(CI_EVENT);
  } catch (err) {
    if (!repaintOnly) toast(err.message, true);
    return;
  }
  paintRows();
}

async function refresh() {
  if (!CI_EVENT && EVENTS.length) {
    const up = upcoming();
    CI_EVENT = (up[0] || EVENTS[0]).id;
  }
  try {
    CI_TICKETS = CI_EVENT ? await adminListTickets(CI_EVENT) : [];
  } catch (err) {
    toast(err.message, true);
    CI_TICKETS = [];
  }
  $('#checkinMain').innerHTML = listHTML();
  wireList();
  initShell();
  startPolling();
}

function startPolling() {
  clearInterval(CI_TIMER);
  CI_TIMER = setInterval(() => {
    if (!document.hidden) pull(true);
  }, CI_POLL_MS);
}

function wireList() {
  const sel = $('#ciEvent');
  if (sel) sel.addEventListener('change', () => { CI_EVENT = sel.value; refresh(); });

  const search = $('#ciSearch');
  if (search) search.addEventListener('input', () => applyFilter(search.value));

  const btn = $('#ciRefresh');
  if (btn) btn.addEventListener('click', () => pull(false));

  const list = $('#ciList');
  if (list) list.addEventListener('change', async e => {
    const box = e.target.closest('input[type=checkbox][data-id]');
    if (!box) return;
    const id = box.dataset.id;
    const on = box.checked;
    const row = box.closest('.ci__row');
    row.classList.toggle('is-in', on);
    box.disabled = true;
    try {
      await adminSetCheckIn(id, on);
      const hit = CI_TICKETS.find(t => t.id === id);
      if (hit) { hit.status = on ? 'used' : 'valid'; hit.checked_in_at = on ? new Date().toISOString() : null; }
      paintRows();
    } catch (err) {
      toast(err.message, true);
      box.checked = !on;
      row.classList.toggle('is-in', !on);
    }
    box.disabled = false;
  });
}

async function boot() {
  if (!isSignedIn()) {
    clearInterval(CI_TIMER);
    $('#checkinMain').innerHTML = signInPrompt();
    initShell();
    return;
  }
  await loadMember();

  let admin = false, failed = '';
  try {
    admin = await isAdminUser();
  } catch (err) { failed = err.message; }

  if (failed) {
    /* 「管理者ではない」と「確認できなかった」は別物です。
       混ぜると原因が分からなくなります。 */
    clearInterval(CI_TIMER);
    $('#checkinMain').innerHTML = ciShell(`
      <h1 class="ci__h1">Door check-in</h1>
      <p class="ci__lead">Could not check this account: ${esc(failed)}</p>
      <button class="mini" type="button" id="ciOut">Sign out and try again</button>`);
    $('#ciOut').addEventListener('click', () => { signOut(); boot(); });
    initShell();
    return;
  }

  if (!admin) {
    clearInterval(CI_TIMER);
    $('#checkinMain').innerHTML = notAdmin();
    $('#ciOut').addEventListener('click', () => { signOut(); boot(); });
    initShell();
    return;
  }
  await refresh();
}

document.addEventListener('DOMContentLoaded', () => {
  const y = $('#year'); if (y) y.textContent = new Date().getFullYear();
  document.addEventListener('member:changed', () => { closeMemberModal(); boot(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) pull(true); });
  $('#checkinMain').innerHTML = ciShell('<div class="empty">…</div>');
  loadContent().catch(() => {}).then(boot);
});
