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

  /* Admin passcode — CHANGE THIS. Client-side only: it keeps the panel out of
     casual sight, it is not real security. Use a backend for real auth. */
  adminPasscode: 't11data1y0',

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

const fmtDate = (ev, opt) => startOf(ev).toLocaleDateString('en-GB',
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
    ? new Date(n.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
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
  if (!ev) throw new Error('Please pick an event first.');
  if (!input.name || !input.email) throw new Error('Name and email are required.');
  if (!isEmail(input.email)) throw new Error('That email address looks incomplete.');

  const rsvp = {
    id: uid(), eventId: ev.id, eventTitle: ev.title, eventDate: ev.date,
    name: input.name, email: input.email, guests,
    createdAt: new Date().toISOString()
  };
  RSVPS.push(rsvp); saveRsvps();

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

const bookedUrl = (rsvp, mode) => 'booked.html?id=' + encodeURIComponent(rsvp.id) + '&m=' + mode;

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

/* Which language is the visitor reading right now? */
function currentLang() {
  if (!location.hostname.endsWith(TRANSLATE_HOST)) return 'en';
  return new URLSearchParams(location.search).get('_x_tr_tl') || 'en';
}

/* The original (untranslated) address of the page being viewed. */
function originalUrl() {
  const u = new URL(location.href);
  if (!u.hostname.endsWith(TRANSLATE_HOST)) return u.href;
  /* the proxy encodes "." as "-" and a real "-" as "--" */
  const host = u.hostname.slice(0, -TRANSLATE_HOST.length)
    .replace(/--|-/g, m => (m === '--' ? '-' : '.'));
  const p = new URLSearchParams(u.search);
  ['_x_tr_sl', '_x_tr_tl', '_x_tr_hl', '_x_tr_pto'].forEach(k => p.delete(k));
  const q = p.toString();
  return 'https://' + host + u.pathname + (q ? '?' + q : '') + u.hash;
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
