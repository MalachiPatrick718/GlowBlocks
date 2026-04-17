'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';

interface PopupOrder {
  id: string;
  text: string;
  colorsByLetter: string;
  customerName: string;
  phoneNumber: string;
  address?: string;
  status?: string;
  deliveryMethod?: string;
  colorMode?: string;
  orderType?: string;
  pickupStatus?: string;
  orderNumber?: string;
}

interface ParsedColorByLetter {
  letter?: string;
  colorName?: string | null;
  colorHex?: string | null;
}

function getStatusPillClasses(status?: string): string {
  const normalized = (status || '').toLowerCase();
  if (normalized === 'not started') return 'bg-pink-200 text-pink-900 border border-pink-300';
  if (normalized === 'in progress') return 'bg-amber-200 text-amber-900 border border-amber-300';
  if (normalized === 'done') return 'bg-cyan-200 text-cyan-900 border border-cyan-300';
  if (normalized === 'picked up') return 'bg-green-200 text-green-900 border border-green-300';
  if (normalized === 'ready to ship') return 'bg-emerald-200 text-emerald-900 border border-emerald-300';
  return 'bg-gray-300 text-gray-900 border border-gray-400';
}

function formatPresetLabel(value?: string): string | null {
  if (!value || value === 'Custom Numbers') return null;
  return /preset$/i.test(value) ? value : `${value} Preset`;
}

function hexToRgbString(hex?: string | null): string | null {
  if (!hex || !/^#[0-9A-Fa-f]{6}$/.test(hex)) return null;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r}, ${g}, ${b}`;
}

function getColorLines(order: PopupOrder): string[] {
  try {
    const parsed = JSON.parse(order.colorsByLetter);
    const list = Array.isArray(parsed)
      ? parsed
      : (Array.isArray(parsed?.colorsByLetter) ? parsed.colorsByLetter : []);
    if (Array.isArray(list) && list.length > 0) {
      return list
        .filter((item: ParsedColorByLetter) => item?.letter && item.letter !== ' ')
        .map((item: ParsedColorByLetter) => {
          const letter = item.letter || '';
          if (!item.colorHex || item.colorHex === '#FFFFFF') {
            return `${letter} - No Color Set`;
          }

          const rgb = hexToRgbString(item.colorHex);
          if (item.colorName && rgb) return `${letter} - ${item.colorName} (${rgb})`;
          if (item.colorName) return `${letter} - ${item.colorName}`;
          if (rgb) {
            const presetLabel = formatPresetLabel(order.colorMode);
            return `${letter} - ${presetLabel || 'Preset'} (${rgb})`;
          }
          return `${letter} - ${item.colorHex}`;
        });
    }

    // Backward/fallback format support:
    // Custom Colors may be an object with only letterColors for preset orders.
    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.letterColors)) {
      const letters = (order.text || '').split('');
      const colorArray = parsed.letterColors as string[];
      return letters
        .map((letter, idx) => ({ letter, colorHex: colorArray[idx] || '#FFFFFF' }))
        .filter((item) => item.letter && item.letter !== ' ')
        .map((item) => {
          if (!item.colorHex || item.colorHex === '#FFFFFF') return `${item.letter} - No Color Set`;
          const rgb = hexToRgbString(item.colorHex);
          const presetLabel = formatPresetLabel(order.colorMode) || 'Preset';
          return rgb ? `${item.letter} - ${presetLabel} (${rgb})` : `${item.letter} - ${item.colorHex}`;
        });
    }

    return [];
  } catch {
    return [];
  }
}

export default function PopupOrdersPage() {
  return (
    <Suspense>
      <PopupOrdersContent />
    </Suspense>
  );
}

