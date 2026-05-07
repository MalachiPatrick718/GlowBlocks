'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

// --- Unified order type ---
interface UnifiedOrder {
  id: string;
  source: 'popup' | 'online';
  customerName: string;
  email: string;
  phoneNumber?: string;
  address?: string;
  date?: string;
  status: string;
  // Popup-specific
  text?: string;
  colorsByLetter?: string;
  orderNumber?: string;
  orderType?: string;
  deliveryMethod?: string;
  colorMode?: string;
  pickupStatus?: string;
  letterCount?: number;
  customColorFee?: number;
  subtotal?: number;
  discount?: number;
  shippingFee?: number;
  tax?: number;
  total?: number;
  onSiteEligible?: boolean | null;
  paymentStatus?: string;
  paymentMethod?: string;
  // Online-specific
  items?: string;
  lineItems?: string;
  shippingMethod?: string;
  shippingCost?: string;
  stripeSessionId?: string;
  orderText?: string;
  orderDataItems?: { text: string; colors: string[]; quantity: number }[];
  gift?: string;
  giftRecipient?: string;
  giftNote?: string;
  // Shared
  boardIds?: (string | null)[];
  trackingNumber?: string;
  labelUrl?: string;
}

// --- Color helpers (from popup) ---
interface ParsedColorByLetter { letter?: string; colorName?: string | null; colorHex?: string | null; }
interface ColorByLetter { letter: string; colorHex: string; colorName?: string; displayText: string; }

function hexToRgbString(hex?: string | null): string | null {
  if (!hex || !/^#[0-9A-Fa-f]{6}$/.test(hex)) return null;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r}, ${g}, ${b}`;
}

function formatPresetLabel(value?: string): string | null {
  if (!value || value === 'Custom Numbers') return null;
  return /preset$/i.test(value) ? value : `${value} Preset`;
}

function getColorLines(order: UnifiedOrder): ColorByLetter[] {
  if (!order.colorsByLetter) return [];
  try {
    const parsed = JSON.parse(order.colorsByLetter);
    const list = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.colorsByLetter) ? parsed.colorsByLetter : []);
    if (Array.isArray(list) && list.length > 0) {
      return list
        .filter((item: ParsedColorByLetter) => item?.letter && item.letter !== ' ')
        .map((item: ParsedColorByLetter) => {
          const letter = item.letter || '';
          const colorHex = item.colorHex || '#FFFFFF';
          if (!item.colorHex || item.colorHex === '#FFFFFF') return { letter, colorHex: '#FFFFFF', displayText: `${letter} - No Color Set` };
          const rgb = hexToRgbString(item.colorHex);
          let displayText = '';
          if (item.colorName && rgb) displayText = `${letter} - ${item.colorName} (${rgb})`;
          else if (item.colorName) displayText = `${letter} - ${item.colorName}`;
          else if (rgb) { displayText = `${letter} - ${formatPresetLabel(order.colorMode) || 'Preset'} (${rgb})`; }
          else displayText = `${letter} - ${item.colorHex}`;
          return { letter, colorHex, colorName: item.colorName || undefined, displayText };
        });
    }
    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.letterColors)) {
      const letters = (order.text || '').split('');
      return letters
        .map((letter, idx) => ({ letter, colorHex: (parsed.letterColors as string[])[idx] || '#FFFFFF' }))
        .filter((item) => item.letter !== ' ')
        .map((item) => {
          const rgb = hexToRgbString(item.colorHex);
          const displayText = (!item.colorHex || item.colorHex === '#FFFFFF')
            ? `${item.letter} - No Color Set`
            : rgb ? `${item.letter} - ${formatPresetLabel(order.colorMode) || 'Preset'} (${rgb})` : `${item.letter} - ${item.colorHex}`;
          return { letter: item.letter, colorHex: item.colorHex, displayText };
        });
    }
    return [];
  } catch { return []; }
}

function getOnlineColorLines(order: UnifiedOrder): ColorByLetter[] {
  if (!order.orderDataItems || order.orderDataItems.length === 0) return [];
  const lines: ColorByLetter[] = [];
  for (const item of order.orderDataItems) {
    const text = item.text || '';
    const colors = item.colors || [];
    for (let i = 0; i < text.length; i++) {
      const letter = text[i];
      if (letter === ' ') continue;
      const colorHex = colors[i] || '#FFFFFF';
      if (!colorHex || colorHex === '#FFFFFF') {
        lines.push({ letter, colorHex: '#FFFFFF', displayText: `${letter} - No Color Set` });
      } else {
        const rgb = hexToRgbString(colorHex);
        const displayText = rgb ? `${letter} - (${rgb})` : `${letter} - ${colorHex}`;
        lines.push({ letter, colorHex, displayText });
      }
    }
  }
  return lines;
}

// --- Status helpers ---
function getStatusPillClasses(status?: string): string {
  const s = (status || '').toLowerCase();
  if (s === 'not started') return 'bg-pink-200 text-pink-900 border border-pink-300';
  if (s === 'new') return 'bg-blue-200 text-blue-900 border border-blue-300';
  if (s === 'in progress' || s === 'processing') return 'bg-amber-200 text-amber-900 border border-amber-300';
  if (s === 'done') return 'bg-cyan-200 text-cyan-900 border border-cyan-300';
  if (s === 'ready to ship') return 'bg-emerald-200 text-emerald-900 border border-emerald-300';
  if (s === 'shipped') return 'bg-cyan-200 text-cyan-900 border border-cyan-300';
  if (s === 'delivered') return 'bg-green-200 text-green-900 border border-green-300';
  if (s === 'picked up') return 'bg-green-200 text-green-900 border border-green-300';
  return 'bg-gray-300 text-gray-900 border border-gray-400';
}

function isCompletedOrder(order: UnifiedOrder): boolean {
  const s = (order.status || '').toLowerCase();
  const ps = (order.pickupStatus || '').toLowerCase();
  return s === 'delivered' || s === 'picked up' || ps === 'picked up';
}

