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
  orderText: string;
  boardIds: (string | null)[];
}

const STATUS_OPTIONS = ['New', 'Processing', 'Ready to Ship', 'Shipped', 'Delivered'];

function getStatusPillClasses(status: string): string {
  const s = status.toLowerCase();
  if (s === 'new') return 'bg-blue-200 text-blue-900 border border-blue-300';
  if (s === 'processing') return 'bg-amber-200 text-amber-900 border border-amber-300';
  if (s === 'ready to ship') return 'bg-emerald-200 text-emerald-900 border border-emerald-300';
  if (s === 'shipped') return 'bg-cyan-200 text-cyan-900 border border-cyan-300';
  if (s === 'delivered') return 'bg-green-200 text-green-900 border border-green-300';
  return 'bg-gray-300 text-gray-900 border border-gray-400';
}

const LOCKED_STATUSES = ['shipped', 'delivered'];

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
  const [statusFilter, setStatusFilter] = useState<'all' | 'new' | 'processing' | 'ready to ship' | 'shipped' | 'delivered'>('all');
  const [newOrderCount, setNewOrderCount] = useState(0);
  const prevOrderIdsRef = useRef<Set<string>>(new Set());
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Multi-order packing slip selection (persisted in localStorage)
  const SLIP_STORAGE_KEY = 'glowblocks-slip-selection';
  const [slipSelection, setSlipSelection] = useState<{ id: string; source: string }[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(SLIP_STORAGE_KEY);
      if (stored) setSlipSelection(JSON.parse(stored));
    } catch {}
  }, []);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === SLIP_STORAGE_KEY) {
        try { setSlipSelection(JSON.parse(e.newValue || '[]')); } catch {}
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const toggleSlipSelection = (id: string) => {
    setSlipSelection(prev => {
      const exists = prev.some(s => s.id === id);
      const next = exists ? prev.filter(s => s.id !== id) : [...prev, { id, source: 'online' }];
      localStorage.setItem(SLIP_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const clearSlipSelection = () => {
    setSlipSelection([]);
    localStorage.removeItem(SLIP_STORAGE_KEY);
  };

  const slipSelectedIds = new Set(slipSelection.map(s => s.id));

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
            ? { ...order, trackingNumber: data.trackingNumber, labelUrl: data.labelUrl, status: 'Shipped' }
            : order
        )
      );
    } catch {
      setError('Failed to create shipping label.');
    } finally {
      setCreatingLabelId(null);
    }
  };

  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [editFields, setEditFields] = useState<Record<string, string>>({});

  const startEdit = (order: Order) => {
    setEditingOrderId(order.id);
    setEditFields({
      customerName: order.customerName || '',
      email: order.email || '',
      address: order.address || '',
      items: order.items || '',
    });
  };

  const cancelEdit = () => {
    setEditingOrderId(null);
    setEditFields({});
  };

  const saveEdit = async (orderId: string) => {
    if (!key) return;
    try {
      const res = await fetch('/api/orders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-popup-admin-key': key },
        body: JSON.stringify({ id: orderId, ...editFields }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to update order.');
        return;
      }
      setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, ...editFields } : o));
      setEditingOrderId(null);
    } catch {
      setError('Failed to update order.');
    }
  };

  const deleteOrder = async (orderId: string) => {
    if (!key || !confirm('Are you sure you want to delete this order? This cannot be undone.')) return;
    try {
      const res = await fetch('/api/orders', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'x-popup-admin-key': key },
        body: JSON.stringify({ id: orderId }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to delete order.');
        return;
      }
      setOrders((prev) => prev.filter((o) => o.id !== orderId));
    } catch {
      setError('Failed to delete order.');
    }
  };

  const filteredOrders = useMemo(() => {
    const q = orderFilter.trim().toLowerCase();
    let filtered = !q
      ? orders
      : orders.filter(
          (order) =>
            order.customerName.toLowerCase().includes(q) ||
            order.email.toLowerCase().includes(q) ||
            order.items.toLowerCase().includes(q) ||
            order.address.toLowerCase().includes(q)
        );
    if (statusFilter !== 'all') {
      filtered = filtered.filter(
        (order) => (order.status || 'new').toLowerCase() === statusFilter
      );
    }
    return [...filtered].sort((a, b) => {
      const aDone = a.status.toLowerCase() === 'delivered' ? 1 : 0;
      const bDone = b.status.toLowerCase() === 'delivered' ? 1 : 0;
      if (aDone !== bDone) return aDone - bDone;
      return 0;
    });
  }, [orders, orderFilter, statusFilter]);

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
          <div className="space-y-3">
            <input
              type="text"
              value={orderFilter}
              onChange={(e) => setOrderFilter(e.target.value)}
              placeholder="Find by name, email, items, or address..."
              className="w-full max-w-md px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-purple-500"
            />
            <div className="flex flex-wrap gap-2">
              {([['all', 'All'], ['new', 'New'], ['processing', 'Processing'], ['ready to ship', 'Ready to Ship'], ['shipped', 'Shipped'], ['delivered', 'Delivered']] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setStatusFilter(value)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                    statusFilter === value
                      ? 'bg-purple-600 text-white border border-purple-500'
                      : 'bg-gray-800 text-gray-400 border border-gray-700 hover:text-white hover:border-gray-500'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {filteredOrders.map((order) => {
          const ids = order.boardIds || [];
          const nonSpaceCount = (order.orderText || '').split('').filter(c => c !== ' ').length;
          const scannedCount = ids.filter(b => b != null).length;
          const allScanned = scannedCount >= nonSpaceCount && nonSpaceCount > 0;

          return (
            <div
              key={order.id}
              className={`rounded-2xl border ${slipSelectedIds.has(order.id) ? 'border-purple-500 ring-1 ring-purple-500/40' : 'border-gray-800'} bg-gray-950 p-5 space-y-3`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <input
                    type="checkbox"
                    checked={slipSelectedIds.has(order.id)}
                    onChange={() => toggleSlipSelection(order.id)}
                    className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-purple-500 focus:ring-purple-500 shrink-0 cursor-pointer"
                  />
                  <p className="text-xl font-bold text-white">
                    {order.customerName || 'Unknown Customer'}
                  </p>
                  {/* PCB progress badge */}
                  {order.orderText && (
                    allScanned ? (
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-green-900/50 text-green-400 border border-green-600/40">
                        PCBs Done
                      </span>
                    ) : scannedCount > 0 ? (
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-900/50 text-blue-400 border border-blue-600/40">
                        PCBs {scannedCount}/{nonSpaceCount}
                      </span>
                    ) : null
                  )}
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-green-400">
                    {order.total}
                  </p>
                  <p className="text-xs text-gray-500">{order.date}</p>
                </div>
              </div>

              {editingOrderId === order.id ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <label className="flex flex-col gap-1"><span className="text-gray-400">Customer Name:</span><input className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-white text-sm" value={editFields.customerName || ''} onChange={(e) => setEditFields((f) => ({ ...f, customerName: e.target.value }))} /></label>
                  <label className="flex flex-col gap-1"><span className="text-gray-400">Email:</span><input className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-white text-sm" value={editFields.email || ''} onChange={(e) => setEditFields((f) => ({ ...f, email: e.target.value }))} /></label>
                  <label className="flex flex-col gap-1 md:col-span-2"><span className="text-gray-400">Address:</span><input className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-white text-sm" value={editFields.address || ''} onChange={(e) => setEditFields((f) => ({ ...f, address: e.target.value }))} /></label>
                  <label className="flex flex-col gap-1 md:col-span-2"><span className="text-gray-400">Items:</span><input className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-white text-sm" value={editFields.items || ''} onChange={(e) => setEditFields((f) => ({ ...f, items: e.target.value }))} /></label>
                  <div className="md:col-span-2 flex gap-2 mt-1">
                    <button onClick={() => saveEdit(order.id)} className="px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-500 text-white text-xs font-semibold">Save</button>
                    <button onClick={cancelEdit} className="px-3 py-1.5 rounded-lg border border-gray-600 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold">Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-sm text-gray-400">{order.email}</p>
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
                </>
              )}

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
                {(() => {
                  const currentStatus = (order.status || 'new').toLowerCase();
                  const isLocked = LOCKED_STATUSES.includes(currentStatus);
                  return STATUS_OPTIONS.map((opt) => {
                    const isActive = opt.toLowerCase() === currentStatus;
                    const isSaving = savingOrderId === order.id;
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => !isActive && !isLocked && saveStatus(order.id, opt)}
                        disabled={isSaving || (isLocked && !isActive)}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                          isActive
                            ? getStatusPillClasses(opt)
                            : 'bg-gray-800 text-gray-500 border border-gray-700 hover:text-white hover:border-gray-500'
                        } ${(isSaving || (isLocked && !isActive)) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                      >
                        {isSaving && isActive ? 'Saving...' : opt}
                      </button>
                    );
                  });
                })()}
              </div>

              {/* PCB Scanning section */}
              {order.orderText && (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {allScanned ? (
                      <span className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-green-900/50 text-green-400 border border-green-600/40 opacity-60 cursor-not-allowed">
                        PCBs Scanned
                      </span>
                    ) : (
                      <Link
                        href={`/scan?key=${encodeURIComponent(key)}&order=${encodeURIComponent(order.id)}&source=online`}
                        className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-purple-800 text-purple-200 border border-purple-600 hover:bg-purple-700 transition-colors"
                      >
                        {scannedCount > 0 ? `Scan PCBs (${scannedCount}/${nonSpaceCount})` : 'Scan PCBs'}
                      </Link>
                    )}
                  </div>
                  {scannedCount > 0 && (
                    <div className="flex flex-wrap gap-1.5 items-center">
                      {(order.orderText || '').split('').map((ch, i) => {
                        if (ch === ' ') return <div key={i} className="w-1.5" />;
                        const bid = ids[i];
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
                                window.location.href = `/scan?key=${encodeURIComponent(key)}&order=${encodeURIComponent(order.id)}&letter=${i}&source=online`;
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
                      <span className="text-xs text-gray-600 italic ml-1">Hold to replace</span>
                    </div>
                  )}
                </div>
              )}

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
                (order.status || 'new').toLowerCase() === 'ready to ship' && (
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

              {(order.status || '').toLowerCase() === 'shipped' && (
                <button
                  type="button"
                  onClick={() => saveStatus(order.id, 'Delivered')}
                  disabled={savingOrderId === order.id}
                  className="px-4 py-2 rounded-lg bg-green-700 hover:bg-green-600 text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {savingOrderId === order.id ? 'Updating...' : 'Mark as Delivered'}
                </button>
              )}

              <div className="flex items-center gap-2">
                <a
                  href={`/packing-label?id=${encodeURIComponent(order.id)}&source=online&key=${encodeURIComponent(key)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block px-4 py-2 rounded-lg bg-gray-800 text-gray-300 border border-gray-600 hover:bg-gray-700 hover:text-white text-xs font-semibold transition-colors"
                >
                  Print Packing Slip
                </a>
                {editingOrderId !== order.id && (
                  <>
                    <button
                      type="button"
                      onClick={() => startEdit(order)}
                      className="px-3 py-2 rounded-lg bg-gray-800 text-gray-300 border border-gray-600 hover:bg-gray-700 hover:text-white text-xs font-semibold transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteOrder(order.id)}
                      className="px-3 py-2 rounded-lg bg-gray-800 text-red-400 border border-gray-600 hover:bg-red-900/50 hover:text-red-300 hover:border-red-600 text-xs font-semibold transition-colors"
                    >
                      Delete
                    </button>
                  </>
                )}
                <p className="text-xs text-gray-600 font-mono ml-auto">
                  {order.stripeSessionId}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Combined packing slip floating bar */}
      {slipSelection.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-gray-950/95 border-t border-purple-700 backdrop-blur-sm px-4 py-3">
          <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
            <p className="text-sm text-gray-300">
              <span className="font-bold text-purple-400">{slipSelection.length}</span> order{slipSelection.length !== 1 ? 's' : ''} selected for packing slip
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={clearSlipSelection}
                className="px-3 py-1.5 rounded-lg border border-gray-600 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold transition-colors"
              >
                Clear
              </button>
              <a
                href={`/packing-label?orders=${encodeURIComponent(slipSelection.map(s => `${s.source}:${s.id}`).join(','))}&key=${encodeURIComponent(key)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold transition-colors"
              >
                Create Combined Packing Slip
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
