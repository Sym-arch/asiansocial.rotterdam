/* =========================================================
   Asian Social Rotterdam — shared core
   Loaded by every page (index.html / event.html / booked.html)
   ========================================================= */

const CONFIG = {
  /* Where every form submission is delivered. */
  contactEmail: 'info@sym-arch.com',
  orgName: 'Asian Social Rotterdam',
  siteUrl: 'https://asiansocialsrotterdam.com',
  timezone: 'Europe/Amsterdam',

  /* Admin sign-in uses Supabase Auth (email + password) — see README.
     Create the account in the Supabase dashboard and keep sign-ups disabled. */

  /* --- Email delivery (optional, pick ONE; see README.md) ---------------
     1) EmailJS  → sends a confirmation to the attendee AND a copy to you.
     2) Formspree → forwards the submission to your inbox.
     If both are empty the site falls back to a pre-filled mail draft. */
  emailjs: {
    /* public key: meant to be visible in the browser. Lock it down with
       Allowed Origins in the EmailJS dashboard (Account -> Security). */
    publicKey:        'WHpmrGhiE_fnmgVIf',
    serviceId:        'service_3gpxwuh',
    rsvpTemplateId:   'template_tzbl1vq',   // 予約確認（参加者宛 + Bcc）
    contactTemplateId:'template_0ffqo56'    // パートナー問い合わせ（自分宛）
  },
  formspreeEndpoint: '',    // e.g. 'https://formspree.io/f/xxxxxxx'

  /* --- Image uploads (Supabase Storage) --------------------------------
     Photos are uploaded from the Admin panel, never pasted as URLs.
     Fill these in and every upload lands in your Supabase bucket and is
     served from its public URL. Leave them empty and photos are kept in
     the admin's own browser instead (fine for testing, not for a live site).
     Setup steps are in README.md. */
  supabase: {
    url:     'https://wbdeeltqrmilmxmatdge.supabase.co',
    /* anon key: public by design, safe to ship in the browser.
       NEVER put the service_role key here. */
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndiZGVlbHRxcm1pbG14bWF0ZGdlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgxMDMyOTEsImV4cCI6MjEwMzY3OTI5MX0.Xl81j-lH-eH1k1Y5k4QLp-cpIWA3l5y7zKDc0u2rQ0s',
    bucket:  'event-photos' // must be a PUBLIC storage bucket
  }
};

/* ---------------------------------------------------------
   Storage
   --------------------------------------------------------- */
const DB = {
  key: n => 'asr.' + n,
  get(name, fallback) {
    try { const v = localStorage.getItem(DB.key(name)); return v ? JSON.parse(v) : fallback; }
    catch { return fallback; }
  },
  set(name, value) {
    try { localStorage.setItem(DB.key(name), JSON.stringify(value)); return true; }
    catch (e) { toast('Storage is full — try removing uploaded photos.', true); return false; }
  }
};

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/* ---------------------------------------------------------
   Seed content (first visit only)
   --------------------------------------------------------- */
/* No demo content: everything is created from the Admin panel. */
const SEED_EVENTS = [];
const SEED_NOTES  = [];

let EVENTS = DB.get('events', null) || SEED_EVENTS.slice();
let NOTES  = DB.get('notes',  null) || SEED_NOTES.slice();
let RSVPS  = DB.get('rsvps',  []);
let MSGS   = DB.get('messages', []);
if (!DB.get('events', null)) DB.set('events', EVENTS);
if (!DB.get('notes',  null)) DB.set('notes',  NOTES);

const saveEvents = () => DB.set('events', EVENTS);
const saveNotes  = () => DB.set('notes',  NOTES);
const saveRsvps  = () => DB.set('rsvps',  RSVPS);
const saveMsgs   = () => DB.set('messages', MSGS);

/* ---------------------------------------------------------
   Small helpers
   --------------------------------------------------------- */
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* Parse "YYYY-MM-DD" + "HH:MM" as a local date (never UTC-shifted). */
function toDate(dateStr, timeStr) {
  const [y, m, d] = String(dateStr).split('-').map(Number);
  const [hh, mm] = String(timeStr || '00:00').split(':').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, hh || 0, mm || 0);
}
const startOf = ev => toDate(ev.date, ev.start);
const endOf   = ev => toDate(ev.date, ev.end || ev.start);
const isPast  = ev => endOf(ev).getTime() < Date.now();

