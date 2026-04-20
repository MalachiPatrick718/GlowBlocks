'use client';

import { useCallback, useEffect, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from '@stripe/react-stripe-js';
import { useCart, getPricePerBlock } from '@/context/CartContext';
import Link from 'next/link';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '');

export default function CheckoutPage() {
  const { items, totalBlocks, shippingMethod } = useCart();
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  const fetchClientSecret = useCallback(async () => {
    const res = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items, shippingMethod }),
    });
    const data = await res.json();
    if (data.error) {
      setError(data.error);
      throw new Error(data.error);
    }
    return data.clientSecret;
  }, [items, shippingMethod]);

  if (!ready) return null;

  if (items.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-4 text-center">
        <h1 className="text-2xl font-bold text-gray-300">No items to checkout</h1>
        <Link
          href="/customize"
          className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-full"
        >
          Start Customizing
        </Link>
      </div>
    );
  }

  const pricePerBlock = getPricePerBlock(totalBlocks);
  const hasCustomColors = items.some(item => item.customColors);
  const customFee = hasCustomColors ? 2.00 : 0;
  const subtotal = totalBlocks * pricePerBlock + customFee;

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl sm:text-3xl font-bold gradient-text">Checkout</h1>
          <Link href="/cart" className="text-sm text-purple-400 hover:text-purple-300">
            &larr; Back to Cart
          </Link>
        </div>

        {/* Order summary bar */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="text-sm text-gray-400">
              <span className="text-white font-medium">{totalBlocks} block{totalBlocks !== 1 ? 's' : ''}</span>
              {' '}@ ${pricePerBlock.toFixed(2)}/block
            </div>
            <div className="text-sm text-gray-400">${(totalBlocks * pricePerBlock).toFixed(2)}</div>
          </div>
          {hasCustomColors && (
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="text-sm text-gray-400">Custom colours</div>
              <div className="text-sm text-gray-400">$2.00</div>
            </div>
          )}
          <div className="border-t border-gray-700 pt-2 flex flex-wrap items-center justify-between gap-4">
            <div className="text-sm text-gray-300 font-medium">Subtotal</div>
            <div className="text-lg font-bold gradient-text">${subtotal.toFixed(2)}</div>
          </div>
        </div>

        {/* Pickup note */}
        <div className="bg-purple-500/5 border border-purple-500/20 rounded-xl px-4 py-3 flex items-start gap-3">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-purple-400 mt-0.5 flex-shrink-0">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
          </svg>
          <p className="text-sm text-gray-300">
            <span className="text-purple-300 font-medium">Picking up your order instead?</span>{' '}
            Add the code <span className="text-white font-semibold">PICKUP</span> as the discount code and you will be refunded the shipping fee.
          </p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Embedded Stripe Checkout */}
        <div className="stripe-checkout-wrapper rounded-2xl overflow-hidden border border-gray-800 min-h-[400px]">
          <EmbeddedCheckoutProvider
            stripe={stripePromise}
            options={{ fetchClientSecret }}
          >
            <EmbeddedCheckout />
          </EmbeddedCheckoutProvider>
        </div>

        <p className="text-center text-xs text-gray-600">
          Your payment is securely processed by Stripe. Your card details never touch our servers.
        </p>
      </div>
    </div>
  );
}
