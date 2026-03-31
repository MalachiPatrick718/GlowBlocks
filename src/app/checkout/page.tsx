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
  const subtotal = totalBlocks * pricePerBlock;

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
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="text-sm text-gray-400">
            <span className="text-white font-medium">{totalBlocks} block{totalBlocks !== 1 ? 's' : ''}</span>
            {' '}@ ${pricePerBlock.toFixed(2)}/block
          </div>
          <div className="text-lg font-bold gradient-text">
            Subtotal: ${subtotal.toFixed(2)}
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Embedded Stripe Checkout */}
        <div className="bg-white rounded-2xl overflow-hidden min-h-[400px]">
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
