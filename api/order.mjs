/* =========================================================
   GET /api/order?session=cs_...
   決済から戻ってきた人に、その注文とチケットの鍵を返します。

   Stripe からの通知（webhook）とブラウザのリダイレクトは競争します。
   戻ってくるほうが速いことがあるので、まだ無ければ 202 を返し、
   ブラウザ側で少し待ってから聞き直してもらいます。

   セッションIDは長い乱数で、買った本人しか知りません。
   チケットの鍵と同じ扱いです。
   ========================================================= */

import { send, missingEnv, sb } from './_lib.mjs';

export default async function handler(req, res) {
  if (req.method !== 'GET') return send(res, 405, { error: 'method_not_allowed' });

  const missing = missingEnv('SUPABASE_URL', 'SERVICE_KEY');
  if (missing) return send(res, 500, { error: 'not_configured', missing });

  const url = new URL(req.url, 'http://localhost');
  const sessionId = url.searchParams.get('session') || '';

  /* 形が違うものは総当たりの可能性が高いので、DBに行く前に落とします */
  if (!/^cs_[A-Za-z0-9_]{20,}$/.test(sessionId)) return send(res, 400, { error: 'bad_session' });

  try {
    const orders = await sb(
      'orders?select=id,event_id,event_title,event_date,quantity,total_cents,currency,name,email' +
      '&stripe_checkout_session_id=eq.' + encodeURIComponent(sessionId)
    );
    const order = orders[0];

    /* まだ通知が届いていないだけかもしれません。エラーにはしません */
    if (!order) return send(res, 202, { pending: true });

    const tickets = await sb(
      'tickets?select=secret,holder_name,quantity&order_id=eq.' + encodeURIComponent(order.id)
    );

    return send(res, 200, {
      order: {
        id: order.id,
        eventId: order.event_id,
        eventTitle: order.event_title,
        eventDate: order.event_date,
        quantity: order.quantity,
        totalCents: order.total_cents,
        currency: order.currency,
        name: order.name
      },
      ticketSecret: tickets[0] ? tickets[0].secret : null
    });
  } catch (err) {
    console.error('order lookup failed:', err.message);
    return send(res, 500, { error: 'lookup_failed' });
  }
}
