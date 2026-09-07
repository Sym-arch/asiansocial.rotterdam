/* =========================================================
   POST /api/checkout
   有料イベントの決済画面を作ります。

   ブラウザから受け取るのは「どのイベントか」「何名か」だけです。
   金額は必ずここでDBから引き直します。ブラウザから金額を受け取ると、
   誰でも1セントに書き換えて買えてしまいます。

   会員かどうかも、送られてきた値ではなくトークンから判定します。
   ========================================================= */

import { json, missingEnv, sb, userFromToken, priceFor, stripe, priceLabel } from './_lib.mjs';

/* 決済画面を開いたまま放置されたぶんを、翌日に確定させないための期限。
   Stripe の下限が30分です。枠の押さえは作らず、これだけで十分としています。 */
const SESSION_MINUTES = 30;

export default async function handler(req) {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const missing = missingEnv('SUPABASE_URL', 'SERVICE_KEY', 'STRIPE_KEY');
  if (missing) return json({ error: 'not_configured', missing }, 500);

  let body;
  try { body = await req.json(); }
  catch { return json({ error: 'bad_request' }, 400); }

  const eventId  = String(body.eventId || '');
  const quantity = Math.min(Math.max(parseInt(body.quantity, 10) || 1, 1), 10);
  if (!eventId) return json({ error: 'missing_event' }, 400);

  /* --- 誰が買おうとしているか ------------------------------------------ */
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const user  = await userFromToken(token);
  if (!user || !user.id) return json({ error: 'sign_in_required' }, 401);

  /* --- 何を、いくらで --------------------------------------------------- */
  const events = await sb('events?select=*&id=eq.' + encodeURIComponent(eventId));
  const ev = events[0];
  if (!ev) return json({ error: 'event_not_found' }, 404);
  if (!ev.price_cents || ev.price_cents <= 0) return json({ error: 'event_is_free' }, 400);

  const ships = await sb('memberships?select=tier,status&user_id=eq.' + encodeURIComponent(user.id));
  const tier  = (ships[0] && ships[0].status === 'active' && ships[0].tier) || 'free';

  const price = priceFor(ev, tier);
  if (price.cents <= 0) return json({ error: 'event_is_free' }, 400);

  /* --- 満席か ----------------------------------------------------------
     枠の押さえは作らないと決めたので、1件の超過は許容します。
     そのぶん決済画面に30分の期限を付けて、大きくずれないようにしています。 */
  if (ev.capacity) {
    const sold = await sb(
      'orders?select=quantity&event_id=eq.' + encodeURIComponent(eventId) + '&status=eq.paid'
    );
    const taken = sold.reduce((n, o) => n + (o.quantity || 1), 0);
    if (taken >= ev.capacity) return json({ error: 'sold_out' }, 409);
  }

  /* --- Stripe の決済画面 ------------------------------------------------ */
  const origin = new URL(req.url).origin;
  const lang   = String(body.lang || 'en');
  const back   = lang && lang !== 'en' ? '&lang=' + encodeURIComponent(lang) : '';

  const profiles = await sb('profiles?select=stripe_customer_id,name&id=eq.' + encodeURIComponent(user.id));
  let customerId = profiles[0] && profiles[0].stripe_customer_id;

  /* 単発決済でも顧客を作って紐付けます。省くと、後で継続課金を足したときに
     同じ人が別顧客として増え、購入履歴が分断されます。 */
  if (!customerId) {
    const customer = await stripe('customers', {
      email: user.email,
      name: (profiles[0] && profiles[0].name) || undefined,
      metadata: { supabase_user_id: user.id }
    });
    customerId = customer.id;
    await sb('profiles?id=eq.' + encodeURIComponent(user.id), {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ stripe_customer_id: customerId })
    }).catch(() => {});
  }

  const session = await stripe('checkout/sessions', {
    mode: 'payment',
    customer: customerId,
    client_reference_id: user.id,
    expires_at: Math.floor(Date.now() / 1000) + SESSION_MINUTES * 60,
    success_url: `${origin}/booked.html?session={CHECKOUT_SESSION_ID}${back}`,
    cancel_url:  `${origin}/event.html?id=${encodeURIComponent(eventId)}${back}`,
    line_items: [{
      quantity,
      price_data: {
        currency: (ev.currency || 'EUR').toLowerCase(),
        unit_amount: price.cents,
        product_data: {
          name: ev.title,
          description: [ev.date, ev.venue].filter(Boolean).join(' · ').slice(0, 300) || undefined
        }
      }
    }],
    /* webhook 側は metadata だけを見ます。金額はここで確定済みです */
    metadata: {
      event_id: ev.id,
      user_id: user.id,
      quantity: String(quantity),
      unit_amount: String(price.cents),
      tier: tier,
      discount: price.reason || '',
      lang: lang
    }
  });

  return json({
    url: session.url,
    unitLabel: priceLabel(price.cents, ev.currency || 'EUR'),
    discount: price.reason || ''
  });
}
