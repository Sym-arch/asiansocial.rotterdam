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
    box.innerHTML = '<p class="upnext__none">Nothing scheduled right now — the next one will appear here.</p>';
    return;
  }
  box.innerHTML = list.map(ev => `
    <a class="next-item" href="${esc(eventUrl(ev.id))}">
      <time>${esc(fmtDate(ev, { day: 'numeric', month: 'short' }))}</time>
      <strong>${esc(ev.title)}</strong>
      <span>${esc(fmtTime(ev))} · ${esc(ev.venue)}</span>
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
         <b>Nothing on the calendar yet.</b>
         <span>The next gathering will show up here — check back soon, or write to
           <a href="mailto:${esc(CONFIG.contactEmail)}">${esc(CONFIG.contactEmail)}</a>.</span>
       </div>`;

  const hint = $('#eventsHint');
  if (hint) hint.hidden = !all.length;

  const count = $('#eventsCount');
  if (count) {
    count.textContent = next.length
      ? `${next.length} upcoming · ${fmtDate(next[0], { month: 'long' })} – ${fmtDate(next[next.length - 1], { month: 'long', year: 'numeric' })}`
      : '';
  }
}

/* ---------------------------------------------------------
   Note — the blog, its own rail
   --------------------------------------------------------- */
function renderNotes() {
  const track = $('#noteTrack');
  const list = NOTES.slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));
  track.innerHTML = list.length
    ? list.map(noteCardHTML).join('')
    : `<div class="empty empty--rail">
         <b>No articles yet.</b>
         <span>The first posts are being written.</span>
       </div>`;
  const hint = $('#noteHint');
  if (hint) hint.hidden = !list.length;
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
    const hasCards = track.querySelector('.ev-card, .note-card');
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

function renderDow() {
  $('#calDow').innerHTML = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    .map(d => `<div class="cal__dow">${d}</div>`).join('');
}

