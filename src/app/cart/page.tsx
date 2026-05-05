'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import BlockPreview from '@/components/BlockPreview';
import { useCart, getPricePerBlock } from '@/context/CartContext';

export default function CartPage() {
  const { items, removeItem, updateQuantity, totalBlocks, clearCart } = useCart();
  const router = useRouter();

  const [promoInput, setPromoInput] = useState('');
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [appliedPromo, setAppliedPromo] = useState<{
    promoId: string;
    code: string;
    description: string;
    percentOff: number | null;
    amountOff: number | null;
  } | null>(null);

  const pricePerBlock = getPricePerBlock(totalBlocks);
  const hasCustomColors = items.some(item => item.customColors);
  const hasSymbols = items.some(item => item.hasSymbols);
  const customFee = hasCustomColors ? 2.00 : 0;
  const symbolFee = hasSymbols ? 2.00 : 0;
  const shipping = 5.99;
  const preDiscountSubtotal = totalBlocks * pricePerBlock + customFee + symbolFee + shipping;

  // Calculate discount
  let discount = 0;
  if (appliedPromo) {
    if (appliedPromo.percentOff) {
      discount = preDiscountSubtotal * (appliedPromo.percentOff / 100);
    } else if (appliedPromo.amountOff) {
      discount = Math.min(appliedPromo.amountOff, preDiscountSubtotal);
    }
  }
  const subtotal = preDiscountSubtotal - discount;

  const handleApplyPromo = async () => {
    const code = promoInput.trim();
    if (!code) return;

    setPromoLoading(true);
    setPromoError(null);

    try {
      const res = await fetch('/api/validate-promo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();

      if (data.valid) {
        setAppliedPromo(data);
        setPromoError(null);
        // Save to localStorage for checkout
        localStorage.setItem('glowblocks-promo', JSON.stringify(data));
      } else {
        setPromoError(data.error || 'Invalid code');
      }
    } catch {
      setPromoError('Failed to validate code');
    } finally {
      setPromoLoading(false);
    }
  };

  const handleRemovePromo = () => {
    setAppliedPromo(null);
    setPromoInput('');
    setPromoError(null);
    localStorage.removeItem('glowblocks-promo');
  };

  if (items.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-4">
        <div className="text-gray-500">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="w-24 h-24 mx-auto">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-300">Your cart is empty</h1>
        <p className="text-gray-500">Create some custom GlowBlocks to get started!</p>
        <Link
          href="/customize"
          className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-semibold rounded-full transition-all"
        >
          Start Customizing
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-8">
        <h1 className="text-3xl sm:text-4xl font-bold gradient-text">Your Cart</h1>

        {/* Cart Items */}
        <div className="space-y-4">
          {items.map((item) => {
            const blockCount = item.text.replace(/\s/g, '').length;
            return (
              <div key={item.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row gap-4">
                  {/* Block preview */}
                  <div className="flex-1 bg-gray-950 rounded-lg p-4">
                    <BlockPreview text={item.text} letterColors={item.letterColors} size="sm" />
                  </div>

                  {/* Details */}
                  <div className="flex flex-col justify-between gap-3 sm:w-48">
                    <div>
                      <p className="text-white font-medium tracking-wider">&quot;{item.text}&quot;</p>
                      <p className="text-sm text-gray-400">{blockCount} block{blockCount !== 1 ? 's' : ''}</p>
                    </div>

                    {/* Quantity */}
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-400">Qty:</span>
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        className="w-8 h-8 flex items-center justify-center bg-gray-800 rounded text-white hover:bg-gray-700"
                      >
                        -
                      </button>
                      <span className="w-8 text-center text-white">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        className="w-8 h-8 flex items-center justify-center bg-gray-800 rounded text-white hover:bg-gray-700"
                      >
                        +
                      </button>
                    </div>

                    <div className="flex gap-4">
                      <Link
                        href={`/customize?edit=${item.id}`}
                        className="text-sm text-purple-400 hover:text-purple-300"
                      >
                        Edit
                      </Link>
                      <button
                        onClick={() => removeItem(item.id)}
                        className="text-sm text-red-400 hover:text-red-300"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Order Summary */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-3">
          <h2 className="text-lg font-semibold">Order Summary</h2>
          <div className="flex justify-between text-gray-400">
            <span>{totalBlocks} letter{totalBlocks !== 1 ? 's' : ''} @ ${pricePerBlock.toFixed(2)}/letter</span>
            <span>${(totalBlocks * pricePerBlock).toFixed(2)}</span>
          </div>
          {hasCustomColors && (
            <div className="flex justify-between text-gray-400">
              <span>Custom colours</span>
              <span>$2.00</span>
            </div>
          )}
          {hasSymbols && (
            <div className="flex justify-between text-gray-400">
              <span>Custom symbols</span>
              <span>$2.00</span>
            </div>
          )}
          <div className="flex justify-between text-gray-400">
            <span>Shipping</span>
            <span>$5.99</span>
          </div>
          <p className="text-xs text-gray-500">Standard Shipping (5-7 business days)</p>

          {/* Promo Code */}
          <div className="border-t border-gray-700 pt-3 space-y-2">
            {appliedPromo ? (
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-green-400 text-sm font-medium">{appliedPromo.code}</span>
                  <span className="text-gray-400 text-sm ml-2">({appliedPromo.description})</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-green-400 text-sm font-medium">-${discount.toFixed(2)}</span>
                  <button
                    onClick={handleRemovePromo}
                    className="text-xs text-red-400 hover:text-red-300"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={promoInput}
                    onChange={(e) => { setPromoInput(e.target.value.toUpperCase()); setPromoError(null); }}
                    placeholder="Discount code"
                    className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500"
                    onKeyDown={(e) => { if (e.key === 'Enter') handleApplyPromo(); }}
                  />
                  <button
                    onClick={handleApplyPromo}
                    disabled={promoLoading || !promoInput.trim()}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    {promoLoading ? '...' : 'Apply'}
                  </button>
                </div>
                {promoError && (
                  <p className="text-xs text-red-400">{promoError}</p>
                )}
              </>
            )}
          </div>

          <div className="border-t border-gray-700 pt-3 flex justify-between text-xl font-bold">
            <span>Estimated Total</span>
            <span className="gradient-text">${subtotal.toFixed(2)}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4">
          <Link
            href="/customize"
            className="flex-1 text-center py-3 border border-gray-700 rounded-lg text-gray-300 hover:text-white hover:border-gray-500 transition-colors font-medium"
          >
            Add More Blocks
          </Link>
          <button
            onClick={() => router.push('/checkout')}
            className="flex-1 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-semibold rounded-lg transition-all shadow-lg shadow-purple-500/25"
          >
            Checkout
          </button>
        </div>

        <button
          onClick={() => {
            if (window.confirm('Clear all items from your cart?')) clearCart();
          }}
          className="text-sm text-gray-500 hover:text-red-400 transition-colors"
        >
          Clear cart
        </button>
      </div>
    </div>
  );
}
