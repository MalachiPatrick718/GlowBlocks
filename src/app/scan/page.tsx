'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Html5Qrcode } from 'html5-qrcode';

interface PopupOrder {
  id: string;
  text: string;
  customerName: string;
  orderNumber?: string;
  status?: string;
  boardId?: string | null;
}

const BOARD_ID_PATTERN = /^GB_\d{3}$/;

export default function ScanPage() {
  return (
    <Suspense>
      <ScanContent />
    </Suspense>
  );
}

function ScanContent() {
  const searchParams = useSearchParams();
  const key = searchParams.get('key') || '';

  const [phase, setPhase] = useState<'scanning' | 'linking' | 'confirming' | 'success' | 'error'>('scanning');
  const [scannedId, setScannedId] = useState<string | null>(null);
  const [orders, setOrders] = useState<PopupOrder[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<PopupOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerId = 'barcode-scanner';

  // Fetch in-progress orders
  const fetchOrders = useCallback(async () => {
    if (!key) return;
    try {
      const res = await fetch('/api/popup-orders', {
        headers: { 'x-popup-admin-key': key },
        cache: 'no-store',
      });
      if (!res.ok) return;
      const data = await res.json();
      const inProgress = (data.orders || []).filter(
        (o: PopupOrder) => o.status?.toLowerCase() === 'in progress' && !o.boardId
      );
      setOrders(inProgress);
    } catch {
      // Silently fail — orders will just be empty
    } finally {
      setLoading(false);
    }
  }, [key]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Start camera scanner
  useEffect(() => {
    if (!key) return;

    const container = document.getElementById(scannerContainerId);
    if (!container) return;

    const scanner = new Html5Qrcode(scannerContainerId);
    scannerRef.current = scanner;

    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          if (BOARD_ID_PATTERN.test(decodedText)) {
            scanner.pause();
            setScannedId(decodedText);
            setPhase('linking');
            setError(null);
            // Haptic feedback if available
            if (navigator.vibrate) navigator.vibrate(100);
          }
        },
        () => {
          // ignore scan failures (no code in frame)
        }
      )
      .catch((err: unknown) => {
        console.error('Camera error:', err);
        setCameraError('Could not access camera. Please allow camera permissions and reload.');
      });

    return () => {
      scanner
        .stop()
        .catch(() => {});
    };
  }, [key]);

  const resumeScanning = useCallback(() => {
    setScannedId(null);
    setSelectedOrder(null);
    setPhase('scanning');
    setError(null);
    try {
      scannerRef.current?.resume();
    } catch {
      // Scanner may already be running
    }
  }, []);

  const handleSelectOrder = (order: PopupOrder) => {
    setSelectedOrder(order);
    setPhase('confirming');
  };

  const handleConfirmLink = async () => {
    if (!selectedOrder || !scannedId || !key) return;
    setLinking(true);
    setError(null);
    try {
      const res = await fetch('/api/popup-orders', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-popup-admin-key': key,
        },
        body: JSON.stringify({
          id: selectedOrder.id,
          status: 'Done',
          boardId: scannedId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to link board');
        setPhase('linking');
        return;
      }
      // Remove linked order from list
      setOrders((prev) => prev.filter((o) => o.id !== selectedOrder.id));
      setPhase('success');
      // Auto-resume after 2s
      setTimeout(() => {
        resumeScanning();
      }, 2000);
    } catch {
      setError('Failed to link board');
      setPhase('linking');
    } finally {
      setLinking(false);
    }
  };

  if (!key) {
    return (
      <div className="min-h-screen py-8 px-4">
        <p className="text-red-300 text-center">
          Missing admin key. Open with <span className="font-mono">/scan?key=YOUR_KEY</span>
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-6 px-3 sm:px-4">
      <div className="max-w-lg mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Link
            href={`/popup-orders?key=${encodeURIComponent(key)}`}
            className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm font-medium text-white"
          >
            Back to Orders
          </Link>
          <h1 className="text-xl font-bold gradient-text">Scanner</h1>
        </div>

        {/* Camera viewfinder */}
        <div className="rounded-xl overflow-hidden border border-gray-800 bg-black relative">
          <div id={scannerContainerId} className="w-full" style={{ minHeight: 280 }} />
          {cameraError && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-4">
              <p className="text-red-400 text-sm text-center">{cameraError}</p>
            </div>
          )}
        </div>

        {/* Scanned ID display */}
        {scannedId && phase !== 'scanning' && (
          <div className={`rounded-xl border p-4 text-center transition-all duration-300 ${
            phase === 'success'
              ? 'border-green-600 bg-green-950/30'
              : 'border-purple-600 bg-purple-950/20'
          }`}>
            <p className="text-xs text-gray-400 mb-1">Scanned Board</p>
            <p className="text-3xl font-black tracking-wider text-white font-mono">{scannedId}</p>
            {phase === 'success' && (
              <p className="text-green-400 font-semibold mt-2">
                Linked to #{selectedOrder?.orderNumber} — SMS sent!
              </p>
            )}
          </div>
        )}

        {/* Error display */}
        {error && (
          <div className="rounded-lg border border-red-600/40 bg-red-950/30 p-3">
            <p className="text-red-400 text-sm text-center">{error}</p>
          </div>
        )}

        {/* Confirmation dialog */}
        {phase === 'confirming' && selectedOrder && (
          <div className="rounded-xl border border-amber-600/50 bg-amber-950/20 p-5 space-y-4">
            <p className="text-center text-white font-medium">
              Link <span className="font-mono font-bold">{scannedId}</span> to Order{' '}
              <span className="font-bold">#{selectedOrder.orderNumber}</span>{' '}
              <span className="text-gray-400">({selectedOrder.text})</span>?
            </p>
            <p className="text-xs text-gray-400 text-center">
              This will mark the order as Done and send a pickup SMS.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setPhase('linking')}
                className="py-3 rounded-lg border border-gray-700 bg-gray-900 text-gray-300 font-medium hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmLink}
                disabled={linking}
                className="py-3 rounded-lg bg-green-600 hover:bg-green-500 text-white font-semibold disabled:opacity-60"
              >
                {linking ? 'Linking...' : 'Confirm'}
              </button>
            </div>
          </div>
        )}

        {/* In-progress orders list */}
        {(phase === 'scanning' || phase === 'linking') && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">
              {phase === 'linking' ? 'Tap an order to link' : 'In-Progress Orders'}
              <span className="text-gray-600 ml-1">({orders.length})</span>
            </h2>

            {loading && <p className="text-gray-500 text-sm">Loading orders...</p>}

            {!loading && orders.length === 0 && (
              <p className="text-gray-500 text-sm">No in-progress orders without a board linked.</p>
            )}

            {orders.map((order) => (
              <button
                key={order.id}
                type="button"
                onClick={() => phase === 'linking' ? handleSelectOrder(order) : undefined}
                disabled={phase !== 'linking'}
                className={`w-full text-left rounded-xl border p-4 transition-all ${
                  phase === 'linking'
                    ? 'border-purple-600/50 bg-gray-900 hover:bg-purple-950/30 hover:border-purple-500 cursor-pointer active:scale-[0.98]'
                    : 'border-gray-800 bg-gray-950/50 cursor-default'
                }`}
                style={{ minHeight: 48 }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl font-black text-white">#{order.orderNumber}</span>
                    <span className="text-lg font-semibold text-purple-300 tracking-wide">{order.text}</span>
                  </div>
                  <span className="text-sm text-gray-500">{order.customerName}</span>
                </div>
              </button>
            ))}

            {phase === 'linking' && (
              <button
                onClick={resumeScanning}
                className="w-full py-2.5 rounded-lg border border-gray-700 bg-gray-900 text-gray-400 text-sm hover:text-white hover:bg-gray-800"
              >
                Scan a different board
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
