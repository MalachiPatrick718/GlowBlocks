'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Html5Qrcode } from 'html5-qrcode';

interface OrderData {
  id: string;
  text: string;
  customerName: string;
  orderNumber?: string;
  boardIds: (string | null)[];
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
  const orderId = searchParams.get('order') || '';
  const letterParam = searchParams.get('letter');
  const replaceIndex = letterParam != null && !isNaN(parseInt(letterParam, 10)) ? parseInt(letterParam, 10) : null;

  const [order, setOrder] = useState<OrderData | null>(null);
  const [boardIds, setBoardIds] = useState<(string | null)[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [allDone, setAllDone] = useState(false);
  const [paused, setPaused] = useState(false);
  const [lastScanned, setLastScanned] = useState<string | null>(null);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerId = 'barcode-scanner';

  // Compute which letters need scanning (skip spaces)
  const letters = order?.text.split('') || [];
  const nonSpaceIndices = letters.reduce<number[]>((acc, ch, i) => {
    if (ch !== ' ') acc.push(i);
    return acc;
  }, []);
  const scannedCount = nonSpaceIndices.filter((i) => boardIds[i] != null).length;
  const totalNeeded = nonSpaceIndices.length;
  const nextUnscannedIndex = nonSpaceIndices.find((i) => boardIds[i] == null) ?? null;
  const targetIndex = replaceIndex != null ? replaceIndex : nextUnscannedIndex;

  // Fetch the specific order
  useEffect(() => {
    if (!key || !orderId) {
      setLoading(false);
      return;
    }
    const load = async () => {
      try {
        const res = await fetch('/api/popup-orders', {
          headers: { 'x-popup-admin-key': key },
          cache: 'no-store',
        });
        if (!res.ok) {
          setError('Failed to load order');
          return;
        }
        const data = await res.json();
        const found = (data.orders || []).find((o: { id: string }) => o.id === orderId);
        if (!found) {
          setError('Order not found');
          return;
        }
        const ids: (string | null)[] = Array.isArray(found.boardIds) ? found.boardIds : [];
        // Ensure array matches word length
        while (ids.length < (found.text || '').length) ids.push(null);
        setOrder({
          id: found.id,
          text: found.text || '',
          customerName: found.customerName || '',
          orderNumber: found.orderNumber || '',
          boardIds: ids,
        });
        setBoardIds(ids);

        // Auto-set to In Progress if not already
        const status = (found.status || '').toLowerCase();
        if (status === 'not started' || status === '') {
          fetch('/api/popup-orders', {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'x-popup-admin-key': key,
            },
            body: JSON.stringify({ id: found.id, status: 'In Progress' }),
          }).catch(() => {});
        }
      } catch {
        setError('Failed to load order');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [key, orderId]);

  const handleScan = useCallback(
    async (decodedText: string) => {
      if (!BOARD_ID_PATTERN.test(decodedText)) return;
      if (!order || saving || paused) return;

      // In replace mode, target specific letter; otherwise find next unscanned
      const idx = replaceIndex != null ? replaceIndex : nonSpaceIndices.find((i) => boardIds[i] == null);
      if (idx == null) return; // all done

      // Pause camera immediately so it stops scanning while we save
      try { scannerRef.current?.pause(); } catch { /* ok */ }
      setPaused(true);

      if (navigator.vibrate) navigator.vibrate(100);
      setSaving(true);
      setError(null);

      try {
        const res = await fetch('/api/popup-orders', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'x-popup-admin-key': key,
          },
          body: JSON.stringify({
            id: order.id,
            scanBoard: { letterIndex: idx, boardId: decodedText },
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || 'Failed to save scan');
          return;
        }
        // Update local state with returned boardIds
        const updated: (string | null)[] = Array.isArray(data.boardIds) ? data.boardIds : [...boardIds];
        updated[idx] = decodedText;
        setBoardIds(updated);
        setLastScanned(decodedText);

        // Check if all done
        if (replaceIndex != null) {
          setAllDone(true);
        } else {
          const nowScanned = nonSpaceIndices.filter((i) => updated[i] != null).length;
          if (nowScanned >= totalNeeded) {
            setAllDone(true);
          }
        }
      } catch {
        setError('Failed to save scan');
      } finally {
        setSaving(false);
      }
    },
    [order, boardIds, nonSpaceIndices, totalNeeded, key, saving, paused, replaceIndex]
  );

  const resumeScanning = useCallback(() => {
    setPaused(false);
    setLastScanned(null);
    setError(null);
    try { scannerRef.current?.resume(); } catch { /* ok */ }
  }, []);

  // Use ref so the scanner callback always calls the latest handleScan
  const handleScanRef = useRef(handleScan);
  handleScanRef.current = handleScan;

  // Start camera scanner
  useEffect(() => {
    if (!key || !orderId || loading || !order || allDone) return;

    const container = document.getElementById(scannerContainerId);
    if (!container) return;

    // Clean up any existing scanner
    if (scannerRef.current) {
      scannerRef.current.stop().catch(() => {});
    }

    const scanner = new Html5Qrcode(scannerContainerId);
    scannerRef.current = scanner;

    let processing = false;
    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          if (!processing) {
            processing = true;
            handleScanRef.current(decodedText).finally(() => {
              processing = false;
            });
          }
        },
        () => {}
      )
      .catch((err: unknown) => {
        console.error('Camera error:', err);
        setCameraError('Could not access camera. Please allow camera permissions and reload.');
      });

    return () => {
      scanner.stop().catch(() => {});
    };
    // Only re-run when order loads or allDone changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, orderId, loading, order?.id, allDone]);

  if (!key || !orderId) {
    return (
      <div className="min-h-screen py-8 px-4">
        <p className="text-red-300 text-center">
          Missing parameters. Open via the Scan PCBs button on an order.
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
          <h1 className="text-xl font-bold gradient-text">Scan PCBs</h1>
        </div>

        {loading && <p className="text-gray-400">Loading order...</p>}
        {error && (
          <div className="rounded-lg border border-red-600/40 bg-red-950/30 p-3">
            <p className="text-red-400 text-sm text-center">{error}</p>
          </div>
        )}

        {order && (
          <>
            {/* Order info + progress */}
            <div className="rounded-xl border border-gray-800 bg-gray-950/50 p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <span className="text-2xl font-black text-white">#{order.orderNumber}</span>
                  <span className="text-gray-400 ml-2">{order.customerName}</span>
                </div>
                <span className={`text-sm font-bold ${allDone ? 'text-green-400' : 'text-purple-400'}`}>
                  {scannedCount}/{totalNeeded}
                </span>
              </div>

              {/* Per-letter progress */}
              <div className="flex flex-wrap gap-2">
                {letters.map((ch, i) => {
                  if (ch === ' ') return <div key={i} className="w-3" />;
                  const bid = boardIds[i];
                  const isNext = i === targetIndex && !allDone;
                  const isReplaceTarget = replaceIndex != null && i === replaceIndex && !allDone;
                  return (
                    <div
                      key={i}
                      className={`flex flex-col items-center rounded-lg border px-3 py-2 min-w-[60px] transition-all ${
                        isReplaceTarget
                          ? 'border-amber-500 bg-amber-950/20 ring-1 ring-amber-500/50'
                          : bid
                            ? 'border-green-600/50 bg-green-950/30'
                            : isNext
                              ? 'border-purple-500 bg-purple-950/20 ring-1 ring-purple-500/50'
                              : 'border-gray-700 bg-gray-900'
                      }`}
                    >
                      <span className="text-lg font-bold text-white">{ch.toUpperCase()}</span>
                      {bid ? (
                        <span className="text-xs text-green-400 font-mono mt-0.5">{bid}</span>
                      ) : (
                        <span className="text-xs text-gray-600 mt-0.5">—</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Replace mode banner */}
            {replaceIndex != null && !allDone && (
              <div className="rounded-lg border border-amber-600/40 bg-amber-950/20 p-3 text-center">
                <p className="text-amber-400 text-sm font-semibold">
                  Replacing PCB for letter: {letters[replaceIndex]?.toUpperCase()}
                </p>
              </div>
            )}

            {/* Camera viewfinder */}
            {!allDone && (
              <>
                <div className="rounded-xl overflow-hidden border border-gray-800 bg-black relative">
                  <div id={scannerContainerId} className="w-full" style={{ minHeight: 280 }} />
                  {cameraError && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-4">
                      <p className="text-red-400 text-sm text-center">{cameraError}</p>
                    </div>
                  )}
                </div>

                {paused && !saving ? (
                  <div className="space-y-3">
                    {lastScanned && (
                      <div className="rounded-xl border border-green-600/40 bg-green-950/20 p-3 text-center">
                        <p className="text-green-400 font-semibold">
                          {lastScanned} assigned!
                        </p>
                      </div>
                    )}
                    {targetIndex != null && (
                      <button
                        onClick={resumeScanning}
                        className="w-full py-3 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-semibold text-lg transition-colors"
                      >
                        {replaceIndex != null ? `Retry: ${letters[targetIndex]?.toUpperCase()}` : `Scan Next: ${letters[targetIndex]?.toUpperCase()}`}
                      </button>
                    )}
                  </div>
                ) : (
                  targetIndex != null && (
                    <p className="text-center text-sm text-gray-400">
                      {saving ? (
                        <span className="text-purple-400">Saving...</span>
                      ) : replaceIndex != null ? (
                        <>Replacing PCB for: <span className="text-white font-bold">{letters[targetIndex]?.toUpperCase()}</span></>
                      ) : (
                        <>Scanning for: <span className="text-white font-bold">{letters[targetIndex]?.toUpperCase()}</span></>
                      )}
                    </p>
                  )
                )}
              </>
            )}

            {/* Completion state */}
            {allDone && (
              <div className="rounded-xl border border-green-600/50 bg-green-950/30 p-5 text-center space-y-2">
                <p className="text-green-400 text-lg font-bold">
                  {replaceIndex != null ? 'PCB replaced!' : 'All PCBs scanned!'}
                </p>
                <p className="text-sm text-gray-400">
                  {replaceIndex != null
                    ? <>{letters[replaceIndex]?.toUpperCase()} updated to {boardIds[replaceIndex]} on Order #{order.orderNumber}</>
                    : <>{totalNeeded} board{totalNeeded !== 1 ? 's' : ''} linked to Order #{order.orderNumber}</>
                  }
                </p>
              </div>
            )}

            {/* Done button */}
            <Link
              href={`/popup-orders?key=${encodeURIComponent(key)}`}
              className="block w-full py-3 rounded-lg border border-gray-700 bg-gray-800 hover:bg-gray-700 text-white font-semibold text-center transition-colors"
            >
              {allDone ? 'Done — Return to Orders' : 'Return to Orders'}
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
