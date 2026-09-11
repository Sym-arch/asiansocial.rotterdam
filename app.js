/* =========================================================
   Asian Social Rotterdam — home page (index.html)
   Requires core.js
   ========================================================= */

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

/* ---------------------------------------------------------
   Hero — next events strip
   --------------------------------------------------------- */
function renderHeroNext() {
  const box = $('#heroNext');
  const list = upcoming().slice(0, 3);
  if (!list.length) {
    box.innerHTML = `<p class="upnext__none">${esc(t('upnext.none'))}</p>`;
    return;
  }
  /* 写真が無い回もあります。そのときも同じ幅の枠を置きます。
     置かないと、その行だけ文字の始まりがずれます。 */
  box.innerHTML = list.map(ev => `
    <a class="next-item" href="${esc(eventUrl(ev.id))}">
      <span class="next-item__img">
        ${ev.image ? `<img src="${esc(ev.image)}" alt="" loading="lazy">` : ''}
      </span>
      <time>${esc(fmtDate(ev, { day: 'numeric', month: 'short' }))}</time>
      <strong>${esc(ev.title)}</strong>
      <span class="next-item__meta">${esc(fmtTime(ev))} · ${esc(ev.venue)}</span>
    </a>`).join('');
}

/* ---------------------------------------------------------
   Events — horizontal timeline
   --------------------------------------------------------- */
function renderEventRail() {
  const track = $('#eventsTrack');
  const next = upcoming();
  const past = EVENTS.filter(isPast).sort(byDate).reverse().slice(0, 2);
  const all = next.concat(past);
  track.innerHTML = all.length
    ? all.map(eventCardHTML).join('')
    : `<div class="empty empty--rail">
         <b>${esc(t('events.none'))}</b>
         <span>${esc(t('events.noneBody'))}
           <a href="mailto:${esc(CONFIG.contactEmail)}">${esc(CONFIG.contactEmail)}</a>.</span>
       </div>`;

  const hint = $('#eventsHint');
  if (hint) hint.hidden = !all.length;

  const count = $('#eventsCount');
  if (count) {
    count.textContent = next.length
      ? `${t('events.upcoming', { n: next.length })} · ${fmtDate(next[0], { month: 'long' })} – ${fmtDate(next[next.length - 1], { month: 'long', year: 'numeric' })}`
      : '';
  }
}

/* En. の回だけを並べます。events の brand 列で見分けます。
   1件も無いときは枠ごと隠します。空の枠は場所を取るだけです。 */
function renderEnEvents() {
  const box = $('#enEvents');
  if (!box) return;
  const list = upcoming().filter(ev => ev.brand === 'en');
  box.hidden = !list.length;
  if (!list.length) { box.innerHTML = ''; return; }
  box.innerHTML = list.slice(0, 3).map(ev => `
    <a class="en-event" href="${esc(eventUrl(ev.id))}">
      <span class="en-event__img">
        ${ev.image ? `<img src="${esc(ev.image)}" alt="" loading="lazy">` : ''}
      </span>
      <span class="en-event__body">
        <span class="en-event__date">${esc(fmtDate(ev, { weekday: 'short', day: 'numeric', month: 'short' }))}</span>
        <b>${esc(ev.title)}</b>
        <span class="en-event__meta">${esc(fmtTime(ev))} \u00b7 ${esc(ev.venue)}</span>
      </span>
      <span class="en-event__price">${esc(priceFor(ev).label)}</span>
    </a>`).join('');
}

/* ---------------------------------------------------------
   Scroll-driven horizontal rails
   Scrolling down through a pinned section moves the track right.
   Falls back to a plain swipe track on small screens.
   --------------------------------------------------------- */
const rails = [];

