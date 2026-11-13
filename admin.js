/* =========================================================
   Asian Socials — 管理画面（admin.html / admin.asiansocials.nl）
   core.js が必要です。運営専用なので英語のみです。

   以前はトップページの中のモーダルでした。別ページに分けた理由:
   - 表や入力欄を画面いっぱいに使える
   - タブごとに URL があり、ブックマークできる（#events / #rsvps / #organisers）
   - 管理画面のコードを、トップを開く全員に読ませずに済む

   admin.asiansocials.nl は www とは別のドメイン扱いなので、
   ログインはそれぞれ別です（ブラウザが保存場所をドメインごとに分けるため）。
   ここで一度サインインすれば、この端末では次から入ったままです。
   ========================================================= */

/* 「サインインしている」は「管理者である」ではありません。
   会員も同じ仕組みでサインインするので、admins テーブルに
   載っているかをサーバに聞いて決めます。 */
let isAdmin = false;
let ADMIN_RSVPS = [];   // every booking, read from Supabase once signed in
let ADMIN_ORGS = [];
let IS_OWNER = false;

async function refreshAdminFlag() {
  if (!isSignedIn()) { isAdmin = false; return false; }
  try { isAdmin = await isAdminUser(); }
  catch { isAdmin = false; }          /* 確かめられないときは開けません */
  return isAdmin;
}

/* ---------------------------------------------------------
   入口（サインイン前・管理者でないとき）
   --------------------------------------------------------- */
function gateHTML(kind) {
  const body = kind === 'signin'
    ? `<p class="ci__lead">Sign in with your organiser account.</p>
       <button class="btn btn--brand" type="button" data-member>Sign in</button>`
    : kind === 'denied'
      ? `<p class="ci__lead">This account is not an organiser account.</p>
         <button class="mini" type="button" data-admin-out>Sign out</button>`
      : `<p class="ci__lead">Checking your account…</p>`;
  return `<h1 class="ci__h1">Admin</h1>${body}`;
}

function showGate(kind) {
  $('#adminApp').hidden = true;
  const gate = $('#adminGate');
  gate.hidden = false;
  gate.innerHTML = gateHTML(kind);
  initMemberLinks();          /* 差し込んだ Sign in ボタンに会員モーダルを繋ぎます */
}

/* サインインの状態が変わるたびに、ここで出し分けます */
async function gate() {
  if (!isSignedIn()) { isAdmin = false; showGate('signin'); return; }
  showGate('checking');
  if (!(await refreshAdminFlag())) { showGate('denied'); return; }

  /* サインインに使った会員モーダルが開いたままだと、管理画面の上に残ります */
  closeMemberModal();
  $('#adminGate').hidden = true;
  $('#adminApp').hidden = false;
  $('#adminWho').textContent = signedInAs();

  await loadContent().catch(err => toast('Could not load events: ' + err.message, true));
  fillReminderSelect();
  renderAdmin();
  prepAdminPanel();
  refreshRsvps();
  loadMemberStats();
  loadCheckins().then(c => { PAST_ADMIN.checkins = c; renderAdmin(); }).catch(() => {});
  if (currentTab() === 'organisers') refreshOrganisers();
  if (currentTab() === 'past') refreshPastAdmin();
}

/* ---------------------------------------------------------
   タブ。URL の # で覚えるので、再読み込みしても同じタブに戻ります
   --------------------------------------------------------- */
const TABS = ['events', 'rsvps', 'past', 'organisers'];
const currentTab = () => {
  const h = location.hash.slice(1);
  return TABS.includes(h) ? h : 'events';
};

function showTab(name) {
  $$('.tabs [data-tab]').forEach(x => x.classList.toggle('is-on', x.dataset.tab === name));
  $$('.tabpane').forEach(p => p.classList.toggle('is-on', p.dataset.pane === name));
  /* 管理者の一覧は開いたときに取りに行きます */
  if (name === 'organisers' && isAdmin) refreshOrganisers();
  if (name === 'past' && isAdmin) refreshPastAdmin();
}

