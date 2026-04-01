import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!);
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature');

  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Missing signature or webhook secret' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;

    try {
      // Get full session with line items
      const stripe = getStripe();
      const fullSession = await stripe.checkout.sessions.retrieve(session.id, {
        expand: ['line_items', 'shipping_cost.shipping_rate'],
      }) as Stripe.Checkout.Session;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const shipping = (fullSession as any).shipping_details as {
        name?: string;
        address?: { line1?: string; line2?: string; city?: string; state?: string; postal_code?: string; country?: string };
      } | null;
      const address = shipping?.address;
      const customerName = shipping?.name || fullSession.customer_details?.name || '';
      const customerEmail = fullSession.customer_details?.email || '';

      // Get shipping method name
      const shippingCost = fullSession.shipping_cost;
      let shippingMethod = 'Unknown';
      if (shippingCost?.shipping_rate && typeof shippingCost.shipping_rate === 'object') {
        const rate = shippingCost.shipping_rate as Stripe.ShippingRate;
        shippingMethod = rate.display_name || 'Unknown';
      }

      // Get order details from metadata
      const orderDetails = fullSession.metadata?.order_details || '[]';

      // Format items for display
      const items = JSON.parse(orderDetails);
      const itemsSummary = items
        .map((item: { text: string; colors: string[] }) => {
          const colors = item.colors?.join(', ') || 'default';
          return `"${item.text}" (colors: ${colors})`;
        })
        .join(' | ');

      // Format full address
      const fullAddress = [
        address?.line1,
        address?.line2,
        address?.city,
        address?.state,
        address?.postal_code,
        address?.country,
      ]
        .filter(Boolean)
        .join(', ');

      // Get line items summary with quantities
      const lineItemsList = fullSession.line_items?.data || [];
      const lineItemsSummary = lineItemsList
        .map((li) => `${li.description} x${li.quantity}`)
        .join(' | ');

      // Save to Airtable
      const apiKey = process.env.AIRTABLE_API_KEY;
      const baseId = process.env.AIRTABLE_BASE_ID;
      const tableName = process.env.AIRTABLE_ORDERS_TABLE || 'Orders';

      if (apiKey && baseId) {
        const res = await fetch(
          `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              fields: {
                'Customer Name': customerName,
                'Email': customerEmail,
                'Address': fullAddress,
                'Shipping Method': shippingMethod,
                'Items': itemsSummary,
                'Line Items': lineItemsSummary,
                'Total': `$${((fullSession.amount_total || 0) / 100).toFixed(2)}`,
                'Shipping Cost': `$${((shippingCost?.amount_total || 0) / 100).toFixed(2)}`,
                'Stripe Session ID': session.id,
                'Date': new Date().toISOString().split('T')[0],
                'Status': 'New',
              },
            }),
          }
        );

        if (!res.ok) {
          const err = await res.json();
          console.error('Airtable order save error:', err);
        }
      }
    } catch (err) {
      console.error('Error processing checkout session:', err);
    }
  }

  return NextResponse.json({ received: true });
}
