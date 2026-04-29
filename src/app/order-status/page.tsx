'use client';

import { useState } from 'react';

interface OrderStatusResult {
  orderNumber: string;
  customerName: string;
  status: string;
  pickupStatus: string;
  trackingNumber: string;
  deliveryMethod: string;
}

function getStatusPill(status: string): { label: string; classes: string } {
  const s = status.toLowerCase();
  if (s === 'not started' || s === 'received')
    return { label: status || 'Received', classes: 'bg-blue-200 text-blue-900 border border-blue-300' };
  if (s === 'in progress')
    return { label: 'In Progress', classes: 'bg-amber-200 text-amber-900 border border-amber-300' };
  if (s === 'done')
    return { label: 'Done', classes: 'bg-cyan-200 text-cyan-900 border border-cyan-300' };
  if (s === 'ready to ship')
    return { label: 'Ready to Ship', classes: 'bg-emerald-200 text-emerald-900 border border-emerald-300' };
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
  const [orderNumber, setOrderNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<OrderStatusResult | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderNumber.trim() || phone.replace(/\D/g, '').length < 10) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(
        `/api/order-status?order=${encodeURIComponent(orderNumber.trim())}&phone=${encodeURIComponent(phone.replace(/[^\d]/g, ''))}`
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Order not found.');
        return;
      }
      setResult(data);
    } catch {
      setError('Failed to look up order.');
    } finally {
      setLoading(false);
    }
  };

  const statusPill = result ? getStatusPill(result.status) : null;
  const pickupPill = result ? getPickupPill(result.pickupStatus) : null;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl sm:text-4xl font-bold gradient-text">Order Status</h1>
          <p className="text-gray-400 text-sm">Enter your order number and phone number to check your order status.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-300 mb-1">Order Number</label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={2}
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value.replace(/\D/g, '').slice(0, 2))}
              placeholder="e.g. 42"
              className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white text-center text-2xl font-bold tracking-widest focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
            />
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
          <button
            type="submit"
            disabled={loading || !orderNumber.trim() || phone.replace(/\D/g, '').length < 10}
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

        {result && (
          <div className="rounded-2xl border border-gray-800 bg-gray-950 p-5 space-y-4">
            <div className="text-center">
              <p className="text-sm text-gray-400">Order #{result.orderNumber}</p>
              <p className="text-xl font-bold text-white mt-1">Hey {result.customerName}!</p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Order Status</span>
                {statusPill && (
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusPill.classes}`}>
                    {statusPill.label}
                  </span>
                )}
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
                  {result.deliveryMethod === 'ship' ? 'Ship to Me' : 'Pick Up'}
                </span>
              </div>

              {result.trackingNumber && (
                <div className="bg-cyan-950/30 border border-cyan-800/40 rounded-lg px-3 py-2 text-sm">
                  <span className="text-gray-400">Tracking: </span>
                  <span className="text-white font-mono">{result.trackingNumber}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