function renderCalendar() {
  const grid = $('#calGrid');
  const y = calCursor.getFullYear(), m = calCursor.getMonth();
  $('#calTitle').textContent = calCursor.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

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
async function handleMessage(e, kind) {
  e.preventDefault();
  const f = e.target;
  const get = id => (($(id) || {}).value || '').trim();

  const data = kind === 'partner'
    ? { name: get('#pName'), email: get('#pEmail'), company: get('#pCompany'),
        topic: get('#pType'), website: get('#pSite'), message: get('#pMsg') }
    : { name: get('#cName'), email: get('#cEmail'), topic: get('#cTopic'), message: get('#cMsg') };

  if (!data.name || !data.email || !data.message) return toast('Please fill in every required field.', true);
  if (!isEmail(data.email)) return toast('That email address looks incomplete.', true);

  MSGS.push(Object.assign({ id: uid(), kind, createdAt: new Date().toISOString() }, data));
  saveMsgs();

  const btn = f.querySelector('button[type=submit]');
  const label = btn.textContent;
  btn.disabled = true; btn.textContent = 'Sending…';

  const subject = kind === 'partner'
    ? `[Partner inquiry] ${data.company} — ${data.topic}`
    : `[Contact] ${data.topic} — ${data.name}`;
  const body = Object.entries(data).map(([k, v]) => k.replace(/^\w/, c => c.toUpperCase()) + ': ' + (v || '—')).join('\n');

  let mode = 'manual';
  try {
    mode = await deliver(kind, Object.assign({ type: kind, subject, to_email: CONFIG.contactEmail, reply_to: data.email }, data));
  } catch (err) { console.warn('Email delivery failed:', err); mode = 'manual'; }

  btn.disabled = false; btn.textContent = label;

  if (mode === 'manual') {
    window.location.href = mailtoUrl(CONFIG.contactEmail, subject, body);
    toast('Opening your mail app to send the message to ' + CONFIG.contactEmail);
  } else {
    f.reset();
    toast('Thanks! Your message is on its way — we reply within a few days.');
  }
  renderAdmin();
}

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
let isAdmin = sessionStorage.getItem('asr.admin') === '1';

/* The Admin button is hidden for everyone. It only appears on a browser that
   has signed in here before (remembered on this device), or when the page is
   opened with #admin. A static site cannot know who the visitor is, so this
   keeps the entry point out of sight rather than authenticating anyone. */
const ADMIN_DEVICE = 'asr.adminDevice';
const isAdminDevice = () => {
  try { return localStorage.getItem(ADMIN_DEVICE) === '1'; } catch { return false; }
};
function rememberAdminDevice() {
  try { localStorage.setItem(ADMIN_DEVICE, '1'); } catch {}
}
function revealAdminEntry() {
  const btn = $('#adminOpen');
  if (btn) btn.hidden = false;
}

function requireAdmin() {
  if (isAdmin) { renderAdmin(); openModal('#adminModal'); }
  else { openModal('#loginModal'); setTimeout(() => $('#adminPass').focus(), 60); }
}

function fillReminderSelect() {
  const rem = $('#reminderEvent');
  if (rem) rem.innerHTML = EVENTS.slice().sort(byDate).reverse()
    .map(e => `<option value="${esc(e.id)}">${esc(fmtDate(e, { day: 'numeric', month: 'short' }))} — ${esc(e.title)}</option>`).join('');
}

function renderAdmin() {
  if (!isAdmin) return;

  const seatsBooked = RSVPS.reduce((n, r) => n + (Number(r.guests) || 1), 0);
  $('#adminKpi').innerHTML = `
    <div><b>${upcoming().length}</b><span>Upcoming events</span></div>
    <div><b>${RSVPS.length}</b><span>RSVPs</span></div>
    <div><b>${seatsBooked}</b><span>Seats booked</span></div>
    <div><b>${MSGS.length}</b><span>Messages</span></div>
    <div><b>${NOTES.length}</b><span>Note articles</span></div>`;

  $('#aeCount').textContent = EVENTS.length;
  const evs = EVENTS.slice().sort(byDate).reverse();
  $('#adminEventList').innerHTML = evs.length ? evs.map(ev => `
    <div class="admin-row">
      <div class="admin-row__main">
        <strong>${esc(ev.title)} ${isPast(ev) ? '<span class="pill">past</span>' : ''}</strong>
        <span>${esc(fmtDate(ev))} · ${esc(fmtTime(ev))} · ${esc(ev.venue)} · ${RSVPS.filter(r => r.eventId === ev.id).length} RSVPs</span>
      </div>
      <div class="admin-row__act">
        <a class="mini" href="${esc(eventUrl(ev.id))}" target="_blank" rel="noopener">View page</a>
        <button class="mini" type="button" data-edit-ev="${esc(ev.id)}">Edit</button>
        <button class="mini" type="button" data-dup-ev="${esc(ev.id)}">Duplicate</button>
        <button class="mini mini--danger" type="button" data-del-ev="${esc(ev.id)}">Delete</button>
      </div>
    </div>`).join('') : '<div class="empty">No events yet.</div>';

  $('#anCount').textContent = NOTES.length;
  const ns = NOTES.slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));
  $('#adminNoteList').innerHTML = ns.length ? ns.map(n => `
    <div class="admin-row">
      <div class="admin-row__main">
        <strong>${esc(n.title)}</strong>
        <span>${esc(n.date || '—')} · ${esc(n.tag || 'note')} · ${esc(n.url)}</span>
      </div>
      <div class="admin-row__act">
        <button class="mini" type="button" data-edit-note="${esc(n.id)}">Edit</button>
        <button class="mini mini--danger" type="button" data-del-note="${esc(n.id)}">Delete</button>
      </div>
    </div>`).join('') : '<div class="empty">No articles yet.</div>';

  const rs = RSVPS.slice().reverse();
  $('#rsvpTable').innerHTML = rs.length ? `
    <thead><tr><th>Received</th><th>Event</th><th>Name</th><th>Email</th><th>Pax</th><th></th></tr></thead>
    <tbody>${rs.map(r => `<tr>
      <td>${esc(new Date(r.createdAt).toLocaleDateString('en-GB'))}</td>
      <td>${esc(r.eventTitle)}<br><span class="pill">${esc(r.eventDate)}</span></td>
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