/* 日付を表示するロケール。タイ語は既定だと仏暦になるのでグレゴリオ暦に固定します。 */
const dateLocale = () => {
  const l = currentLang();
  if (l === 'en') return 'en-GB';
  return l === 'th' ? 'th-TH-u-ca-gregory' : l;
};

const fmtDate = (ev, opt) => startOf(ev).toLocaleDateString(dateLocale(),
  opt || { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
const fmtLong = ev => fmtDate(ev, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const fmtTime = ev => ev.start + (ev.end ? '–' + ev.end : '');

const byDate = (a, b) => startOf(a) - startOf(b);
const upcoming = () => EVENTS.filter(e => !isPast(e)).sort(byDate);
const findEvent = id => EVENTS.find(e => e.id === id);

/* Shared card markup — used by the home rails and by the sub-pages. */
function eventCardHTML(ev) {
  const done = isPast(ev);
  const teaser = ev.description.length > 118 ? esc(ev.description.slice(0, 118)) + '…' : esc(ev.description);
  return `<a class="ev-card${done ? ' is-past' : ''}" href="${esc(eventUrl(ev.id))}">
    <span class="ev-card__img">
      ${ev.image ? `<img src="${esc(ev.image)}" alt="${esc(ev.title)}" loading="lazy">` : ''}
      ${done ? '<span class="ev-card__tag">Past</span>' : ''}
    </span>
    <span class="ev-card__date">
      <span>${esc(fmtDate(ev, { weekday: 'short', day: 'numeric', month: 'short' }))}</span>
      <span>${esc(ev.start)}</span>
    </span>
    <h3>${esc(ev.title)}</h3>
    <p>${teaser}</p>
    <span class="ev-card__foot">
      <span>${esc(ev.venue)}</span>
      <b>${done ? 'Finished' : esc(ev.price || 'Free')}</b>
    </span>
  </a>`;
}

function noteCardHTML(n) {
  const date = n.date
    ? new Date(n.date).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short', year: 'numeric' })
    : '';
  return `<a class="note-card" href="${esc(n.url)}" target="_blank" rel="noopener">
    <span class="note-card__img">
      ${n.image ? `<img src="${esc(n.image)}" alt="${esc(n.title)}" loading="lazy">` : ''}
    </span>
    <span class="note-card__meta">${esc(n.tag || 'note')}${date ? `<span>${esc(date)}</span>` : ''}</span>
    <h3>${esc(n.title)}</h3>
    <p>${esc(n.description)}</p>
    <span class="note-card__more">Read on note →</span>
  </a>`;
}

function toast(msg, isErr) {
  const el = $('#toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.toggle('is-err', !!isErr);
  el.classList.add('is-on');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove('is-on'), 4200);
}

function download(filename, content, mime) {
  const blob = new Blob([content], { type: mime || 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/* ---------------------------------------------------------
   Photo uploads
   Admin picks a file; it goes to Supabase Storage when configured,
   otherwise it stays in this browser as a data URL.
   --------------------------------------------------------- */
const supabaseReady = () => {
  const s = CONFIG.supabase || {};
  return Boolean(s.url && s.anonKey && s.bucket);
};

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error('Could not read that file.'));
    r.readAsDataURL(file);
  });
}

/**
 * Upload one image and return the URL to store on the event / article.
 * @returns {Promise<string>}
 */
async function uploadImage(file) {
  if (!file) return '';
  if (!/^image\//.test(file.type)) throw new Error('That file is not an image.');

  const s = CONFIG.supabase;
  const name = Date.now().toString(36) + '-' +
               file.name.toLowerCase().replace(/[^a-z0-9.\-]+/g, '-').replace(/^-+|-+$/g, '');

  if (supabaseReady()) {
    const base = s.url.replace(/\/+$/, '');
    const res = await fetch(`${base}/storage/v1/object/${encodeURIComponent(s.bucket)}/${encodeURIComponent(name)}`, {
      method: 'POST',
      headers: {
        apikey: s.anonKey,
        Authorization: 'Bearer ' + s.anonKey,
        'Content-Type': file.type,
        /* No x-upsert: an upsert is checked against the UPDATE policy, which
           would force a second policy in Supabase. File names already carry a
           timestamp, so a plain insert never collides. */
        'cache-control': '31536000'
      },
      body: file
    });
    if (!res.ok) {
      const detail = (await res.text().catch(() => '')).slice(0, 160);
      throw new Error(`Upload failed (${res.status}). ${detail}`);
    }
    return `${base}/storage/v1/object/public/${s.bucket}/${name}`;
  }

  /* No storage configured — keep it in this browser. */
  if (file.size > 1.6 * 1024 * 1024)
    throw new Error('Without Supabase configured, photos must be under 1.6 MB.');
  return fileToDataUrl(file);
}

const slug = s => String(s).replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').toLowerCase();
const isEmail = s => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s));
const eventUrl = id => 'event.html?id=' + encodeURIComponent(id);
/* Absolute URL against the page the visitor is on — works on any domain,
   so emails can link back without hard-coding the host. */
const absUrl = path => new URL(path, location.href).href;

/* ---------------------------------------------------------
   Calendar links (Google Calendar / .ics)
   --------------------------------------------------------- */
const pad = n => String(n).padStart(2, '0');
function stampLocal(d) {
  return d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + 'T' +
         pad(d.getHours()) + pad(d.getMinutes()) + '00';
}

function eventDetailsText(ev) {
  return [
    ev.description,
    '',
    'Venue: ' + ev.venue,
    ev.address ? 'Address: ' + ev.address : '',
    'Price: ' + (ev.price || 'Free'),
    '',
    'Hosted by ' + CONFIG.orgName + ' · ' + CONFIG.contactEmail
  ].filter(Boolean).join('\n');
}

function googleCalendarUrl(ev) {
  const s = startOf(ev);
  const e = ev.end ? endOf(ev) : new Date(s.getTime() + 2 * 3600 * 1000);
  const p = new URLSearchParams({
    action: 'TEMPLATE',
    text: ev.title + ' | ' + CONFIG.orgName,
    dates: stampLocal(s) + '/' + stampLocal(e),
    ctz: CONFIG.timezone,
    details: eventDetailsText(ev),
    location: [ev.venue, ev.address].filter(Boolean).join(', '),
    sprop: 'website:' + CONFIG.siteUrl
  });
  return 'https://calendar.google.com/calendar/render?' + p.toString();
}

function mailtoUrl(to, subject, body) {
  return 'mailto:' + to + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
}
function gmailComposeUrl({ to, bcc, subject, body }) {
  const p = new URLSearchParams({ view: 'cm', fs: '1', tf: '1' });
  if (to) p.set('to', to);
  if (bcc) p.set('bcc', bcc);
  p.set('su', subject); p.set('body', body);
  return 'https://mail.google.com/mail/?' + p.toString();
}

/* ---------------------------------------------------------
   Email delivery
   --------------------------------------------------------- */
let emailjsReady = null;
function loadEmailJs() {
  if (emailjsReady) return emailjsReady;
  emailjsReady = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js';
    s.onload = () => { try { window.emailjs.init({ publicKey: CONFIG.emailjs.publicKey }); resolve(window.emailjs); } catch (e) { reject(e); } };
    s.onerror = reject;
    document.head.appendChild(s);
  });
  return emailjsReady;
}

