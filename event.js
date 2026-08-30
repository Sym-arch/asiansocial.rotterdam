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

function renderEvent(ev) {
  const cat = CAT[ev.category] || CAT.social;
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
          <p class="label label--brand">${done ? 'Past event' : esc(cat.label)}</p>
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
            : `<div class="ev-hero__ph">${esc(cat.label)}</div>`}
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
            : `<p class="label label--brand">RSVP</p>
               <h2 style="font-size:1.5rem;margin:14px 0 10px;font-weight:500">Reserve your spot</h2>
               <p style="color:var(--muted);font-size:.9rem;margin-bottom:18px">
                 ${esc(ev.price || 'Free')}. You can add the event to Google Calendar
                 right after booking.</p>
               <form id="bookForm" novalidate>
                 <div class="form-grid" style="grid-template-columns:1fr">
                   <div class="field">
                     <label for="bName">Full name <span class="req">*</span></label>
                     <input id="bName" type="text" autocomplete="name" required>
                   </div>
                   <div class="field">
                     <label for="bEmail">Email <span class="req">*</span></label>
                     <input id="bEmail" type="email" autocomplete="email" required>
                   </div>
                   <div class="field">
                     <label for="bGuests">Number of people</label>
                     <select id="bGuests">
                       <option value="1">Just me (1)</option>
                       <option value="2">2</option><option value="3">3</option>
                       <option value="4">4</option><option value="5">5+</option>
                     </select>
                   </div>
                   <div class="field">
                     <label class="check"><input type="checkbox" id="bConsent" required>
                       <span>I accept the community code of conduct. <span class="req">*</span></span></label>
                   </div>
                 </div>
                 <button class="btn btn--brand btn--block" type="submit" id="bSubmit" style="margin-top:18px">
                   Confirm my RSVP</button>
                 <small style="display:block;margin-top:12px;color:var(--muted);font-size:.78rem">
                   No account needed. Your details are only used to manage this booking.</small>
               </form>`}
        </div>
      </aside>
    </div>
  </section>`;

  /* wiring */
  const form = $('#bookForm');
  if (form) form.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = $('#bSubmit');
    btn.disabled = true; btn.textContent = 'Sending…';
    try {
      const { rsvp, mode } = await submitRsvp({
        eventId: ev.id,
        name: $('#bName').value.trim(),
        email: $('#bEmail').value.trim(),
        guests: $('#bGuests').value,
        consent: $('#bConsent').checked
      });
      location.href = bookedUrl(rsvp, mode);
    } catch (err) {
      toast(err.message, true);
      btn.disabled = false; btn.textContent = 'Confirm my RSVP';
    }
  });

  initShell();
}

document.addEventListener('DOMContentLoaded', () => {
  const y = $('#year'); if (y) y.textContent = new Date().getFullYear();
  const ev = EV_ID ? findEvent(EV_ID) : null;
  if (ev) renderEvent(ev); else notFound();
});
