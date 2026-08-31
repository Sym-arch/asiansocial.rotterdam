/* =========================================================
   Asian Social Rotterdam — event detail page (event.html)
   Requires core.js
   ========================================================= */

const EV_ID = new URLSearchParams(location.search).get('id');

function notFound() {
  $('#eventMain').innerHTML = `
    <div class="wrap" style="padding:90px 0 60px">
      <div style="max-width:560px">
        <h1 style="font-size:clamp(1.6rem,4vw,2.4rem);margin-bottom:12px">Event not found</h1>
        <p style="color:var(--muted);margin-bottom:24px">
          This event may have been removed, or the link is incomplete.</p>
        <a class="btn btn--brand" href="index.html#events">Back to all events</a>
      </div>
    </div>`;
}

/**
 * 予約欄の中身。
 *
 * Google 翻訳のプロキシは <input> にフォーカスが入った時点で警告を出し、
 * 入力を止めてしまいます（<form> の有無は無関係。実測で確認済み）。
 * そのため翻訳ページでは入力欄を出さず、母語の案内と
 * 「自前ドメイン ＋ ?lang=xx」へのボタンだけを見せます。
 * 移動先では下のフォームが同じ言語で表示され、警告も出ません。
 */
function bookingHTML(ev) {
  if (onProxy()) {
    return `<p class="label label--brand">${esc(t('rsvp.label'))}</p>
      <h2 style="font-size:1.5rem;margin:14px 0 10px;font-weight:500">${esc(t('cta.rsvp.title'))}</h2>
      <p style="color:var(--muted);font-size:.9rem;margin-bottom:20px">${esc(t('cta.rsvp.body'))}</p>
      <a class="btn btn--brand btn--block" href="${esc(nativeUrl(currentLang(), '#book'))}">
        ${esc(t('cta.rsvp.button'))}</a>`;
  }

  return `<p class="label label--brand">${esc(t('rsvp.label'))}</p>
    <h2 style="font-size:1.5rem;margin:14px 0 10px;font-weight:500">${esc(t('rsvp.title'))}</h2>
    <p style="color:var(--muted);font-size:.9rem;margin-bottom:18px">
      ${esc(ev.price || 'Free')}. ${esc(t('rsvp.note'))}</p>
    <form id="bookForm" novalidate>
      <div class="form-grid" style="grid-template-columns:1fr">
        <div class="field">
          <label for="bName">${esc(t('rsvp.name'))} <span class="req">*</span></label>
          <input id="bName" type="text" autocomplete="name" required>
        </div>
        <div class="field">
          <label for="bEmail">${esc(t('rsvp.email'))} <span class="req">*</span></label>
          <input id="bEmail" type="email" autocomplete="email" required>
        </div>
        <div class="field">
          <label for="bGuests">${esc(t('rsvp.guests'))}</label>
          <select id="bGuests">
            <option value="1">${esc(t('rsvp.justme'))}</option>
            <option value="2">2</option><option value="3">3</option>
            <option value="4">4</option><option value="5">5+</option>
          </select>
        </div>
      </div>
      <button class="btn btn--brand btn--block" type="submit" id="bSubmit" style="margin-top:18px">
        ${esc(t('rsvp.submit'))}</button>
      <small style="display:block;margin-top:12px;color:var(--muted);font-size:.78rem">
        ${esc(t('rsvp.privacy'))}</small>
    </form>`;
}

