'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import BlockPreview from '@/components/BlockPreview';
import { useCart, getPricePerBlock } from '@/context/CartContext';

export default function CartPage() {
  const { items, removeItem, updateQuantity, totalBlocks, clearCart } = useCart();
  const router = useRouter();

  const pricePerBlock = getPricePerBlock(totalBlocks);
  const hasCustomColors = items.some(item => item.customColors);
  const customFee = hasCustomColors ? 5.00 : 0;
  const subtotal = totalBlocks * pricePerBlock + customFee;

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

                    <button
                      onClick={() => removeItem(item.id)}
                      className="text-sm text-red-400 hover:text-red-300 text-left"
                    >
                      Remove
                    </button>
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
              <span>$5.00</span>
            </div>
          )}
          <div className="flex justify-between text-gray-400">
            <span>Shipping</span>
            <span className="text-sm">Selected at checkout</span>
          </div>
          <div className="border-t border-gray-700 pt-3 flex justify-between text-xl font-bold">
            <span>Subtotal</span>
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
          onClick={clearCart}
          className="text-sm text-gray-500 hover:text-red-400 transition-colors"
        >
          Clear cart
        </button>
      </div>
    </div>
  );
}