function getOrderText(order: UnifiedOrder): string {
  return order.source === 'popup' ? (order.text || '') : (order.orderText || '');
}

const SHIP_STATUSES = ['Not Started', 'In Progress', 'Done', 'Ready to Ship', 'Shipped', 'Delivered'];
const PICKUP_STATUSES = ['Not Started', 'In Progress', 'Done'];
const LOCKED_STATUSES = ['shipped', 'delivered'];

const AUTH_STORAGE_KEY = 'glowblocks-admin-key';
const THEME_STORAGE_KEY = 'glowblocks-orders-theme';

export default function OrdersPage() {
  return (
    <Suspense>
      <OrdersContent />
    </Suspense>
  );
}

function OrdersContent() {
  const searchParams = useSearchParams();
  const paramKey = searchParams.get('key') || '';

  // Theme
  const [light, setLight] = useState(false);
  useEffect(() => { setLight(localStorage.getItem(THEME_STORAGE_KEY) === 'light'); }, []);
  const toggleTheme = () => {
    const next = !light;
    setLight(next);
    localStorage.setItem(THEME_STORAGE_KEY, next ? 'light' : 'dark');
  };

  // Admin key: from URL param, localStorage, or prompt
  const [key, setKey] = useState('');
  const [keyInput, setKeyInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (paramKey) {
      setKey(paramKey);
      localStorage.setItem(AUTH_STORAGE_KEY, paramKey);
    } else {
      const stored = localStorage.getItem(AUTH_STORAGE_KEY) || '';
      if (stored) setKey(stored);
    }
  }, [paramKey]);

  const handleKeySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (keyInput.trim()) {
      setKey(keyInput.trim());
      localStorage.setItem(AUTH_STORAGE_KEY, keyInput.trim());
    }
  };

  const [orders, setOrders] = useState<UnifiedOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingOrderId, setSavingOrderId] = useState<string | null>(null);
  const [creatingLabelId, setCreatingLabelId] = useState<string | null>(null);
  const [markingPaidId, setMarkingPaidId] = useState<string | null>(null);
  const [orderFilter, setOrderFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'popup' | 'online'>('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'awaiting' | 'paid'>('all');
  const [newOrderCount, setNewOrderCount] = useState(0);
  const prevOrderIdsRef = useRef<Set<string>>(new Set());
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [editFields, setEditFields] = useState<Record<string, string>>({});
  const [pickupDrafts, setPickupDrafts] = useState<Record<string, string>>({});

  // Multi-order packing slip selection
  const SLIP_STORAGE_KEY = 'glowblocks-slip-selection';
  const [slipSelection, setSlipSelection] = useState<{ id: string; source: string }[]>([]);

  useEffect(() => {
    try { const stored = localStorage.getItem(SLIP_STORAGE_KEY); if (stored) setSlipSelection(JSON.parse(stored)); } catch {}
  }, []);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => { if (e.key === SLIP_STORAGE_KEY) { try { setSlipSelection(JSON.parse(e.newValue || '[]')); } catch {} } };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const toggleSlipSelection = (order: UnifiedOrder) => {
    setSlipSelection(prev => {
      const exists = prev.some(s => s.id === order.id);
      const next = exists ? prev.filter(s => s.id !== order.id) : [...prev, { id: order.id, source: order.source }];
      localStorage.setItem(SLIP_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const clearSlipSelection = () => { setSlipSelection([]); localStorage.removeItem(SLIP_STORAGE_KEY); };
  const slipSelectedIds = new Set(slipSelection.map(s => s.id));

  const playChime = useCallback(() => {
    try {
      const ctx = new AudioContext();
      const osc1 = ctx.createOscillator(); const gain1 = ctx.createGain();
      osc1.connect(gain1); gain1.connect(ctx.destination); osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, ctx.currentTime);
      gain1.gain.setValueAtTime(0.3, ctx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
      osc1.start(ctx.currentTime); osc1.stop(ctx.currentTime + 0.5);
      const osc2 = ctx.createOscillator(); const gain2 = ctx.createGain();
      osc2.connect(gain2); gain2.connect(ctx.destination); osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880, ctx.currentTime + 0.15);
      gain2.gain.setValueAtTime(0.3, ctx.currentTime + 0.15);
      gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.65);
      osc2.start(ctx.currentTime + 0.15); osc2.stop(ctx.currentTime + 0.65);
    } catch {}
  }, []);

  const fetchOrders = useCallback(async (isInitialLoad: boolean) => {
    if (!key) { if (isInitialLoad) setLoading(false); return; }
    if (isInitialLoad) { setLoading(true); setError(null); }
    try {
      const headers = { 'x-popup-admin-key': key };
      const [popupRes, onlineRes] = await Promise.allSettled([
        fetch('/api/popup-orders', { headers, cache: 'no-store' }).then(async r => {
          if (r.status === 401) throw new Error('unauthorized');
          if (!r.ok) throw new Error('fetch-error');
          return r.json();
        }),
        fetch('/api/orders', { headers, cache: 'no-store' }).then(async r => {
          if (r.status === 401) throw new Error('unauthorized');
          if (!r.ok) throw new Error('fetch-error');
          return r.json();
        }),
      ]);

      // Check if either API returned unauthorized
      const unauthorized = [popupRes, onlineRes].some(
        r => r.status === 'rejected' && r.reason?.message === 'unauthorized'
      );
      if (unauthorized) {
        setKey('');
        localStorage.removeItem(AUTH_STORAGE_KEY);
        setError('Invalid admin key. Please try again.');
        setOrders([]);
        return;
      }

      const popupOrders: UnifiedOrder[] = (popupRes.status === 'fulfilled' && popupRes.value.orders || []).map((o: Record<string, unknown>) => ({ ...o, source: 'popup' as const }));
      const onlineOrders: UnifiedOrder[] = (onlineRes.status === 'fulfilled' && onlineRes.value.orders || []).map((o: Record<string, unknown>) => ({ ...o, source: 'online' as const }));
      const merged = [...popupOrders, ...onlineOrders];

      setOrders(merged);
      const nextIds = new Set<string>(merged.map(o => o.id));
      if (isInitialLoad) {
        prevOrderIdsRef.current = nextIds;
        const drafts: Record<string, string> = {};
        popupOrders.forEach(o => { drafts[o.id] = o.pickupStatus || ''; });
        setPickupDrafts(drafts);
      } else {
        if (prevOrderIdsRef.current.size > 0) {
          const newIds = [...nextIds].filter(id => !prevOrderIdsRef.current.has(id));
          if (newIds.length > 0) { setNewOrderCount(newIds.length); playChime(); setTimeout(() => setNewOrderCount(0), 10_000); }
        }
        prevOrderIdsRef.current = nextIds;
        setPickupDrafts(prev => {
          const updated = { ...prev };
          popupOrders.forEach(o => { if (!(o.id in updated)) updated[o.id] = o.pickupStatus || ''; if (o.pickupStatus === 'Picked Up') updated[o.id] = 'Picked Up'; });
          return updated;
        });
      }
    } catch {
      if (isInitialLoad) setError('Failed to load orders.');
    } finally {
      if (isInitialLoad) setLoading(false);
    }
  }, [key, playChime]);

  useEffect(() => { fetchOrders(true); }, [fetchOrders]);

  useEffect(() => {
    if (!key) return;
    const interval = setInterval(() => { if (savingOrderId || creatingLabelId || markingPaidId) return; fetchOrders(false); }, 120_000);
    return () => clearInterval(interval);
  }, [key, fetchOrders, savingOrderId, creatingLabelId, markingPaidId]);

  // --- Handlers ---
  const apiUrl = (order: UnifiedOrder) => order.source === 'popup' ? '/api/popup-orders' : '/api/orders';

  const saveStatus = async (order: UnifiedOrder, newStatus: string) => {
    if (!key || !newStatus) return;
    if (order.source === 'popup' && newStatus.toLowerCase() === 'done') {
      if ((order.paymentStatus || 'Awaiting Payment').toLowerCase() !== 'paid') {
        setError('Cannot mark as Done — payment is still pending. Mark as Paid first.');
        return;
      }
    }
    setSavingOrderId(order.id);
    try {
      const res = await fetch(apiUrl(order), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-popup-admin-key': key },
        body: JSON.stringify({ id: order.id, status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to update order status.'); return; }
      setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: newStatus, pickupStatus: newStatus.toLowerCase() === 'done' && order.source === 'popup' && (order.orderType || '').toLowerCase().includes('pickup') ? 'Ready for Pickup' : o.pickupStatus } : o));
    } catch { setError('Failed to update order status.'); } finally { setSavingOrderId(null); }
  };

  const markPickedUp = async (order: UnifiedOrder) => {
    if (!key) return;
    setSavingOrderId(order.id);
    try {
      const res = await fetch('/api/popup-orders', { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'x-popup-admin-key': key }, body: JSON.stringify({ id: order.id, pickupStatus: 'Picked Up' }) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to update pickup status.'); return; }
      setPickupDrafts(prev => ({ ...prev, [order.id]: 'Picked Up' }));
      setOrders(prev => prev.map(o => o.id === order.id ? { ...o, pickupStatus: 'Picked Up' } : o));
    } catch { setError('Failed to update pickup status.'); } finally { setSavingOrderId(null); }
  };

  const markAsPaid = async (order: UnifiedOrder) => {
    if (!key) return;
    setMarkingPaidId(order.id);
    try {
      const res = await fetch('/api/popup-orders', { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'x-popup-admin-key': key }, body: JSON.stringify({ id: order.id, paymentStatus: 'Paid' }) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to mark as paid.'); return; }
      setOrders(prev => prev.map(o => o.id === order.id ? { ...o, paymentStatus: 'Paid' } : o));
    } catch { setError('Failed to mark as paid.'); } finally { setMarkingPaidId(null); }
  };

  const createLabel = async (order: UnifiedOrder) => {
    if (!key) return;
    setCreatingLabelId(order.id);
    try {
      const body = order.source === 'popup' ? { orderId: order.id, source: 'popup' } : { orderId: order.id };
      const res = await fetch('/api/shipping-label', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-popup-admin-key': key }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to create shipping label.'); return; }
      setOrders(prev => prev.map(o => o.id === order.id ? { ...o, trackingNumber: data.trackingNumber, labelUrl: data.labelUrl, status: order.source === 'popup' ? 'Ready to Ship' : 'Shipped' } : o));
    } catch { setError('Failed to create shipping label.'); } finally { setCreatingLabelId(null); }
  };

  const startEdit = (order: UnifiedOrder) => {
    setEditingOrderId(order.id);
    if (order.source === 'popup') {
      setEditFields({ customerName: order.customerName || '', email: order.email || '', phoneNumber: order.phoneNumber || '', address: order.address || '', text: order.text || '' });
    } else {
      setEditFields({ customerName: order.customerName || '', email: order.email || '', address: order.address || '', items: order.items || '' });
    }
  };

  const cancelEdit = () => { setEditingOrderId(null); setEditFields({}); };

  const saveEdit = async (order: UnifiedOrder) => {
    if (!key) return;
    try {
      const res = await fetch(apiUrl(order), { method: 'PUT', headers: { 'Content-Type': 'application/json', 'x-popup-admin-key': key }, body: JSON.stringify({ id: order.id, ...editFields }) });
      if (!res.ok) { const data = await res.json(); setError(data.error || 'Failed to update order.'); return; }
      setOrders(prev => prev.map(o => o.id === order.id ? { ...o, ...editFields } : o));
      setEditingOrderId(null);
    } catch { setError('Failed to update order.'); }
  };

  const deleteOrder = async (order: UnifiedOrder) => {
    if (!key || !confirm('Are you sure you want to delete this order? This cannot be undone.')) return;
    try {
      const res = await fetch(apiUrl(order), { method: 'DELETE', headers: { 'Content-Type': 'application/json', 'x-popup-admin-key': key }, body: JSON.stringify({ id: order.id }) });
      if (!res.ok) { const data = await res.json(); setError(data.error || 'Failed to delete order.'); return; }
      setOrders(prev => prev.filter(o => o.id !== order.id));
    } catch { setError('Failed to delete order.'); }
  };

  // --- Filtering ---
  const filteredOrders = useMemo(() => {
    const q = orderFilter.trim().toLowerCase();
    let filtered = orders;

    if (sourceFilter !== 'all') filtered = filtered.filter(o => o.source === sourceFilter);

    if (q) {
      filtered = filtered.filter(o =>
        (o.customerName || '').toLowerCase().includes(q) ||
        (o.email || '').toLowerCase().includes(q) ||
        (o.orderNumber || '').toLowerCase().includes(q) ||
        (o.text || '').toLowerCase().includes(q) ||
        (o.items || '').toLowerCase().includes(q) ||
        (o.address || '').toLowerCase().includes(q)
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(o => (o.status || '').toLowerCase() === statusFilter);
    }

    if (paymentFilter !== 'all') {
      filtered = filtered.filter(o => {
        if (o.source !== 'popup') return paymentFilter === 'paid'; // online orders are always paid via Stripe
        const paid = (o.paymentStatus || '').toLowerCase() === 'paid';
        return paymentFilter === 'paid' ? paid : !paid;
      });
    }

    return [...filtered].sort((a, b) => {
      const aDone = isCompletedOrder(a) ? 1 : 0;
      const bDone = isCompletedOrder(b) ? 1 : 0;
      return aDone - bDone;
    });
  }, [orders, orderFilter, sourceFilter, statusFilter, paymentFilter]);

  // --- Auth prompt ---
  if (!key) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <form onSubmit={handleKeySubmit} className="w-full max-w-sm space-y-4">
          <h1 className="text-2xl font-bold gradient-text text-center">Admin Login</h1>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder="Enter admin key"
              autoFocus
              className="w-full px-4 py-3 pr-12 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200 transition-colors"
              tabIndex={-1}
            >
              {showPassword ? (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12c1.292 4.338 5.31 7.5 10.066 7.5.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                </svg>
              )}
            </button>
          </div>
          <button type="submit" className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-semibold rounded-lg transition-all">
            Sign In
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className={`min-h-screen py-8 px-4 transition-colors duration-200 ${light ? 'orders-light' : ''}`}>
      <style jsx global>{`
        /* --- Light mode base --- */
        .orders-light { background: #f3f4f6 !important; color: #1e293b; }
        .orders-light .gradient-text { background: linear-gradient(135deg, #c026d3, #9333ea, #6366f1); -webkit-background-clip: text; background-clip: text; }

        /* --- Card & section backgrounds --- */
        .orders-light .bg-gray-950 { background: #ffffff !important; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .orders-light .bg-gray-900 { background: #ffffff !important; }
        .orders-light .bg-gray-900\/50 { background: #f9fafb !important; }
        .orders-light .bg-black\/40 { background: #f1f5f9 !important; }
        .orders-light .bg-gray-800 { background: #e5e7eb !important; }
        .orders-light .bg-gray-950\/95 { background: rgba(255,255,255,0.97) !important; }

        /* --- Borders --- */
        .orders-light .border-gray-800 { border-color: #d1d5db !important; }
        .orders-light .border-gray-700 { border-color: #d1d5db !important; }
        .orders-light .border-gray-600 { border-color: #d1d5db !important; }
        .orders-light .border-purple-700 { border-color: #c084fc !important; }
        .orders-light .border-purple-500 { border-color: #a855f7 !important; }

        /* --- Text colors --- */
        .orders-light .text-white { color: #111827 !important; }
        .orders-light .text-gray-300 { color: #374151 !important; }
        .orders-light .text-gray-400 { color: #6b7280 !important; }
        .orders-light .text-gray-500 { color: #6b7280 !important; }
        .orders-light .text-gray-600 { color: #4b5563 !important; }
        .orders-light .text-red-300 { color: #dc2626 !important; }
        .orders-light .text-red-400 { color: #dc2626 !important; }
        .orders-light .text-green-400 { color: #16a34a !important; }
        .orders-light .text-green-200 { color: #ffffff !important; }
        .orders-light .text-purple-200 { color: #ffffff !important; }
        .orders-light .text-purple-300 { color: #7c3aed !important; }
        .orders-light .text-purple-400 { color: #7c3aed !important; }
        .orders-light .text-blue-300 { color: #2563eb !important; }
        .orders-light .text-blue-400 { color: #2563eb !important; }
        .orders-light .text-cyan-400 { color: #0891b2 !important; }
        .orders-light .text-yellow-400 { color: #ca8a04 !important; }
        .orders-light .text-pink-300 { color: #db2777 !important; }

        /* --- Badge backgrounds --- */
        .orders-light .bg-purple-900\/50 { background: #f3e8ff !important; }
        .orders-light .border-purple-600\/40 { border-color: #c084fc !important; }
        .orders-light .bg-blue-900\/50 { background: #dbeafe !important; }
        .orders-light .border-blue-600\/40 { border-color: #93c5fd !important; }
        .orders-light .bg-green-900\/50 { background: #dcfce7 !important; }
        .orders-light .border-green-600\/40 { border-color: #86efac !important; }
        .orders-light .bg-green-900\/40 { background: #dcfce7 !important; }
        .orders-light .border-green-700\/40 { border-color: #86efac !important; }
        .orders-light .bg-red-900\/50 { background: #fef2f2 !important; }
        .orders-light .border-red-600\/40 { border-color: #fca5a5 !important; }
        .orders-light .bg-yellow-900\/50 { background: #fefce8 !important; }
        .orders-light .border-yellow-600\/40 { border-color: #fde68a !important; }
        .orders-light .bg-cyan-950\/30 { background: #ecfeff !important; }
        .orders-light .border-cyan-800\/40 { border-color: #a5f3fc !important; }
        .orders-light .bg-pink-900\/50 { background: #fce7f3 !important; }
        .orders-light .border-pink-600\/40 { border-color: #f9a8d4 !important; }

        /* --- Solid colored buttons --- */
        .orders-light .bg-green-800 { background: #16a34a !important; }
        .orders-light .bg-green-700 { background: #15803d !important; }
        .orders-light .bg-green-600 { background: #16a34a !important; }
        .orders-light .bg-purple-800 { background: #7c3aed !important; }
        .orders-light .bg-purple-700 { background: #7c3aed !important; }
        .orders-light .bg-purple-600 { background: #9333ea !important; }
        .orders-light .border-green-600 { border-color: #16a34a !important; }
        .orders-light .border-purple-600 { border-color: #7c3aed !important; }

        /* --- Hover states --- */
        .orders-light .hover\:bg-gray-700:hover { background: #d1d5db !important; }
        .orders-light .hover\:bg-gray-300:hover { background: #d1d5db !important; }
        .orders-light .hover\:text-white:hover { color: #111827 !important; }
        .orders-light .hover\:border-gray-500:hover { border-color: #9ca3af !important; }
        .orders-light .hover\:border-emerald-500:hover { border-color: #10b981 !important; }
        .orders-light .hover\:bg-red-900\/50:hover { background: #fef2f2 !important; }
        .orders-light .hover\:text-red-300:hover { color: #dc2626 !important; }
        .orders-light .hover\:border-red-600:hover { border-color: #dc2626 !important; }
        .orders-light .hover\:bg-purple-700:hover { background: #6d28d9 !important; }
        .orders-light .hover\:bg-purple-600:hover { background: #7c3aed !important; }
        .orders-light .hover\:bg-purple-500:hover { background: #8b5cf6 !important; }
        .orders-light .hover\:bg-green-700:hover { background: #15803d !important; }
        .orders-light .hover\:bg-green-600:hover { background: #16a34a !important; }

        /* --- Ring / focus --- */
        .orders-light .ring-purple-500\/40 { --tw-ring-color: rgba(168,85,247,0.3) !important; }
        .orders-light .focus\:border-purple-500:focus { border-color: #a855f7 !important; }

        /* --- Inputs / form elements --- */
        .orders-light input[type="checkbox"] { background: #f3f4f6 !important; border-color: #d1d5db !important; }
        .orders-light input[type="text"],
        .orders-light input.bg-gray-900,
        .orders-light input.border-gray-700 { background: #f9fafb !important; color: #111827 !important; border-color: #d1d5db !important; }
        .orders-light select { background: #f9fafb !important; color: #111827 !important; border-color: #d1d5db !important; }
      `}</style>
      <div className="max-w-6xl mx-auto space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl md:text-4xl font-bold gradient-text">
            Orders
            {newOrderCount > 0 && (
              <span className="ml-3 inline-flex items-center justify-center px-2.5 py-1 rounded-full text-sm font-bold bg-red-600 text-white animate-pulse">
                +{newOrderCount} new
              </span>
            )}
          </h1>
          <div className="flex gap-2">
            <button onClick={toggleTheme}
              className={`px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${light ? 'bg-gray-200 text-gray-800 hover:bg-gray-300' : 'bg-gray-800 hover:bg-gray-700 text-white'}`}>
              {light ? 'Dark' : 'Light'}
            </button>
            <Link href={`/scan?key=${encodeURIComponent(key)}`} className="px-4 py-2 rounded-lg bg-purple-700 hover:bg-purple-600 text-sm font-semibold text-white">Scanner</Link>
            <Link href={`/inventory?key=${encodeURIComponent(key)}`} className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm font-semibold text-white">Inventory</Link>
          </div>
        </div>

        {loading && <p className="text-gray-400">Loading orders...</p>}
        {error && <p className="text-red-300">{error}</p>}
        {!loading && orders.length === 0 && <p className="text-gray-400">No orders yet.</p>}

        {!loading && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="text"
                value={orderFilter}
                onChange={(e) => setOrderFilter(e.target.value)}
                placeholder="Find by name, email, order #, letters..."
                className="w-full max-w-md px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-purple-500"
              />
            </div>

            {/* Source filter */}
            <div className="flex flex-wrap gap-2">
              {([['all', 'All'], ['popup', 'Pop-Up'], ['online', 'Online']] as const).map(([value, label]) => (
                <button key={value} type="button" onClick={() => setSourceFilter(value)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors ${sourceFilter === value ? 'bg-purple-600 text-white border border-purple-500' : 'bg-gray-800 text-gray-400 border border-gray-700 hover:text-white hover:border-gray-500'}`}
                >{label}</button>
              ))}

              <div className="w-px bg-gray-700 mx-1" />

              {/* Status filter */}
              {([['all', 'All'], ['not started', 'Not Started'], ['in progress', 'In Progress'], ['done', 'Done'], ['ready to ship', 'Ready to Ship'], ['shipped', 'Shipped'], ['delivered', 'Delivered']] as const).map(([value, label]) => (
                <button key={value} type="button" onClick={() => setStatusFilter(value)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors ${statusFilter === value ? 'bg-purple-600 text-white border border-purple-500' : 'bg-gray-800 text-gray-400 border border-gray-700 hover:text-white hover:border-gray-500'}`}
                >{label}</button>
              ))}
            </div>

            {/* Payment filter (popup) */}
            {(sourceFilter === 'all' || sourceFilter === 'popup') && (
              <div className="flex rounded-lg border border-gray-700 overflow-hidden w-fit">
                {([['all', 'All'], ['awaiting', 'Unpaid'], ['paid', 'Paid']] as const).map(([value, label]) => (
                  <button key={value} type="button" onClick={() => setPaymentFilter(value)}
                    className={`px-3 py-2 text-xs font-semibold transition-colors ${paymentFilter === value ? 'bg-purple-600 text-white' : 'bg-gray-900 text-gray-400 hover:text-white'}`}
                  >{label}</button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filteredOrders.map((order) => {
          const oText = getOrderText(order);
          const ids = order.boardIds || [];
          const nonSpaceCount = oText.split('').filter(c => c !== ' ').length;
          const scannedCount = ids.filter(b => b != null).length;
          const allScanned = scannedCount >= nonSpaceCount && nonSpaceCount > 0;
          const isPickup = order.source === 'popup' && (order.orderType || '').toLowerCase().includes('pickup');
          const statusOptions = isPickup ? PICKUP_STATUSES : SHIP_STATUSES;
          const colorLines = order.source === 'popup' ? getColorLines(order) : getOnlineColorLines(order);

          return (
            <div key={order.id} className={`rounded-2xl border ${slipSelectedIds.has(order.id) ? 'border-purple-500 ring-1 ring-purple-500/40' : 'border-gray-800'} bg-gray-950 p-5 space-y-3`}>
              {/* Header */}
              <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                <div className="flex items-start gap-3">
                  <input type="checkbox" checked={slipSelectedIds.has(order.id)} onChange={() => toggleSlipSelection(order)}
                    className="mt-2 w-4 h-4 rounded border-gray-600 bg-gray-800 text-purple-500 focus:ring-purple-500 shrink-0 cursor-pointer" />
                  <div>
                    <div className="flex items-center gap-3 flex-wrap">
                      {order.source === 'popup' && <p className="text-3xl font-black text-white">{order.orderNumber || '--'}</p>}
                      {order.source === 'online' && <p className="text-xl font-bold text-white">{order.customerName || 'Unknown Customer'}</p>}
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${order.source === 'popup' ? 'bg-purple-900/50 text-purple-300 border border-purple-600/40' : 'bg-blue-900/50 text-blue-300 border border-blue-600/40'}`}>
                        {order.source === 'popup' ? 'Pop-Up' : 'Online'}
                      </span>
                      {order.onSiteEligible === true && <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-green-900/50 text-green-400 border border-green-600/40">On-Site Eligible</span>}
                      {order.onSiteEligible === false && <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-red-900/50 text-red-400 border border-red-600/40">Not Available On-Site</span>}
                      {scannedCount > 0 && scannedCount >= nonSpaceCount && <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-green-900/50 text-green-400 border border-green-600/40">PCBs ✓</span>}
                      {scannedCount > 0 && scannedCount < nonSpaceCount && <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-900/50 text-blue-400 border border-blue-600/40">PCBs {scannedCount}/{nonSpaceCount}</span>}
                      {order.gift === 'Yes' && <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-pink-900/50 text-pink-300 border border-pink-600/40">Gift</span>}
                    </div>
                    {order.source === 'popup' && <p className="text-xs text-gray-500">Order Number</p>}
                    {order.date && order.source === 'online' && <p className="text-xs text-gray-500">{order.date}</p>}
                  </div>
                </div>
                <div className="text-right">
                  {order.source === 'popup' && order.total !== undefined && (
                    <>
                      <p className="text-2xl font-bold text-green-400">${Number(order.total).toFixed(2)}</p>
                      <p className="text-xs text-gray-500 mb-1">Amount to Charge</p>
                    </>
                  )}
                  {order.source === 'online' && order.total && (
                    <>
                      <p className="text-2xl font-bold text-green-400">{order.total}</p>
                      {order.date && <p className="text-xs text-gray-500">{order.date}</p>}
                    </>
                  )}
                  {order.source === 'popup' && (
                    (order.paymentStatus || 'Awaiting Payment').toLowerCase() === 'paid'
                      ? <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-green-900/50 text-green-400 border border-green-600/40">Paid</span>
                      : <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-yellow-900/50 text-yellow-400 border border-yellow-600/40">Awaiting Payment</span>
                  )}
                </div>
              </div>

              {/* Edit form or details */}
              {editingOrderId === order.id ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  {order.source === 'popup' && <label className="flex flex-col gap-1"><span className="text-gray-400">Custom Letters:</span><input className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-white text-sm" value={editFields.text || ''} onChange={(e) => setEditFields(f => ({ ...f, text: e.target.value }))} /></label>}
                  <label className="flex flex-col gap-1"><span className="text-gray-400">Customer Name:</span><input className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-white text-sm" value={editFields.customerName || ''} onChange={(e) => setEditFields(f => ({ ...f, customerName: e.target.value }))} /></label>
                  <label className="flex flex-col gap-1"><span className="text-gray-400">Email:</span><input className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-white text-sm" value={editFields.email || ''} onChange={(e) => setEditFields(f => ({ ...f, email: e.target.value }))} /></label>
                  {order.source === 'popup' && <label className="flex flex-col gap-1"><span className="text-gray-400">Phone:</span><input className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-white text-sm" value={editFields.phoneNumber || ''} onChange={(e) => setEditFields(f => ({ ...f, phoneNumber: e.target.value }))} /></label>}
                  <label className="flex flex-col gap-1 md:col-span-2"><span className="text-gray-400">Address:</span><input className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-white text-sm" value={editFields.address || ''} onChange={(e) => setEditFields(f => ({ ...f, address: e.target.value }))} /></label>
                  {order.source === 'online' && <label className="flex flex-col gap-1 md:col-span-2"><span className="text-gray-400">Items:</span><input className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-white text-sm" value={editFields.items || ''} onChange={(e) => setEditFields(f => ({ ...f, items: e.target.value }))} /></label>}
                  <div className="md:col-span-2 flex gap-2 mt-1">
                    <button onClick={() => saveEdit(order)} className="px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-500 text-white text-xs font-semibold">Save</button>
                    <button onClick={cancelEdit} className="px-3 py-1.5 rounded-lg border border-gray-600 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold">Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  {order.source === 'popup' && <p><span className="text-gray-400">Custom Letters:</span> <span className="font-bold text-white">{order.text}</span></p>}
                  {order.source === 'popup' && <p><span className="text-gray-400">Customer Name:</span> {order.customerName}</p>}
                  <p><span className="text-gray-400">Email:</span> {order.email || '-'}</p>
                  {order.source === 'popup' && <p><span className="text-gray-400">Phone:</span> {order.phoneNumber || '-'}</p>}
                  <p><span className="text-gray-400">Delivery:</span> {isPickup ? 'Pick Up' : 'Ship to Me'}</p>
                  <p><span className="text-gray-400">Address:</span> {order.address || '-'}</p>
                  {order.source === 'online' && <p><span className="text-gray-400">Shipping:</span> {order.shippingMethod} {order.shippingCost && <span className="text-gray-500">({order.shippingCost})</span>}</p>}
                  {order.gift === 'Yes' && order.giftRecipient && <p><span className="text-gray-400">Gift For:</span> <span className="text-pink-300">{order.giftRecipient}</span></p>}
                  {order.gift === 'Yes' && order.giftNote && <p className="md:col-span-2"><span className="text-gray-400">Gift Note:</span> <span className="text-pink-300 italic">&ldquo;{order.giftNote}&rdquo;</span></p>}
                </div>
              )}

              {/* Popup pricing breakdown */}
              {order.source === 'popup' && order.subtotal !== undefined && (
                <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-3 text-sm space-y-1">
                  <div className="flex justify-between"><span className="text-gray-400">Letters ({order.letterCount || 0}):</span><span className="text-white font-medium">${((order.subtotal || 0) + (order.discount || 0) - (order.customColorFee || 0)).toFixed(2)}</span></div>
                  {(order.customColorFee || 0) > 0 && <div className="flex justify-between"><span className="text-gray-400">Custom Color Fee:</span><span className="text-white font-medium">${order.customColorFee!.toFixed(2)}</span></div>}
                  {(order.discount || 0) > 0 && <div className="flex justify-between"><span className="text-green-400">Discount (10%):</span><span className="text-green-400 font-medium">-${order.discount!.toFixed(2)}</span></div>}
                  {(order.shippingFee || 0) > 0 && <div className="flex justify-between"><span className="text-gray-400">Shipping:</span><span className="text-white font-medium">${order.shippingFee!.toFixed(2)}</span></div>}
                  <div className="flex justify-between"><span className="text-gray-400">Tax:</span><span className="text-white font-medium">${(order.tax || 0).toFixed(2)}</span></div>
                  <div className="flex justify-between pt-2 border-t border-gray-700 font-bold"><span className="text-white">Total:</span><span className="text-green-400">${Number(order.total)?.toFixed(2) || '0.00'}</span></div>
                </div>
              )}

              {/* Online items */}
              {order.source === 'online' && (
                <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-3 text-sm space-y-1">
                  <p className="text-gray-400 text-xs font-medium mb-1">Items</p>
                  {order.items ? order.items.split(' | ').map((item, idx) => <p key={idx} className="text-gray-300">{item}</p>)
                    : order.lineItems ? order.lineItems.split(' | ').map((item, idx) => <p key={idx} className="text-gray-300">{item}</p>)
                    : <p className="text-gray-500">No items</p>}
                </div>
              )}

              {/* Popup payment action */}
              {order.source === 'popup' && (order.paymentStatus || 'Awaiting Payment').toLowerCase() !== 'paid' && (
                <div className="flex flex-wrap items-center gap-2">
                  {order.paymentMethod && <span className="text-xs text-gray-500">{order.paymentMethod}</span>}
                  <button type="button" onClick={() => markAsPaid(order)} disabled={markingPaidId === order.id}
                    className="px-3 py-1.5 rounded-full text-xs font-semibold bg-green-800 text-green-200 border border-green-600 hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ml-auto">
                    {markingPaidId === order.id ? 'Saving...' : 'Mark as Paid'}
                  </button>
                </div>
              )}

              {/* Status buttons */}
              <div className="flex flex-wrap items-center gap-2">
                {(() => {
                  const currentStatus = (order.status || 'Not Started').toLowerCase();
                  const isLocked = LOCKED_STATUSES.includes(currentStatus);
                  const isCompleted = order.source === 'popup' && (pickupDrafts[order.id] || order.pickupStatus) === 'Picked Up';
                  return statusOptions.map(opt => {
                    const isActive = opt.toLowerCase() === currentStatus;
                    const isSaving = savingOrderId === order.id;
                    return (
                      <button key={opt} type="button"
                        onClick={() => !isActive && !isLocked && saveStatus(order, opt)}
                        disabled={isSaving || isCompleted || (isLocked && !isActive)}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors ${isActive ? getStatusPillClasses(opt) : 'bg-gray-800 text-gray-500 border border-gray-700 hover:text-white hover:border-gray-500'} ${(isSaving || isCompleted || (isLocked && !isActive)) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                      >{isSaving && isActive ? 'Saving...' : opt}</button>
                    );
                  });
                })()}
                {isPickup && (
                  <button type="button" onClick={() => markPickedUp(order)}
                    disabled={savingOrderId === order.id || (pickupDrafts[order.id] || order.pickupStatus) === 'Picked Up'}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-semibold ml-auto transition-colors ${(pickupDrafts[order.id] || order.pickupStatus) === 'Picked Up' ? getStatusPillClasses('Picked Up') : 'bg-gray-800 text-gray-500 border border-gray-700 hover:text-white hover:border-emerald-500'} ${savingOrderId === order.id ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  >{(pickupDrafts[order.id] || order.pickupStatus) === 'Picked Up' ? 'Picked Up' : 'Mark Picked Up'}</button>
                )}
              </div>

              {/* PCB Scanning */}
              {oText && (
                <div className="flex flex-wrap items-center gap-2">
                  {allScanned ? (
                    <span className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-green-900/50 text-green-400 border border-green-600/40 opacity-60 cursor-not-allowed">PCBs Scanned ✓</span>
                  ) : (
                    <Link href={`/scan?key=${encodeURIComponent(key)}&order=${encodeURIComponent(order.id)}${order.source === 'online' ? '&source=online' : ''}`}
                      className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-purple-800 text-purple-200 border border-purple-600 hover:bg-purple-700 transition-colors">
                      {scannedCount > 0 ? `Scan PCBs (${scannedCount}/${nonSpaceCount})` : 'Scan PCBs'}
                    </Link>
                  )}
                  {scannedCount > 0 && (
                    <>
                      <div className="flex flex-wrap gap-1.5">
                        {oText.split('').map((ch, i) => {
                          if (ch === ' ') return order.source === 'online' ? <div key={i} className="w-1.5" /> : null;
                          const bid = ids[i];
                          return (
                            <span key={i}
                              className={`px-2 py-0.5 rounded text-xs font-mono select-none ${bid ? 'bg-green-900/40 text-green-400 border border-green-700/40' : 'bg-gray-800 text-gray-500 border border-gray-700'}`}
                              onTouchStart={() => { if (!bid) return; longPressTimerRef.current = setTimeout(() => { longPressTimerRef.current = null; window.location.href = `/scan?key=${encodeURIComponent(key)}&order=${encodeURIComponent(order.id)}&letter=${i}${order.source === 'online' ? '&source=online' : ''}`; }, 600); }}
                              onTouchEnd={() => { if (longPressTimerRef.current) { clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null; } }}
                              onTouchCancel={() => { if (longPressTimerRef.current) { clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null; } }}
                              onContextMenu={(e) => { if (bid) e.preventDefault(); }}
                            >{ch.toUpperCase()}{bid ? ` ${bid}` : ''}</span>
                          );
                        })}
                      </div>
                      <span className="text-xs text-gray-600 italic">Hold to replace</span>
                    </>
                  )}
                </div>
              )}

              {/* Shipping label */}
              {!isPickup && (
                order.trackingNumber ? (
                  <div className="flex flex-wrap items-center gap-3 bg-cyan-950/30 border border-cyan-800/40 rounded-lg px-3 py-2 text-sm">
                    <span className="text-gray-400">Tracking:</span>
                    <span className="text-white font-mono">{order.trackingNumber}</span>
                    {order.labelUrl && <a href={order.labelUrl} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:text-cyan-300 underline text-xs">Download Label (PDF)</a>}
                  </div>
                ) : (
                  order.address && (order.status || '').toLowerCase() === 'ready to ship' && (
                    <button type="button" onClick={() => createLabel(order)} disabled={creatingLabelId === order.id}
                      className="px-4 py-2 rounded-lg bg-cyan-700 hover:bg-cyan-600 text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed">
                      {creatingLabelId === order.id ? 'Creating Label...' : 'Create Shipping Label'}
                    </button>
                  )
                )
              )}

              {(order.status || '').toLowerCase() === 'shipped' && (
                <button type="button" onClick={() => saveStatus(order, 'Delivered')} disabled={savingOrderId === order.id}
                  className="px-4 py-2 rounded-lg bg-green-700 hover:bg-green-600 text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed">
                  {savingOrderId === order.id ? 'Updating...' : 'Mark as Delivered'}
                </button>
              )}

              {/* Color lines */}
              {colorLines.length > 0 && (
                <div className="space-y-2 text-sm">
                  <p className="text-gray-300">Colors by letter</p>
                  <div className="rounded-lg bg-black/40 border border-gray-800 p-3 text-xs text-gray-300 space-y-1">
                    {colorLines.map((item, idx) => <p key={idx}>{item.displayText}</p>)}
                  </div>
                </div>
              )}

              {/* Bottom actions */}
              <div className="flex items-center gap-2">
                <a href={`/packing-label?id=${encodeURIComponent(order.id)}&source=${order.source === 'popup' ? 'popup' : 'online'}&key=${encodeURIComponent(key)}`} target="_blank" rel="noopener noreferrer"
                  className="inline-block px-4 py-2 rounded-lg bg-gray-800 text-gray-300 border border-gray-600 hover:bg-gray-700 hover:text-white text-xs font-semibold transition-colors">
                  Print Packing Slip
                </a>
                <a href={`/packing-label?id=${encodeURIComponent(order.id)}&source=${order.source === 'popup' ? 'popup' : 'online'}&key=${encodeURIComponent(key)}&mode=view`} target="_blank" rel="noopener noreferrer"
                  className="inline-block px-4 py-2 rounded-lg bg-gray-800 text-gray-300 border border-gray-600 hover:bg-gray-700 hover:text-white text-xs font-semibold transition-colors">
                  View Packing Slip
                </a>
                {editingOrderId !== order.id && (
                  <>
                    <button type="button" onClick={() => startEdit(order)} className="px-3 py-2 rounded-lg bg-gray-800 text-gray-300 border border-gray-600 hover:bg-gray-700 hover:text-white text-xs font-semibold transition-colors">Edit</button>
                    <button type="button" onClick={() => deleteOrder(order)} className="px-3 py-2 rounded-lg bg-gray-800 text-red-400 border border-gray-600 hover:bg-red-900/50 hover:text-red-300 hover:border-red-600 text-xs font-semibold transition-colors">Delete</button>
                  </>
                )}
                {order.source === 'online' && order.stripeSessionId && <p className="text-xs text-gray-600 font-mono ml-auto">{order.stripeSessionId}</p>}
              </div>
            </div>
          );
        })}
        </div>
      </div>

      {/* Combined packing slip floating bar */}
      {slipSelection.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-gray-950/95 border-t border-purple-700 backdrop-blur-sm px-4 py-3">
          <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
            <p className="text-sm text-gray-300"><span className="font-bold text-purple-400">{slipSelection.length}</span> order{slipSelection.length !== 1 ? 's' : ''} selected for packing slip</p>
            <div className="flex items-center gap-2">
              <button onClick={clearSlipSelection} className="px-3 py-1.5 rounded-lg border border-gray-600 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold transition-colors">Clear</button>
              <a href={`/packing-label?orders=${encodeURIComponent(slipSelection.map(s => `${s.source}:${s.id}`).join(','))}&key=${encodeURIComponent(key)}`} target="_blank" rel="noopener noreferrer"
                className="px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold transition-colors">
                Create Combined Packing Slip
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
