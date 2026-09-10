/* =========================================================
   Asian Social Rotterdam — shared core
   Loaded by every page (index.html / event.html / booked.html)
   ========================================================= */

const CONFIG = {
  /* Where every form submission is delivered. */
  contactEmail: 'info@sym-arch.com',
  orgName: 'Asian Social Rotterdam',
  /* 公開ドメイン。www.symarch-llc.com と asiansocial-rotterdam.vercel.app の
     両方で同じ内容が出るため、canonical はこちらに寄せています。
     ドメインを変えるときは index/event.html の canonical・og:url・構造化データ、
     robots.txt、sitemap.xml も合わせて差し替えてください */
  siteUrl: 'https://www.symarch-llc.com',
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

let EVENTS = DB.get('events', null) || SEED_EVENTS.slice();
let RSVPS  = DB.get('rsvps',  []);
let MSGS   = DB.get('messages', []);
if (!DB.get('events', null)) DB.set('events', EVENTS);

const saveEvents = () => DB.set('events', EVENTS);
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

/* 日付を表示するロケール。英語は日/月/年で読む欧州式にします（米国式と紛れるため） */
const dateLocale = () => {
  const l = currentLang();
  return l === 'en' ? 'en-GB' : l;
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
      ${done ? `<span class="ev-card__tag">${esc(t('card.past'))}</span>` : ''}
    </span>
    <span class="ev-card__date">
      <span>${esc(fmtDate(ev, { weekday: 'short', day: 'numeric', month: 'short' }))}</span>
      <span>${esc(ev.start)}</span>
    </span>
    <h3>${esc(ev.title)}</h3>
    <p>${teaser}</p>
    <span class="ev-card__foot">
      <span>${esc(ev.venue)}</span>
      <b>${done ? esc(t('card.finished')) : esc(priceFor(ev).label)}</b>
    </span>
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
    /* バケットへの書き込みは管理者だけに絞るので、匿名キーではなく
       ログイン中のトークンで送ります（未ログインなら匿名キーに戻ります）。 */
    await ensureSession();
    const res = await fetch(`${base}/storage/v1/object/${encodeURIComponent(s.bucket)}/${encodeURIComponent(name)}`, {
      method: 'POST',
      headers: {
        apikey: s.anonKey,
        Authorization: 'Bearer ' + sbToken(),
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
    'Price: ' + priceFor(ev).label,
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
  ${priceFor(ev).label} · ${rsvp.guests} ${rsvp.guests > 1 ? 'people' : 'person'}

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

  /* サインイン済みなら入力させない。
     未サインインなら、予約と同時に無料会員を作ります。 */
  if (isSignedIn()) {
    input = Object.assign({}, input, {
      name:  input.name  || (MEMBER && MEMBER.profile && MEMBER.profile.name) || signedInAs(),
      email: signedInAs()
    });
  } else {
    if (!input.name || !input.email) throw new Error(t('rsvp.err.required'));
    if (!isEmail(input.email)) throw new Error(t('rsvp.err.email'));
    if (String(input.password || '').length < MIN_PASSWORD) throw new Error(t('account.err.password'));
    try {
      await signUp(input.email, input.password, input.name);
    } catch (err) {
      /* 既存のアドレスなら、パスワードを推測させずサインインへ向けます */
      if (/already|registered|exists/i.test(err.message)) throw new Error(t('rsvp.err.exists'));
      throw err;
    }
  }

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

    /* 発券も同じく「失敗しても予約は通す」扱いにします。
       チケットが出なくても受付の名簿で入場できるためです。 */
    try {
      const issued = await issueTicket(ev, rsvp);
      rsvp.ticketSecret = issued.secret;
    } catch (err) {
      console.warn('ticket not issued:', err.message);
    }
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
      event_price: priceFor(ev).label,
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
         (lang === 'en' ? '' : '&lang=' + lang) +
         (rsvp.ticketSecret ? '&t=' + encodeURIComponent(rsvp.ticketSecret) : '');
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
    /* トークン更新のレスポンスに user が無いことがあるので、前の値を残します */
    user_id: (data.user && data.user.id) || (SESSION && SESSION.user_id) || '',
    email: (data.user && data.user.email) || (SESSION && SESSION.email) || email || '',
    expires_at: Date.now() + ((data.expires_in || 3600) - 60) * 1000
  };
  DB.set('session', SESSION);
  return SESSION;
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

/* ---------------------------------------------------------
   会員のサインアップとサインイン（メール＋パスワード）

   当初は6桁コードにしていましたが、パスワードに戻しました。
   見慎れていた問題が2つあったためです。
   - Supabase の OTP を 6桁にしても、メール本文のテンプレートを
     {{ .Token }} に変えない限り送られるのはリンクです。
     実際に送信ログを見ると "Your sign-in link" が届いていました
   - コード方式自体が見慣れないという声もありました

   パスワードなら、確認メールも再設定メールも
   「リンクを押す」で正しく成立し、既存のテンプレートがそのまま使えます。
   --------------------------------------------------------- */

const MIN_PASSWORD = 8;

/** アカウントを作ってそのままサインインする。 */
async function signUp(email, password, name) {
  if (!isEmail(email)) throw new Error(t('rsvp.err.email'));
  if (String(password).length < MIN_PASSWORD) throw new Error(t('account.err.password'));

  const res = await fetch(authBase() + '/signup', {
    method: 'POST',
    headers: { apikey: CONFIG.supabase.anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: email.trim(),
      password: password,
      data: { name: (name || '').trim() }
    })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.msg || data.error_description || data.error || 'Could not create the account.');

  /* メール確認を必須にしている場合、ここではまだトークンが返りません。
     そのときは続けてサインインを試します。 */
  if (data.access_token) {
    SESSION = null;
    storeSession(data, email);
    await loadMember();
    return SESSION;
  }
  return signIn(email, password);
}

/** メールとパスワードでサインインする。 */
async function signIn(email, password) {
  const res = await fetch(authBase() + '/token?grant_type=password', {
    method: 'POST',
    headers: { apikey: CONFIG.supabase.anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: String(email).trim(), password: password })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    throw new Error(data.error_description || data.msg || t('account.err.signin'));
  }
  SESSION = null;                 /* 別人のセッションが残らないように */
  storeSession(data, email);
  await loadMember();
  return SESSION;
}

/**
 * パスワード再設定のリンクを送る。
 * 登録済みかどうかは返しません（会員名簿を推測されないため）。
 */
/** そのメールアドレスの会員が居るか。居ないなら送っても届きません。 */
async function accountExists(email) {
  const res = await fetch(sbUrl('rpc/account_exists'), {
    method: 'POST',
    headers: { apikey: CONFIG.supabase.anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_email: String(email).trim() })
  });
  if (!res.ok) throw new Error('lookup failed (' + res.status + ')');
  return await res.json() === true;
}

/**
 * パスワード再設定のメールを送ります。
 *
 * Supabase の SMTP 経由（/auth/v1/recover）は使いません。そこが落ちて
 * いて "Error sending recovery email" を返し、一通も出ていませんでした。
 * 予約の確認メールで動いている Resend 側に寄せています。
 *
 * 失敗は握り潰しません。以前は catch で捨てていたので、届いていない
 * のに「送りました」と出ていました。
 */
async function sendPasswordReset(email) {
  if (!isEmail(email)) throw new Error(t('rsvp.err.email'));
  const res = await fetch('/api/reset', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim() })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (data.error === 'not_configured') throw new Error('Email sending is not set up yet.');
    throw new Error(data.message || data.error || 'Could not send the email. Please try again.');
  }
  return true;
}

/* ---------------------------------------------------------
   有料チケット（Stripe）

   ブラウザから送るのは「どのイベントか」「何名か」だけです。
   金額はサーバー側でDBから引き直します。
   --------------------------------------------------------- */

const isPaid = ev => (ev && ev.priceCents || 0) > 0;

/** 決済画面のURLを受け取ります。 */
async function startCheckout(eventId, quantity) {
  await ensureSession();
  const res = await fetch('/api/checkout', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + (SESSION ? SESSION.access_token : '')
    },
    body: JSON.stringify({ eventId, quantity: Number(quantity) || 1, lang: uiLang() })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (data.error === 'sold_out')         throw new Error(t('rsvp.err.soldOut'));
    if (data.error === 'sign_in_required') throw new Error(t('account.err.signin'));
    if (data.error === 'not_configured')   throw new Error('Payments are not set up yet.');
    throw new Error(data.message || data.error || 'Could not open the payment page.');
  }
  return data.url;
}

