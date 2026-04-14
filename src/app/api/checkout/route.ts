import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!);
}

function getPricePerBlock(totalBlocks: number): number {
  if (totalBlocks >= 10) return 9.00;
  if (totalBlocks >= 7) return 10.00;
  if (totalBlocks >= 4) return 11.00;
  return 12.00;
}

export async function POST(req: NextRequest) {
  try {
    const { items } = await req.json();

    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json(
        { error: 'Stripe is not configured. Add STRIPE_SECRET_KEY to .env.local' },
        { status: 500 }
      );
    }

    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'Cart is empty' }, { status: 400 });
    }

    const totalBlocks = items.reduce((sum: number, item: { text: string; quantity: number }) => {
      return sum + item.text.replace(/\s/g, '').length * item.quantity;
    }, 0);

    const pricePerBlock = getPricePerBlock(totalBlocks);

    const hasCustomColors = items.some((item: { customColors?: boolean }) => item.customColors);

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = items.map(
      (item: { text: string; letterColors: string[]; quantity: number }) => {
        const blockCount = item.text.replace(/\s/g, '').length;
        return {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `GlowBlocks: "${item.text}"`,
              description: `${blockCount} custom illuminating letter tile${blockCount !== 1 ? 's' : ''}`,
            },
            unit_amount: Math.round(pricePerBlock * blockCount * 100),
          },
          quantity: item.quantity,
        };
      }
    );

    if (hasCustomColors) {
      lineItems.push({
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'Custom Colours',
            description: 'One-time fee for custom colour selection',
          },
          unit_amount: 500,
        },
        quantity: 1,
      });
    }

    const origin = process.env.NEXT_PUBLIC_SITE_URL || req.headers.get('origin') || 'http://localhost:3000';

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      ui_mode: 'embedded',
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      shipping_address_collection: {
        allowed_countries: ['US', 'CA', 'GB', 'AU'],
      },
      shipping_options: [
        {
          shipping_rate_data: {
            type: 'fixed_amount',
            fixed_amount: { amount: 599, currency: 'usd' },
            display_name: 'Standard Shipping (5-7 business days)',
            delivery_estimate: {
              minimum: { unit: 'business_day', value: 5 },
              maximum: { unit: 'business_day', value: 7 },
            },
          },
        },
        {
          shipping_rate_data: {
            type: 'fixed_amount',
            fixed_amount: { amount: 1299, currency: 'usd' },
            display_name: 'Express Shipping (2-3 business days)',
            delivery_estimate: {
              minimum: { unit: 'business_day', value: 2 },
              maximum: { unit: 'business_day', value: 3 },
            },
          },
        },
      ],
      allow_promotion_codes: true,
      return_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      metadata: {
        order_details: JSON.stringify(
          items.map((item: { text: string; letterColors: string[] }) => ({
            text: item.text,
            colors: item.letterColors,
          }))
        ),
      },
    });

    return NextResponse.json({ clientSecret: session.client_secret });
  } catch (err) {
    console.error('Stripe checkout error:', err);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