function createRail(railSel, trackSel, barSel) {
  const rail = $(railSel), track = $(trackSel), bar = $(barSel);
  if (!rail || !track) return null;
  const vp = rail.querySelector('.rail__vp');
  const api = { rail, track, bar, vp, shift: 0, measure, update };

  function isStatic() {
    return window.innerWidth <= 820 || reducedMotion.matches;
  }

  function measure() {
    const hasCards = track.querySelector('.ev-card');
    if (!hasCards || isStatic() || rail.offsetParent === null) {
      rail.classList.add('is-static');
      rail.style.height = '';
      track.style.transform = '';
      api.shift = 0;
      return;
    }
    api.shift = Math.max(0, track.scrollWidth - window.innerWidth);
    if (api.shift < 40) {           // everything already fits: no need to pin
      rail.classList.add('is-static');
      rail.style.height = '';
      track.style.transform = '';
      api.shift = 0;
      return;
    }
    rail.classList.remove('is-static');
    rail.style.height = (vp.offsetHeight + api.shift) + 'px';
    update();
  }

  function update() {
    if (rail.classList.contains('is-static') || api.shift <= 0) return;
    const headerH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || 70;
    const travelled = headerH - rail.getBoundingClientRect().top;
    const p = Math.min(1, Math.max(0, travelled / api.shift));
    track.style.transform = 'translate3d(' + (-p * api.shift).toFixed(2) + 'px,0,0)';
    if (bar) bar.style.width = (p * 100).toFixed(2) + '%';
  }

  rails.push(api);
  return api;
}

function measureRails() { rails.forEach(r => r.measure()); }

function bindRailScroll() {
  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { rails.forEach(r => r.update()); ticking = false; });
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', () => setTimeout(measureRails, 120));
  reducedMotion.addEventListener?.('change', measureRails);
}

/* ---------------------------------------------------------
   Calendar
   --------------------------------------------------------- */
function initialCalMonth() {
  const next = upcoming()[0];
  const d = next ? startOf(next) : new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
let calCursor = initialCalMonth();
let calTouched = false;   // don't jump the month away while it is being browsed

/* 曜日の見出し。名前は直書きせず、その言語から作ります。
   2024-01-01 は月曜なので、そこから7日ぶん並べれば月曜始まりになります。 */
function renderDow() {
  const monday = new Date(2024, 0, 1);
  const names = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
    names.push(d.toLocaleDateString(dateLocale(), { weekday: 'short' }));
  }
  $('#calDow').innerHTML = names.map(d => `<div class="cal__dow">${esc(d)}</div>`).join('');
}

function renderCalendar() {
  const grid = $('#calGrid');
  const y = calCursor.getFullYear(), m = calCursor.getMonth();
  $('#calTitle').textContent = calCursor.toLocaleDateString(dateLocale(), { month: 'long', year: 'numeric' });

  const offset = (new Date(y, m, 1).getDay() + 6) % 7;      // Monday-first
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const daysPrev = new Date(y, m, 0).getDate();
  const cells = [];

  for (let i = offset - 1; i >= 0; i--) cells.push({ day: daysPrev - i, out: true });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, out: false });
  while (cells.length % 7 !== 0) cells.push({ day: cells.length - offset - daysInMonth + 1, out: true });

  const today = new Date();
  const todayKey = today.getFullYear() + '-' + pad(today.getMonth() + 1) + '-' + pad(today.getDate());

  grid.innerHTML = cells.map(c => {
    if (c.out) return `<div class="cal__cell is-out"><span class="cal__num">${c.day}</span></div>`;
    const key = y + '-' + pad(m + 1) + '-' + pad(c.day);
    const evs = EVENTS.filter(e => e.date === key).sort((a, b) => a.start.localeCompare(b.start));
    const chips = evs.map(ev => {
      return `<a class="cal__ev ${isPast(ev) ? 'is-past' : ''}"
                href="${esc(eventUrl(ev.id))}" title="${esc(ev.start + ' ' + ev.title)}"
                aria-label="${esc(ev.title + ' — ' + fmtDate(ev))}">${esc(ev.start)} ${esc(ev.title)}</a>`;
    }).join('');
    return `<div class="cal__cell ${key === todayKey ? 'is-today' : ''}">
      <span class="cal__num">${c.day}</span>${chips}</div>`;
  }).join('');
}

/* ---------------------------------------------------------
   Contact + partner forms
   --------------------------------------------------------- */
