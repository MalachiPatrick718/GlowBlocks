'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';

interface OrderResult {
  type: 'popup' | 'online';
  orderNumber?: string;
  customerName: string;
  status: string;
  pickupStatus?: string;
  trackingNumber: string;
  deliveryMethod: string;
  items?: string;
  date?: string;
}

function getStatusPill(status: string): { label: string; classes: string } {
  const s = status.toLowerCase();
  if (s === 'not started' || s === 'received')
    return { label: status || 'Received', classes: 'bg-blue-200 text-blue-900 border border-blue-300' };
  if (s === 'in progress' || s === 'processing')
    return { label: status, classes: 'bg-amber-200 text-amber-900 border border-amber-300' };
  if (s === 'done')
    return { label: 'Done', classes: 'bg-cyan-200 text-cyan-900 border border-cyan-300' };
  if (s === 'ready to ship')
    return { label: 'Ready to Ship', classes: 'bg-emerald-200 text-emerald-900 border border-emerald-300' };
  if (s === 'new')
    return { label: 'New', classes: 'bg-blue-200 text-blue-900 border border-blue-300' };
  if (s === 'shipped')
    return { label: 'Shipped', classes: 'bg-purple-200 text-purple-900 border border-purple-300' };
  if (s === 'delivered')
    return { label: 'Delivered', classes: 'bg-green-200 text-green-900 border border-green-300' };
  return { label: status || 'Received', classes: 'bg-gray-300 text-gray-900 border border-gray-400' };
}

function getPickupPill(status: string): { label: string; classes: string } | null {
  const s = status.toLowerCase();
  if (!s || s === 'not applicable') return null;
  if (s === 'not ready')
    return { label: 'Not Ready Yet', classes: 'bg-amber-200 text-amber-900 border border-amber-300' };
  if (s === 'ready for pickup')
    return { label: 'Ready for Pickup!', classes: 'bg-green-200 text-green-900 border border-green-300' };
  if (s === 'picked up')
    return { label: 'Picked Up', classes: 'bg-green-200 text-green-900 border border-green-300' };
  return { label: status, classes: 'bg-gray-300 text-gray-900 border border-gray-400' };
}

export default function OrderStatusPage() {
  return (
    <Suspense>
      <OrderStatusContent />
    </Suspense>
  );
}

function OrderStatusContent() {
  const searchParams = useSearchParams();
  const [orderNumber, setOrderNumber] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<OrderResult[]>([]);
  const autoSearched = useRef(false);

  const hasEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const hasPhone = phone.replace(/\D/g, '').length >= 10;
  const canSubmit = hasEmail || hasPhone;

  const doLookup = useCallback(async (lookupEmail: string, lookupPhone: string, lookupOrder: string) => {
    setLoading(true);
    setError(null);
    setResults([]);

    try {
      const params = new URLSearchParams();
      if (lookupOrder.trim()) params.set('order', lookupOrder.trim());
      if (lookupEmail.trim()) params.set('email', lookupEmail.trim().toLowerCase());
      if (lookupPhone.trim()) params.set('phone', lookupPhone.replace(/[^\d]/g, ''));

      const res = await fetch(`/api/order-status?${params.toString()}`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'No orders found.');
        return;
      }

      const orders = data.orders || [];
      if (orders.length === 0) {
        setError('No orders found.');
      } else {
        setResults(orders);
      }
    } catch {
      setError('Failed to look up order.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-fill and auto-submit from URL params (e.g. from email link)
  useEffect(() => {
    if (autoSearched.current) return;
    const paramEmail = searchParams.get('email') || '';
    const paramPhone = searchParams.get('phone') || '';
    const paramOrder = searchParams.get('order') || '';

    if (paramEmail) setEmail(paramEmail);
    if (paramPhone) setPhone(paramPhone);
    if (paramOrder) setOrderNumber(paramOrder);

    if (paramEmail || paramPhone) {
      autoSearched.current = true;
      doLookup(paramEmail, paramPhone, paramOrder);
    }
  }, [searchParams, doLookup]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    doLookup(email, phone, orderNumber);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl sm:text-4xl font-bold gradient-text">Order Status</h1>
          <p className="text-gray-400 text-sm">Enter your email or phone number to find your order.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-300 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
            />
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1 border-t border-gray-700" />
            <span className="text-xs text-gray-500">or</span>
            <div className="flex-1 border-t border-gray-700" />
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-1">Phone Number</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
                if (digits.length >= 7) {
                  setPhone(`(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`);
                } else if (digits.length >= 4) {
                  setPhone(`(${digits.slice(0, 3)}) ${digits.slice(3)}`);
                } else {
                  setPhone(digits);
                }
              }}
              placeholder="(555) 555-5555"
              className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-1">Order Number <span className="text-gray-500">(optional)</span></label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={2}
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value.replace(/\D/g, '').slice(0, 2))}
              placeholder="e.g. 42"
              className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !canSubmit}
            className="w-full py-3 rounded-lg font-semibold text-lg bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Looking up...' : 'Check Status'}
          </button>
        </form>

        {error && (
          <div className="rounded-xl border border-red-700 bg-red-950/40 p-4 text-red-200 text-center text-sm">
            {error}
          </div>
        )}

        {results.length > 0 && (
          <div className="space-y-4">
            <p className="text-center text-sm text-gray-400">
              Found {results.length} order{results.length !== 1 ? 's' : ''}
            </p>
            {results.map((order, idx) => {
              const statusPill = getStatusPill(order.status);
              const pickupPill = order.pickupStatus ? getPickupPill(order.pickupStatus) : null;

              return (
                <div key={idx} className="rounded-2xl border border-gray-800 bg-gray-950 p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      {order.orderNumber && (
                        <p className="text-xs text-gray-500">Order #{order.orderNumber}</p>
                      )}
                      <p className="text-xl font-bold text-white">Hey {order.customerName}!</p>
                    </div>
                    <div className="text-right">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-800 text-gray-400 border border-gray-700">
                        {order.type === 'popup' ? 'Pop-Up' : 'Online'}
                      </span>
                      {order.date && (
                        <p className="text-xs text-gray-500 mt-1">{order.date}</p>
                      )}
                    </div>
                  </div>

                  {order.items && (
                    <p className="text-sm text-gray-300">{order.items}</p>
                  )}

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">Status</span>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusPill.classes}`}>
                      {statusPill.label}
                    </span>
                  </div>

                  {pickupPill && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-400">Pickup Status</span>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${pickupPill.classes}`}>
                        {pickupPill.label}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">Delivery</span>
                    <span className="text-sm text-white">
                      {order.deliveryMethod === 'ship' ? 'Ship to Me' : 'Pick Up'}
                    </span>
                  </div>

                  {order.trackingNumber && (
                    <div className="bg-cyan-950/30 border border-cyan-800/40 rounded-lg px-3 py-2 text-sm">
                      <span className="text-gray-400">Tracking: </span>
                      <span className="text-white font-mono">{order.trackingNumber}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