function renderEvent(ev) {
  const done = isPast(ev);
  const others = upcoming().filter(e => e.id !== ev.id).slice(0, 3);
  const mapUrl = ev.address
    ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(ev.address) : '';

  document.title = ev.title + ' — Asian Social Rotterdam';

  $('#eventMain').innerHTML = `
  <section class="ev-hero">
    <div class="wrap">
      <a class="crumb" href="index.html#events">← All events</a>

      <div class="ev-hero__grid">
        <div>
          ${done ? '<p class="label label--brand">Past event</p>' : ''}
          <h1>${esc(ev.title)}</h1>
          <p class="lead" style="margin-top:14px">${esc(ev.description).split('\n')[0]}</p>

          <div class="ev-facts">
            <div><span class="lbl">Date</span><div><b>${esc(fmtLong(ev))}</b><span>${esc(fmtTime(ev))} · ${esc(CONFIG.timezone)}</span></div></div>
            <div><span class="lbl">Venue</span><div><b>${esc(ev.venue)}</b><span>${esc(ev.address || 'Rotterdam')}</span></div></div>
            <div><span class="lbl">Tickets</span><div><b>${esc(ev.price || 'Free')}</b>${done ? '<span>This event has finished</span>' : ''}</div></div>
          </div>

          <div class="hero__cta">
            ${done ? '' : '<a class="btn btn--brand" href="#book">Reserve your spot</a>'}
            <a class="btn btn--line" href="${esc(googleCalendarUrl(ev))}" target="_blank" rel="noopener">Add to Google Calendar</a>
            ${mapUrl ? `<a class="btn btn--line" href="${esc(mapUrl)}" target="_blank" rel="noopener">Open in Maps</a>` : ''}
          </div>
        </div>

        <div class="ev-hero__img">
          ${ev.image
            ? `<img src="${esc(ev.image)}" alt="${esc(ev.title)}">`
            : `<div class="ev-hero__ph">Asian Social Rotterdam</div>`}
        </div>
      </div>
    </div>
  </section>

  <section class="section" style="padding-top:clamp(32px,4vw,56px)">
    <div class="wrap ev-body">
      <div>
        <div class="prose reveal">
          <h2>About this event</h2>
          <p>${esc(ev.description)}</p>

          <h3>Good to know</h3>
          <ul class="ticks">
            <li>Hosted in English — everyone is welcome, Asian or not.</li>
            <li>Coming alone is completely normal; our hosts will introduce you.</li>
            <li>Reply to your confirmation email if your plans change, so we can free the spot.</li>
            <li>Questions? Write to <a href="mailto:${esc(CONFIG.contactEmail)}">${esc(CONFIG.contactEmail)}</a>.</li>
          </ul>
        </div>

        ${others.length ? `
        <div style="margin-top:38px">
          <h2 style="font-size:1.4rem;font-weight:500;margin-bottom:24px">Other upcoming events</h2>
          <div class="events__grid">
            ${others.map(eventCardHTML).join('')}
          </div>
        </div>` : ''}
      </div>

      <aside class="ev-side" id="book">
        <div>
          ${done
            ? `<h2 style="font-size:1.25rem;margin-bottom:10px">This event has finished</h2>
               <p style="color:var(--muted);font-size:.94rem;margin-bottom:18px">
                 Take a look at what is coming up next instead.</p>
               <a class="btn btn--brand btn--block" href="index.html#events">See upcoming events</a>`
            : bookingHTML(ev)}
        </div>
      </aside>
    </div>
  </section>`;

  /* wiring */
  const form = $('#bookForm');
  if (form) form.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = $('#bSubmit');
    btn.disabled = true; btn.textContent = t('rsvp.sending');
    try {
      const { rsvp, mode } = await submitRsvp({
        eventId: ev.id,
        name: $('#bName').value.trim(),
        email: $('#bEmail').value.trim(),
        guests: $('#bGuests').value
      });
      location.href = bookedUrl(rsvp, mode);
    } catch (err) {
      toast(err.message, true);
      btn.disabled = false; btn.textContent = t('rsvp.submit');
    }
  });

  initShell();
}

function loadingState() {
  $('#eventMain').innerHTML =
    '<div class="wrap" style="padding:90px 0 60px"><div class="empty">Loading the event…</div></div>';
}

document.addEventListener('DOMContentLoaded', () => {
  const y = $('#year'); if (y) y.textContent = new Date().getFullYear();
  bootstrapContent(() => {
    const ev = EV_ID ? findEvent(EV_ID) : null;
    if (ev) renderEvent(ev);
    else if (contentSource === 'loading') loadingState();
    else notFound();
  });
});