/* ---------------------------------------------------------
   Modals (admin)
   --------------------------------------------------------- */
function openModal(sel) {
  $(sel).classList.add('is-open');
  document.body.classList.add('is-locked');
}
function closeModal(el) {
  el.classList.remove('is-open');
  if (!$$('.modal.is-open').length) document.body.classList.remove('is-locked');
}

/* ---------------------------------------------------------
   Admin
   --------------------------------------------------------- */
/* 「サインインしている」は「管理者である」ではありません。
   会員も同じ仕組みでサインインするようになったので、ここを取り違えると
   予約したお客さん全員に管理画面が開いてしまいます。
   admins テーブルに載っているかをサーバに聞いて決めます。 */
let isAdmin = false;
let ADMIN_RSVPS = [];   // every booking, read from Supabase once signed in

async function refreshAdminFlag() {
  if (!isSignedIn()) { isAdmin = false; return false; }
  try { isAdmin = await isAdminUser(); }
  catch { isAdmin = false; }          /* 確かめられないときは開けません */
  return isAdmin;
}

/* Admin ボタンは、管理者だと確かめられたときだけ出します。
   以前は「この端末で前にサインインしたか」を目印にして出していましたが、
   主催者が一度使った端末に入口が残り、会員にも見えて紛らわしいものでした。
   端末ではなく、その時サインインしている人で決めます。 */
function revealAdminEntry() {
  const btn = $('#adminOpen');
  if (btn) btn.hidden = false;
}
function hideAdminEntry() {
  const btn = $('#adminOpen');
  if (btn) btn.hidden = true;
}

async function requireAdmin() {
  /* Admin もフォームの塊なので、翻訳ページでは警告に阻まれます。
     開かずに、そのまま英語の本来のページへ送ります。 */
  if (onProxy()) { location.href = nativeUrl('en', '#admin'); return; }

  if (!isAdmin && isSignedIn()) await refreshAdminFlag();
  if (isAdmin) { renderAdmin(); openModal('#adminModal'); refreshRsvps(); return; }

  /* ここへ来るのは、押した時点で権限が外れていた場合だけです。
     ボタンはもともと管理者にしか出していません。 */
  hideAdminEntry();
  toast(isSignedIn() ? 'That account is not an organiser.' : 'Please sign in first.', true);
}

/* 管理者の一覧。開いたときにだけ読みます。
   admins は普段の描画では使わないので、常に持ち歩く必要がありません。 */
let ADMIN_ORGS = [];
let IS_OWNER = false;

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
  if (keep && EVENTS.some(e => e.id === keep)) rem.value = keep;
}

/** 表とリマインダーが見ているイベント。空文字は「すべて」です。 */
const rsvpFilter = () => (($('#rsvpEvent') || {}).value || '');