/**
 * そのイベントの予約者へリマインダーを送ります（主催者のみ）。
 * 宛先はサーバが名簿から作ります。ここからは渡しません。
 * @returns {Promise<{sent:number, recipients:number}>}
 */
async function sendEventReminder(eventId) {
  await ensureSession();
  const res = await fetch('/api/reminder', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + (SESSION ? SESSION.access_token : '')
    },
    body: JSON.stringify({ eventId })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (data.error === 'not_an_organiser')  throw new Error('You are not an organiser on this site.');
    if (data.error === 'sign_in_required')  throw new Error('Please sign in again.');
    if (data.error === 'not_configured')    throw new Error('Email sending is not set up yet.');
    throw new Error(data.message || data.error || 'Could not send the reminder.');
  }
  return data;
}

/** 決済から戻ってきたとき、発券を待ちます。 */
async function fetchOrderBySession(sessionId, tries = 8) {
  for (let i = 0; i < tries; i++) {
    const res = await fetch('/api/order?session=' + encodeURIComponent(sessionId));
    if (res.status === 202) { await wait(1200); continue; }
    if (!res.ok) throw new Error('order lookup failed (' + res.status + ')');
    return res.json();
  }
  /* 送られてくるのが遅いだけのこともあるので、失敗とは呼びません */
  return { pending: true };
}

/* ---------------------------------------------------------
   注文とチケット

   まだお金は扱いません。無料イベントだけで
   発券 → 表示 → 入場 まで通しきります。

   チケットのURLに入る secret は、知っている人だけが
   開ける鍵です。当日の入口でログインを求めるのは
   現実的ではないので、メールのリンクだけで開けます。
   --------------------------------------------------------- */

/** 推測できない長い乱数。URLを総当たりされても当たらない長さにします。 */
function newSecret() {
  const a = new Uint8Array(24);
  crypto.getRandomValues(a);
  return Array.from(a, b => b.toString(16).padStart(2, '0')).join('');
}

const ticketUrl = (secret) => {
  const u = new URL('ticket.html', location.href);
  const lang = uiLang();
  if (lang !== 'en') u.searchParams.set('lang', lang);
  /* 鍵はハッシュで渡します。理由は ticket.js の先頭に書いてあります */
  u.hash = secret;
  return u.href;
};

/**
 * 予約から注文と1枚のチケットを作ります。
 * 失敗しても予約自体は成立させます（呼び出し側で catch）。
 */