/* ---------------------------------------------------------
   Past events（終わった回の管理）
   回ごとに、予約した人数・受付でチェックインした人数・実際に来た人数・
   写真・感想をまとめて扱います。来た人数は、あとで分析に使うために残します。

   - 予約した人数 … rsvps の人数の合計
   - チェックイン … tickets の status が used の人数（受付ページで付けたもの）
   - 実際に来た人数 … 手で入れた数（events.attendance）。空ならチェックインの数を使う
   --------------------------------------------------------- */
let PAST_ADMIN = { photos: [], reviews: [], checkins: {}, cmReady: true };

/** 回ごとのチェックイン人数。tickets を1回だけ読んで数えます */
async function loadCheckins() {
  const rows = await sbSelect('tickets', 'select=event_id,quantity,status');
  const out = {};
  rows.forEach(r => {
    if (r.status !== 'used' || !r.event_id) return;
    out[r.event_id] = (out[r.event_id] || 0) + (Number(r.quantity) || 1);
  });
  return out;
}

const seatsFor = id => ADMIN_RSVPS.filter(r => r.eventId === id)
  .reduce((n, r) => n + (Number(r.guests) || 1), 0);

/* 実際に来た人数。手で入れた数があればそれを、無ければチェックインの数 */
const attendedFor = ev => (ev.attendance ?? null) !== null
  ? Number(ev.attendance)
  : (PAST_ADMIN.checkins[ev.id] || 0);

async function refreshPastAdmin() {
  const box = $('#pastAdmin');
  if (!box) return;
  const [cm, checkins] = await Promise.all([
    Promise.all([loadPhotos(null, 500), loadReviews(null, 500)])
      .then(([photos, reviews]) => ({ photos, reviews, cmReady: true }))
      .catch(() => ({ photos: [], reviews: [], cmReady: false })),
    loadCheckins().catch(() => ({}))
  ]);
  PAST_ADMIN = Object.assign({}, cm, { checkins });
  renderPastAdmin();
}

function renderPastAdmin() {
  const box = $('#pastAdmin');
  const list = EVENTS.filter(isPast).sort(byDate).reverse();
  if (!list.length) { box.innerHTML = '<div class="empty">No past events yet.</div>'; return; }
  const open = new Set($$('#pastAdmin details[open]').map(d => d.dataset.ev));

  box.innerHTML = (PAST_ADMIN.cmReady ? '' :
      '<div class="notice">Photos and reviews are not set up yet — run supabase/19-community-posts.sql.</div>') +
    list.map(ev => {
      const photos  = PAST_ADMIN.photos.filter(p => p.event_id === ev.id);
      const reviews = PAST_ADMIN.reviews.filter(r => r.event_id === ev.id);
      const booked  = seatsFor(ev.id);
      const checked = PAST_ADMIN.checkins[ev.id] || 0;
      const manual  = ev.attendance ?? '';
      const came    = attendedFor(ev);
      const rate    = booked ? Math.round(came / booked * 100) + '%' : '—';
      return `
      <details class="pe" data-ev="${esc(ev.id)}"${open.has(ev.id) ? ' open' : ''}>
        <summary class="pe__sum">
          <span class="pe__title"><b>${esc(ev.title)}</b>
            <span>${esc(fmtDate(ev, { day: 'numeric', month: 'short', year: 'numeric' }))} · ${esc(ev.venue)}</span></span>
          <span class="pe__nums">
            <span><b>${booked}</b> booked</span>
            <span><b>${came}</b> came</span>
            <span><b>${photos.length}</b> ${photos.length === 1 ? 'photo' : 'photos'}</span>
            <span><b>${reviews.length}</b> ${reviews.length === 1 ? 'review' : 'reviews'}</span>
          </span>
        </summary>

        <div class="pe__body">
          <div class="pe__stats">
            <div><b>${booked}</b><span>Seats booked</span></div>
            <div><b>${checked}</b><span>Checked in at the door</span></div>
            <div><b>${rate}</b><span>Show-up rate</span></div>
          </div>
          <div class="pe__att">
            <label for="att-${esc(ev.id)}">Actual attendance</label>
            <input id="att-${esc(ev.id)}" type="number" min="0" step="1" inputmode="numeric"
                   value="${esc(manual)}" placeholder="${checked}">
            <button class="mini" type="button" data-save-att="${esc(ev.id)}">Save</button>
            <small>Leave empty to use the door check-ins (${checked}).</small>
          </div>

          <div class="admin-head"><h4>Photos</h4>
            ${PAST_ADMIN.cmReady ? `<label class="btn btn--brand btn--sm pe__add">
              <input type="file" accept="image/*" multiple hidden data-add-photos="${esc(ev.id)}">
              <span>Add photos</span></label>` : ''}</div>
          ${photos.length ? `<div class="cm-admin-photos">${photos.map(p => `
            <figure>
              <a href="${esc(p.url)}" target="_blank" rel="noopener"><img src="${esc(p.url)}" alt="" loading="lazy"></a>
              <button class="mini mini--danger" type="button" data-cm-admin-photo="${esc(p.id)}">Delete</button>
            </figure>`).join('')}</div>` : '<div class="empty">No photos yet.</div>'}

          <div class="admin-head"><h4>Reviews</h4></div>
          ${reviews.length ? `<div class="admin-list">${reviews.map(r => `
            <div class="admin-row">
              <div class="admin-row__main">
                <strong>${avatarHTML(r.initials, r.nationality)} ${esc(r.body)}</strong>
                <span>${esc(new Date(r.created_at).toLocaleDateString('en-GB'))}</span>
              </div>
              <div class="admin-row__act">
                <button class="mini mini--danger" type="button" data-cm-admin-review="${esc(r.id)}">Delete</button>
              </div>
            </div>`).join('')}</div>` : '<div class="empty">No reviews yet.</div>'}
        </div>
      </details>`;
    }).join('');

  /* 写真を選んだら、その場で縮めて順に送ります */
  $$('#pastAdmin [data-add-photos]').forEach(input => input.addEventListener('change', async () => {
    const files = [...input.files];
    const eventId = input.dataset.addPhotos;
    input.value = '';
    if (!files.length) return;
    const label = input.nextElementSibling;
    let done = 0;
    for (const f of files) {
      label.textContent = 'Uploading ' + (done + 1) + '/' + files.length + '…';
      try { await uploadCommunityPhoto(eventId, f); done++; }
      catch (err) { toast(err.message, true); break; }
    }
    label.textContent = 'Add photos';
    if (done) toast(done + ' photo(s) added.');
    refreshPastAdmin();
  }));
}

