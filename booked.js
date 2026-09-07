/* =========================================================
   Asian Social Rotterdam — booking confirmed page (booked.html)
   Requires core.js.  URL: booked.html?id=<rsvpId>&m=<deliveryMode>
   ========================================================= */

const Q = new URLSearchParams(location.search);
const MODE = Q.get('m') || 'manual';
const TICKET_SECRET = Q.get('t') || '';

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
  const mapUrl = ev.address
    ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(ev.address) : '';
  const others = upcoming().filter(e => e.id !== ev.id).slice(0, 3);

  const organiserMail = mailtoUrl(
    CONFIG.contactEmail,
    `[RSVP] ${ev.title} — ${rsvp.name} (${rsvp.guests})`,
    `New RSVP\n\nEvent: ${ev.title}\nDate: ${fmtLong(ev)} ${fmtTime(ev)}\n` +
    `Name: ${rsvp.name}\nEmail: ${rsvp.email}\nGuests: ${rsvp.guests}`
  );

  $('#bookedMain').innerHTML = `
  <section class="booked">
    <div class="wrap">
      <div class="booked__card">
        <div class="booked__tick">${esc(t('booked.tick'))}</div>
        <h1>${esc(t('booked.title', { name: rsvp.name.split(' ')[0] }))}</h1>
        <p class="lead">${esc(t(MODE === 'manual' ? 'booked.lead.manual' : 'booked.lead.auto'))}</p>

        <div class="booked__event">
          ${ev.image ? `<img src="${esc(ev.image)}" alt="${esc(ev.title)}">` : ''}
          <div>
            <h2>${esc(ev.title)}</h2>
            <ul class="booked__meta">
              <li><span class="lbl">${esc(t('meta.date'))}</span>${esc(fmtLong(ev))}</li>
              <li><span class="lbl">${esc(t('meta.time'))}</span>${esc(fmtTime(ev))} (${esc(CONFIG.timezone)})</li>
              <li><span class="lbl">${esc(t('meta.venue'))}</span>${esc(ev.venue)}${ev.address ? ', ' + esc(ev.address) : ''}</li>
              <li><span class="lbl">${esc(t('meta.tickets'))}</span>${esc(priceFor(ev).label)} · ${esc(rsvp.guests)} ${esc(t(rsvp.guests > 1 ? 'meta.people' : 'meta.person'))}</li>
              <li><span class="lbl">${esc(t('meta.email'))}</span>${esc(rsvp.email)}</li>
            </ul>
          </div>
        </div>

        ${MODE === 'manual' ? `
        <a class="btn btn--brand btn--block booked__primary" href="${esc(organiserMail)}">
          ${esc(t('booked.manualBtn'))}</a>
        <p class="booked__hint">${esc(t('booked.manualHint'))}</p>` : ''}

        ${TICKET_SECRET ? `
        <h3 class="booked__sub">${esc(t('booked.ticketTitle'))}</h3>
        <p style="color:var(--muted);font-size:.92rem;margin-bottom:16px">${esc(t('booked.ticketBody'))}</p>
        <a class="btn btn--brand" href="ticket.html#${encodeURIComponent(TICKET_SECRET)}">
          ${esc(t('booked.ticketBtn'))}</a>` : ''}

        <h3 class="booked__sub">${esc(t('booked.calendar'))}</h3>
        <div class="booked__actions">
          <a class="btn ${MODE === 'manual' ? 'btn--line' : 'btn--brand'}" href="${esc(gcal)}" target="_blank" rel="noopener">
            ${esc(t('booked.gcal'))}</a>
          ${mapUrl ? `<a class="btn btn--line" href="${esc(mapUrl)}" target="_blank" rel="noopener">${esc(t('booked.maps'))}</a>` : ''}
        </div>

        <h3 class="booked__sub">${esc(t('booked.next'))}</h3>
        <ol class="steps">
          <li><b>${esc(t('booked.step1'))}</b><span>${esc(t(MODE === 'manual' ? 'booked.step1.manual' : 'booked.step1.body'))}</span></li>
          <li><b>${esc(t('booked.step2'))}</b><span>${esc(t('booked.step2.body'))}</span></li>
          <li><b>${esc(t('booked.step3'))}</b><span>${esc(t('booked.step3.body'))}</span></li>
        </ol>

      </div>

      ${others.length ? `
      <div class="booked__more">
        <h2>${esc(t('booked.more'))}</h2>
        <div class="events__grid">
          ${others.map(eventCardHTML).join('')}
        </div>
      </div>` : ''}

      <div class="booked__foot">
        <a class="btn btn--line" href="index.html">${esc(t('booked.home'))}</a>
      </div>
    </div>
  </section>`;

  initShell();
}