async function issueTicket(ev, rsvp) {
  const secret = newSecret();
  const orderId = 'o' + rsvp.id;

  await sbInsert('orders', {
    id: orderId,
    user_id: (SESSION && SESSION.user_id) || null,
    email: rsvp.email,
    name: rsvp.name,
    event_id: ev.id,
    event_title: ev.title,
    event_date: ev.date,
    quantity: rsvp.guests,
    unit_price_cents: 0,
    total_cents: 0,
    tier_at_purchase: memberTier(),
    status: 'paid'
  });

  await sbInsert('tickets', {
    id: 't' + rsvp.id,
    order_id: orderId,
    user_id: (SESSION && SESSION.user_id) || null,
    email: rsvp.email,
    event_id: ev.id,
    event_title: ev.title,
    event_date: ev.date,
    holder_name: rsvp.name,
    quantity: rsvp.guests,
    secret: secret,
    status: 'valid'
  });

  return { secret, url: ticketUrl(secret) };
}

/* --- 管理者の管理 -------------------------------------------------------
   admins は「自分の行しか読めない」ので、一覧も追加もサーバ側の関数を
   通します。関数の入口で管理者かどうかを見ています（08-admin-manage.sql）。 */

async function callRpc(name, body) {
  if (!(await ensureSession())) throw new Error('Please sign in again.');
  const res = await fetch(sbUrl('rpc/' + name), {
    method: 'POST', headers: sbHeaders(), body: JSON.stringify(body || {})
  });
  const text = await res.text();
  if (!res.ok) {
    /* Postgres の raise exception は message に入ってきます。
       そのまま出すと読めないので、こちら側の言葉に直します。 */
    let code = '';
    try { code = (JSON.parse(text).message || '').trim(); } catch { code = text; }
    throw new Error(code || (name + ' → ' + res.status));
  }
  return text ? JSON.parse(text) : null;
}

/**
 * 自分の予約を取り消します。
 * 鍵を知っているだけでは通りません。サインインしている本人だけです。
 * 転送されたスクリーンショットで他人の予約を消せてしまうためです。
 */
async function cancelMyBooking(secret) {
  try { return await callRpc('cancel_my_booking', { p_secret: secret }); }
  catch (err) { throw new Error(CANCEL_ERRORS[err.message] || err.message); }
}

const CANCEL_ERRORS = {
  sign_in_required: 'Please sign in with the account you booked with.',
  no_such_ticket:   'We could not find that booking.',
  not_your_booking: 'That booking belongs to another account.',
  already_used:     'You have already been checked in at the door.',
  event_passed:     'This event has already happened.'
};

const ADMIN_ERRORS = {
  not_an_organiser:    'You are not an organiser.',
  owner_only:          'Only the owner can add or remove organisers.',
  cannot_remove_self:  'You cannot remove yourself.',
  cannot_remove_owner: 'The owner cannot be removed.',
  last_organiser:      'This is the only organiser. Add someone else first.'
};
const adminError = err => new Error(ADMIN_ERRORS[err.message] || err.message);

async function adminList() {
  try { return await callRpc('admin_list'); }
  catch (err) { throw adminError(err); }
}
/**
 * 主催者を招きます。
 * 相手のアカウントが無ければ作り、本人がパスワードを決めるリンクを送ります。
 * こちらでパスワードを作って渡す形にはしません。
 */
async function adminInvite(email, note) {
  await ensureSession();
  const res = await fetch('/api/organiser', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + (SESSION ? SESSION.access_token : '')
    },
    body: JSON.stringify({ email, note: note || '' })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (data.error === 'not_an_organiser') throw new Error('You are not an organiser.');
    if (data.error === 'owner_only')        throw new Error('Only the owner can invite organisers.');
    if (data.error === 'sign_in_required')  throw new Error('Please sign in again.');
    if (data.error === 'not_configured')    throw new Error('Email sending is not set up yet.');
    if (data.error === 'bad_email')         throw new Error('That email address does not look right.');
    throw new Error(data.message || data.error || 'Could not send the invitation.');
  }
  return data;
}
async function adminRemove(userId) {
  try { return await callRpc('admin_remove', { p_user_id: userId }); }
  catch (err) { throw adminError(err); }
}

/** secret だけでチケットを読みます（ログイン不要）。 */
async function fetchTicket(secret) {
  const res = await fetch(sbUrl('rpc/get_ticket'), {
    method: 'POST',
    headers: { apikey: CONFIG.supabase.anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_secret: secret })
  });
  if (!res.ok) throw new Error('ticket read failed (' + res.status + ')');
  const rows = await res.json();
  return rows[0] || null;
}

/* --- 受付（管理者のみ） ------------------------------------------------
   secret は列の権限から外してあるので、管理者でも取り出せません。
   受付は名簿から手で通す形になります（それで十分で、かつ安全です）。 */

/* secret は権限から外してあるので、列を明示して取ります */
const TICKET_COLS = 'id,order_id,user_id,email,event_id,event_title,event_date,' +
                    'holder_name,quantity,status,checked_in_at,created_at';

async function adminListTickets(eventId) {
  if (!(await ensureSession())) throw new Error('Not signed in.');
  return sbSelect('tickets',
    'select=' + TICKET_COLS +
    '&event_id=eq.' + encodeURIComponent(eventId) + '&order=holder_name.asc');
}

/**
 * 受付のチェックを入れる／外す。
 * 取り消せることが大事です。押し間違いは必ず起きるので、
 * 一方通行にすると現場で直せなくなります。
 */
async function adminSetCheckIn(ticketId, checkedIn) {
  if (!(await ensureSession())) throw new Error('Not signed in.');
  const res = await fetch(sbUrl('tickets', 'id=eq.' + encodeURIComponent(ticketId)), {
    method: 'PATCH',
    headers: Object.assign(sbHeaders(), { Prefer: 'return=minimal' }),
    body: JSON.stringify({
      status: checkedIn ? 'used' : 'valid',
      checked_in_at: checkedIn ? new Date().toISOString() : null,
      checked_in_by: checkedIn ? signedInAs() : null
    })
  });
  if (!res.ok) throw new Error('check-in failed (' + res.status + ')');

  sbInsert('ticket_history', {
    ticket_id: ticketId,
    action: checkedIn ? 'checked_in' : 'undone',
    by_email: signedInAs(),
    detail: { source: 'door' }
  }).catch(() => {});
}

