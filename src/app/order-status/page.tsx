'use client';

import { useState } from 'react';

type LookupMode = 'popup' | 'online';

interface PopupResult {
  type: 'popup';
  orderNumber: string;
  customerName: string;
  status: string;
  pickupStatus: string;
  trackingNumber: string;
  deliveryMethod: string;
}

interface OnlineOrder {
  type: 'online';
  customerName: string;
  status: string;
  trackingNumber: string;
  items: string;
  date: string;
  deliveryMethod: string;
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
  const [mode, setMode] = useState<LookupMode>('popup');
  const [orderNumber, setOrderNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [popupResult, setPopupResult] = useState<PopupResult | null>(null);
  const [onlineResults, setOnlineResults] = useState<OnlineOrder[]>([]);

  const clearResults = () => {
    setError(null);
    setPopupResult(null);
    setOnlineResults([]);
  };

  const handleModeSwitch = (m: LookupMode) => {
    setMode(m);
    clearResults();
  };

  const canSubmitPopup = orderNumber.trim().length > 0 && phone.replace(/\D/g, '').length >= 10;
  const canSubmitOnline = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    clearResults();

    try {
      let url: string;
      if (mode === 'popup') {
        url = `/api/order-status?order=${encodeURIComponent(orderNumber.trim())}&phone=${encodeURIComponent(phone.replace(/[^\d]/g, ''))}`;
      } else {
        url = `/api/order-status?email=${encodeURIComponent(email.trim().toLowerCase())}`;
      }

      const res = await fetch(url);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'No orders found.');
        return;
      }

      if (mode === 'popup') {
        setPopupResult(data as PopupResult);
      } else {
        setOnlineResults(data.orders || []);
        if (!data.orders || data.orders.length === 0) {
          setError('No orders found for this email.');
        }
      }
    } catch {
      setError('Failed to look up order.');
    } finally {
      setLoading(false);
    }
  };

  const statusPill = popupResult ? getStatusPill(popupResult.status) : null;
  const pickupPill = popupResult ? getPickupPill(popupResult.pickupStatus) : null;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl sm:text-4xl font-bold gradient-text">Order Status</h1>
          <p className="text-gray-400 text-sm">Look up your order to check its current status.</p>
        </div>

        {/* Mode toggle */}
        <div className="flex rounded-lg overflow-hidden border border-gray-700">
          <button
            type="button"
            onClick={() => handleModeSwitch('popup')}
            className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${
              mode === 'popup'
                ? 'bg-purple-600 text-white'
                : 'bg-gray-900 text-gray-400 hover:text-white'
            }`}
          >
            Pop-Up Order
          </button>
          <button
            type="button"
            onClick={() => handleModeSwitch('online')}
            className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${
              mode === 'online'
                ? 'bg-purple-600 text-white'
                : 'bg-gray-900 text-gray-400 hover:text-white'
            }`}
          >
            Online Order
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'popup' ? (
            <>
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
            </>
          ) : (
            <div>
              <label className="block text-sm text-gray-300 mb-1">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading || (mode === 'popup' ? !canSubmitPopup : !canSubmitOnline)}
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

        {/* Popup order result */}
        {popupResult && (
          <div className="rounded-2xl border border-gray-800 bg-gray-950 p-5 space-y-4">
            <div className="text-center">
              <p className="text-sm text-gray-400">Order #{popupResult.orderNumber}</p>
              <p className="text-xl font-bold text-white mt-1">Hey {popupResult.customerName}!</p>
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
                  {popupResult.deliveryMethod === 'ship' ? 'Ship to Me' : 'Pick Up'}
                </span>
              </div>

              {popupResult.trackingNumber && (
                <div className="bg-cyan-950/30 border border-cyan-800/40 rounded-lg px-3 py-2 text-sm">
                  <span className="text-gray-400">Tracking: </span>
                  <span className="text-white font-mono">{popupResult.trackingNumber}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Online order results */}
        {onlineResults.length > 0 && (
          <div className="space-y-4">
            <p className="text-center text-sm text-gray-400">
              {onlineResults.length === 1
                ? 'Found 1 order'
                : `Found ${onlineResults.length} orders`}
            </p>
            {onlineResults.map((order, idx) => {
              const pill = getStatusPill(order.status);
              return (
                <div key={idx} className="rounded-2xl border border-gray-800 bg-gray-950 p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-white font-bold">Hey {order.customerName}!</p>
                    {order.date && (
                      <span className="text-xs text-gray-500">{order.date}</span>
                    )}
                  </div>

                  {order.items && (
                    <p className="text-sm text-gray-300">{order.items}</p>
                  )}

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">Status</span>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${pill.classes}`}>
                      {pill.label}
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
