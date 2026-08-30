/* =========================================================
   Asian Social Rotterdam — booking confirmed page (booked.html)
   Requires core.js.  URL: booked.html?id=<rsvpId>&m=<deliveryMode>
   ========================================================= */

const Q = new URLSearchParams(location.search);
const MODE = Q.get('m') || 'manual';

function noBooking() {
  $('#bookedMain').innerHTML = `
    <div class="wrap" style="padding:90px 0 60px">
      <div style="max-width:600px">
        <h1 style="font-size:clamp(1.6rem,4vw,2.2rem);margin-bottom:12px">We can't find that booking</h1>
        <p style="color:var(--muted);margin-bottom:24px">
          Confirmation pages are tied to the browser you booked with. Pick your event again
          and we will get you on the list.</p>
        <a class="btn btn--brand" href="index.html#events">See upcoming events</a>
      </div>
    </div>`;
}

function render(rsvp, ev) {
  const gcal = googleCalendarUrl(ev);
  const icsName = slug(ev.title) + '.ics';
  const mapUrl = ev.address
    ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(ev.address) : '';
  const others = upcoming().filter(e => e.id !== ev.id).slice(0, 3);

  const organiserMail = mailtoUrl(
    CONFIG.contactEmail,
    `[RSVP] ${ev.title} — ${rsvp.name} (${rsvp.guests})`,
    `New RSVP\n\nEvent: ${ev.title}\nDate: ${fmtLong(ev)} ${fmtTime(ev)}\nName: ${rsvp.name}\n` +
    `Email: ${rsvp.email}\nGuests: ${rsvp.guests}\nFrom: ${rsvp.origin || '—'}\nNote: ${rsvp.message || '—'}`
  );
  const selfMail = mailtoUrl(rsvp.email,
    `Your spot at ${ev.title} — ${CONFIG.orgName}`, rsvpConfirmationBody(rsvp, ev));

  $('#bookedMain').innerHTML = `
  <section class="booked">
    <div class="wrap">
      <div class="booked__card">
        <div class="booked__tick">Booking confirmed</div>
        <h1>You're on the list, ${esc(rsvp.name.split(' ')[0])}!</h1>
        <p class="lead">${MODE === 'manual'
          ? 'One last step — send your booking to the organisers so we can save your spot, then add the event to your calendar.'
          : 'Your booking is confirmed and a confirmation email is on its way. Add the event to your calendar so you get a reminder before it starts.'}</p>

        <div class="booked__event">
          ${ev.image ? `<img src="${esc(ev.image)}" alt="${esc(ev.title)}">` : ''}
          <div>
            <p class="label label--brand">${esc((CAT[ev.category] || CAT.social).label)}</p>
            <h2>${esc(ev.title)}</h2>
            <ul class="booked__meta">
              <li><span class="lbl">Date</span>${esc(fmtLong(ev))}</li>
              <li><span class="lbl">Time</span>${esc(fmtTime(ev))} (${esc(CONFIG.timezone)})</li>
              <li><span class="lbl">Venue</span>${esc(ev.venue)}${ev.address ? ', ' + esc(ev.address) : ''}</li>
              <li><span class="lbl">Tickets</span>${esc(ev.price || 'Free')} · ${esc(rsvp.guests)} ${rsvp.guests > 1 ? 'people' : 'person'}</li>
              <li><span class="lbl">Email</span>${esc(rsvp.email)}</li>
            </ul>
          </div>
        </div>

        ${MODE === 'manual' ? `
        <a class="btn btn--brand btn--block booked__primary" href="${esc(organiserMail)}">
          Send my booking to the organisers</a>
        <p class="booked__hint">This opens your mail app with everything filled in — just press send.</p>` : ''}

        <h3 class="booked__sub">Add it to your calendar</h3>
        <div class="booked__actions">
          <a class="btn ${MODE === 'manual' ? 'btn--line' : 'btn--brand'}" href="${esc(gcal)}" target="_blank" rel="noopener">
            Add to Google Calendar</a>
          <button class="btn btn--line" type="button" id="icsBtn">Apple / Outlook (.ics)</button>
          <a class="btn btn--line" href="${esc(selfMail)}">Email me the details</a>
          ${mapUrl ? `<a class="btn btn--line" href="${esc(mapUrl)}" target="_blank" rel="noopener">Open in Maps</a>` : ''}
        </div>
        <p class="booked__hint">
          The .ics file comes with reminders 24 hours and 2 hours before the event.</p>

        <h3 class="booked__sub">What happens next</h3>
        <ol class="steps">
          <li><b>Confirmation</b><span>You get the full details${MODE === 'manual' ? ' once we receive your booking' : ' by email'}, including the exact meeting point.</span></li>
          <li><b>Reminder</b><span>We send a reminder a day before${rsvp.reminder ? '' : ' (you opted out — add the calendar entry above instead)'}.</span></li>
          <li><b>Come as you are</b><span>Turn up, find a host with a name badge, and we will introduce you to people.</span></li>
        </ol>

        <div class="booked__foot">
          <a class="btn btn--line" href="${esc(eventUrl(ev.id))}">Back to the event</a>
          <a class="btn btn--line" href="index.html#events">See all events</a>
          <a class="btn btn--line" href="mailto:${esc(CONFIG.contactEmail)}?subject=${encodeURIComponent('Cancel my RSVP — ' + ev.title)}">Cancel my booking</a>
        </div>
      </div>

      ${others.length ? `
      <div class="booked__more">
        <h2>While you're here — what else is coming up</h2>
        <div class="events__grid">
          ${others.map(eventCardHTML).join('')}
        </div>
      </div>` : ''}
    </div>
  </section>`;

  $('#icsBtn').addEventListener('click', () => {
    download(icsName, icsFor(ev), 'text/calendar;charset=utf-8');
    toast('Calendar file downloaded — open it to add the event.');
  });

  initShell();
}

document.addEventListener('DOMContentLoaded', () => {
  const y = $('#year'); if (y) y.textContent = new Date().getFullYear();
  const rsvp = RSVPS.find(r => r.id === Q.get('id'));
  const ev = rsvp ? findEvent(rsvp.eventId) : null;
  if (rsvp && ev) render(rsvp, ev); else noBooking();
});