/* ---------------------------------------------------------
   会員モーダル

   会員ページは作りません。入口は予約フォームであって、
   「Membership」を押して登録する人はほとんどいないためです。
   ここは「戻ってきた会員が履歴を見る場所」と
   「予約の途中でサインインする場所」だけを担います。

   マークアップを各HTMLに書くと三重管理になるので、
   ここで組み立てて全ページに共通で入れます。
   --------------------------------------------------------- */

let MEMBER_MODE = 'signin';   /* 'signin' | 'create' | 'forgot' | 'sent' */

function memberModalEl() {
  let el = $('#memberModal');
  if (el) return el;
  el = document.createElement('div');
  el.className = 'modal modal--sm';
  el.id = 'memberModal';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.innerHTML =
    '<div class="modal__scrim" data-close></div>' +
    '<div class="modal__panel">' +
      '<div class="modal__head"><h3 id="memberTitle"></h3>' +
        '<button class="modal__close" type="button" data-close aria-label="Close">\u2715</button></div>' +
      '<div class="modal__body" id="memberBody"></div>' +
    '</div>';
  document.body.appendChild(el);
  el.addEventListener('click', e => {
    if (e.target === el || e.target.closest('[data-close]')) closeMemberModal();
  });
  return el;
}

function closeMemberModal() {
  const el = $('#memberModal');
  if (el) el.classList.remove('is-open');
  document.body.style.overflow = '';
}

/** サインイン済みなら会員証、未サインインならフォーム。 */
async function openMemberModal(mode) {
  MEMBER_MODE = mode || (isSignedIn() ? 'card' : 'signin');
  const el = memberModalEl();
  el.classList.add('is-open');
  document.body.style.overflow = 'hidden';
  await renderMemberModal();
}

async function renderMemberModal() {
  const body = $('#memberBody');
  if (!body) return;

  const head = $('#memberTitle');
  if (head) head.textContent = t('account.title');

  if (isSignedIn()) {
    body.innerHTML = '<div class="empty" style="padding:40px 0">\u2026</div>';
    const [, rsvps, tickets, admin] = await Promise.all([
      loadMember(), loadMyRsvps(), loadMyTickets(), isAdminUser().catch(() => false)
    ]);
    body.innerHTML = memberCardHTML(rsvps, tickets, admin);
    wireMemberCard();
  } else {
    body.innerHTML = memberAuthHTML();
    wireMemberAuth();
  }
}

/**
 * 会員証。
 *
 * 画面上のカードなので、紙のカードに見えるところまで作ります。
 * 和紙の地、筆書きの名前、押した印、そして影。ここを素っ気ない箱に
 * すると「登録して何が手に入るのか」が伝わりません。
 *
 * @param rsvps   予約の一覧
 * @param tickets 自分のチケット（secret 込み）。予約と event_id で突き合わせます
 */
function memberCardHTML(rsvps, tickets, isOrganiser) {
  const profile = (MEMBER && MEMBER.profile) || {};
  const ship = (MEMBER && MEMBER.membership) || {};
  const tier = memberTier();
  const since = ship.started_at
    ? new Date(ship.started_at).toLocaleDateString(dateLocale(), { year: 'numeric', month: 'long', day: 'numeric' })
    : '';
  const name = profile.name || profile.email || signedInAs();

  const byEvent = new Map();
  (tickets || []).forEach(tk => { if (!byEvent.has(tk.event_id)) byEvent.set(tk.event_id, tk); });

  /* いま存在する回の予約だけを出します。
     予約はイベントへの外部キーを張っていないので、イベントが消えても
     行としては残ります。event_id が空のまま残っている行もあります。
     どちらも、開く先も日付の裏付けも無い「読めない予約」です。

     はじめは event_id が空の行を「判断できないので残す」扱いにして
     いましたが、それだと消えた回の予約が古い名前のまま出続けました。

     イベントの読み込みに失敗したときだけ絞りません。全部消えたように
     見えるほうが、古い行が1つ残るより困るためです。 */
  const known = contentSource === 'supabase'
    ? new Set(EVENTS.map(e => e.id))
    : null;
  const shown = known
    ? rsvps.filter(r => r.event_id && known.has(r.event_id))
    : rsvps;

  if (known && shown.length !== rsvps.length) {
    console.info('bookings hidden (event no longer exists):',
      rsvps.filter(r => !(r.event_id && known.has(r.event_id)))
           .map(r => ({ id: r.id, event_id: r.event_id, title: r.event_title })));
  }

  const bookingRow = r => {
    const tk = byEvent.get(r.event_id);
    /* 控えてある名前は予約した当時のものです。イベント名を変えると
       ここだけ古い名前で残ります。いまある回は、いまの名前で出します。 */
    const ev = findEvent(r.event_id);
    const title = (ev && ev.title) || r.event_title || '\u2014';
    const date = (ev && ev.date) || r.event_date;
    const when = date
      ? new Date(date).toLocaleDateString(dateLocale(), { year: 'numeric', month: 'long', day: 'numeric' })
      : '';
    return `<li>
      <b>${esc(title)}</b>
      <span>${esc(when)} \u00b7 ${esc(r.guests)} ${esc(t(r.guests > 1 ? 'meta.people' : 'meta.person'))}</span>
      ${tk ? `<a class="acct-ticket" href="ticket.html#${encodeURIComponent(tk.secret)}">
                ${esc(t('account.openTicket'))}</a>` : ''}
    </li>`;
  };

  return `
    <div class="washi">
      <div class="washi__grain" aria-hidden="true"></div>
      <div class="washi__head">
        <img src="assets/logo.jpg" alt="" width="34" height="34">
        <div><b>Asian Social</b><span>Rotterdam</span></div>
      </div>
      <p class="washi__label">${esc(t('account.card'))}</p>
      <div class="washi__name">${esc(name)}</div>
      <div class="washi__meta">
        <span>${esc(t(tier === 'premium' ? 'account.tier.premium' : 'account.tier.free'))}</span>
        ${since ? `<span>${esc(t('account.since'))} ${esc(since)}</span>` : ''}
      </div>
    </div>

    <div class="acct-block">
      <h2>${esc(t('account.name'))}</h2>
      <div class="field">
        <label for="mcName" class="sr-only">${esc(t('account.name'))}</label>
        <input id="mcName" type="text" value="${esc(profile.name || '')}" placeholder="${esc(t('account.namePh'))}">
      </div>
      <button class="mini" type="button" id="mcSave" style="margin-top:14px">${esc(t('account.save'))}</button>
    </div>

    <div class="acct-block">
      <h2>${esc(t('account.bookings'))}</h2>
      ${shown.length
        ? `<ul class="acct-list">${shown.map(bookingRow).join('')}</ul>`
        : `<p style="color:var(--muted)">${esc(t('account.noBookings'))}</p>`}
    </div>

    ${isOrganiser ? `
    <div class="acct-block">
      <h2>${esc(t('account.organiser'))}</h2>
      <a class="btn btn--line btn--sm" href="index.html#admin">${esc(t('account.openAdmin'))}</a>
    </div>` : ''}

    <div class="acct-foot">
      <button class="mini" type="button" id="mcSignOut">${esc(t('account.signout'))}</button>
    </div>`;
}

