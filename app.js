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

/* ---------------------------------------------------------
   Past events（ホームの一番下）
   終わった回を新しい順に4件（全部は events.html の See all past events で）。表紙はイベント本来の画像。
   写真とレビューの数、いちばん新しいレビューを添えます。
   写真・レビューのテーブル（19 の SQL）が無いときは、回だけを並べます。
   --------------------------------------------------------- */
let PAST_COMMUNITY = null;   /* { photos, reviews } を一度だけ読みます */

async function loadPastCommunity() {
  if (PAST_COMMUNITY) return PAST_COMMUNITY;
  try {
    const [photos, reviews] = await Promise.all([loadPhotos(null, 300), loadReviews(null, 300)]);
    PAST_COMMUNITY = { photos, reviews };
  } catch (err) {
    console.info('past community not loaded:', err.message);
    PAST_COMMUNITY = { photos: [], reviews: [] };
  }
  return PAST_COMMUNITY;
}

function pastCardHTML(ev, cm) {
  const photos  = cm.photos.filter(p => p.event_id === ev.id);
  const reviews = cm.reviews.filter(r => r.event_id === ev.id);
  /* 表紙はイベント本来の画像のまま。あとから足した写真には差し替えません */
  const cover = ev.image;
  const latest = reviews[0];
  /* 写真・感想の件数は出しません（枚数の多さで選ばれるのを避けるため）。
     感想が1件あれば、いちばん新しいものだけを添えます */
  return `<a class="past-card" href="${esc(eventUrl(ev.id))}#eventCommunity">
    <span class="past-card__img">${cover ? `<img src="${esc(cover)}" alt="" loading="lazy">` : ''}</span>
    <span class="past-card__body">
      <span class="past-card__date">${esc(fmtDate(ev, { day: 'numeric', month: 'short', year: 'numeric' }))}</span>
      <b>${esc(ev.title)}</b>
      ${latest ? `<span class="past-card__review">${avatarHTML(latest.initials, latest.nationality)}
        <span>${esc(latest.body.length > 110 ? latest.body.slice(0, 110) + '…' : latest.body)}</span></span>` : ''}
    </span>
  </a>`;
}

/* Our Community の写真。全部の回の写真を混ぜ、毎回ちがう順に並べます。
   切れ目なく流すため、同じ並びを2回つなげて、半分ぶん動かしたら最初に戻します（CSS の reel） */
async function renderCommunityReel() {
  const reel = $('#communityReel'), track = $('#communityTrack');
  if (!reel || !track) return;
  const cm = await loadPastCommunity();
  const pics = cm.photos.slice();
  for (let i = pics.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pics[i], pics[j]] = [pics[j], pics[i]];
  }
  const list = pics.slice(0, 24);
  reel.hidden = !list.length;
  if (!list.length) return;
  const one = list.map(p => `<a class="reel__item" href="${esc(eventUrl(p.event_id))}#eventCommunity" tabindex="-1">
      <img src="${esc(p.url)}" alt="" loading="lazy" decoding="async"></a>`).join('');
  track.innerHTML = one + one;
  /* 枚数が多いほどゆっくり。1枚あたり約4秒で、速さを一定に保ちます */
  track.style.setProperty('--reel-dur', Math.max(30, list.length * 4) + 's');
  keepLangOnLinks(track);
}

async function renderPastEvents() {
  const sec = $('#past'), grid = $('#pastGrid');
  if (!sec || !grid) return;
  const list = EVENTS.filter(isPast).sort(byDate).reverse().slice(0, 4);
  sec.hidden = !list.length;
  if (!list.length) return;
  const cm = await loadPastCommunity();
  grid.innerHTML = list.map(ev => pastCardHTML(ev, cm)).join('');
  keepLangOnLinks(grid);
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
/* 検索結果や他サイトのリンクから来た人には、最初から Upcoming events を見せます。
   戻る・進むボタンでの行き来、サイト内の遷移（ヘッダーの Home など）、
   #hash 付きのリンクで来たときは、普段どおり一番上から見せます。 */
function shouldJumpToEvents() {
  if (location.hash) return false;
  try {
    const nav = performance.getEntriesByType('navigation')[0];
    if (nav && nav.type !== 'navigate') return false;   // reload・戻る/進むは対象外
  } catch (e) {}
  if (!document.referrer) return false;   // 直接入力・ブックマークは一番上から
  try {
    if (new URL(document.referrer).host === location.host) return false;   // サイト内の遷移
  } catch (e) { return false; }
  return true;
}
let jumpedToEvents = false;
function jumpToEventsIfNeeded() {
  if (jumpedToEvents || !shouldJumpToEvents()) return;
  const target = $('#events');
  if (!target) return;
  jumpedToEvents = true;
  /* html の scroll-behavior:smooth を無効にして、一瞬で移動します
     （ページを開いた瞬間にスクロールが「動いて見える」のを避けるため） */
  target.scrollIntoView({ block: 'start', behavior: 'instant' });
}

document.addEventListener('DOMContentLoaded', () => {
  initShell();
  renderDow();

  createRail('#eventsRail', '#eventsTrack', '#eventsProgress');
  bindRailScroll();
  window.addEventListener('load', measureRails);

  const drawAll = () => {
    if (!calTouched) calCursor = initialCalMonth();
    renderCalendar(); renderEventRail(); renderHeroNext(); renderPastEvents(); renderCommunityReel();
    keepLangOnLinks();   /* カードは後から描かれるので、描くたびに ?lang= を付け直す */
    requestAnimationFrame(measureRails);
    requestAnimationFrame(jumpToEventsIfNeeded);
  };
  bootstrapContent(drawAll);

  /* Scroll-spy */
  ['home', 'events', 'past'].forEach(id => {
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
