'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useCart } from '@/context/CartContext';

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { items } = useCart();
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <nav className="sticky top-0 z-50 bg-black/90 backdrop-blur-md border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="text-lg font-bold gradient-text tracking-wide">
            GLOWBLOCKS STUDIO
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-8">
            <Link href="/" className="text-gray-300 hover:text-white transition-colors">Home</Link>
            <Link href="/customize" className="text-gray-300 hover:text-white transition-colors">Customize</Link>
            <Link href="/about" className="text-gray-300 hover:text-white transition-colors">About</Link>
            <Link href="/reviews" className="text-gray-300 hover:text-white transition-colors">Reviews</Link>
            <Link href="/faq" className="text-gray-300 hover:text-white transition-colors">FAQ</Link>
            <Link href="/cart" className="relative text-gray-300 hover:text-white transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
              </svg>
              {itemCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-purple-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {itemCount}
                </span>
              )}
            </Link>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center gap-4">
            <Link href="/cart" className="relative text-gray-300">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
              </svg>
              {itemCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-purple-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {itemCount}
                </span>
              )}
            </Link>
            <button onClick={() => setMobileOpen(!mobileOpen)} className="text-gray-300">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                {mobileOpen
                  ? <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  : <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                }
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile nav */}
        {mobileOpen && (
          <div className="md:hidden pb-4 space-y-2">
            <Link href="/" onClick={() => setMobileOpen(false)} className="block text-gray-300 hover:text-white py-2">Home</Link>
            <Link href="/customize" onClick={() => setMobileOpen(false)} className="block text-gray-300 hover:text-white py-2">Customize</Link>
            <Link href="/about" onClick={() => setMobileOpen(false)} className="block text-gray-300 hover:text-white py-2">About</Link>
            <Link href="/reviews" onClick={() => setMobileOpen(false)} className="block text-gray-300 hover:text-white py-2">Reviews</Link>
            <Link href="/faq" onClick={() => setMobileOpen(false)} className="block text-gray-300 hover:text-white py-2">FAQ</Link>
            <Link href="/cart" onClick={() => setMobileOpen(false)} className="block text-gray-300 hover:text-white py-2">Cart</Link>
          </div>
        )}
      </div>
    </nav>
  );
}