function memberForgotHTML() {
  return `
    <h2 style="font-size:1.3rem;font-weight:500;margin:0 0 10px">
      ${esc(t('forgot.title'))}</h2>
    <p style="color:var(--muted);font-size:.9rem;margin:0 0 22px">${esc(t('forgot.body'))}</p>

    <div class="field">
      <label for="mfEmail">${esc(t('rsvp.email'))}</label>
      <input id="mfEmail" type="email" autocomplete="email" inputmode="email">
    </div>

    <button class="btn btn--brand btn--block" type="button" id="mfSubmit" style="margin-top:20px">
      ${esc(t('forgot.send'))}</button>

    <p class="acct-swap">
      <button type="button" class="linkish" id="mfBack">${esc(t('forgot.back'))}</button>
    </p>`;
}

function memberSentHTML() {
  return `
    <h2 style="font-size:1.3rem;font-weight:500;margin:0 0 10px">
      ${esc(t('forgot.sentTitle'))}</h2>
    <p style="color:var(--muted);font-size:.9rem;margin:0 0 22px">${esc(t('forgot.sentBody'))}</p>
    <button class="btn btn--line btn--block" type="button" id="mfBack">${esc(t('forgot.back'))}</button>`;
}

function memberAuthHTML() {
  if (MEMBER_MODE === 'forgot') return memberForgotHTML();
  if (MEMBER_MODE === 'sent')   return memberSentHTML();
  const creating = MEMBER_MODE === 'create';
  return `
    <h2 style="font-size:1.3rem;font-weight:500;margin:0 0 22px">
      ${esc(t(creating ? 'account.create' : 'account.signin.title'))}</h2>

    ${creating ? `
    <div class="field">
      <label for="mmName">${esc(t('account.name'))}</label>
      <input id="mmName" type="text" autocomplete="name">
    </div>` : ''}

    <div class="field">
      <label for="mmEmail">${esc(t('rsvp.email'))}</label>
      <input id="mmEmail" type="email" autocomplete="email" inputmode="email">
    </div>

    <div class="field">
      <label for="mmPass">${esc(t('account.password'))}</label>
      <input id="mmPass" type="password" autocomplete="${creating ? 'new-password' : 'current-password'}"
             placeholder="${creating ? esc(t('account.passwordPh')) : ''}">
    </div>

    <button class="btn btn--brand btn--block" type="button" id="mmSubmit" style="margin-top:20px">
      ${esc(t(creating ? 'account.createBtn' : 'account.signinBtn'))}</button>

    <p class="acct-swap">
      ${esc(t(creating ? 'account.haveAccount' : 'account.noAccount'))}
      <button type="button" class="linkish" id="mmSwap">
        ${esc(t(creating ? 'account.toSignin' : 'account.toCreate'))}</button>
    </p>
    ${creating ? '' : `<p class="acct-swap">
      <button type="button" class="linkish" id="mmForgot">${esc(t('account.forgot'))}</button></p>`}`;
}