function PopupOrdersContent() {
  const searchParams = useSearchParams();
  const key = searchParams.get('key') || '';
  const [orders, setOrders] = useState<PopupOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingOrderId, setSavingOrderId] = useState<string | null>(null);
  const [statusDrafts, setStatusDrafts] = useState<Record<string, string>>({});
  const [pickupDrafts, setPickupDrafts] = useState<Record<string, string>>({});
  const [orderFilter, setOrderFilter] = useState('');
  const statusOptions = ['Not Started', 'In Progress', 'Done', 'Picked Up', 'Ready to Ship'];

  useEffect(() => {
    if (!key) {
      setLoading(false);
      return;
    }

    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/popup-orders', {
          headers: { 'x-popup-admin-key': key },
          cache: 'no-store',
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || 'Failed to load popup orders.');
          return;
        }
        const nextOrders = data.orders || [];
        setOrders(nextOrders);
        setStatusDrafts(
          nextOrders.reduce((acc: Record<string, string>, item: PopupOrder) => {
            acc[item.id] = item.status || 'New';
            return acc;
          }, {})
        );
        setPickupDrafts(
          nextOrders.reduce((acc: Record<string, string>, item: PopupOrder) => {
            acc[item.id] = item.pickupStatus || '';
            return acc;
          }, {})
        );
      } catch {
        setError('Failed to load popup orders.');
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [key]);

  const saveStatus = async (orderId: string) => {
    if (!key || !statusDrafts[orderId]) return;
    setSavingOrderId(orderId);
    try {
      const res = await fetch('/api/popup-orders', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-popup-admin-key': key,
        },
        body: JSON.stringify({
          id: orderId,
          status: statusDrafts[orderId],
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to update order status.');
        return;
      }

      setOrders((prev) =>
        prev.map((order) =>
          order.id === orderId
            ? {
                ...order,
                status: statusDrafts[orderId],
                pickupStatus:
                  statusDrafts[orderId].toLowerCase() === 'done' && (order.orderType || '').toLowerCase() === 'pickup'
                    ? 'Ready for Pickup'
                    : order.pickupStatus,
              }
            : order
        )
      );
    } catch {
      setError('Failed to update order status.');
    } finally {
      setSavingOrderId(null);
    }
  };

  const markPickedUp = async (orderId: string) => {
    if (!key) return;
    setSavingOrderId(orderId);
    try {
      const res = await fetch('/api/popup-orders', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-popup-admin-key': key,
        },
        body: JSON.stringify({
          id: orderId,
          pickupStatus: 'Picked Up',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to update pickup status.');
        return;
      }
      setPickupDrafts((prev) => ({ ...prev, [orderId]: 'Picked Up' }));
      setOrders((prev) =>
        prev.map((order) => (order.id === orderId ? { ...order, pickupStatus: 'Picked Up' } : order))
      );
    } catch {
      setError('Failed to update pickup status.');
    } finally {
      setSavingOrderId(null);
    }
  };

  const emptyState = useMemo(() => !loading && !error && orders.length === 0, [loading, error, orders.length]);
  const filteredOrders = useMemo(() => {
    const q = orderFilter.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter((order) =>
      (order.orderNumber || '').toLowerCase().includes(q) ||
      (order.text || '').toLowerCase().includes(q) ||
      (order.customerName || '').toLowerCase().includes(q)
    );
  }, [orders, orderFilter]);

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="max-w-6xl mx-auto space-y-5">
        <h1 className="text-3xl md:text-4xl font-bold gradient-text">Pop-Up Orders (Private)</h1>

        {!key && (
          <div className="rounded-xl border border-red-700 bg-red-950/40 p-4 text-red-200">
            This page is private. Use your secret key in the URL: <span className="font-mono">/popup-orders?key=YOUR_KEY</span>
          </div>
        )}

        {loading && <p className="text-gray-400">Loading popup orders...</p>}
        {error && <p className="text-red-300">{error}</p>}
        {emptyState && <p className="text-gray-400">No popup orders yet.</p>}
        {!loading && (
          <input
            type="text"
            value={orderFilter}
            onChange={(e) => setOrderFilter(e.target.value)}
            placeholder="Find by order number, name, or letters..."
            className="w-full max-w-md px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-purple-500"
          />
        )}

        {filteredOrders.map((order) => {
          const colorLines = getColorLines(order);
          return (
          <div key={order.id} className="rounded-2xl border border-gray-800 bg-gray-950 p-5 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <p><span className="text-gray-400">Order Number:</span> <span className="font-bold text-white">{order.orderNumber || '-'}</span></p>
              <p><span className="text-gray-400">Custom Letters:</span> <span className="font-bold text-white">{order.text}</span></p>
              <p><span className="text-gray-400">Customer Name:</span> {order.customerName}</p>
              <p><span className="text-gray-400">Number:</span> {order.phoneNumber}</p>
              <p><span className="text-gray-400">Delivery:</span> {order.deliveryMethod === 'ship' ? 'Ship to Me' : 'Pick Up'}</p>
              <p><span className="text-gray-400">Address:</span> {order.address || '-'}</p>
              <p className="flex items-center gap-2">
                <span className="text-gray-400">Status:</span>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${getStatusPillClasses(order.status || 'Not Started')}`}>
                  {order.status || 'Not Started'}
                </span>
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={statusDrafts[order.id] || order.status || 'New'}
                onChange={(e) =>
                  setStatusDrafts((prev) => ({
                    ...prev,
                    [order.id]: e.target.value,
                  }))
                }
                className="px-3 py-2 rounded-lg bg-gray-900 border border-gray-700 text-sm text-white"
              >
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => saveStatus(order.id)}
                disabled={savingOrderId === order.id}
                className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-60 text-sm font-semibold text-white"
              >
                {savingOrderId === order.id ? 'Saving...' : 'Update Status'}
              </button>
              {(order.orderType || '').toLowerCase() === 'pickup' && (
                <button
                  type="button"
                  onClick={() => markPickedUp(order.id)}
                  disabled={savingOrderId === order.id || (pickupDrafts[order.id] || order.pickupStatus) === 'Picked Up'}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-sm font-semibold text-white"
                >
                  {(pickupDrafts[order.id] || order.pickupStatus) === 'Picked Up' ? 'Picked Up' : 'Mark Picked Up'}
                </button>
              )}
            </div>
            {(order.orderType || '').toLowerCase() === 'pickup' && (
              <p className="text-sm text-gray-300">
                <span className="text-gray-400">Pickup Status:</span> {pickupDrafts[order.id] || order.pickupStatus || 'Not Ready'}
              </p>
            )}

            <div className="space-y-2 text-sm">
              <p className="text-gray-300">Colors by letter</p>
              <div className="rounded-lg bg-black/40 border border-gray-800 p-3 text-xs text-gray-300 space-y-1">
                {colorLines.length > 0 ? (
                  colorLines.map((line, idx) => (
                    <p key={idx}>{line}</p>
                  ))
                ) : (
                  <p>No Color Set</p>
                )}
              </div>
            </div>
          </div>
          );
        })}
      </div>
    </div>
  );
}