/**
 * Deliver a submission to CONFIG.contactEmail.
 * @returns {Promise<'emailjs'|'formspree'|'manual'>}
 */
async function deliver(kind, params) {
  const ej = CONFIG.emailjs;
  if (ej.publicKey && ej.serviceId) {
    const tpl = kind === 'rsvp' ? (ej.rsvpTemplateId || ej.contactTemplateId) : (ej.contactTemplateId || ej.rsvpTemplateId);
    if (tpl) {
      const lib = await loadEmailJs();
      await lib.send(ej.serviceId, tpl, Object.assign({ to_email: CONFIG.contactEmail }, params));
      return 'emailjs';
    }
  }
  if (CONFIG.formspreeEndpoint) {
    const res = await fetch(CONFIG.formspreeEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(params)
    });
    if (!res.ok) throw new Error('Formspree responded ' + res.status);
    return 'formspree';
  }
  return 'manual';
}

/* ---------------------------------------------------------
   RSVP — shared by the home page and the event page
   --------------------------------------------------------- */
function rsvpConfirmationBody(rsvp, ev) {
  return `Hi ${rsvp.name},

You're booked for:

  ${ev.title}
  ${fmtLong(ev)}
  ${fmtTime(ev)} (${CONFIG.timezone})
  ${ev.venue}${ev.address ? ', ' + ev.address : ''}
  ${ev.price || 'Free'} · ${rsvp.guests} ${rsvp.guests > 1 ? 'people' : 'person'}

Add it to your calendar:
${googleCalendarUrl(ev)}

${ev.description}

See you there!
${CONFIG.orgName}
${CONFIG.contactEmail}`;
}