/* 実際に来た人数を保存します（events.attendance）。空欄は「未入力」に戻します */
async function saveAttendance(eventId, value) {
  await ensureSession();
  const n = String(value).trim() === '' ? null : Math.max(0, parseInt(value, 10) || 0);
  const res = await fetch(sbUrl('events', 'id=eq.' + encodeURIComponent(eventId)), {
    method: 'PATCH',
    headers: Object.assign(sbHeaders(), { Prefer: 'return=minimal' }),
    body: JSON.stringify({ attendance: n })
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    if (/attendance/.test(text)) throw new Error('Run supabase/20-event-attendance.sql first.');
    throw new Error('Could not save (' + res.status + ').');
  }
  const ev = findEvent(eventId);
  if (ev) ev.attendance = n;
  saveEvents();
}

/* ---------------------------------------------------------
   Organisers
   --------------------------------------------------------- */
function renderOrganisers() {
  const box = $('#adminOrgList');
  if (!box) return;
  $('#aoCount').textContent = ADMIN_ORGS.length;
  const me = (SESSION && SESSION.user_id) || '';

  /* 招待と削除はオーナーだけです。押せない操作は並べません */
  const form = $('#adminOrgForm');
  if (form) form.hidden = !IS_OWNER;

  box.innerHTML = ADMIN_ORGS.length ? ADMIN_ORGS.map(a => {
    const owner = a.role === 'owner';
    const canRemove = IS_OWNER && !owner && a.user_id !== me;
    return `
    <div class="admin-row">
      <div class="admin-row__main">
        <strong>${esc(a.name || a.email)}
          ${owner ? '<span class="pill">owner</span>' : ''}
          ${a.user_id === me ? '<span class="pill">you</span>' : ''}</strong>
        <span>${a.name ? esc(a.email) + ' · ' : ''}${esc(a.note || '—')} · added ${esc(new Date(a.created_at).toLocaleDateString('en-GB'))}</span>
      </div>
      <div class="admin-row__act">
        ${canRemove
          ? `<button class="mini mini--danger" type="button" data-del-org="${esc(a.user_id)}">Remove</button>`
          : ''}
      </div>
    </div>`; }).join('') : '<div class="empty">Could not read the organiser list.</div>';
}

async function refreshOrganisers() {
  if (!isAdmin) return;
  try {
    /* 古いセッションには user_id が入っていません。
       先に確定させないと、自分の行に「Remove」が出てしまいます。 */
    await ensureUserId();
    ADMIN_ORGS = await adminList();
    const me = (SESSION && SESSION.user_id) || '';
    IS_OWNER = ADMIN_ORGS.some(a => a.user_id === me && a.role === 'owner');
    renderOrganisers();
  } catch (err) {
    ADMIN_ORGS = [];
    $('#adminOrgList').innerHTML = `<div class="empty">${esc(err.message)}</div>`;
    $('#aoCount').textContent = '0';
  }
}

/** Pull the booking list; without a valid session RLS returns nothing. */
async function refreshRsvps() {
  if (!isAdmin) return;
  try {
    ADMIN_RSVPS = await loadRsvps();
    renderAdmin();
  } catch (err) {
    toast('Could not load the bookings: ' + err.message, true);
  }
}

/* 選び直したイベントは、作り直しても保ちます。
   イベントを保存するたびに先頭へ戻ると、名簿を見ている途中で飛ばされます。 */
function fillReminderSelect() {
  const rem = $('#rsvpEvent');
  if (!rem) return;
  const keep = rem.value;
  rem.innerHTML = '<option value="">All events</option>' +
    EVENTS.slice().sort(byDate).reverse()
      .map(e => `<option value="${esc(e.id)}">${esc(fmtDate(e, { day: 'numeric', month: 'short' }))} — ${esc(e.title)}</option>`).join('');
  if (keep && EVENTS.some(e => e.id === keep)) { rem.value = keep; return; }

  /* 初めて開いたときは、次の回を選んでおきます。
     「すべて」のままだと、上の数字が累計になり、いまの回に何人来るのか
     読み取れません。知りたいのはたいてい直近の1回です。 */
  const next = upcoming()[0] || EVENTS.slice().sort(byDate).reverse()[0];
  if (next) rem.value = next.id;
}

/** 表とリマインダーが見ているイベント。空文字は「すべて」です。 */
const rsvpFilter = () => (($('#rsvpEvent') || {}).value || '');

/* ---------------------------------------------------------
   上の数字（全体）
   回ごとの数字は、Events の各行と Past events の中に出します。
   ここには、運営全体の調子が一目で分かるものだけを置きます。
   - Upcoming events … これからの回の数
   - Members … 会員の総数と、この30日で増えた数
   --------------------------------------------------------- */
let MEMBER_STATS = null;   /* { total, recent } */

async function loadMemberStats() {
  try {
    const rows = await sbSelect('profiles', 'select=created_at');
    const since = Date.now() - 30 * 864e5;
    MEMBER_STATS = { total: rows.length, recent: rows.filter(r => new Date(r.created_at).getTime() >= since).length };
  } catch (err) {
    MEMBER_STATS = null;
  }
  renderKpi();
}

function renderKpi() {
  /* 箱には入れず、左に大きく並べます。数字が2つだけなので、見出しのように読ませます */
  $('#adminKpi').innerHTML = `
    <div class="kpi-big"><b>${upcoming().length}</b><span>Upcoming events</span></div>
    <div class="kpi-big"><b>${MEMBER_STATS ? MEMBER_STATS.total : '—'}</b><span>Members${MEMBER_STATS && MEMBER_STATS.recent ? ' · +' + MEMBER_STATS.recent + ' in 30 days' : ''}</span></div>`;
}

function renderAdmin() {
  if (!isAdmin) return;

  renderKpi();

  $('#aeCount').textContent = EVENTS.length;
  const evs = EVENTS.slice().sort(byDate).reverse();
  $('#adminEventList').innerHTML = evs.length ? evs.map(ev => `
    <div class="admin-row">
      <div class="admin-row__main">
        <strong>${esc(ev.title)}
          ${ev.brand === 'en' ? '<span class="pill">En.</span>' : ''}
          ${isPast(ev) ? '<span class="pill">past</span>' : ''}</strong>
        <span>${esc(fmtDate(ev))} · ${esc(fmtTime(ev))} · ${esc(ev.venue)}</span>
        <span class="admin-row__nums">${ADMIN_RSVPS.filter(r => r.eventId === ev.id).length} bookings · ${seatsFor(ev.id)} seats${ev.capacity ? ' / ' + ev.capacity : ''}${isPast(ev) ? ' · ' + attendedFor(ev) + ' came' : ''}</span>
      </div>
      <div class="admin-row__act">
        <a class="mini" href="${esc(publicEventUrl(ev.id))}" target="_blank" rel="noopener">View page</a>
        <button class="mini" type="button" data-edit-ev="${esc(ev.id)}">Edit</button>
        <button class="mini mini--danger" type="button" data-del-ev="${esc(ev.id)}">Delete</button>
      </div>
    </div>`).join('') : '<div class="empty">No events yet.</div>';

  const pick = rsvpFilter();
  const rs = pick ? ADMIN_RSVPS.filter(r => r.eventId === pick) : ADMIN_RSVPS.slice();
  const cnt = $('#rsvpCount');
  if (cnt) {
    const heads = rs.reduce((n, r) => n + (Number(r.guests) || 1), 0);
    cnt.textContent = rs.length
      ? rs.length + (pick ? '' : ' total') + ' · ' + heads + (heads > 1 ? ' people' : ' person')
      : 'none';
  }
  $('#rsvpTable').innerHTML = rs.length ? `
    <thead><tr><th>Received</th>${pick ? '' : '<th>Event</th>'}<th>Name</th><th>Email</th><th>Pax</th><th></th></tr></thead>
    <tbody>${rs.map(r => `<tr>
      <td>${esc(new Date(r.createdAt).toLocaleDateString('en-GB'))}</td>
      ${pick ? '' : `<td>${esc(r.eventTitle)}<br><span class="pill">${esc(r.eventDate)}</span></td>`}
      <td>${esc(r.name)}</td>
      <td><a href="mailto:${esc(r.email)}">${esc(r.email)}</a></td>
      <td>${esc(r.guests)}</td>
      <td><button class="mini mini--danger" type="button" data-del-rsvp="${esc(r.id)}">✕</button></td>
    </tr>`).join('')}</tbody>` : '<tbody><tr><td><div class="empty">No RSVPs yet.</div></td></tr></tbody>';
}

/* イベントページは www 側にあります。admin.asiansocials.nl の上で
   相対パスのまま開くと、転送を1回挟むので、最初から www を指します */
function publicEventUrl(id) {
  return isLocalHost() ? eventUrl(id) : CONFIG.siteUrl + '/e/' + encodeURIComponent(id);
}

/* チェックが外れている項目の入力欄は出しません。
   使わない欄が並んでいると、入れるべきか迷わせるためです。 */
function syncPriceOptions() {
  $('#aeMemberWrap').hidden = !$('#aeMemberOn').checked;
  $('#aeEarlyWrap').hidden  = !$('#aeEarlyOn').checked;
}

function eventFormFill(ev) {
  $('#aeId').value = ev ? ev.id : '';
  $('#aeTitle').value = ev ? ev.title : '';
  $('#aeDate').value = ev ? ev.date : '';
  $('#aeStart').value = ev ? ev.start : '19:00';
  $('#aeEnd').value = ev ? (ev.end || '') : '22:00';
  $('#aeVenue').value = ev ? ev.venue : '';
  $('#aeAddr').value = ev ? (ev.address || '') : '';
  $('#aeEnOn').checked      = !!(ev && ev.brand === 'en');
  $('#aePrice').value       = ev ? centsToInput(ev.priceCents) : '0';
  $('#aeMemberOn').checked  = !!(ev && ev.memberDiscount);
  $('#aeMemberPrice').value = ev ? centsToInput(ev.priceMemberCents) : '';
  $('#aeEarlyOn').checked   = !!(ev && ev.earlyBird);
  $('#aeEarlyPrice').value  = ev ? centsToInput(ev.priceEarlyCents) : '';
  $('#aeEarlyUntil').value  = (ev && ev.earlyBirdUntil) || '';
  syncPriceOptions();
  $('#aeDesc').value = ev ? ev.description : '';
  $('#aeFile').value = '';
  $('#aeImgClear').checked = false;
  $('#aeImgClearWrap').hidden = !(ev && ev.image);
  $('#aeImgState').textContent = ev && ev.image
    ? 'A photo is attached. Pick a new file to replace it.'
    : (supabaseReady() ? 'Uploaded to your Supabase bucket.' : 'Kept in this browser until Supabase is configured.');
  $('#adminEventFormTitle').textContent = ev ? 'Edit event' : 'Add a new event';
  $('#aeSubmit').textContent = ev ? 'Save changes' : 'Publish event';
  /* たたんであっても、編集を押したら開きます */
  const fold = $('#aeFold');
  if (fold && ev) fold.open = true;
}

/* 新しい回の入力フォームは、いつもたたんで開きます（一覧が先に見えるように） */
function prepAdminPanel() {
  const fold = $('#aeFold');
  if (fold && !$('#aeId').value) fold.open = false;
}

function toCsv(rows) {
  if (!rows.length) return '';
  const cols = Object.keys(rows[0]);
  const cell = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
  return [cols.join(','), ...rows.map(r => cols.map(c => cell(r[c])).join(','))].join('\r\n');
}

/* ---------------------------------------------------------
   Wiring
   --------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', () => {
  initShell();
  eventFormFill(null);
  showTab(currentTab());

  /* 「View site」は www へ。ローカルでは同じフォルダのトップへ */
  const site = $('#adminSite');
  if (site) site.href = isLocalHost() ? 'index.html' : CONFIG.siteUrl + '/';

  /* Click delegation */
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-admin-out],[data-edit-ev],[data-del-ev],[data-del-rsvp],[data-del-org],[data-cm-admin-review],[data-cm-admin-photo],[data-save-att]');
    if (!t) return;

    if (t.dataset.saveAtt) {
      const input = document.getElementById('att-' + t.dataset.saveAtt);
      saveAttendance(t.dataset.saveAtt, input ? input.value : '')
        .then(() => { toast('Attendance saved.'); renderPastAdmin(); renderAdmin(); })
        .catch(err => toast(err.message, true));
      return;
    }
    if (t.dataset.cmAdminReview) {
      if (!confirm('Delete this review? It disappears from the site straight away.')) return;
      deleteCommunityReview(t.dataset.cmAdminReview)
        .then(() => { toast('Review deleted.'); refreshPastAdmin(); })
        .catch(err => toast(err.message, true));
      return;
    }
    if (t.dataset.cmAdminPhoto) {
      const p = PAST_ADMIN.photos.find(x => x.id === t.dataset.cmAdminPhoto);
      if (!p || !confirm('Delete this photo? It disappears from the site straight away.')) return;
      deleteCommunityPhoto(p)
        .then(() => { toast('Photo deleted.'); refreshPastAdmin(); })
        .catch(err => toast(err.message, true));
      return;
    }

    if (t.hasAttribute('data-admin-out')) {
      signOut(); isAdmin = false; ADMIN_RSVPS = [];
      showGate('signin');
      return;
    }
    if (t.dataset.editEv) {
      eventFormFill(EVENTS.find(x => x.id === t.dataset.editEv));
      $('#adminEventForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    if (t.dataset.delEv) {
      /* 削除は予約にも波及します。何人ぶんが消えるのかを先に見せます */
      const ev = findEvent(t.dataset.delEv);
      const booked = ADMIN_RSVPS.filter(r => r.eventId === t.dataset.delEv);
      const heads = booked.reduce((n, r) => n + (Number(r.guests) || 1), 0);
      const warn = booked.length
        ? `

${booked.length} booking(s) for ${heads} people will be removed from the door list, and their tickets stop working. Paid orders are marked cancelled — this does not refund anyone.`
        : '';
      if (!confirm(`Delete "${(ev && ev.title) || 'this event'}"?` + warn)) return;
      const gone = t.dataset.delEv;
      EVENTS = EVENTS.filter(x => x.id !== gone);
      ADMIN_RSVPS = ADMIN_RSVPS.filter(r => r.eventId !== gone);
      saveEvents(); fillReminderSelect(); renderAdmin();
      dropEvent(gone)
        .then(() => refreshRsvps())
        .catch(err => toast(err.message, true));
      toast('Event deleted.');
      return;
    }
    if (t.dataset.delOrg) {
      const who = ADMIN_ORGS.find(a => a.user_id === t.dataset.delOrg);
      if (!confirm('Remove ' + (who ? who.email : 'this organiser') +
                   '?\n\nThey keep their member account, but lose access to the admin panel.')) return;
      adminRemove(t.dataset.delOrg)
        .then(refreshOrganisers)
        .then(() => toast('Organiser removed.'))
        .catch(err => toast(err.message, true));
      return;
    }
    if (t.dataset.delRsvp) {
      if (!confirm('Delete this RSVP?')) return;
      const goneRsvp = t.dataset.delRsvp;
      ADMIN_RSVPS = ADMIN_RSVPS.filter(x => x.id !== goneRsvp);
      RSVPS = RSVPS.filter(x => x.id !== goneRsvp); saveRsvps(); renderAdmin();
      deleteRsvp(goneRsvp).catch(err => toast(err.message, true));
      return;
    }
  });

  /* Tabs */
  $$('.tabs [data-tab]').forEach(b => b.addEventListener('click', () => {
    history.replaceState(null, '', '#' + b.dataset.tab);
    showTab(b.dataset.tab);
  }));
  window.addEventListener('hashchange', () => showTab(currentTab()));

  $('#adminOrgForm').addEventListener('submit', async e => {
    e.preventDefault();
    const email = $('#aoEmail').value.trim();
    if (!isEmail(email)) return toast('Enter a valid email address.', true);

    const btn = $('#aoSubmit'), label = btn.textContent;
    btn.disabled = true; btn.textContent = 'Sending…';
    try {
      const out = await adminInvite(email, $('#aoNote').value.trim());
      $('#aoEmail').value = ''; $('#aoNote').value = '';
      await refreshOrganisers();
      toast(out.existed
        ? email + ' is now an organiser. We emailed them a password link.'
        : 'Invitation sent to ' + email + '. They set their own password.');
    } catch (err) {
      toast(err.message, true);
    }
    btn.disabled = false; btn.textContent = label;
  });

  /* Event form */
  $('#adminEventReset').addEventListener('click', () => eventFormFill(null));
  $('#aeMemberOn').addEventListener('change', syncPriceOptions);
  $('#aeEarlyOn').addEventListener('change', syncPriceOptions);
  $('#adminEventForm').addEventListener('submit', async e => {
    e.preventDefault();
    const required = ['#aeTitle', '#aeDate', '#aeStart', '#aeVenue', '#aeDesc'];
    if (required.some(sel => !$(sel).value.trim()))
      return toast('Fill in title, date, start time, venue and description.', true);

    /* チェックが入っているのに金額が空だと、表示側でどう出すか決められません */
    if ($('#aeMemberOn').checked && !$('#aeMemberPrice').value.trim())
      return toast('Member discount is ticked — fill in the member price.', true);
    if ($('#aeEarlyOn').checked && (!$('#aeEarlyPrice').value.trim() || !$('#aeEarlyUntil').value))
      return toast('Early bird is ticked — fill in the price and the last day.', true);

    const id = $('#aeId').value;
    const existing = EVENTS.find(x => x.id === id);
    const btn = $('#aeSubmit'), label = btn.textContent;
    const file = $('#aeFile').files[0];

    let image = $('#aeImgClear').checked ? '' : (existing ? existing.image : '');
    if (file) {
      btn.disabled = true; btn.textContent = 'Uploading photo…';
      try { image = await uploadImage(file); }
      catch (err) { btn.disabled = false; btn.textContent = label; return toast(err.message, true); }
      btn.disabled = false; btn.textContent = label;
    }

    const rec = {
      id: id || uid(),
      title: $('#aeTitle').value.trim(),
      date: $('#aeDate').value,
      start: $('#aeStart').value,
      end: $('#aeEnd').value,
      venue: $('#aeVenue').value.trim(),
      address: $('#aeAddr').value.trim(),
      /* En. の回かどうか。ホームの En. セクションはここを見ています */
      brand:            $('#aeEnOn').checked ? 'en' : 'asian-social',
      priceCents:       inputToCents($('#aePrice').value),
      currency:         'EUR',
      memberDiscount:   $('#aeMemberOn').checked,
      priceMemberCents: $('#aeMemberOn').checked ? inputToCents($('#aeMemberPrice').value) : null,
      earlyBird:        $('#aeEarlyOn').checked,
      priceEarlyCents:  $('#aeEarlyOn').checked ? inputToCents($('#aeEarlyPrice').value) : null,
      earlyBirdUntil:   $('#aeEarlyOn').checked ? ($('#aeEarlyUntil').value || null) : null,
      image,
      description: $('#aeDesc').value.trim()
    };
    /* 先に Supabase へ保存し、通ってから画面に出します。
       逆にすると、保存に失敗しても一覧には残り、再読み込みで消えます。 */
    btn.disabled = true; btn.textContent = 'Saving…';
    try {
      await pushEvent(rec);
    } catch (err) {
      btn.disabled = false; btn.textContent = label;
      return toast('Not saved: ' + err.message, true);
    }
    btn.disabled = false; btn.textContent = label;

    if (existing) Object.assign(existing, rec); else EVENTS.push(rec);
    saveEvents(); eventFormFill(null); fillReminderSelect(); renderAdmin();
    toast(existing ? 'Event updated' : 'Event published');
    /* 新しいページや日付の変更に、Google が早く気づくように */
    notifyGoogle();
  });

  /* Reminders + exports */
  /* 実際に参加者へ届くので、押した瞬間には送りません。
     何人に送るのかを見せてから送ります。 */
  $('#sendReminder').addEventListener('click', async (e) => {
    const ev = findEvent(rsvpFilter());
    if (!ev) return toast('Pick an event first.', true);
    const list = ADMIN_RSVPS.filter(r => r.eventId === ev.id);
    const heads = new Set(list.map(r => String(r.email || '').toLowerCase())).size;
    if (!heads) return toast('Nobody has booked this event yet.', true);

    const ask = `Send a reminder for "${ev.title}" to ${heads} ${heads > 1 ? 'people' : 'person'}?

They receive it straight away.`;
    if (!confirm(ask)) return;

    const btn = e.currentTarget;
    btn.disabled = true;
    const was = btn.textContent;
    btn.textContent = 'Sending…';
    try {
      const out = await sendEventReminder(ev.id);
      toast('Reminder sent to ' + (out.recipients || heads) + ' attendee(s).');
    } catch (err) {
      toast(err.message, true);
    } finally {
      btn.disabled = false; btn.textContent = was;
    }
  });

  $('#copyEmails').addEventListener('click', async () => {
    const ev = findEvent(rsvpFilter());
    const list = ev ? ADMIN_RSVPS.filter(r => r.eventId === ev.id) : [];
    const emails = [...new Set(list.map(r => r.email))].join(', ');
    if (!emails) return toast('No addresses for that event.', true);
    try { await navigator.clipboard.writeText(emails); toast('Copied ' + list.length + ' address(es).'); }
    catch { prompt('Copy the addresses:', emails); }
  });

  /* 表を絞ったら CSV も同じ範囲にします。見えているものと出るものが違うと
     気づかないまま配ってしまいます */
  $('#rsvpEvent').addEventListener('change', renderAdmin);


  $('#exportRsvp').addEventListener('click', () => {
    const ev   = findEvent(rsvpFilter());
    const rows = ev ? ADMIN_RSVPS.filter(r => r.eventId === ev.id) : ADMIN_RSVPS;
    if (!rows.length) return toast('Nothing to export.', true);
    const slug = ev ? '-' + String(ev.title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) : '';
    download('asr-rsvps' + slug + '.csv', toCsv(rows), 'text/csv;charset=utf-8');
  });

  /* サインイン・サインアウトのたびに出し分け直します */
  document.addEventListener('member:changed', gate);
  gate();
});
