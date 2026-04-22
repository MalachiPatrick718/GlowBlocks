'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

interface Order {
  id: string;
  customerName: string;
  email: string;
  address: string;
  shippingMethod: string;
  items: string;
  lineItems: string;
  total: string;
  shippingCost: string;
  stripeSessionId: string;
  date: string;
  status: string;
}

const STATUS_OPTIONS = ['New', 'Processing', 'Shipped', 'Delivered'];

function getStatusPillClasses(status: string): string {
  const s = status.toLowerCase();
  if (s === 'new') return 'bg-blue-200 text-blue-900 border border-blue-300';
  if (s === 'processing') return 'bg-amber-200 text-amber-900 border border-amber-300';
  if (s === 'shipped') return 'bg-cyan-200 text-cyan-900 border border-cyan-300';
  if (s === 'delivered') return 'bg-green-200 text-green-900 border border-green-300';
  return 'bg-gray-300 text-gray-900 border border-gray-400';
}

export default function OrdersPage() {
  return (
    <Suspense>
      <OrdersContent />
    </Suspense>
  );
}

function OrdersContent() {
  const searchParams = useSearchParams();
  const key = searchParams.get('key') || '';
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingOrderId, setSavingOrderId] = useState<string | null>(null);
  const [orderFilter, setOrderFilter] = useState('');

  useEffect(() => {
    if (!key) {
      setLoading(false);
      return;
    }

    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/orders', {
          headers: { 'x-popup-admin-key': key },
          cache: 'no-store',
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || 'Failed to load orders.');
          return;
        }
        setOrders(data.orders || []);
      } catch {
        setError('Failed to load orders.');
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [key]);

  const saveStatus = async (orderId: string, newStatus: string) => {
    if (!key || !newStatus) return;
    setSavingOrderId(orderId);
    try {
      const res = await fetch('/api/orders', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-popup-admin-key': key,
        },
        body: JSON.stringify({ id: orderId, status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to update order status.');
        return;
      }
      setOrders((prev) =>
        prev.map((order) =>
          order.id === orderId ? { ...order, status: newStatus } : order
        )
      );
    } catch {
      setError('Failed to update order status.');
    } finally {
      setSavingOrderId(null);
    }
  };

  const filteredOrders = useMemo(() => {
    const q = orderFilter.trim().toLowerCase();
    const filtered = !q
      ? orders
      : orders.filter(
          (order) =>
            order.customerName.toLowerCase().includes(q) ||
            order.email.toLowerCase().includes(q) ||
            order.items.toLowerCase().includes(q) ||
            order.address.toLowerCase().includes(q)
        );
    return [...filtered].sort((a, b) => {
      const aDone = a.status.toLowerCase() === 'delivered' ? 1 : 0;
      const bDone = b.status.toLowerCase() === 'delivered' ? 1 : 0;
      if (aDone !== bDone) return aDone - bDone;
      return 0;
    });
  }, [orders, orderFilter]);

  const emptyState = useMemo(
    () => !loading && !error && orders.length === 0,
    [loading, error, orders.length]
  );

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="max-w-6xl mx-auto space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl md:text-4xl font-bold gradient-text">
            Online Orders
          </h1>
          <div className="flex gap-2">
            <Link
              href={`/popup-orders?key=${encodeURIComponent(key)}`}
              className="px-4 py-2 rounded-lg bg-purple-700 hover:bg-purple-600 text-sm font-semibold text-white"
            >
              Pop-Up Orders
            </Link>
            <Link
              href={`/inventory?key=${encodeURIComponent(key)}`}
              className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm font-semibold text-white"
            >
              Inventory
            </Link>
          </div>
        </div>

        {!key && (
          <div className="rounded-xl border border-red-700 bg-red-950/40 p-4 text-red-200">
            This page is private. Use your secret key in the URL:{' '}
            <span className="font-mono">/orders?key=YOUR_KEY</span>
          </div>
        )}

        {loading && <p className="text-gray-400">Loading orders...</p>}
        {error && <p className="text-red-300">{error}</p>}
        {emptyState && <p className="text-gray-400">No online orders yet.</p>}
        {!loading && key && (
          <input
            type="text"
            value={orderFilter}
            onChange={(e) => setOrderFilter(e.target.value)}
            placeholder="Find by name, email, items, or address..."
            className="w-full max-w-md px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-purple-500"
          />
        )}

        {filteredOrders.map((order) => (
          <div
            key={order.id}
            className="rounded-2xl border border-gray-800 bg-gray-950 p-5 space-y-3"
          >
            <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
              <div>
                <p className="text-xl font-bold text-white">
                  {order.customerName || 'Unknown Customer'}
                </p>
                <p className="text-sm text-gray-400">{order.email}</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-green-400">
                  {order.total}
                </p>
                <p className="text-xs text-gray-500">{order.date}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <p>
                <span className="text-gray-400">Address:</span>{' '}
                {order.address || '-'}
              </p>
              <p>
                <span className="text-gray-400">Shipping:</span>{' '}
                {order.shippingMethod}{' '}
                {order.shippingCost && (
                  <span className="text-gray-500">({order.shippingCost})</span>
                )}
              </p>
            </div>

            <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-3 text-sm space-y-1">
              <p className="text-gray-400 text-xs font-medium mb-1">Items</p>
              {order.items
                ? order.items.split(' | ').map((item, idx) => (
                    <p key={idx} className="text-gray-300">
                      {item}
                    </p>
                  ))
                : order.lineItems
                  ? order.lineItems.split(' | ').map((item, idx) => (
                      <p key={idx} className="text-gray-300">
                        {item}
                      </p>
                    ))
                  : <p className="text-gray-500">No items</p>
              }
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {STATUS_OPTIONS.map((opt) => {
                const isActive =
                  opt.toLowerCase() === (order.status || 'new').toLowerCase();
                const isSaving = savingOrderId === order.id;
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => !isActive && saveStatus(order.id, opt)}
                    disabled={isSaving}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                      isActive
                        ? getStatusPillClasses(opt)
                        : 'bg-gray-800 text-gray-500 border border-gray-700 hover:text-white hover:border-gray-500'
                    } ${isSaving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    {isSaving && isActive ? 'Saving...' : opt}
                  </button>
                );
              })}
            </div>

            <p className="text-xs text-gray-600 font-mono">
              {order.stripeSessionId}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