function wireMemberAuth() {
  /* 「忘れた」と「送りました」は入力の意味が違うので、別に配線します */
  if (MEMBER_MODE === 'forgot' || MEMBER_MODE === 'sent') {
    const back = $('#mfBack');
    if (back) back.addEventListener('click', () => {
      MEMBER_MODE = 'signin';
      renderMemberModal();
    });

    const send = $('#mfSubmit');
    if (send) {
      const go = async () => {
        const email = $('#mfEmail').value.trim();
        if (!isEmail(email)) return toast(t('rsvp.err.email'), true);

        const label = send.textContent;
        send.disabled = true; send.textContent = t('forgot.checking');
        try {
          if (!(await accountExists(email))) {
            toast(t('forgot.noAccount'), true);
            send.disabled = false; send.textContent = label;
            return;
          }
          await sendPasswordReset(email);
          MEMBER_MODE = 'sent';
          await renderMemberModal();
          return;
        } catch (err) {
          toast(err.message, true);
        }
        send.disabled = false; send.textContent = label;
      };
      send.addEventListener('click', go);
      $('#memberBody').addEventListener('keydown', e => {
        if (e.key === 'Enter' && e.target.matches('input')) go();
      });
    }
    return;
  }

  const submit = async () => {
    const btn = $('#mmSubmit'), label = btn.textContent;
    const creating = MEMBER_MODE === 'create';
    btn.disabled = true;
    btn.textContent = t(creating ? 'account.creating' : 'account.signingIn');
    try {
      if (creating) {
        await signUp($('#mmEmail').value, $('#mmPass').value, ($('#mmName') || {}).value);
        toast(t('account.welcome'));
      } else {
        await signIn($('#mmEmail').value, $('#mmPass').value);
      }
      await renderMemberModal();
      document.dispatchEvent(new CustomEvent('member:changed'));
      return;
    } catch (err) {
      toast(err.message, true);
    }
    btn.disabled = false; btn.textContent = label;
  };

  $('#mmSubmit').addEventListener('click', submit);
  $('#memberBody').addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.matches('input')) submit();
  });
  $('#mmSwap').addEventListener('click', () => {
    MEMBER_MODE = MEMBER_MODE === 'create' ? 'signin' : 'create';
    renderMemberModal();
  });
  const forgot = $('#mmForgot');
  if (forgot) forgot.addEventListener('click', () => {
    MEMBER_MODE = 'forgot';
    renderMemberModal().then(() => {
      /* サインイン欄に入れかけていたものを引き継ぎます */
      const typed = $('#mmEmail');
      const box = $('#mfEmail');
      if (box) { if (typed && typed.value) box.value = typed.value; box.focus(); }
    });
  });
}

function wireMemberCard() {
  $('#mcSave').addEventListener('click', async () => {
    const btn = $('#mcSave');
    btn.disabled = true;
    try {
      await saveProfile({ name: $('#mcName').value.trim(), locale: currentLang() });
      toast(t('account.saved'));
      document.dispatchEvent(new CustomEvent('member:changed'));
    } catch (err) { toast(err.message, true); }
    btn.disabled = false;
  });
  $('#mcSignOut').addEventListener('click', () => {
    signOut();
    location.href = homeUrl();
  });
}

/* ---------------------------------------------------------
   会員データ
   --------------------------------------------------------- */
let MEMBER = null;   /* { profile, membership } */

/**
 * 古いセッションには user_id が入っていません。
 * 保存する前に作られたものが localStorage に残っているためで、
 * その状態で user_id を使うと問い合わせが空振りします。
 * 足りなければ取り直して保存し直します。
 */
async function ensureUserId() {
  if (!SESSION) return '';
  if (SESSION.user_id) return SESSION.user_id;
  try {
    const res = await fetch(authBase() + '/user', {
      headers: { apikey: CONFIG.supabase.anonKey, Authorization: 'Bearer ' + SESSION.access_token }
    });
    if (!res.ok) return '';
    const u = await res.json();
    SESSION.user_id = u.id || '';
    SESSION.email   = u.email || SESSION.email;
    DB.set('session', SESSION);
    return SESSION.user_id;
  } catch (err) {
    return '';
  }
}

/** いまサインインしている人が管理者か。 */
async function isAdminUser() {
  if (!(await ensureSession())) return false;
  const id = await ensureUserId();
  if (!id) return false;
  const rows = await sbSelect('admins', 'user_id=eq.' + encodeURIComponent(id));
  return rows.length > 0;
}

/** サインイン中の会員のプロフィールと会員ランクを読む。 */
async function loadMember() {
  if (!(await ensureSession())) { MEMBER = null; return null; }
  const uid = await ensureUserId();
  if (!uid) { MEMBER = null; return null; }
  const id = encodeURIComponent(uid);
  try {
    const [profiles, memberships] = await Promise.all([
      sbSelect('profiles', 'id=eq.' + id),
      sbSelect('memberships', 'user_id=eq.' + id)
    ]);
    MEMBER = { profile: profiles[0] || null, membership: memberships[0] || null };
  } catch (err) {
    console.warn('member load failed:', err.message);
    MEMBER = null;
  }
  return MEMBER;
}

/** 'guest' | 'free' | 'premium' */
function memberTier() {
  if (!isSignedIn()) return 'guest';
  return (MEMBER && MEMBER.membership && MEMBER.membership.tier) || 'free';
}

/** 名前と言語だけ更新できます（他の列はDB側で拒否されます）。 */
async function saveProfile(fields) {
  if (!(await ensureSession())) throw new Error('Not signed in.');
  const uid = await ensureUserId();
  const res = await fetch(sbUrl('profiles', 'id=eq.' + encodeURIComponent(uid)), {
    method: 'PATCH',
    headers: Object.assign(sbHeaders(), { Prefer: 'return=minimal' }),
    body: JSON.stringify(fields)
  });
  if (!res.ok) throw new Error('Could not save (' + res.status + ')');
  if (MEMBER && MEMBER.profile) Object.assign(MEMBER.profile, fields);
}

/**
 * 自分の予約。メールアドレスで突き合わせるので、
 * アカウントを作る前にした予約も出てきます。
 */
/**
 * 自分のチケット（secret 込み）。
 * secret は列の権限から外してあるので、素の select では取れません。
 * 自分の分だけを返す関数をサーバに置いてあります（07-my-tickets.sql）。
 */
async function loadMyTickets() {
  if (!(await ensureSession())) return [];
  try {
    const res = await fetch(sbUrl('rpc/my_tickets'), {
      method: 'POST', headers: sbHeaders(), body: '{}'
    });
    if (!res.ok) throw new Error('my_tickets → ' + res.status);
    return await res.json();
  } catch (err) {
    /* 関数がまだ無い環境でも会員証は出したいので、黙って空にします */
    console.warn('tickets load failed:', err.message);
    return [];
  }
}