function eventFormFill(ev) {
  $('#aeId').value = ev ? ev.id : '';
  $('#aeTitle').value = ev ? ev.title : '';
  $('#aeDate').value = ev ? ev.date : '';
  $('#aeStart').value = ev ? ev.start : '19:00';
  $('#aeEnd').value = ev ? (ev.end || '') : '22:00';
  $('#aeVenue').value = ev ? ev.venue : '';
  $('#aeAddr').value = ev ? (ev.address || '') : '';
  $('#aePrice').value = ev ? (ev.price || 'Free') : 'Free';
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

function noteFormFill(n) {
  $('#anId').value = n ? n.id : '';
  $('#anTitle').value = n ? n.title : '';
  $('#anUrl').value = n ? n.url : '';
  $('#anDate').value = n ? (n.date || '') : '';
  $('#anTag').value = n ? (n.tag || '') : '';
  $('#anDesc').value = n ? n.description : '';
  $('#anFile').value = '';
  $('#anImgClear').checked = false;
  $('#anImgClearWrap').hidden = !(n && n.image);
  $('#anImgState').textContent = n && n.image
    ? 'A thumbnail is attached. Pick a new file to replace it.'
    : (supabaseReady() ? 'Uploaded to your Supabase bucket.' : 'Kept in this browser until Supabase is configured.');
  $('#adminNoteFormTitle').textContent = n ? 'Edit article' : 'Add a note article';
  $('#anSubmit').textContent = n ? 'Save changes' : 'Publish article';
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
document.addEventListener('DOMContentLoaded', () => {
  initShell();
  renderDow();

  createRail('#eventsRail', '#eventsTrack', '#eventsProgress');
  createRail('#noteRail', '#noteTrack', '#noteProgress');
  bindRailScroll();
  window.addEventListener('load', measureRails);

  const drawAll = () => {
    if (!calTouched) calCursor = initialCalMonth();
    renderCalendar(); renderEventRail(); renderHeroNext(); renderNotes();
    fillReminderSelect(); renderAdmin();
    requestAnimationFrame(measureRails);
  };
  bootstrapContent(drawAll);

  /* content created before the tables existed would otherwise stay stranded
     in this browser, so lift it up once from the admin's own device */
  if (supabaseReady() && isAdminDevice()) {
    loadContent()
      .then(() => syncLocalToSupabase())
      .then(r => {
        if (!r.events && !r.notes) return;
        toast(`Uploaded ${r.events} event(s) and ${r.notes} article(s) to Supabase.`);
        return loadContent().then(drawAll);
      })
      .catch(err => console.warn('sync skipped:', err));
  }

  /* Scroll-spy */
  ['home', 'about', 'events', 'note', 'partners'].forEach(id => {
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
    const t = e.target.closest('[data-close],[data-edit-ev],[data-dup-ev],[data-del-ev],[data-edit-note],[data-del-note],[data-del-rsvp],[data-del-msg]');
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
      if (!confirm('Delete this event? RSVPs for it stay in the inbox.')) return;
      const gone = t.dataset.delEv;
      EVENTS = EVENTS.filter(x => x.id !== gone); saveEvents(); refreshPublic(); renderAdmin();
      dropEvent(gone).catch(err => toast(err.message, true));
      toast('Event deleted.');
      return;
    }
    if (t.dataset.editNote) {
      noteFormFill(NOTES.find(x => x.id === t.dataset.editNote));
      $('#adminNoteForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    if (t.dataset.delNote) {
      if (!confirm('Delete this article?')) return;
      const goneNote = t.dataset.delNote;
      NOTES = NOTES.filter(x => x.id !== goneNote); saveNotes(); renderNotes(); renderAdmin();
      dropNote(goneNote).catch(err => toast(err.message, true));
      requestAnimationFrame(measureRails);
      return;
    }
    if (t.dataset.delRsvp) {
      if (!confirm('Delete this RSVP?')) return;
      RSVPS = RSVPS.filter(x => x.id !== t.dataset.delRsvp); saveRsvps(); refreshPublic(); renderAdmin();
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

  /* Forms */
  $('#partnerForm').addEventListener('submit', e => handleMessage(e, 'partner'));

  /* Admin login */
  $('#adminOpen').addEventListener('click', requireAdmin);
  if (isAdminDevice()) revealAdminEntry();
  /* opening the site with #admin lets you get in on a new browser */
  if (location.hash === '#admin') { revealAdminEntry(); requireAdmin(); }
  window.addEventListener('hashchange', () => {
    if (location.hash === '#admin') { revealAdminEntry(); requireAdmin(); }
  });

  $('#loginForm').addEventListener('submit', e => {
    e.preventDefault();
    if ($('#adminPass').value === CONFIG.adminPasscode) {
      isAdmin = true; sessionStorage.setItem('asr.admin', '1');
      rememberAdminDevice(); revealAdminEntry();
      $('#adminPass').value = '';
      closeModal($('#loginModal'));
      renderAdmin(); openModal('#adminModal');
      toast('Signed in as admin.');
    } else toast('Wrong passcode.', true);
  });
  $('#adminLogout').addEventListener('click', () => {
    isAdmin = false; sessionStorage.removeItem('asr.admin');
    closeModal($('#adminModal')); toast('Signed out.');
  });

  /* Admin tabs */
  $$('.tabs [data-tab]').forEach(b => b.addEventListener('click', () => {
    $$('.tabs [data-tab]').forEach(x => x.classList.toggle('is-on', x === b));
    $$('.tabpane').forEach(p => p.classList.toggle('is-on', p.dataset.pane === b.dataset.tab));
  }));

  /* Admin: event form */
  $('#adminEventReset').addEventListener('click', () => eventFormFill(null));
  $('#adminEventForm').addEventListener('submit', async e => {
    e.preventDefault();
    const required = ['#aeTitle', '#aeDate', '#aeStart', '#aeVenue', '#aeDesc'];
    if (required.some(sel => !$(sel).value.trim()))
      return toast('Fill in title, date, start time, venue and description.', true);

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
      price: $('#aePrice').value.trim() || 'Free',
      image,
      description: $('#aeDesc').value.trim()
    };
    if (existing) Object.assign(existing, rec); else EVENTS.push(rec);
    saveEvents(); eventFormFill(null); refreshPublic(); renderAdmin();
    try { await pushEvent(rec); } catch (err) { return toast(err.message, true); }
    toast(existing ? 'Event updated' : 'Event published');
  });

  /* Admin: note form */
  $('#adminNoteReset').addEventListener('click', () => noteFormFill(null));
  $('#adminNoteForm').addEventListener('submit', async e => {
    e.preventDefault();
    if (!$('#anTitle').value.trim() || !$('#anUrl').value.trim() || !$('#anDesc').value.trim())
      return toast('Title, URL and summary are required.', true);

    const id = $('#anId').value;
    const existing = NOTES.find(x => x.id === id);
    const btn = $('#anSubmit'), label = btn.textContent;
    const file = $('#anFile').files[0];

    let image = $('#anImgClear').checked ? '' : (existing ? existing.image : '');
    if (file) {
      btn.disabled = true; btn.textContent = 'Uploading photo…';
      try { image = await uploadImage(file); }
      catch (err) { btn.disabled = false; btn.textContent = label; return toast(err.message, true); }
      btn.disabled = false; btn.textContent = label;
    }

    const rec = {
      id: id || uid(),
      title: $('#anTitle').value.trim(),
      url: $('#anUrl').value.trim(),
      date: $('#anDate').value || new Date().toISOString().slice(0, 10),
      tag: $('#anTag').value.trim(),
      image,
      description: $('#anDesc').value.trim()
    };
    if (existing) Object.assign(existing, rec); else NOTES.push(rec);
    saveNotes(); noteFormFill(null); renderNotes(); renderAdmin();
    requestAnimationFrame(measureRails);
    try { await pushNote(rec); } catch (err) { return toast(err.message, true); }
    toast(existing ? 'Article updated' : 'Article published');
  });

  /* Admin: reminders + exports */
  $('#sendReminder').addEventListener('click', () => {
    const ev = findEvent($('#reminderEvent').value);
    if (!ev) return toast('Pick an event first.', true);
    const list = RSVPS.filter(r => r.eventId === ev.id);
    if (!list.length) return toast('Nobody has booked this event yet.', true);
    const bcc = [...new Set(list.map(r => r.email))].join(',');
    const body =
`Hi everyone,

A quick reminder about ${ev.title}.

  ${fmtLong(ev)}
  ${fmtTime(ev)} (${CONFIG.timezone})
  ${ev.venue}${ev.address ? ', ' + ev.address : ''}
  ${ev.price || 'Free'}

Add it to your calendar: ${googleCalendarUrl(ev)}

${ev.description}

Can't make it any more? Just reply to this email so we can free up your spot.

See you soon,
${CONFIG.orgName}
${CONFIG.contactEmail}`;
    window.open(gmailComposeUrl({
      to: CONFIG.contactEmail, bcc,
      subject: `Reminder: ${ev.title} — ${fmtDate(ev, { day: 'numeric', month: 'long' })}`,
      body
    }), '_blank', 'noopener');
    toast(`Gmail draft opened for ${list.length} attendee(s).`);
  });

  $('#copyEmails').addEventListener('click', async () => {
    const ev = findEvent($('#reminderEvent').value);
    const list = ev ? RSVPS.filter(r => r.eventId === ev.id) : [];
    const emails = [...new Set(list.map(r => r.email))].join(', ');
    if (!emails) return toast('No addresses for that event.', true);
    try { await navigator.clipboard.writeText(emails); toast('Copied ' + list.length + ' address(es).'); }
    catch { prompt('Copy the addresses:', emails); }
  });

  $('#exportRsvp').addEventListener('click', () => {
    if (!RSVPS.length) return toast('Nothing to export.', true);
    download('asr-rsvps.csv', toCsv(RSVPS), 'text/csv;charset=utf-8');
  });
  $('#exportMsg').addEventListener('click', () => {
    if (!MSGS.length) return toast('Nothing to export.', true);
    download('asr-messages.csv', toCsv(MSGS), 'text/csv;charset=utf-8');
  });
  $('#syncUp').addEventListener('click', async e => {
    const btn = e.currentTarget, label = btn.textContent;
    btn.disabled = true; btn.textContent = 'Uploading…';
    try {
      const r = await syncLocalToSupabase();
      await loadContent(); drawAll();
      toast(r.failed
        ? `Uploaded ${r.events + r.notes}, ${r.failed} failed — check the table policies.`
        : `Uploaded ${r.events} event(s) and ${r.notes} article(s).`, Boolean(r.failed));
    } catch (err) {
      toast(err.message, true);
    }
    btn.disabled = false; btn.textContent = label;
  });

  $('#exportAll').addEventListener('click', () => {
    download('asr-data-' + new Date().toISOString().slice(0, 10) + '.json',
      JSON.stringify({ events: EVENTS, notes: NOTES, rsvps: RSVPS, messages: MSGS }, null, 2),
      'application/json');
  });
  $('#importFile').addEventListener('change', e => {
    const file = e.target.files[0]; if (!file) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const d = JSON.parse(r.result);
        if (Array.isArray(d.events)) { EVENTS = d.events; saveEvents(); }
        if (Array.isArray(d.notes)) { NOTES = d.notes; saveNotes(); }
        if (Array.isArray(d.rsvps)) { RSVPS = d.rsvps; saveRsvps(); }
        if (Array.isArray(d.messages)) { MSGS = d.messages; saveMsgs(); }
        refreshPublic(); renderNotes(); renderAdmin();
        toast('Data imported');
      } catch { toast('That file could not be read as JSON.', true); }
      e.target.value = '';
    };
    r.readAsText(file);
  });
  $('#resetAll').addEventListener('click', () => {
    if (!confirm('This permanently deletes every event, article, RSVP and message stored in this browser. Continue?')) return;
    EVENTS = []; NOTES = []; RSVPS = []; MSGS = [];
    saveEvents(); saveNotes(); saveRsvps(); saveMsgs();
    refreshPublic(); renderNotes(); renderAdmin();
    toast('Everything deleted.');
  });

  const notice = $('#storageNotice');
  if (notice) {
    notice.innerHTML = supabaseReady()
      ? 'Photos are uploaded to your Supabase bucket <b>' + esc(CONFIG.supabase.bucket) + '</b>. ' +
        'Events, articles and submissions are still stored in this browser — export them as JSON to move them.'
      : '<b>Supabase is not configured yet.</b> Photos you upload are kept in this browser only, ' +
        'and so are events, articles and submissions. Add your project URL and anon key to ' +
        '<b>core.js</b> (CONFIG.supabase) — see README.md.';
  }

  eventFormFill(null); noteFormFill(null);
});