/**
 * Validate, store and deliver an RSVP, then hand back where to go next.
 * @returns {Promise<{rsvp:object, mode:string}>}  throws Error(message) on invalid input
 */
async function submitRsvp(input) {
  const ev = findEvent(input.eventId);
  const guests = Number(input.guests) || 1;
  if (!ev) throw new Error(t('rsvp.err.event'));
  if (!input.name || !input.email) throw new Error(t('rsvp.err.required'));
  if (!isEmail(input.email)) throw new Error(t('rsvp.err.email'));

  const rsvp = {
    id: uid(), eventId: ev.id, eventTitle: ev.title, eventDate: ev.date,
    name: input.name, email: input.email, guests,
    createdAt: new Date().toISOString()
  };
  RSVPS.push(rsvp); saveRsvps();

  /* the booking belongs in the table; the confirmation email is the backstop
     if the write fails, so never block the visitor on it */
  if (supabaseReady()) {
    sbInsert('rsvps', {
      id: rsvp.id, event_id: ev.id, event_title: ev.title, event_date: ev.date,
      name: rsvp.name, email: rsvp.email, guests
    }).catch(err => console.warn('rsvp not stored:', err.message));
  }

  let mode = 'manual';
  try {
    mode = await deliver('rsvp', {
      type: 'RSVP',
      to_email: CONFIG.contactEmail,
      reply_to: rsvp.email,
      attendee_email: rsvp.email,
      name: rsvp.name, email: rsvp.email, guests: String(guests),
      event_title: ev.title,
      event_date: fmtLong(ev),
      event_time: fmtTime(ev),
      event_venue: [ev.venue, ev.address].filter(Boolean).join(', '),
      event_price: ev.price || 'Free',
      calendar_link: googleCalendarUrl(ev),
      /* absolute URLs so the confirmation email can link and show images */
      first_name: rsvp.name.split(' ')[0],
      event_url: absUrl(eventUrl(ev.id)),
      event_image: /^https?:/i.test(ev.image || '') ? ev.image : absUrl('assets/bg-crowd.jpg'),
      logo_url: absUrl('assets/logo.jpg'),
      site_url: absUrl('index.html'),
      subject: `[RSVP] ${ev.title} — ${rsvp.name} (${guests})`
    });
  } catch (err) {
    console.warn('Email delivery failed:', err);
    mode = 'manual';
  }
  return { rsvp, mode };
}

const bookedUrl = (rsvp, mode) => {
  const lang = uiLang();
  return 'booked.html?id=' + encodeURIComponent(rsvp.id) + '&m=' + mode +
         (lang === 'en' ? '' : '&lang=' + lang);
};

/* ---------------------------------------------------------
   Shared content (Supabase tables)
   Events and articles have to be the same for every visitor, so they live
   in Supabase. localStorage is only a cache, which also keeps the site
   readable if the request fails.
   --------------------------------------------------------- */
/* --- Admin sign-in (Supabase Auth) ---------------------------------------
   Attendee names and emails are personal data, so the rsvps table can only
   be read by a signed-in user. Everything public keeps using the anon key. */