async function loadMyRsvps() {
  if (!(await ensureSession())) return [];
  try {
    return await sbSelect('rsvps', 'order=event_date.desc');
  } catch (err) {
    console.warn('bookings load failed:', err.message);
    return [];
  }
}

/**
 * サインアウトしたあとの行き先。
 * その場に留まると、もう見られないものが並んだままになります。
 * 読み込み直すので、価格や会員向けの表示も一緒に戻ります。
 */
function homeUrl() {
  const u = new URL('index.html', location.href);
  const lang = uiLang();
  if (lang !== 'en') u.searchParams.set('lang', lang);
  u.hash = '';
  return u.href;
}

function signOut() {
  if (SESSION && SESSION.access_token) {
    fetch(authBase() + '/logout', {
      method: 'POST',
      headers: { apikey: CONFIG.supabase.anonKey, Authorization: 'Bearer ' + SESSION.access_token }
    }).catch(() => {});
  }
  SESSION = null;
  MEMBER = null;
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
  /* 呼び出し側が select= を指定していればそれを使います。
     tickets は列単位で権限を絞っているため、select=* だと
     secret まで要求したことになって 403 になります。 */
  const hasSelect = query && /(^|&)select=/.test(query);
  const q = hasSelect ? query : ('select=*' + (query ? '&' + query : ''));
  const res = await fetch(sbUrl(table, q), { headers: sbHeaders() });
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
  venue: r.venue, address: r.address, price: r.price, image: r.image, description: r.description,
  brand: r.brand || 'asian-social',
  priceCents:       r.price_cents || 0,
  currency:         r.currency || 'EUR',
  memberDiscount:   !!r.member_discount,
  priceMemberCents: r.price_member_cents,
  earlyBird:        !!r.early_bird,
  priceEarlyCents:  r.price_early_cents,
  earlyBirdUntil:   r.early_bird_until,
  capacity:         r.capacity
});
const evToRow = e => ({
  id: e.id, title: e.title, date: e.date, start_time: e.start, end_time: e.end,
  venue: e.venue, address: e.address, image: e.image, description: e.description,
  brand: e.brand || 'asian-social',
  /* price は表示用の自由入力だった列。金額の計算は price_cents 側で行い、
     price には整形した文字列を入れて古い表示との互換を保ちます。 */
  price: priceLabel(e.priceCents || 0, e.currency || 'EUR'),
  price_cents:        e.priceCents || 0,
  currency:           e.currency || 'EUR',
  member_discount:    !!e.memberDiscount,
  price_member_cents: e.memberDiscount ? (e.priceMemberCents ?? null) : null,
  early_bird:         !!e.earlyBird,
  price_early_cents:  e.earlyBird ? (e.priceEarlyCents ?? null) : null,
  early_bird_until:   e.earlyBird ? (e.earlyBirdUntil || null) : null
});

/* ---------------------------------------------------------
   価格

   金額はセントの整数で持ちます。表示するときだけ割ります。
   --------------------------------------------------------- */

const CURRENCY_SIGN = { EUR: '\u20ac', USD: '$', GBP: '\u00a3', JPY: '\u00a5' };

/** 1250 → "€12.50" / 0 → "Free" */
function priceLabel(cents, currency) {
  const n = Number(cents) || 0;
  if (n <= 0) return t('price.free');
  const sign = CURRENCY_SIGN[currency || 'EUR'] || (currency || '') + ' ';
  const s = (n / 100).toFixed(2).replace(/\.00$/, '');
  return sign + s;
}

/** Admin の入力欄用。1250 → "12.50" */
const centsToInput = cents =>
  (cents === null || cents === undefined || cents === '') ? '' : String(Number(cents) / 100);

/** "12.50" → 1250。四捨五入するので 12.505 のような入力でもずれません。 */
const inputToCents = v => Math.max(0, Math.round((parseFloat(String(v).replace(',', '.')) || 0) * 100));

/** 早割が今日まだ有効か。 */
function earlyBirdActive(ev) {
  if (!ev || !ev.earlyBird || !ev.earlyBirdUntil) return false;
  const [y, m, d] = String(ev.earlyBirdUntil).split('-').map(Number);
  /* その日の終わりまで有効にします。締切当日に買えないのは不親切なので */
  return Date.now() <= new Date(y, (m || 1) - 1, d || 1, 23, 59, 59).getTime();
}

/**
 * その訪問者に適用される価格を決めます。
 * 割引が重なったときは一番安いものを採ります。会員なのに高い、が起きないためです。
 * @returns {{cents:number, label:string, base:number, baseLabel:string, reason:string}}
 */
function priceFor(ev, tier) {
  const cur  = (ev && ev.currency) || 'EUR';
  const base = (ev && ev.priceCents) || 0;
  const who  = tier || (typeof memberTier === 'function' ? memberTier() : 'guest');

  const options = [{ cents: base, reason: '' }];
  if (ev && ev.memberDiscount && ev.priceMemberCents != null && who !== 'guest') {
    options.push({ cents: ev.priceMemberCents, reason: 'member' });
  }
  if (earlyBirdActive(ev) && ev.priceEarlyCents != null) {
    options.push({ cents: ev.priceEarlyCents, reason: 'early' });
  }
  const best = options.reduce((a, b) => (b.cents < a.cents ? b : a));

  return {
    cents: best.cents,
    label: priceLabel(best.cents, cur),
    base: base,
    baseLabel: priceLabel(base, cur),
    reason: best.cents < base ? best.reason : ''
  };
}
let contentSource = supabaseReady() ? 'loading' : 'local';

