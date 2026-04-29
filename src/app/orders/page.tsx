'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  trackingNumber: string;
  labelUrl: string;
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
  const [creatingLabelId, setCreatingLabelId] = useState<string | null>(null);
  const [orderFilter, setOrderFilter] = useState('');
  const [newOrderCount, setNewOrderCount] = useState(0);
  const prevOrderIdsRef = useRef<Set<string>>(new Set());

  const playChime = useCallback(() => {
    try {
      const ctx = new AudioContext();
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, ctx.currentTime);
      gain1.gain.setValueAtTime(0.3, ctx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
      osc1.start(ctx.currentTime);
      osc1.stop(ctx.currentTime + 0.5);
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880, ctx.currentTime + 0.15);
      gain2.gain.setValueAtTime(0.3, ctx.currentTime + 0.15);
      gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.65);
      osc2.start(ctx.currentTime + 0.15);
      osc2.stop(ctx.currentTime + 0.65);
    } catch {}
  }, []);

  const fetchOrders = useCallback(async (isInitialLoad: boolean) => {
    if (!key) {
      if (isInitialLoad) setLoading(false);
      return;
    }
    if (isInitialLoad) {
      setLoading(true);
      setError(null);
    }
    try {
      const res = await fetch('/api/orders', {
        headers: { 'x-popup-admin-key': key },
        cache: 'no-store',
      });
      const data = await res.json();
      if (!res.ok) {
        if (isInitialLoad) setError(data.error || 'Failed to load orders.');
        return;
      }
      const nextOrders = data.orders || [];
      setOrders(nextOrders);
      const nextIds = new Set<string>(nextOrders.map((o: Order) => o.id));
      if (isInitialLoad) {
        prevOrderIdsRef.current = nextIds;
      } else if (prevOrderIdsRef.current.size > 0) {
        const newIds = [...nextIds].filter(id => !prevOrderIdsRef.current.has(id));
        if (newIds.length > 0) {
          setNewOrderCount(newIds.length);
          playChime();
          setTimeout(() => setNewOrderCount(0), 10_000);
        }
        prevOrderIdsRef.current = nextIds;
      }
    } catch {
      if (isInitialLoad) setError('Failed to load orders.');
    } finally {
      if (isInitialLoad) setLoading(false);
    }
  }, [key, playChime]);

  useEffect(() => {
    fetchOrders(true);
  }, [fetchOrders]);

  useEffect(() => {
    if (!key) return;
    const interval = setInterval(() => {
      if (savingOrderId || creatingLabelId) return;
      fetchOrders(false);
    }, 120_000);
    return () => clearInterval(interval);
  }, [key, fetchOrders, savingOrderId, creatingLabelId]);

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

  const createLabel = async (orderId: string) => {
    if (!key) return;
    setCreatingLabelId(orderId);
    try {
      const res = await fetch('/api/shipping-label', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-popup-admin-key': key,
        },
        body: JSON.stringify({ orderId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to create shipping label.');
        return;
      }
      setOrders((prev) =>
        prev.map((order) =>
          order.id === orderId
            ? { ...order, trackingNumber: data.trackingNumber, labelUrl: data.labelUrl }
            : order
        )
      );
    } catch {
      setError('Failed to create shipping label.');
    } finally {
      setCreatingLabelId(null);
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
            {newOrderCount > 0 && (
              <span className="ml-3 inline-flex items-center justify-center px-2.5 py-1 rounded-full text-sm font-bold bg-red-600 text-white animate-pulse">
                +{newOrderCount} new
              </span>
            )}
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

            {/* Shipping label section */}
            {order.trackingNumber ? (
              <div className="flex flex-wrap items-center gap-3 bg-cyan-950/30 border border-cyan-800/40 rounded-lg px-3 py-2 text-sm">
                <span className="text-gray-400">Tracking:</span>
                <span className="text-white font-mono">{order.trackingNumber}</span>
                {order.labelUrl && (
                  <a
                    href={order.labelUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cyan-400 hover:text-cyan-300 underline text-xs"
                  >
                    Download Label (PDF)
                  </a>
                )}
              </div>
            ) : (
              order.address &&
              ['new', 'processing'].includes(order.status.toLowerCase()) && (
                <button
                  type="button"
                  onClick={() => createLabel(order.id)}
                  disabled={creatingLabelId === order.id}
                  className="px-4 py-2 rounded-lg bg-cyan-700 hover:bg-cyan-600 text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creatingLabelId === order.id ? 'Creating Label...' : 'Create Shipping Label'}
                </button>
              )
            )}

            <p className="text-xs text-gray-600 font-mono">
              {order.stripeSessionId}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