function renderAdmin() {
  if (!isAdmin) return;

  const seatsBooked = ADMIN_RSVPS.reduce((n, r) => n + (Number(r.guests) || 1), 0);
  $('#adminKpi').innerHTML = `
    <div><b>${upcoming().length}</b><span>Upcoming events</span></div>
    <div><b>${ADMIN_RSVPS.length}</b><span>RSVPs</span></div>
    <div><b>${seatsBooked}</b><span>Seats booked</span></div>
    <div><b>${MSGS.length}</b><span>Messages</span></div>`;

  $('#aeCount').textContent = EVENTS.length;
  const evs = EVENTS.slice().sort(byDate).reverse();
  $('#adminEventList').innerHTML = evs.length ? evs.map(ev => `
    <div class="admin-row">
      <div class="admin-row__main">
        <strong>${esc(ev.title)}
          ${ev.brand === 'en' ? '<span class="pill">En.</span>' : ''}
          ${isPast(ev) ? '<span class="pill">past</span>' : ''}</strong>
        <span>${esc(fmtDate(ev))} · ${esc(fmtTime(ev))} · ${esc(ev.venue)} · ${ADMIN_RSVPS.filter(r => r.eventId === ev.id).length} RSVPs</span>
      </div>
      <div class="admin-row__act">
        <a class="mini" href="${esc(eventUrl(ev.id))}" target="_blank" rel="noopener">View page</a>
        <button class="mini" type="button" data-edit-ev="${esc(ev.id)}">Edit</button>
        <button class="mini" type="button" data-dup-ev="${esc(ev.id)}">Duplicate</button>
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

  const ms = MSGS.slice().reverse();
  $('#msgTable').innerHTML = ms.length ? `
    <thead><tr><th>Received</th><th>Type</th><th>From</th><th>Subject</th><th>Message</th><th></th></tr></thead>
    <tbody>${ms.map(m => `<tr>
      <td>${esc(new Date(m.createdAt).toLocaleDateString('en-GB'))}</td>
      <td><span class="pill ${m.kind === 'partner' ? 'pill--orange' : ''}">${esc(m.kind)}</span></td>
      <td>${esc(m.name)}${m.company ? '<br><small>' + esc(m.company) + '</small>' : ''}<br><a href="mailto:${esc(m.email)}">${esc(m.email)}</a></td>
      <td>${esc(m.topic || '—')}${m.website ? '<br><small>' + esc(m.website) + '</small>' : ''}</td>
      <td>${esc(m.message)}</td>
      <td><button class="mini mini--danger" type="button" data-del-msg="${esc(m.id)}">✕</button></td>
    </tr>`).join('')}</tbody>` : '<tbody><tr><td><div class="empty">No messages yet.</div></td></tr></tbody>';
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
}

function toCsv(rows) {
  if (!rows.length) return '';
  const cols = Object.keys(rows[0]);
  const cell = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
  return [cols.join(','), ...rows.map(r => cols.map(c => cell(r[c])).join(','))].join('\r\n');
}

function refreshPublic() {
  renderCalendar(); renderEventRail(); renderHeroNext(); fillReminderSelect();
  requestAnimationFrame(measureRails);
}

/* ---------------------------------------------------------
   Wiring
   --------------------------------------------------------- */
/**
 * 翻訳ページでは入力欄を出さない。
 * プロキシは <input> にフォーカスが入ると警告を出して入力を止めるので、
 * 母語の案内と「自前ドメイン ＋ ?lang=xx」へのボタンだけを見せます。
 */
document.addEventListener('DOMContentLoaded', () => {
  initShell();
  renderDow();

  createRail('#eventsRail', '#eventsTrack', '#eventsProgress');
  bindRailScroll();
  window.addEventListener('load', measureRails);

  const drawAll = () => {
    if (!calTouched) calCursor = initialCalMonth();
    renderCalendar(); renderEventRail(); renderHeroNext(); renderEnEvents();
    fillReminderSelect(); renderAdmin();
    keepLangOnLinks();   /* カードは後から描かれるので、描くたびに ?lang= を付け直す */
    requestAnimationFrame(measureRails);
  };
  bootstrapContent(drawAll);

  /* Scroll-spy */
  ['home', 'events', 'membership', 'en'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (!en.isIntersecting) return;
        $$('.nav a').forEach(a => a.classList.toggle('is-active', a.getAttribute('href') === '#' + en.target.id));
      });
    }, { rootMargin: '-45% 0px -50% 0px' }).observe(el);
  });

  /* Calendar nav */
  $('#calPrev').addEventListener('click', () => { calTouched = true; calCursor.setMonth(calCursor.getMonth() - 1); renderCalendar(); });
  $('#calNext').addEventListener('click', () => { calTouched = true; calCursor.setMonth(calCursor.getMonth() + 1); renderCalendar(); });
  $('#calToday').addEventListener('click', () => { calTouched = true; calCursor = new Date(); calCursor.setDate(1); renderCalendar(); });

  /* Timeline / calendar switch */
  $$('.seg [data-view]').forEach(b => b.addEventListener('click', () => {
    $$('.seg [data-view]').forEach(x => x.classList.toggle('is-on', x === b));
    const calendar = b.dataset.view === 'calendar';
    $('#viewCalendar').hidden = !calendar;
    $('#viewList').hidden = calendar;
    requestAnimationFrame(measureRails);
  }));

  /* Admin click delegation */
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-close],[data-edit-ev],[data-dup-ev],[data-del-ev],[data-del-rsvp],[data-del-msg],[data-del-org]');
    if (!t) return;

    if (t.hasAttribute('data-close')) { closeModal(t.closest('.modal')); return; }

    if (t.dataset.editEv) {
      eventFormFill(EVENTS.find(x => x.id === t.dataset.editEv));
      $('#adminEventForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    if (t.dataset.dupEv) {
      const src = EVENTS.find(x => x.id === t.dataset.dupEv);
      if (!src) return;
      const copy = Object.assign({}, src, { id: uid(), title: src.title + ' (copy)' });
      EVENTS.push(copy);
      saveEvents(); refreshPublic(); renderAdmin();
      pushEvent(copy).catch(err => toast(err.message, true));
      toast('Event duplicated — edit the date before publishing.');
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
      saveEvents(); refreshPublic(); renderAdmin();
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
    if (t.dataset.delMsg) {
      if (!confirm('Delete this message?')) return;
      MSGS = MSGS.filter(x => x.id !== t.dataset.delMsg); saveMsgs(); renderAdmin();
      return;
    }
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') $$('.modal.is-open').forEach(closeModal);
  });

  /* Admin login */
  $('#adminOpen').addEventListener('click', requireAdmin);

  /* 入口は「管理者だと確かめられたとき」だけ出します。
     端末の目印で先に出していた頃は、主催者が一度使った端末に
     Admin が残り、会員にも見えて紛らわしいものでした。
     主催者は先にサインインします（ヘッダーの Log in）。
     サインインすればボタンが現れます。 */
  refreshAdminFlag().then(ok => {
    if (ok) { revealAdminEntry(); refreshRsvps(); return; }
    /* 会員として入っているだけの人には入口を出しません */
    if (isSignedIn()) hideAdminEntry();
  });

  /* マイページから戻ってくる道。#admin で開けますが、
     先に管理者かどうかを確かめます。確かめる前に出すと、
     URL を知っているだけの人にボタンが見えます。 */
  async function openAdminFromHash() {
    if (location.hash !== '#admin') return;
    if (!(await refreshAdminFlag())) return;
    revealAdminEntry();
    requireAdmin();
  }
  openAdminFromHash();
  window.addEventListener('hashchange', openAdminFromHash);

  /* 予約の途中でサインインした場合も、その場で入口を出します */
  document.addEventListener('member:changed', () => {
    refreshAdminFlag().then(ok => (ok ? revealAdminEntry() : hideAdminEntry()));
  });
  $('#adminLogout').addEventListener('click', () => {
    signOut(); isAdmin = false; ADMIN_RSVPS = [];
    closeModal($('#adminModal'));
    /* もう見られない画面を開いたままにしません。最初の画面へ戻します */
    location.href = homeUrl();
  });

  /* Admin tabs */
  $$('.tabs [data-tab]').forEach(b => b.addEventListener('click', () => {
    $$('.tabs [data-tab]').forEach(x => x.classList.toggle('is-on', x === b));
    $$('.tabpane').forEach(p => p.classList.toggle('is-on', p.dataset.pane === b.dataset.tab));
    /* 管理者の一覧は開いたときに取りに行きます */
    if (b.dataset.tab === 'organisers') refreshOrganisers();
  }));

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

  /* Admin: event form */
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
    if (existing) Object.assign(existing, rec); else EVENTS.push(rec);
    saveEvents(); eventFormFill(null); refreshPublic(); renderAdmin();
    try { await pushEvent(rec); } catch (err) { return toast(err.message, true); }
    toast(existing ? 'Event updated' : 'Event published');
  });

  /* Admin: reminders + exports */
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
  $('#exportMsg').addEventListener('click', () => {
    if (!MSGS.length) return toast('Nothing to export.', true);
    download('asr-messages.csv', toCsv(MSGS), 'text/csv;charset=utf-8');
  });

  eventFormFill(null);
});