/* 決済から戻ってきた場合。
   ブラウザのリダイレクトと Stripe の通知は競争するので、
   まだ発券されていなければ少し待ちます。 */
async function renderPaid(sessionId) {
  $('#bookedMain').innerHTML =
    '<div class="wrap" style="padding:90px 0 60px"><div class="empty">\u2026</div></div>';

  let data;
  try { data = await fetchOrderBySession(sessionId); }
  catch (err) { data = { pending: true }; }

  await loadContent().catch(() => {});
  const ev = data.order ? findEvent(data.order.eventId) : null;

  $('#bookedMain').innerHTML = `
  <section class="booked"><div class="wrap"><div class="booked__card">
    <div class="booked__tick">${esc(t('booked.paidTitle'))}</div>
    <h1>${esc(t('booked.title', { name: (data.order && String(data.order.name || '').split(' ')[0]) || '' }))}</h1>
    <p class="lead">${esc(data.ticketSecret ? t('booked.paidLead') : t('booked.pending'))}</p>

    ${ev ? `
    <div class="booked__event">
      ${ev.image ? `<img src="${esc(ev.image)}" alt="${esc(ev.title)}">` : ''}
      <div>
        <h2>${esc(ev.title)}</h2>
        <ul class="booked__meta">
          <li><span class="lbl">${esc(t('meta.date'))}</span>${esc(fmtLong(ev))}</li>
          <li><span class="lbl">${esc(t('meta.time'))}</span>${esc(fmtTime(ev))} (${esc(CONFIG.timezone)})</li>
          <li><span class="lbl">${esc(t('meta.venue'))}</span>${esc(ev.venue)}</li>
          <li><span class="lbl">${esc(t('meta.tickets'))}</span>${esc(priceLabel(data.order.totalCents, data.order.currency))} \u00b7 ${esc(data.order.quantity)} ${esc(t(data.order.quantity > 1 ? 'meta.people' : 'meta.person'))}</li>
        </ul>
      </div>
    </div>` : ''}

    ${data.ticketSecret ? `
    <h3 class="booked__sub">${esc(t('booked.ticketTitle'))}</h3>
    <p style="color:var(--muted);font-size:.92rem;margin-bottom:16px">${esc(t('booked.ticketBody'))}</p>
    <a class="btn btn--brand" href="ticket.html#${encodeURIComponent(data.ticketSecret)}">
      ${esc(t('booked.ticketBtn'))}</a>` : ''}

    ${ev ? `
    <h3 class="booked__sub">${esc(t('booked.calendar'))}</h3>
    <div class="booked__actions">
      <a class="btn btn--line" href="${esc(googleCalendarUrl(ev))}" target="_blank" rel="noopener">
        ${esc(t('booked.gcal'))}</a>
    </div>` : ''}

    <div class="booked__foot" style="margin-top:40px">
      <a class="btn btn--line" href="index.html">${esc(t('booked.home'))}</a>
    </div>
  </div></div></section>`;
  initShell();
}

document.addEventListener('DOMContentLoaded', () => {
  const y = $('#year'); if (y) y.textContent = new Date().getFullYear();

  const session = Q.get('session');
  if (session) { renderPaid(session); return; }

  bootstrapContent(() => {
    const rsvp = RSVPS.find(r => r.id === Q.get('id'));
    const ev = rsvp ? findEvent(rsvp.eventId) : null;
    if (rsvp && ev) render(rsvp, ev);
    else if (contentSource === 'loading') {
      $('#bookedMain').innerHTML =
        '<div class="wrap" style="padding:90px 0 60px"><div class="empty">Loading your booking…</div></div>';
    } else noBooking();
  });
});