let SESSION = DB.get('session', null);

const authBase = () => CONFIG.supabase.url.replace(/\/+$/, '') + '/auth/v1';
const isSignedIn = () => Boolean(SESSION && SESSION.access_token);
const signedInAs = () => (SESSION && SESSION.email) || '';

function storeSession(data, email) {
  SESSION = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    email: (data.user && data.user.email) || email || '',
    expires_at: Date.now() + ((data.expires_in || 3600) - 60) * 1000
  };
  DB.set('session', SESSION);
  return SESSION;
}

async function signIn(email, password) {
  const res = await fetch(authBase() + '/token?grant_type=password', {
    method: 'POST',
    headers: { apikey: CONFIG.supabase.anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error_description || data.msg || data.message || 'Sign in failed');
  return storeSession(data, email);
}

async function refreshSession() {
  if (!SESSION || !SESSION.refresh_token) return false;
  const res = await fetch(authBase() + '/token?grant_type=refresh_token', {
    method: 'POST',
    headers: { apikey: CONFIG.supabase.anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: SESSION.refresh_token })
  });
  if (!res.ok) { signOut(); return false; }
  storeSession(await res.json(), SESSION.email);
  return true;
}

/** Renew the token shortly before it expires so a long admin session keeps working. */
async function ensureSession() {
  if (!SESSION) return false;
  if (Date.now() < (SESSION.expires_at || 0)) return true;
  return refreshSession();
}

function signOut() {
  if (SESSION && SESSION.access_token) {
    fetch(authBase() + '/logout', {
      method: 'POST',
      headers: { apikey: CONFIG.supabase.anonKey, Authorization: 'Bearer ' + SESSION.access_token }
    }).catch(() => {});
  }
  SESSION = null;
  DB.set('session', null);
}

const sbToken = () => (isSignedIn() ? SESSION.access_token : CONFIG.supabase.anonKey);
const sbHeaders = () => ({
  apikey: CONFIG.supabase.anonKey,
  Authorization: 'Bearer ' + sbToken(),
  'Content-Type': 'application/json'
});
const sbUrl = (table, query) =>
  CONFIG.supabase.url.replace(/\/+$/, '') + '/rest/v1/' + table + (query ? '?' + query : '');

const wait = ms => new Promise(r => setTimeout(r, ms));

/* PostgREST answers 404 for a moment while it reloads its schema cache
   (which a request for a table that does not exist triggers), so one retry
   keeps an unrelated table from being taken down with it. */
async function sbSelect(table, query, attempt = 0) {
  const res = await fetch(sbUrl(table, 'select=*' + (query ? '&' + query : '')), { headers: sbHeaders() });
  if (res.ok) return res.json();
  if (attempt < 2 && (res.status === 404 || res.status >= 500)) {
    await wait(600 * (attempt + 1));
    return sbSelect(table, query, attempt + 1);
  }
  throw new Error(table + ' read failed (' + res.status + ')');
}
async function sbUpsert(table, row) {
  const res = await fetch(sbUrl(table), {
    method: 'POST',
    headers: Object.assign(sbHeaders(), { Prefer: 'resolution=merge-duplicates,return=minimal' }),
    body: JSON.stringify(row)
  });
  if (!res.ok) throw new Error(table + ' save failed (' + res.status + '). ' + (await res.text()).slice(0, 140));
}
async function sbInsert(table, row) {
  const res = await fetch(sbUrl(table), {
    method: 'POST',
    headers: Object.assign(sbHeaders(), { Prefer: 'return=minimal' }),
    body: JSON.stringify(row)
  });
  if (!res.ok) throw new Error(table + ' insert failed (' + res.status + '). ' + (await res.text()).slice(0, 140));
}
async function sbDelete(table, id) {
  const res = await fetch(sbUrl(table, 'id=eq.' + encodeURIComponent(id)), {
    method: 'DELETE', headers: sbHeaders()
  });
  if (!res.ok) throw new Error(table + ' delete failed (' + res.status + ')');
}

/* "start" and "end" are reserved words in SQL, so the columns are named differently */
const evFromRow = r => ({
  id: r.id, title: r.title, date: r.date, start: r.start_time, end: r.end_time,
  venue: r.venue, address: r.address, price: r.price, image: r.image, description: r.description
});
const evToRow = e => ({
  id: e.id, title: e.title, date: e.date, start_time: e.start, end_time: e.end,
  venue: e.venue, address: e.address, price: e.price, image: e.image, description: e.description
});
const noteFromRow = r => ({
  id: r.id, title: r.title, url: r.url, date: r.date,
  tag: r.tag, image: r.image, description: r.description
});
const noteToRow = n => ({
  id: n.id, title: n.title, url: n.url, date: n.date || null,
  tag: n.tag, image: n.image, description: n.description
});

let contentSource = supabaseReady() ? 'loading' : 'local';

/**
 * Pull events and articles from Supabase into EVENTS / NOTES.
 * The two tables are handled independently: if one is missing or fails,
 * the other still loads and the missing one keeps its cached copy.
 */
async function loadContent() {
  if (!supabaseReady()) return false;
  const [ev, nt] = await Promise.allSettled([
    sbSelect('events', 'order=date.asc'),
    sbSelect('notes', 'order=date.desc')
  ]);
  let loaded = 0;

  if (ev.status === 'fulfilled') {
    EVENTS = ev.value.map(evFromRow); DB.set('events', EVENTS); loaded++;
  } else {
    console.warn('events: using the cached copy —', ev.reason && ev.reason.message);
  }
  if (nt.status === 'fulfilled') {
    NOTES = nt.value.map(noteFromRow); DB.set('notes', NOTES); loaded++;
  } else {
    console.warn('notes: using the cached copy —', nt.reason && nt.reason.message);
  }

  contentSource = loaded ? 'supabase' : 'cache';
  return loaded > 0;
}

/**
 * Push anything that exists only in this browser up to Supabase.
 * Run from the admin device so content created before the tables existed
 * is not stranded locally.
 * @returns {Promise<{events:number, notes:number, failed:number}>}
 */
async function syncLocalToSupabase() {
  const out = { events: 0, notes: 0, failed: 0 };
  if (!supabaseReady()) return out;

  const [remoteEv, remoteNt] = await Promise.allSettled([
    sbSelect('events'), sbSelect('notes')
  ]);
  const known = list => new Set(list.status === 'fulfilled' ? list.value.map(r => r.id) : null);

  if (remoteEv.status === 'fulfilled') {
    const have = known(remoteEv);
    for (const e of EVENTS) {
      if (have.has(e.id)) continue;
      try { await sbUpsert('events', evToRow(e)); out.events++; } catch { out.failed++; }
    }
  }
  if (remoteNt.status === 'fulfilled') {
    const have = known(remoteNt);
    for (const n of NOTES) {
      if (have.has(n.id)) continue;
      try { await sbUpsert('notes', noteToRow(n)); out.notes++; } catch { out.failed++; }
    }
  }
  return out;
}

/* Admin writes: keep the local copy and the table in step. */
const pushEvent = rec => supabaseReady() ? sbUpsert('events', evToRow(rec)) : Promise.resolve();
const dropEvent = id  => supabaseReady() ? sbDelete('events', id) : Promise.resolve();
const pushNote  = rec => supabaseReady() ? sbUpsert('notes', noteToRow(rec)) : Promise.resolve();
const dropNote  = id  => supabaseReady() ? sbDelete('notes', id) : Promise.resolve();

/**
 * Draw once from the cache so the page is never blank, then redraw with
 * whatever Supabase returns.
 */
/** Every booking in the table. Requires a signed-in admin (RLS). */
async function loadRsvps() {
  if (!supabaseReady() || !(await ensureSession())) return [];
  const rows = await sbSelect('rsvps', 'order=created_at.desc');
  return rows.map(r => ({
    id: r.id, eventId: r.event_id, eventTitle: r.event_title, eventDate: r.event_date,
    name: r.name, email: r.email, guests: r.guests, createdAt: r.created_at
  }));
}
const deleteRsvp = id => sbDelete('rsvps', id);

function bootstrapContent(render) {
  render();
  loadContent().then(() => render());
}

/* ---------------------------------------------------------
   Language switcher
   English is the site itself. The other languages are served through
   Google's translation proxy, so event text written in the Admin panel
   gets translated too — nothing has to be maintained per language.
   --------------------------------------------------------- */
const LANGS = [
  { code: 'en',    label: 'English',            short: 'EN' },
  { code: 'nl',    label: 'Nederlands',         short: 'NL' },
  { code: 'ja',    label: '日本語', short: 'JA' },
  { code: 'zh-CN', label: '简体中文', short: 'ZH' },
  { code: 'zh-TW', label: '繁體中文（台灣）', short: 'TW' },
  { code: 'ko',    label: '한국어', short: 'KO' },
  { code: 'th',    label: 'ไทย', short: 'TH' },
  { code: 'id',    label: 'Bahasa Indonesia',   short: 'ID' }
];

const TRANSLATE_HOST = '.translate.goog';

/* いま Google 翻訳のプロキシ越しに読まれているか */
const onProxy = () => location.hostname.endsWith(TRANSLATE_HOST);

/* プロキシが翻訳している言語 */
function proxyLang() {
  if (!onProxy()) return 'en';
  return new URLSearchParams(location.search).get('_x_tr_tl') || 'en';
}

/* 自前ドメインでの表示言語（?lang=xx）。フォーム周りだけこれで訳します。 */
function uiLang() {
  const code = new URLSearchParams(location.search).get('lang');
  return (code && I18N[code]) ? code : 'en';
}

/* 訪問者がいま実際に読んでいる言語（プロキシ経由でも自前でも） */
const currentLang = () => (onProxy() ? proxyLang() : uiLang());

/**
 * 自前の翻訳を引く。無いキーは英語にフォールバックします。
 * @param {string} key   i18n.js のキー
 * @param {object} [vars] {name:'Tai'} のように {name} を差し替える
 */
function t(key, vars) {
  const dict = I18N[currentLang()] || I18N.en;
  let out = (dict && dict[key]) || I18N.en[key] || key;
  if (vars) Object.keys(vars).forEach(k => { out = out.split('{' + k + '}').join(vars[k]); });
  return out;
}

/* The original (untranslated) address of the page being viewed. */
function originalUrl() {
  const u = new URL(location.href);
  const strip = p => { ['_x_tr_sl', '_x_tr_tl', '_x_tr_hl', '_x_tr_pto', 'lang'].forEach(k => p.delete(k)); };
  if (!onProxy()) {
    strip(u.searchParams);
    return u.href;
  }
  /* the proxy encodes "." as "-" and a real "-" as "--" */
  const host = u.hostname.slice(0, -TRANSLATE_HOST.length)
    .replace(/--|-/g, m => (m === '--' ? '-' : '.'));
  const p = new URLSearchParams(u.search);
  strip(p);
  const q = p.toString();
  return 'https://' + host + u.pathname + (q ? '?' + q : '') + u.hash;
}

/**
 * 同じページを「自前ドメイン ＋ ?lang=xx」で開くURL。
 * 翻訳ページからフォームへ渡すための出口です。
 * @param {string} code 言語コード
 * @param {string} [hash] '#book' など
 */
function nativeUrl(code, hash) {
  const u = new URL(originalUrl());
  if (code && code !== 'en' && I18N[code]) u.searchParams.set('lang', code);
  u.hash = hash || '';
  return u.href;
}

/* サイト内リンクに ?lang= を引き継ぐ（自前翻訳のUIを保つため） */
function keepLangOnLinks(root) {
  const code = uiLang();
  if (onProxy() || code === 'en') return;
  $$('a[href]', root || document).forEach(a => {
    const href = a.getAttribute('href');
    /* 外部リンク・メール・ページ内アンカー・言語メニューは触らない */
    if (!href || /^(#|mailto:|tel:|https?:|\/\/)/i.test(href)) return;
    const u = new URL(href, location.href);
    u.searchParams.set('lang', code);
    a.setAttribute('href', u.pathname.split('/').pop() + u.search + u.hash);
  });
}

/* Same page, read through Google Translate in the chosen language. */
function translatedUrl(code) {
  const u = new URL(originalUrl());
  if (code === 'en') return u.href;
  const host = u.hostname.replace(/-/g, '--').replace(/\./g, '-') + TRANSLATE_HOST;
  const p = new URLSearchParams(u.search);
  p.set('_x_tr_sl', 'en'); p.set('_x_tr_tl', code); p.set('_x_tr_hl', code);
  return 'https://' + host + u.pathname + '?' + p.toString() + u.hash;
}

/**
 * data-i18n / data-i18n-ph の付いた要素を自前の訳に差し替える。
 * 翻訳ページでは Google がすでに訳しているので何もしません。
 */
function applyI18n(root) {
  if (onProxy() || uiLang() === 'en') return;
  const box = root || document;
  $$('[data-i18n]', box).forEach(el => { el.textContent = t(el.dataset.i18n); });
  $$('[data-i18n-ph]', box).forEach(el => { el.placeholder = t(el.dataset.i18nPh); });
}

/**
 * 自前ドメインを ?lang=xx で開いている人への一言。
 * 本文は英語のままフォームだけ母語、という状態を説明し、
 * 読むだけなら翻訳ページへ戻れるようにします。
 */
function showNativeNotice() {
  const code = uiLang();
  if (onProxy() || code === 'en' || $('.langnote')) return;
  const main = document.querySelector('main');
  if (!main) return;
  const bar = document.createElement('div');
  bar.className = 'langnote';
  bar.innerHTML = `<div class="wrap"><span>${esc(t('native.notice'))}</span>
    <a href="${esc(translatedUrl(code))}">${esc(t('native.back'))}</a></div>`;
  main.prepend(bar);
}

const isLocalHost = () => /^(localhost|127\.|0\.0\.0\.0|\[?::1)/.test(location.hostname) || location.protocol === 'file:';

function initLangMenu() {
  const box = $('#lang'), btn = $('#langBtn'), menu = $('#langMenu');
  if (!box || !btn || !menu) return;

  const active = currentLang();
  const activeLang = LANGS.find(l => l.code === active) || LANGS[0];
  btn.textContent = activeLang.short;
  btn.setAttribute('aria-label', 'Language: ' + activeLang.label);

  menu.innerHTML = LANGS.map(l =>
    `<li><a href="${esc(translatedUrl(l.code))}" data-lang="${l.code}"
        class="${l.code === active ? 'is-on' : ''}">${esc(l.label)}</a></li>`).join('');

  const close = () => { menu.hidden = true; btn.setAttribute('aria-expanded', 'false'); };
  const open  = () => { menu.hidden = false; btn.setAttribute('aria-expanded', 'true'); };
  close();

  btn.addEventListener('click', e => {
    e.stopPropagation();
    menu.hidden ? open() : close();
  });
  document.addEventListener('click', e => { if (!box.contains(e.target)) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });

  /* the proxy cannot reach a machine that is not on the public internet */
  if (isLocalHost()) {
    menu.addEventListener('click', e => {
      const a = e.target.closest('a[data-lang]');
      if (!a || a.dataset.lang === 'en') return;
      e.preventDefault();
      close();
      toast('Translation works on the live domain, not on localhost.', true);
    });
  }
}

/* ---------------------------------------------------------
   Shared UI wiring (header menu, reveal-on-scroll, year)
   --------------------------------------------------------- */
function initShell() {
  const y = $('#year'); if (y) y.textContent = new Date().getFullYear();
  initLangMenu();
  keepLangOnLinks();
  applyI18n();
  showNativeNotice();

  const nav = $('#nav'), burger = $('#burger');
  if (nav && burger) {
    burger.addEventListener('click', () => {
      const open = nav.classList.toggle('is-open');
      burger.setAttribute('aria-expanded', String(open));
    });
    nav.addEventListener('click', e => { if (e.target.tagName === 'A') nav.classList.remove('is-open'); });
  }

  const rev = new IntersectionObserver((entries, obs) => {
    entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add('is-in'); obs.unobserve(en.target); } });
  }, { threshold: .12 });
  $$('.reveal').forEach(el => rev.observe(el));
}
