/* =========================================================
   Asian Socials — home page (index.html)
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
  /* 終わった回は並べません。これから行ける回だけを見せます
     （管理画面では引き続き全部見えます） */
  const next = upcoming();
  const all = next;
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
  /* 説明は About に移したので、回が無いと見出しだけが残ります。セクションごと隠します */
  const sec = box.closest('section');
  if (sec) sec.hidden = !list.length;
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
    /* カレンダーには終わった回も残します。記録として見えるほうがよいためです。
       一覧（What's coming up）からは外してあるので、混ざるのはここだけです */
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
    keepLangOnLinks();   /* カードは後から描かれるので、描くたびに ?lang= を付け直す */
    requestAnimationFrame(measureRails);
  };
  bootstrapContent(drawAll);

  /* Scroll-spy */
  ['home', 'events', 'en'].forEach(id => {
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

  /* 管理画面は admin.asiansocials.nl に移しました。
     古いブックマーク（index.html#admin）から来た人は、そちらへ送ります */
  if (location.hash === '#admin') location.replace(adminUrl());
});
