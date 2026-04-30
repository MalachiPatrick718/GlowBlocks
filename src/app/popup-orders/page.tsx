'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

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
  letterCount?: number;
  customColorFee?: number;
  subtotal?: number;
  tax?: number;
  total?: number;
  onSiteEligible?: boolean | null;
  boardIds?: (string | null)[];
  trackingNumber?: string;
  labelUrl?: string;
  paymentStatus?: string;
  paymentMethod?: string;
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

interface ColorByLetter {
  letter: string;
  colorHex: string;
  colorName?: string;
  displayText: string;
}

function getColorLines(order: PopupOrder): ColorByLetter[] {
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
          const colorHex = item.colorHex || '#FFFFFF';

          if (!item.colorHex || item.colorHex === '#FFFFFF') {
            return {
              letter,
              colorHex: '#FFFFFF',
              displayText: `${letter} - No Color Set`
            };
          }

          const rgb = hexToRgbString(item.colorHex);
          let displayText = '';
          if (item.colorName && rgb) displayText = `${letter} - ${item.colorName} (${rgb})`;
          else if (item.colorName) displayText = `${letter} - ${item.colorName}`;
          else if (rgb) {
            const presetLabel = formatPresetLabel(order.colorMode);
            displayText = `${letter} - ${presetLabel || 'Preset'} (${rgb})`;
          } else {
            displayText = `${letter} - ${item.colorHex}`;
          }

          return {
            letter,
            colorHex,
            colorName: item.colorName || undefined,
            displayText
          };
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
          const colorHex = item.colorHex || '#FFFFFF';
          let displayText = '';
          if (!item.colorHex || item.colorHex === '#FFFFFF') {
            displayText = `${item.letter} - No Color Set`;
          } else {
            const rgb = hexToRgbString(item.colorHex);
            const presetLabel = formatPresetLabel(order.colorMode) || 'Preset';
            displayText = rgb ? `${item.letter} - ${presetLabel} (${rgb})` : `${item.letter} - ${item.colorHex}`;
          }
          return {
            letter: item.letter,
            colorHex,
            displayText
          };
        });
    }

    return [];
  } catch {
    return [];
  }
}

