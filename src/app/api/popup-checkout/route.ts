import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

const apiKey = process.env.AIRTABLE_API_KEY;
const baseId = process.env.AIRTABLE_BASE_ID;
const tableName = process.env.AIRTABLE_POPUP_ORDERS || process.env.AIRTABLE_POPUP_ORDERS_TABLE || 'Popup';

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!);
}

function getAirtableUrl() {
  return `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}`;
}

function getHeaders() {
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };
}

export async function POST(req: NextRequest) {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ error: 'Stripe is not configured' }, { status: 500 });
    }

    const { recordId, orderText, letterCount, pricePerLetter, customColorFee, shippingFee, tax, total } = await req.json();

    if (!recordId || !orderText || !total) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const origin = process.env.NEXT_PUBLIC_SITE_URL || req.headers.get('origin') || 'http://localhost:3000';
    const stripe = getStripe();

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: `GlowBlocks: "${orderText}"`,
            description: `${letterCount} custom illuminating letter tile${letterCount !== 1 ? 's' : ''} @ $${Number(pricePerLetter).toFixed(2)} each`,
          },
          unit_amount: Math.round(letterCount * pricePerLetter * 100),
        },
        quantity: 1,
      },
    ];

    if (customColorFee > 0) {
      lineItems.push({
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'Custom Colours',
            description: 'One-time fee for custom colour selection',
          },
          unit_amount: Math.round(customColorFee * 100),
        },
        quantity: 1,
      });
    }

    // Add shipping as a line item
    if (shippingFee > 0) {
      lineItems.push({
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'Shipping',
            description: 'Standard shipping (5-7 business days)',
          },
          unit_amount: Math.round(shippingFee * 100),
        },
        quantity: 1,
      });
    }

    // Add tax as a line item
    if (tax > 0) {
      lineItems.push({
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'Tax',
            description: 'Sales tax',
          },
          unit_amount: Math.round(tax * 100),
        },
        quantity: 1,
      });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: `${origin}/popup/payment-success`,
      cancel_url: `${origin}/popup`,
      metadata: {
        popup_record_id: recordId,
        order_text: orderText,
      },
    });

    return NextResponse.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    console.error('Popup checkout error:', err);
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ error: 'Stripe is not configured' }, { status: 500 });
    }

    const sessionId = req.nextUrl.searchParams.get('session_id');
    if (!sessionId) {
      return NextResponse.json({ error: 'Missing session_id' }, { status: 400 });
    }

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    const paid = session.payment_status === 'paid';

    // Update Airtable when payment is confirmed
    if (paid && apiKey && baseId) {
      const recordId = session.metadata?.popup_record_id;
      if (recordId) {
        await fetch(getAirtableUrl(), {
          method: 'PATCH',
          headers: getHeaders(),
          body: JSON.stringify({
            records: [{ id: recordId, fields: { Payment: 'Paid' } }],
          }),
        }).catch((err) => console.error('Failed to update Airtable payment status:', err));
      }
    }

    return NextResponse.json({
      status: paid ? 'paid' : session.status === 'expired' ? 'expired' : 'unpaid',
    });
  } catch (err) {
    console.error('Popup checkout status error:', err);
    return NextResponse.json({ error: 'Failed to check payment status' }, { status: 500 });
  }
}
