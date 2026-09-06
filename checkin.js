/* =========================================================
   Asian Social Rotterdam — 受付（checkin.html）
   core.js が必要です。運営専用なので英語のみです。

   スライドでの消し込みは来場者の端末に通信を要求します。
   会場の電波が死ぬことは普通にあるので、この画面は保険ではなく
   必須の第2経路です。名簿から手で通せます。

   「使用済みだが通す」を残しているのは、転送された画面が先に
   スライドされたときに、本物の人を弾いたままにしないためです。
   システムは判断材料を出すところまでで、最終判断は人に残します。
   ========================================================= */

let CI_EVENT = '';
let CI_TICKETS = [];

function ciShell(inner) {
  return `<section class="sec sec--flush ci"><div class="wrap">${inner}</div></section>`;
}

function signInPrompt() {
  return ciShell(`
    <h1 class="ci__h1">Door check-in</h1>
    <p class="ci__lead">Sign in with the admin account to open the guest list.</p>
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
  const rows = CI_TICKETS;
  const inCount = rows.filter(r => r.status === 'used')
                      .reduce((n, r) => n + (r.quantity || 1), 0);
  const total = rows.reduce((n, r) => n + (r.quantity || 1), 0);

  return ciShell(`
    <div class="ci__top">
      <h1 class="ci__h1">Door check-in</h1>
      <button class="mini" type="button" id="ciRefresh">Refresh</button>
    </div>

    <div class="ci__controls">
      <select id="ciEvent">
        ${evs.map(e => `<option value="${esc(e.id)}" ${e.id === CI_EVENT ? 'selected' : ''}>
          ${esc(fmtDate(e))} — ${esc(e.title)}</option>`).join('')}
      </select>
      <input id="ciSearch" type="search" placeholder="Search by name">
    </div>

    <p class="ci__count"><b>${inCount}</b> of ${total} people checked in
      · ${rows.length} booking${rows.length === 1 ? '' : 's'}</p>

    <ul class="ci__list" id="ciList">
      ${rows.length ? rows.map(rowHTML).join('')
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
      <div>
        <b>${esc(t.holder_name)}</b>
        <span>${esc(t.quantity)} ${t.quantity > 1 ? 'people' : 'person'}${at ? ' · in at ' + esc(at) : ''}</span>
      </div>
      <button class="mini ${used ? 'mini--ghost' : ''}" type="button"
              data-in="${esc(t.id)}" data-used="${used ? '1' : ''}">
        ${used ? 'Let in again' : 'Check in'}</button>
    </li>`;
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
}

function wireList() {
  const sel = $('#ciEvent');
  if (sel) sel.addEventListener('change', () => { CI_EVENT = sel.value; refresh(); });

  const search = $('#ciSearch');
  if (search) search.addEventListener('input', () => {
    const q = search.value.trim().toLowerCase();
    $$('#ciList .ci__row').forEach(li => {
      li.hidden = q && !li.dataset.name.includes(q);
    });
  });

  const refreshBtn = $('#ciRefresh');
  if (refreshBtn) refreshBtn.addEventListener('click', refresh);

  const list = $('#ciList');
  if (list) list.addEventListener('click', async e => {
    const btn = e.target.closest('[data-in]');
    if (!btn) return;
    const wasUsed = btn.dataset.used === '1';
    if (wasUsed && !confirm('This ticket was already used. Let them in anyway?')) return;
    btn.disabled = true;
    try {
      await adminCheckIn(btn.dataset.in, wasUsed);
      await refresh();
    } catch (err) {
      toast(err.message, true);
      btn.disabled = false;
    }
  });
}

async function boot() {
  if (!isSignedIn()) {
    $('#checkinMain').innerHTML = signInPrompt();
    initShell();
    return;
  }
  await loadMember();
  /* 管理者かどうかは admins テーブルの読み取りで確かめます */
  let admin = false;
  try {
    admin = (await sbSelect('admins', 'user_id=eq.' + encodeURIComponent(SESSION.user_id))).length > 0;
  } catch (err) { admin = false; }

  if (!admin) {
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
  $('#checkinMain').innerHTML = ciShell('<div class="empty">…</div>');
  bootstrapContent(() => {});
  loadContent().catch(() => {}).then(boot);
});
