'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useCart } from '@/context/CartContext';

export default function SuccessPage() {
  const { clearCart } = useCart();

  useEffect(() => {
    clearCart();
  }, [clearCart]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-10 h-10 text-green-500">
          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
        </svg>
      </div>
      <h1 className="text-3xl sm:text-4xl font-bold gradient-text">Order Confirmed!</h1>
      <p className="text-gray-400 max-w-md">
        Thank you for your GlowBlocks order! We&apos;re getting your custom blocks ready.
        You&apos;ll receive a confirmation email shortly with your order details and tracking information.
      </p>
      <div className="flex gap-4 mt-4">
        <Link
          href="/"
          className="px-6 py-3 border border-gray-700 rounded-lg text-gray-300 hover:text-white hover:border-gray-500 transition-colors"
        >
          Back to Home
        </Link>
        <Link
          href="/customize"
          className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-semibold rounded-lg transition-all"
        >
          Order More
        </Link>
      </div>
    </div>
  );
}