/**
 * Pull the events from Supabase into EVENTS.
 * 読めなかったときは、この端末に残っている前回の内容をそのまま使います。
 * 真っ白になるより、少し古いものが出ているほうがましです。
 */
async function loadContent() {
  if (!supabaseReady()) return false;
  let loaded = 0;
  try {
    EVENTS = (await sbSelect('events', 'order=date.asc')).map(evFromRow);
    DB.set('events', EVENTS);
    loaded++;
  } catch (err) {
    console.warn('events: using the cached copy —', err.message);
  }
  contentSource = loaded ? 'supabase' : 'cache';
  return loaded > 0;
}

/* Admin writes: keep the local copy and the table in step. */
const pushEvent = rec => supabaseReady() ? sbUpsert('events', evToRow(rec)) : Promise.resolve();
const dropEvent = id  => supabaseReady() ? sbDelete('events', id) : Promise.resolve();

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
/* 既定は英語です。増やすときは i18n.js に同じキーを足してから足してください。
   訳の無い言語を並べると、選んだのに英語のまま、という見え方になります。 */
const LANGS = [
  { code: 'en', label: 'English',    short: 'EN' },
  { code: 'ja', label: '日本語',      short: 'JA' },
  { code: 'nl', label: 'Nederlands', short: 'NL' }
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
/**
 * 言語メニューの行き先。
 *
 * 以前は Google 翻訳のプロキシへ飛ばしていました。やめた理由は、
 * このサイトの中身の多くが JavaScript で後から描かれるからです。
 * プロキシは最初に届いた HTML を訳す作りなので後の文字を取りこぼし、
 * 実測では本文が英語のまま、日付だけ日本語という状態になっていました。
 * 訳しきれない翻訳は、訳さないより読みにくくなります。
 *
 * いまは自前の訳を ?lang= で出します。訳はすべて i18n.js にあります。
 */
function translatedUrl(code) {
  return nativeUrl(code, location.hash.slice(1));
}

/**
 * data-i18n / data-i18n-ph の付いた要素を自前の訳に差し替える。
 * 翻訳ページでは Google がすでに訳しているので何もしません。
 */
function applyI18n(root) {
  if (onProxy() || uiLang() === 'en') return;
  const box = root || document;
  $$('[data-i18n]', box).forEach(el => { el.textContent = t(el.dataset.i18n); });
  /* <br> や <em> を含む見出し用。訳は自分たちで書いたものだけです */
  $$('[data-i18n-html]', box).forEach(el => { el.innerHTML = t(el.dataset.i18nHtml); });

  /* タブに出る文字。共有したときに最初に見られるので、ここも訳します。
     イベントのページだけは、あとから催しの名前で上書きされます。 */
  const titleKey = document.body && document.body.dataset.i18nTitle;
  if (titleKey) document.title = t(titleKey);

  /* 読み上げソフトとブラウザに、いまの言語を伝えます。
     ここが en のままだと、日本語が英語として読まれ、
     ブラウザが「翻訳しますか」と重ねて聞いてきます。 */
  document.documentElement.lang = uiLang();
  $$('[data-i18n-ph]', box).forEach(el => { el.placeholder = t(el.dataset.i18nPh); });
}


/* ナビの Membership はページ遷移ではなくモーダルを開きます */
/**
 * 同じ登録を二度しないための札。
 *
 * initShell() は内容を描き直すたびに呼ばれます（キャッシュで一度、
 * Supabase から届いてもう一度）。素直に addEventListener すると
 * リスナーが積み上がり、開いてすぐ閉じる＝押しても何も起きない、
 * という形で壊れます。ハンバーガーと言語メニューが実際にそうなっていました。
 */
const BOUND = new Set();
function bindOnce(key, fn) {
  if (BOUND.has(key)) return;
  BOUND.add(key);
  fn();
}

function initMemberLinks() {
  $$('[data-member]').forEach(el => {
    if (el.dataset.memberBound) return;
    el.dataset.memberBound = '1';
    el.addEventListener('click', e => {
      e.preventDefault();
      openMemberModal(el.dataset.member === 'create' ? 'create' : undefined);
    });
  });
  bindOnce('member-esc', () => {
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeMemberModal();
    });
  });
}

const isLocalHost = () => /^(localhost|127\.|0\.0\.0\.0|\[?::1)/.test(location.hostname) || location.protocol === 'file:';

/**
 * ヘッダーの会員リンクの文字を、いまの状態に合わせます。
 * 「Membership」だけだと、入る場所なのか自分の情報なのか分かりません。
 */
function syncAccountLink() {
  $$('.nav__acc').forEach(el => {
    el.textContent = isSignedIn() ? t('account.mine') : t('account.signin');
    el.removeAttribute('data-i18n');              /* ここで入れた文字を消させません */
  });
}

document.addEventListener('member:changed', syncAccountLink);

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

  bindOnce('lang-menu', () => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      menu.hidden ? open() : close();
    });
    document.addEventListener('click', e => { if (!box.contains(e.target)) close(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  });

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
  initMemberLinks();
  keepLangOnLinks();
  applyI18n();

  const nav = $('#nav'), burger = $('#burger');
  if (nav && burger) {
    bindOnce('burger', () => {
      burger.addEventListener('click', () => {
        const open = nav.classList.toggle('is-open');
        burger.setAttribute('aria-expanded', String(open));
      });
      nav.addEventListener('click', e => { if (e.target.tagName === 'A') nav.classList.remove('is-open'); });
    });
  }
  syncAccountLink();

  const rev = new IntersectionObserver((entries, obs) => {
    entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add('is-in'); obs.unobserve(en.target); } });
  }, { threshold: .12 });
  $$('.reveal').forEach(el => rev.observe(el));
}
