/* =========================================================
   Asian Socials — booking confirmed page (booked.html)
   Requires core.js.  URL: booked.html?id=<rsvpId>&m=<deliveryMode>
   ========================================================= */

const Q = new URLSearchParams(location.search);
const MODE = Q.get('m') || 'manual';
const TICKET_SECRET = Q.get('t') || '';

/* 共有アイコン（矢印の付いた箱）。ボタンの文字の前に置きます */
const SHARE_ICON = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" ' +
  'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ' +
  'style="margin-right:8px;vertical-align:-3px">' +
  '<path d="M12 3v12"/><path d="M7 8l5-5 5 5"/><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/></svg>';

/* 予約したイベントを共有します。対応していれば端末の共有シートを、
   できなければリンクをコピーして知らせます（ネイティブの共有シートが
   無い環境向けの、いちばん確実な代わりです） */
function wireShare(ev) {
  const btn = $('#bookedShare');
  if (!btn) return;
  const url = absUrl(eventUrl(ev.id));
  const title = ev.title;
  const text = t('booked.shareText', { title });

  btn.addEventListener('click', async () => {
    if (navigator.share) {
      try { await navigator.share({ title, text, url }); return; }
      catch (err) { if (err.name === 'AbortError') return; /* 本人が閉じただけ */ }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast(t('booked.shareCopied'));
    } catch {
      prompt(t('booked.shareCopyManual'), url);
    }
  });
}

function noBooking() {
  $('#bookedMain').innerHTML = `
    <div class="wrap" style="padding:90px 0 60px">
      <div style="max-width:600px">
        <h1 style="font-size:clamp(1.6rem,4vw,2.2rem);margin-bottom:12px">${esc(t('booked.gone'))}</h1>
        <p style="color:var(--muted);margin-bottom:24px">${esc(t('booked.goneBody'))}</p>
        <a class="btn btn--brand" href="index.html#events">${esc(t('booked.see'))}</a>
      </div>
    </div>`;
}

/* 予約が済んだ直後に、プロフィールへのボタンを出します。
   予約フォームそのものには項目を足しません（入力が増えると予約が減るため）。
   サインインしていて、国籍・都市・生年月日がもう全部入っている人には出しません。 */
async function fillProfileNudge() {
  const box = $('#bookedProfile');
  if (!box) return;
  if (isSignedIn()) {
    const m = await loadMember().catch(() => null);
    const p = m && m.profile;
    if (!hasProfileDetails(p)) return;           /* 18 の SQL がまだの間は出しません */
    if (p.nationality && p.city && p.birthdate) return;
  }
  box.innerHTML = `
    <a class="btn btn--line booked__profile" href="details.html">${esc(t('booked.profile.btn'))}</a>`;
  box.hidden = false;
}

function render(rsvp, ev) {
  const gcal = googleCalendarUrl(ev);
  const mapUrl = ev.address
    ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(ev.address) : '';
  const others = upcoming().filter(e => e.id !== ev.id).slice(0, 3);


  $('#bookedMain').innerHTML = `
  <section class="booked">
    <div class="wrap">
      <div class="booked__card">
        <div class="booked__tick">${esc(t('booked.tick'))}</div>
        <h1>${esc(t('booked.title', { name: rsvp.name.split(' ')[0] }))}</h1>
        <p class="lead">${esc(t(MODE === 'manual' ? 'booked.lead.saved' : 'booked.lead.auto'))}</p>

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


        ${TICKET_SECRET ? `
        <h3 class="booked__sub">${esc(t('booked.ticketTitle'))}</h3>
        <p style="color:var(--muted);font-size:.92rem;margin-bottom:16px">${esc(t(MODE === 'manual' ? 'booked.ticketBodyNoMail' : 'booked.ticketBody'))}</p>
        <a class="btn btn--brand" href="ticket.html#${encodeURIComponent(TICKET_SECRET)}">
          ${esc(t('booked.ticketBtn'))}</a>` : ''}

        <h3 class="booked__sub">${esc(t('booked.calendar'))}</h3>
        <div class="booked__actions">
          <a class="btn btn--line" href="${esc(gcal)}" target="_blank" rel="noopener">
            ${esc(t('booked.gcal'))}</a>
          ${mapUrl ? `<a class="btn btn--line" href="${esc(mapUrl)}" target="_blank" rel="noopener">${esc(t('booked.maps'))}</a>` : ''}
        </div>

        <h3 class="booked__sub">${esc(t('booked.shareTitle'))}</h3>
        <p style="color:var(--muted);font-size:.92rem;margin-bottom:16px">${esc(t('booked.shareBody'))}</p>
        <div class="booked__actions">
          <button class="btn btn--line" type="button" id="bookedShare">
            ${SHARE_ICON}${esc(t('booked.shareBtn'))}</button>
        </div>

        <div id="bookedProfile" hidden></div>


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
  fillProfileNudge();
  wireShare(ev);
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

  /* 売上として1件数えます。
     この画面は再読み込みされることがあるので、同じ決済は一度だけ送ります。 */
  if (data.order && data.ticketSecret) {
    const once = 'tracked:' + sessionId;
    try {
      if (!sessionStorage.getItem(once)) {
        sessionStorage.setItem(once, '1');
        track('purchase', {
          transaction_id: data.order.id || sessionId,
          value: (data.order.totalCents || 0) / 100,
          currency: data.order.currency || 'EUR',
          items: [{
            item_id: data.order.eventId,
            item_name: data.order.eventTitle || (ev && ev.title) || '',
            quantity: data.order.quantity || 1
          }]
        });
      }
    } catch (err) {
      console.warn('purchase not tracked:', err.message);
    }
  }

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
    </div>

    <h3 class="booked__sub">${esc(t('booked.shareTitle'))}</h3>
    <p style="color:var(--muted);font-size:.92rem;margin-bottom:16px">${esc(t('booked.shareBody'))}</p>
    <div class="booked__actions">
      <button class="btn btn--line" type="button" id="bookedShare">
        ${SHARE_ICON}${esc(t('booked.shareBtn'))}</button>
    </div>` : ''}

    <div id="bookedProfile" hidden></div>

    <div class="booked__foot" style="margin-top:40px">
      <a class="btn btn--line" href="index.html">${esc(t('booked.home'))}</a>
    </div>
  </div></div></section>`;
  initShell();
  if (data.ticketSecret) fillProfileNudge();
  if (ev) wireShare(ev);
}

document.addEventListener('DOMContentLoaded', () => {
  const y = $('#year'); if (y) y.textContent = new Date().getFullYear();
  /* ヘッダーは中身が何であれ動かします。「見つかりません」や読み込み中に
     ここを通らないと、ハンバーガーも言語切替も効かなくなります。
     二重登録は bindOnce が防ぎます。 */
  initShell();

  const session = Q.get('session');
  if (session) { renderPaid(session); return; }

  bootstrapContent(() => {
    const rsvp = RSVPS.find(r => r.id === Q.get('id'));
    const ev = rsvp ? findEvent(rsvp.eventId) : null;
    if (rsvp && ev) render(rsvp, ev);
    else if (contentSource === 'loading') {
      $('#bookedMain').innerHTML =
        `<div class="wrap" style="padding:90px 0 60px"><div class="empty">${esc(t('booked.loading'))}</div></div>`;
    } else noBooking();
  });
});
