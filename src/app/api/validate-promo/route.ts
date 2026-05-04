import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!);
}

export async function POST(req: NextRequest) {
  try {
    const { code } = await req.json();

    if (!code || typeof code !== 'string') {
      return NextResponse.json({ valid: false, error: 'No code provided' }, { status: 400 });
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ valid: false, error: 'Stripe not configured' }, { status: 500 });
    }

    const stripe = getStripe();

    // Search for promotion codes matching the entered code (case-insensitive via Stripe)
    const promotionCodes = await stripe.promotionCodes.list({
      code: code.toUpperCase(),
      active: true,
      limit: 1,
      expand: ['data.promotion.coupon'],
    });

    if (promotionCodes.data.length === 0) {
      return NextResponse.json({ valid: false, error: 'Invalid or expired code' });
    }

    const promo = promotionCodes.data[0];
    const coupon = promo.promotion.coupon as Stripe.Coupon | null;

    if (!coupon) {
      return NextResponse.json({ valid: false, error: 'Invalid promotion' });
    }

    let description = '';
    if (coupon.percent_off) {
      description = `${coupon.percent_off}% off`;
    } else if (coupon.amount_off) {
      description = `$${(coupon.amount_off / 100).toFixed(2)} off`;
    }

    return NextResponse.json({
      valid: true,
      promoId: promo.id,
      code: promo.code,
      description,
      percentOff: coupon.percent_off || null,
      amountOff: coupon.amount_off ? coupon.amount_off / 100 : null,
    });
  } catch (err) {
    console.error('Promo validation error:', err);
    return NextResponse.json({ valid: false, error: 'Failed to validate code' }, { status: 500 });
  }
}