function isCompletedOrder(order: PopupOrder): boolean {
  const pickupStatus = (order.pickupStatus || '').toLowerCase();
  const status = (order.status || '').toLowerCase();
  if (pickupStatus === 'picked up') return true;
  if (status === 'picked up') return true;
  if (status === 'ready to ship') return true;
  return false;
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
  const [creatingLabelId, setCreatingLabelId] = useState<string | null>(null);
  const [pickupDrafts, setPickupDrafts] = useState<Record<string, string>>({});
  const [orderFilter, setOrderFilter] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'awaiting' | 'paid'>('all');
  const [markingPaidId, setMarkingPaidId] = useState<string | null>(null);
  const [newOrderCount, setNewOrderCount] = useState(0);
  const prevOrderIdsRef = useRef<Set<string>>(new Set());
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const baseStatusOptions = ['Not Started', 'In Progress', 'Done'];

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
      const res = await fetch('/api/popup-orders', {
        headers: { 'x-popup-admin-key': key },
        cache: 'no-store',
      });
      const data = await res.json();
      if (!res.ok) {
        if (isInitialLoad) setError(data.error || 'Failed to load popup orders.');
        return;
      }
      const nextOrders = data.orders || [];
      setOrders(nextOrders);
      const nextIds = new Set<string>(nextOrders.map((o: PopupOrder) => o.id));
      if (isInitialLoad) {
        prevOrderIdsRef.current = nextIds;
        setPickupDrafts(
          nextOrders.reduce((acc: Record<string, string>, item: PopupOrder) => {
            acc[item.id] = item.pickupStatus || '';
            return acc;
          }, {})
        );
      } else {
        if (prevOrderIdsRef.current.size > 0) {
          const newIds = [...nextIds].filter(id => !prevOrderIdsRef.current.has(id));
          if (newIds.length > 0) {
            setNewOrderCount(newIds.length);
            playChime();
            setTimeout(() => setNewOrderCount(0), 10_000);
          }
        }
        prevOrderIdsRef.current = nextIds;
        setPickupDrafts((prev) => {
          const updated = { ...prev };
          nextOrders.forEach((item: PopupOrder) => {
            if (!(item.id in updated)) updated[item.id] = item.pickupStatus || '';
            if (item.pickupStatus === 'Picked Up') updated[item.id] = 'Picked Up';
          });
          return updated;
        });
      }
    } catch {
      if (isInitialLoad) setError('Failed to load popup orders.');
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
      if (savingOrderId || creatingLabelId || markingPaidId) return;
      fetchOrders(false);
    }, 120_000);
    return () => clearInterval(interval);
  }, [key, fetchOrders, savingOrderId, creatingLabelId, markingPaidId]);

  const saveStatus = async (orderId: string, newStatus: string) => {
    if (!key || !newStatus) return;
    if (newStatus.toLowerCase() === 'done') {
      const order = orders.find((o) => o.id === orderId);
      if (order && (order.paymentStatus || 'Awaiting Payment').toLowerCase() !== 'paid') {
        setError('Cannot mark as Done — payment is still pending. Mark as Paid first.');
        return;
      }
    }
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
          status: newStatus,
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
                status: newStatus,
                pickupStatus:
                  newStatus.toLowerCase() === 'done' && (order.orderType || '').toLowerCase() === 'pickup'
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
        body: JSON.stringify({ orderId, source: 'popup' }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to create shipping label.');
        return;
      }
      setOrders((prev) =>
        prev.map((order) =>
          order.id === orderId
            ? { ...order, trackingNumber: data.trackingNumber, labelUrl: data.labelUrl, status: 'Ready to Ship' }
            : order
        )
      );
    } catch {
      setError('Failed to create shipping label.');
    } finally {
      setCreatingLabelId(null);
    }
  };

  const markAsPaid = async (orderId: string) => {
    if (!key) return;
    setMarkingPaidId(orderId);
    try {
      const res = await fetch('/api/popup-orders', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-popup-admin-key': key,
        },
        body: JSON.stringify({ id: orderId, paymentStatus: 'Paid' }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to mark as paid.');
        return;
      }
      setOrders((prev) =>
        prev.map((order) =>
          order.id === orderId ? { ...order, paymentStatus: 'Paid' } : order
        )
      );
    } catch {
      setError('Failed to mark as paid.');
    } finally {
      setMarkingPaidId(null);
    }
  };

  const emptyState = useMemo(() => !loading && !error && orders.length === 0, [loading, error, orders.length]);
  const filteredOrders = useMemo(() => {
    const q = orderFilter.trim().toLowerCase();
    let filtered = !q ? orders : orders.filter((order) =>
      (order.orderNumber || '').toLowerCase().includes(q) ||
      (order.text || '').toLowerCase().includes(q) ||
      (order.customerName || '').toLowerCase().includes(q)
    );
    if (paymentFilter === 'awaiting') {
      filtered = filtered.filter((order) => (order.paymentStatus || 'Awaiting Payment').toLowerCase() !== 'paid');
    } else if (paymentFilter === 'paid') {
      filtered = filtered.filter((order) => (order.paymentStatus || '').toLowerCase() === 'paid');
    }
    return [...filtered].sort((a, b) => {
      const aDone = isCompletedOrder(a) ? 1 : 0;
      const bDone = isCompletedOrder(b) ? 1 : 0;
      if (aDone !== bDone) return aDone - bDone;
      return 0;
    });
  }, [orders, orderFilter, paymentFilter]);

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="max-w-6xl mx-auto space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl md:text-4xl font-bold gradient-text">
            Pop-Up Orders (Private)
            {newOrderCount > 0 && (
              <span className="ml-3 inline-flex items-center justify-center px-2.5 py-1 rounded-full text-sm font-bold bg-red-600 text-white animate-pulse">
                +{newOrderCount} new
              </span>
            )}
          </h1>
          <div className="flex gap-2">
            <Link
              href={`/orders?key=${encodeURIComponent(key)}`}
              className="px-4 py-2 rounded-lg bg-blue-700 hover:bg-blue-600 text-sm font-semibold text-white"
            >
              Online Orders
            </Link>
            <Link
              href={`/scan?key=${encodeURIComponent(key)}`}
              className="px-4 py-2 rounded-lg bg-purple-700 hover:bg-purple-600 text-sm font-semibold text-white"
            >
              Scanner
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
            This page is private. Use your secret key in the URL: <span className="font-mono">/popup-orders?key=YOUR_KEY</span>
          </div>
        )}

        {loading && <p className="text-gray-400">Loading popup orders...</p>}
        {error && <p className="text-red-300">{error}</p>}
        {emptyState && <p className="text-gray-400">No popup orders yet.</p>}
        {!loading && (
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="text"
              value={orderFilter}
              onChange={(e) => setOrderFilter(e.target.value)}
              placeholder="Find by order number, name, or letters..."
              className="w-full max-w-md px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-purple-500"
            />
            <div className="flex rounded-lg border border-gray-700 overflow-hidden">
              {([['all', 'All'], ['awaiting', 'Unpaid'], ['paid', 'Paid']] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setPaymentFilter(value)}
                  className={`px-3 py-2 text-xs font-semibold transition-colors ${
                    paymentFilter === value
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-900 text-gray-400 hover:text-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {filteredOrders.map((order) => {
          const colorLines = getColorLines(order);
          return (
          <div key={order.id} className="rounded-2xl border border-gray-800 bg-gray-950 p-5 space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
              <div>
                <div className="flex items-center gap-3">
                  <p className="text-3xl font-black text-white">{order.orderNumber || '--'}</p>
                  {order.onSiteEligible === true && (
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-green-900/50 text-green-400 border border-green-600/40">
                      On-Site Eligible
                    </span>
                  )}
                  {order.onSiteEligible === false && (
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-red-900/50 text-red-400 border border-red-600/40">
                      Not Available On-Site
                    </span>
                  )}
                  {(() => {
                    const ids = order.boardIds || [];
                    const nonSpaceCount = (order.text || '').split('').filter(c => c !== ' ').length;
                    const scanned = ids.filter(b => b != null).length;
                    if (scanned > 0 && scanned >= nonSpaceCount) {
                      return (
                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-green-900/50 text-green-400 border border-green-600/40">
                          PCBs ✓
                        </span>
                      );
                    }
                    if (scanned > 0) {
                      return (
                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-900/50 text-blue-400 border border-blue-600/40">
                          PCBs {scanned}/{nonSpaceCount}
                        </span>
                      );
                    }
                    return null;
                  })()}
                </div>
                <p className="text-xs text-gray-500">Order Number</p>
              </div>
              {order.total !== undefined && (
                <div className="text-right">
                  <p className="text-2xl font-bold text-green-400">${order.total.toFixed(2)}</p>
                  <p className="text-xs text-gray-500 mb-1">Amount to Charge</p>
                  {(order.paymentStatus || 'Awaiting Payment').toLowerCase() === 'paid' ? (
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-green-900/50 text-green-400 border border-green-600/40">
                      Paid
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-yellow-900/50 text-yellow-400 border border-yellow-600/40">
                      Awaiting Payment
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <p><span className="text-gray-400">Custom Letters:</span> <span className="font-bold text-white">{order.text}</span></p>
              <p><span className="text-gray-400">Customer Name:</span> {order.customerName}</p>
              <p><span className="text-gray-400">Number:</span> {order.phoneNumber}</p>
              <p><span className="text-gray-400">Delivery:</span> {order.deliveryMethod === 'ship' ? 'Ship to Me' : 'Pick Up'}</p>
              <p><span className="text-gray-400">Address:</span> {order.address || '-'}</p>
            </div>

            {order.subtotal !== undefined && (
              <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-3 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-400">Letters ({order.letterCount || 0}):</span>
                  <span className="text-white font-medium">${((order.subtotal || 0) - (order.customColorFee || 0)).toFixed(2)}</span>
                </div>
                {(order.customColorFee || 0) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Custom Color Fee:</span>
                    <span className="text-white font-medium">${order.customColorFee!.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-400">Tax:</span>
                  <span className="text-white font-medium">${(order.tax || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-gray-700 font-bold">
                  <span className="text-white">Total:</span>
                  <span className="text-green-400">${order.total?.toFixed(2) || '0.00'}</span>
                </div>
              </div>
            )}

            {/* Payment action */}
            {(order.paymentStatus || 'Awaiting Payment').toLowerCase() !== 'paid' && (
              <div className="flex flex-wrap items-center gap-2">
                {order.paymentMethod && (
                  <span className="text-xs text-gray-500">{order.paymentMethod}</span>
                )}
                <button
                  type="button"
                  onClick={() => markAsPaid(order.id)}
                  disabled={markingPaidId === order.id}
                  className="px-3 py-1.5 rounded-full text-xs font-semibold bg-green-800 text-green-200 border border-green-600 hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ml-auto"
                >
                  {markingPaidId === order.id ? 'Saving...' : 'Mark as Paid'}
                </button>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              {(() => {
                const isShipOrder = (order.deliveryMethod || '').toLowerCase() === 'ship';
                const statusOptions = isShipOrder
                  ? [...baseStatusOptions, 'Ready to Ship']
                  : baseStatusOptions;
                const currentStatus = (order.status || 'Not Started').toLowerCase();
                const isCompleted = (pickupDrafts[order.id] || order.pickupStatus) === 'Picked Up';
                return statusOptions.map((opt) => {
                  const isActive = opt.toLowerCase() === currentStatus;
                  const isSaving = savingOrderId === order.id;
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => !isActive && saveStatus(order.id, opt)}
                      disabled={isSaving || isCompleted}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                        isActive
                          ? getStatusPillClasses(opt)
                          : 'bg-gray-800 text-gray-500 border border-gray-700 hover:text-white hover:border-gray-500'
                      } ${(isSaving || isCompleted) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                      {isSaving && isActive ? 'Saving...' : opt}
                    </button>
                  );
                });
              })()}
              {(order.orderType || '').toLowerCase() === 'pickup' && (
                <button
                  type="button"
                  onClick={() => markPickedUp(order.id)}
                  disabled={savingOrderId === order.id || (pickupDrafts[order.id] || order.pickupStatus) === 'Picked Up'}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold ml-auto transition-colors ${
                    (pickupDrafts[order.id] || order.pickupStatus) === 'Picked Up'
                      ? getStatusPillClasses('Picked Up')
                      : 'bg-gray-800 text-gray-500 border border-gray-700 hover:text-white hover:border-emerald-500'
                  } ${savingOrderId === order.id ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  {(pickupDrafts[order.id] || order.pickupStatus) === 'Picked Up' ? 'Picked Up' : 'Mark Picked Up'}
                </button>
              )}
            </div>

            {/* Scan PCBs */}
            <div className="flex flex-wrap items-center gap-2">
              {(() => {
                const ids = order.boardIds || [];
                const nonSpaceCount = (order.text || '').split('').filter(c => c !== ' ').length;
                const scanned = ids.filter(b => b != null).length;
                const allScanned = scanned >= nonSpaceCount && nonSpaceCount > 0;
                if (allScanned) {
                  return (
                    <span className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-green-900/50 text-green-400 border border-green-600/40 opacity-60 cursor-not-allowed">
                      PCBs Scanned ✓
                    </span>
                  );
                }
                return (
                  <Link
                    href={`/scan?key=${encodeURIComponent(key)}&order=${encodeURIComponent(order.id)}`}
                    className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-purple-800 text-purple-200 border border-purple-600 hover:bg-purple-700 transition-colors"
                  >
                    {scanned > 0 ? `Scan PCBs (${scanned}/${nonSpaceCount})` : 'Scan PCBs'}
                  </Link>
                );
              })()}
              {(order.boardIds || []).some(b => b != null) && (
                <>
                  <div className="flex flex-wrap gap-1.5">
                    {(order.text || '').split('').map((ch, i) => {
                      if (ch === ' ') return null;
                      const bid = (order.boardIds || [])[i];
                      return (
                        <span
                          key={i}
                          className={`px-2 py-0.5 rounded text-xs font-mono select-none ${
                            bid ? 'bg-green-900/40 text-green-400 border border-green-700/40' : 'bg-gray-800 text-gray-500 border border-gray-700'
                          }`}
                          onTouchStart={() => {
                            if (!bid) return;
                            longPressTimerRef.current = setTimeout(() => {
                              longPressTimerRef.current = null;
                              window.location.href = `/scan?key=${encodeURIComponent(key)}&order=${encodeURIComponent(order.id)}&letter=${i}`;
                            }, 600);
                          }}
                          onTouchEnd={() => {
                            if (longPressTimerRef.current) {
                              clearTimeout(longPressTimerRef.current);
                              longPressTimerRef.current = null;
                            }
                          }}
                          onTouchCancel={() => {
                            if (longPressTimerRef.current) {
                              clearTimeout(longPressTimerRef.current);
                              longPressTimerRef.current = null;
                            }
                          }}
                          onContextMenu={(e) => { if (bid) e.preventDefault(); }}
                        >
                          {ch.toUpperCase()}{bid ? ` ${bid}` : ''}
                        </span>
                      );
                    })}
                  </div>
                  <span className="text-xs text-gray-600 italic">Hold to replace</span>
                </>
              )}
            </div>

            {/* Shipping label section for Ship to Me orders */}
            {(order.deliveryMethod || '').toLowerCase() === 'ship' && (
              order.trackingNumber ? (
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
                order.address && (order.status || '').toLowerCase() === 'ready to ship' && (
                  <button
                    type="button"
                    onClick={() => createLabel(order.id)}
                    disabled={creatingLabelId === order.id}
                    className="px-4 py-2 rounded-lg bg-cyan-700 hover:bg-cyan-600 text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {creatingLabelId === order.id ? 'Creating Label...' : 'Create Shipping Label'}
                  </button>
                )
              )
            )}

            <div className="space-y-2 text-sm">
              <p className="text-gray-300">Colors by letter</p>
              <div className="rounded-lg bg-black/40 border border-gray-800 p-3 text-xs text-gray-300 space-y-1">
                {colorLines.length > 0 ? (
                  colorLines.map((item, idx) => (
                    <p key={idx}>{item.displayText}</p>
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
