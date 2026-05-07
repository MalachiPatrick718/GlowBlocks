'use client';

import { useCallback, useEffect, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from '@stripe/react-stripe-js';
import { useCart, getPricePerBlock } from '@/context/CartContext';
import Link from 'next/link';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '');
const GIFT_STORAGE_KEY = 'glowblocks-gift';

export default function CheckoutPage() {
  const { items, totalBlocks } = useCart();
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  // Gift order state
  const [isGift, setIsGift] = useState(false);
  const [giftRecipientName, setGiftRecipientName] = useState('');
  const [giftNote, setGiftNote] = useState('');
  const [shipToRecipient, setShipToRecipient] = useState(true);

  useEffect(() => {
    setReady(true);
    try {
      const saved = localStorage.getItem(GIFT_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setIsGift(parsed.isGift || false);
        setGiftRecipientName(parsed.recipientName || '');
        setGiftNote(parsed.giftNote || '');
        setShipToRecipient(parsed.shipToRecipient ?? true);
      }
    } catch {}
  }, []);

  // Persist gift state to localStorage
  useEffect(() => {
    if (isGift) {
      localStorage.setItem(GIFT_STORAGE_KEY, JSON.stringify({
        isGift,
        recipientName: giftRecipientName,
        giftNote,
        shipToRecipient,
      }));
    } else {
      localStorage.removeItem(GIFT_STORAGE_KEY);
    }
  }, [isGift, giftRecipientName, giftNote, shipToRecipient]);

  const fetchClientSecret = useCallback(async () => {
    const referral = typeof window !== 'undefined' ? localStorage.getItem('glowblocks-referral') : null;
    let promoId: string | undefined;
    let promoCodeValue: string | undefined;
    try {
      const savedPromo = typeof window !== 'undefined' ? localStorage.getItem('glowblocks-promo') : null;
      if (savedPromo) {
        const parsed = JSON.parse(savedPromo);
        promoId = parsed.promoId;
        promoCodeValue = parsed.code;
      }
    } catch {}

    // Read gift data from localStorage (since this callback is captured once by Stripe)
    let gift: { isGift: boolean; recipientName: string; giftNote: string; shipToRecipient: boolean } | undefined;
    try {
      const savedGift = localStorage.getItem(GIFT_STORAGE_KEY);
      if (savedGift) {
        const parsed = JSON.parse(savedGift);
        if (parsed.isGift) gift = parsed;
      }
    } catch {}

    const res = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items, referral: referral || undefined, promoId, promoCode: promoCodeValue, gift }),
    });
    const data = await res.json();
    if (data.error) {
      setError(data.error);
      throw new Error(data.error);
    }
    return data.clientSecret;
  }, [items]);

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
  const hasSymbols = items.some(item => item.hasSymbols);
  const customFee = hasCustomColors ? 2.00 : 0;
  const symbolFee = hasSymbols ? 2.00 : 0;

  // Read applied promo from localStorage
  let appliedPromo: { code?: string; percentOff?: number | null; amountOff?: number | null } | null = null;
  try {
    const savedPromo = typeof window !== 'undefined' ? localStorage.getItem('glowblocks-promo') : null;
    if (savedPromo) appliedPromo = JSON.parse(savedPromo);
  } catch {}

  const promoCode = (appliedPromo?.code || '').toUpperCase();
  const isFreeShipping = ['POP', 'MARTEL', 'PICKUP'].includes(promoCode);
  const shipping = isFreeShipping ? 0 : 5.99;
  const preDiscountSubtotal = totalBlocks * pricePerBlock + customFee + symbolFee;

  let discount = 0;
  if (appliedPromo) {
    if (appliedPromo.percentOff) {
      discount = preDiscountSubtotal * (appliedPromo.percentOff / 100);
    } else if (appliedPromo.amountOff) {
      discount = Math.min(appliedPromo.amountOff, preDiscountSubtotal);
    }
  }
  const subtotal = preDiscountSubtotal - discount + shipping;

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
          {hasSymbols && (
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="text-sm text-gray-400">Custom symbols</div>
              <div className="text-sm text-gray-400">$2.00</div>
            </div>
          )}
          {discount > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="text-sm text-green-400">Discount ({promoCode})</div>
              <div className="text-sm text-green-400">-${discount.toFixed(2)}</div>
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="text-sm text-gray-400">Shipping</div>
            <div className={`text-sm ${isFreeShipping ? 'text-green-400' : 'text-gray-400'}`}>
              {isFreeShipping ? 'Free' : '$5.99'}
            </div>
          </div>
          <div className="border-t border-gray-700 pt-2 flex flex-wrap items-center justify-between gap-4">
            <div className="text-sm text-gray-300 font-medium">Estimated Total</div>
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

        {/* Gift order section */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={isGift}
              onChange={(e) => {
                setIsGift(e.target.checked);
                if (!e.target.checked) {
                  setGiftRecipientName('');
                  setGiftNote('');
                  setShipToRecipient(true);
                }
              }}
              className="w-5 h-5 rounded border-gray-600 bg-gray-800 text-purple-500 focus:ring-purple-500 focus:ring-offset-0"
            />
            <span className="text-sm text-white font-medium">Is this order a gift?</span>
          </label>

          {isGift && (
            <div className="mt-4 space-y-4 pl-8">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Recipient&apos;s Name</label>
                <input
                  type="text"
                  value={giftRecipientName}
                  onChange={(e) => setGiftRecipientName(e.target.value)}
                  placeholder="First and last name"
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Ship to</label>
                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="shipTo"
                      checked={shipToRecipient}
                      onChange={() => setShipToRecipient(true)}
                      className="w-4 h-4 text-purple-500 bg-gray-800 border-gray-600 focus:ring-purple-500 focus:ring-offset-0"
                    />
                    <span className="text-sm text-gray-300">Recipient&apos;s address</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="shipTo"
                      checked={!shipToRecipient}
                      onChange={() => setShipToRecipient(false)}
                      className="w-4 h-4 text-purple-500 bg-gray-800 border-gray-600 focus:ring-purple-500 focus:ring-offset-0"
                    />
                    <span className="text-sm text-gray-300">My address</span>
                  </label>
                </div>
                {shipToRecipient && (
                  <p className="mt-2 text-xs text-purple-300">
                    Enter the recipient&apos;s shipping address in the form below.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Gift Note <span className="text-gray-600">(optional)</span>
                </label>
                <textarea
                  value={giftNote}
                  onChange={(e) => setGiftNote(e.target.value.slice(0, 200))}
                  placeholder="Add a personal message..."
                  rows={3}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 resize-none"
                />
                <p className="text-xs text-gray-600 text-right mt-1">{giftNote.length}/200</p>
              </div>
            </div>
          )}
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
