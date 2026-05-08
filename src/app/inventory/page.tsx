'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

const MAIN_ITEMS = ['P6 Bases', 'PCB'];
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const PCB_REORDER_THRESHOLD = 80;

// Print batch definitions — each batch is one 3D print plate
const BATCHES: { id: number; letters: Record<string, number> }[] = [
  { id: 1,  letters: { A: 2, E: 2, I: 1, L: 1, N: 1, O: 1, S: 1, R: 1 } },
  { id: 2,  letters: { A: 2, E: 2, I: 1, L: 1, N: 1, O: 1, S: 1, T: 1 } },
  { id: 3,  letters: { A: 1, E: 1, I: 1, L: 1, N: 1, O: 1, R: 1, S: 1, T: 2 } },
  { id: 4,  letters: { A: 1, E: 1, I: 1, L: 1, N: 1, O: 1, R: 1, S: 1, T: 1, K: 1 } },
  { id: 5,  letters: { B: 1, C: 1, D: 1, G: 1, H: 1, K: 1, M: 1, P: 1, U: 1, Y: 1 } },
  { id: 6,  letters: { B: 1, C: 1, D: 1, G: 1, H: 1, M: 1, P: 1, U: 1, Y: 1, F: 1 } },
  { id: 7,  letters: { B: 1, C: 1, D: 1, H: 1, K: 1, P: 1, U: 1, Y: 1, J: 1, Q: 1 } },
  { id: 8,  letters: { B: 1, D: 1, G: 1, K: 1, M: 1, F: 1, V: 1, W: 1, X: 1, Z: 1 } },
  { id: 9,  letters: { C: 1, G: 1, H: 1, M: 1, B: 1, F: 1, Q: 1, V: 1, W: 1, X: 1 } },
  { id: 10, letters: { R: 2, E: 1, I: 1, L: 1, N: 1, O: 1, A: 1, S: 1, T: 1 } },
  { id: 11, letters: { U: 1, Y: 1, K: 1, J: 1, Z: 1, W: 1, E: 1, N: 1, A: 1, R: 1 } },
];

function getBatchLetterList(batch: { letters: Record<string, number> }): string {
  return Object.entries(batch.letters)
    .flatMap(([letter, count]) => Array(count).fill(letter))
    .join(' ');
}

interface BatchRecommendation {
  batchId: number;
  count: number;
  letters: Record<string, number>;
  fills: { letter: string; adds: number }[];
}

function computeRecommendations(
  inv: Record<string, number | string>,
  tgts: Record<string, number>,
): BatchRecommendation[] {
  // Calculate deficit for each letter (how many more needed to reach target)
  const deficit: Record<string, number> = {};
  for (const letter of LETTERS) {
    const current = Number(inv[letter] || 0);
    const target = tgts[letter] || 0;
    if (target > 0 && current < target) {
      deficit[letter] = target - current;
    }
  }

  if (Object.keys(deficit).length === 0) return [];

  // Greedy: pick the batch that fills the most deficit, repeat until no deficit remains
  const remaining = { ...deficit };
  const batchCounts: Record<number, number> = {};

  for (let iter = 0; iter < 200; iter++) {
    // Check if any deficit remains
    const totalRemaining = Object.values(remaining).reduce((s, v) => s + Math.max(0, v), 0);
    if (totalRemaining <= 0) break;

    // Score each batch by how many deficit units it fills
    let bestBatch = -1;
    let bestScore = 0;
    for (const batch of BATCHES) {
      let score = 0;
      for (const [letter, count] of Object.entries(batch.letters)) {
        if ((remaining[letter] || 0) > 0) {
          score += Math.min(count, remaining[letter]);
        }
      }
      if (score > bestScore) {
        bestScore = score;
        bestBatch = batch.id;
      }
    }

    if (bestBatch < 0 || bestScore === 0) break;

    // Apply the batch
    const batch = BATCHES.find(b => b.id === bestBatch)!;
    batchCounts[bestBatch] = (batchCounts[bestBatch] || 0) + 1;
    for (const [letter, count] of Object.entries(batch.letters)) {
      if (remaining[letter] != null) {
        remaining[letter] -= count;
      }
    }
  }

  // Build recommendation list
  return Object.entries(batchCounts)
    .map(([idStr, count]) => {
      const batchId = Number(idStr);
      const batch = BATCHES.find(b => b.id === batchId)!;
      const fills = Object.entries(batch.letters)
        .filter(([letter]) => (deficit[letter] || 0) > 0)
        .map(([letter, adds]) => ({ letter, adds: adds * count }));
      return { batchId, count, letters: batch.letters, fills };
    })
    .sort((a, b) => a.batchId - b.batchId);
}

export default function InventoryPage() {
  return (
    <Suspense>
      <InventoryContent />
    </Suspense>
  );
}

function InventoryContent() {
  const searchParams = useSearchParams();
  const key = searchParams.get('key') || '';
  const [inventory, setInventory] = useState<Record<string, number | string>>({});
  const [targets, setTargets] = useState<Record<string, number>>({});
  const [recordIds, setRecordIds] = useState<Record<string, string>>({});
  const [lowStock, setLowStock] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingItem, setSavingItem] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [checkerText, setCheckerText] = useState('');

  const stockCheck = useMemo(() => {
    const letters = checkerText.toUpperCase().replace(/[^A-Z]/g, '');
    if (!letters) return null;

    const counts: Record<string, number> = {};
    for (const ch of letters) {
      counts[ch] = (counts[ch] || 0) + 1;
    }
    const totalLetters = letters.length;

    const shortages: { item: string; needed: number; available: number }[] = [];

    for (const [letter, needed] of Object.entries(counts)) {
      const available = Number(inventory[letter] || 0);
      if (available < needed) {
        shortages.push({ item: letter, needed, available });
      }
    }

    const basesAvailable = Number(inventory['P6 Bases'] || 0);
    if (basesAvailable < totalLetters) {
      shortages.push({ item: 'P6 Bases', needed: totalLetters, available: basesAvailable });
    }

    const pcbAvailable = Number(inventory['PCB'] || 0);
    if (pcbAvailable < totalLetters) {
      shortages.push({ item: 'PCBs', needed: totalLetters, available: pcbAvailable });
    }

    return { eligible: shortages.length === 0, shortages, totalLetters };
  }, [checkerText, inventory]);

  // Compute needed client-side so it updates immediately on input
  const needed = useMemo(() => {
    const result: Record<string, number> = {};
    for (const item of [...MAIN_ITEMS, ...LETTERS]) {
      const target = targets[item];
      if (target != null && target > 0) {
        const current = Number(inventory[item] || 0);
        result[item] = Math.max(0, target - current);
      }
    }
    return result;
  }, [inventory, targets]);

  const recommendations = useMemo(() => {
    return computeRecommendations(inventory, targets);
  }, [inventory, targets]);

  const pcbCount = Number(inventory['PCB'] || 0);
  const pcbNeedsReorder = !loading && key && pcbCount < PCB_REORDER_THRESHOLD;

  useEffect(() => {
    if (!key) {
      setLoading(false);
      return;
    }

    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/inventory', {
          headers: { 'x-popup-admin-key': key },
          cache: 'no-store',
        });
        const data = await res.json();
        if (!res.ok) {
          setMessage(data.error || 'Failed to load inventory.');
          return;
        }
        setInventory(data.inventory || {});
        setTargets(data.targets || {});
        setRecordIds(data.recordIds || {});
        setLowStock(data.lowStock || []);
      } catch {
        setMessage('Failed to load inventory.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [key]);

  const saveInventory = async () => {
    if (!key) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/inventory', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-popup-admin-key': key,
        },
        body: JSON.stringify({ inventory, targets }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || 'Failed to save inventory.');
        return;
      }
      setMessage('All saved.');
      setTimeout(() => setMessage(null), 2000);
    } catch {
      setMessage('Failed to save inventory.');
    } finally {
      setSaving(false);
    }
  };

  // Auto-save a single item on blur or Enter
  const saveItem = async (item: string) => {
    const rid = recordIds[item];
    if (!key || !rid) return;
    setSavingItem(item);
    try {
      const res = await fetch('/api/inventory', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-popup-admin-key': key },
        body: JSON.stringify({
          recordId: rid,
          quantity: Number(inventory[item] || 0),
          target: Number(targets[item] || 0),
        }),
      });
      if (!res.ok) console.error('Auto-save failed for', item);
    } catch {
      console.error('Auto-save failed for', item);
    } finally {
      setSavingItem(null);
    }
  };

  const renderInput = (item: string) => {
    const raw = inventory[item];
    const display = raw === undefined || raw === null ? '0' : String(raw);
    const isLowStock = lowStock.includes(item);
    const target = targets[item];
    const targetDisplay = target === undefined || target === null ? '' : String(target);
    const need = needed[item];
    const isSaving = savingItem === item;
    return (
      <div key={item} className={`rounded-lg border p-3 ${isLowStock ? 'border-red-500 bg-red-950/20' : 'border-gray-800 bg-gray-950'} ${isSaving ? 'opacity-70' : ''}`}>
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-300">{item}</p>
          <div className="text-right">
            {isLowStock && (
              <span className="text-xs font-semibold text-red-400 flex items-center gap-1">
                ⚠ Low
              </span>
            )}
            {need != null && need > 0 && (
              <p className="text-xs text-amber-400">
                Need: <span className="font-medium">{need}</span>
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-2 mt-2">
          <div className="flex-1">
            <label className="text-[10px] text-gray-500 uppercase tracking-wider">Stock</label>
            <input
              type="number"
              min={0}
              value={display}
              onFocus={(e) => e.target.select()}
              onChange={(e) => {
                const val = e.target.value;
                setInventory((prev) => ({
                  ...prev,
                  [item]: val === '' ? '' : Math.max(0, Number(val)),
                }));
              }}
              onBlur={() => {
                setInventory((prev) => {
                  const updated = { ...prev, [item]: Math.max(0, Number(prev[item] || 0)) };
                  return updated;
                });
                saveItem(item);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  (e.target as HTMLInputElement).blur();
                }
              }}
              className={`w-full px-3 py-2 rounded-md bg-black/50 border text-white ${isLowStock ? 'border-red-500' : 'border-gray-700'}`}
            />
          </div>
          <div className="flex-1">
            <label className="text-[10px] text-gray-500 uppercase tracking-wider">Target</label>
            <input
              type="number"
              min={0}
              value={targetDisplay}
              placeholder="—"
              onFocus={(e) => e.target.select()}
              onChange={(e) => {
                const val = e.target.value;
                setTargets((prev) => ({
                  ...prev,
                  [item]: val === '' ? 0 : Math.max(0, Number(val)),
                }));
              }}
              onBlur={() => saveItem(item)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  (e.target as HTMLInputElement).blur();
                }
              }}
              className="w-full px-3 py-2 rounded-md bg-black/50 border border-gray-700 text-purple-300"
            />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl md:text-4xl font-bold gradient-text">Inventory Tracker</h1>
          <Link
            href={`/popup-orders?key=${encodeURIComponent(key)}`}
            className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm font-semibold text-white"
          >
            Back to Pop-Up Orders
          </Link>
        </div>

        {!key && (
          <p className="text-red-300">Missing admin key. Open with <span className="font-mono">/inventory?key=YOUR_KEY</span></p>
        )}
        {loading && <p className="text-gray-400">Loading inventory...</p>}

        {pcbNeedsReorder && (
          <div className="rounded-xl border border-amber-600/50 bg-amber-950/30 p-4 space-y-1">
            <p className="text-amber-300 font-semibold flex items-center gap-2">
              <span className="text-lg">⚠</span> PCB Reorder Needed
            </p>
            <p className="text-sm text-amber-200/80">
              PCB stock is at <span className="font-bold text-white">{pcbCount}</span> (below {PCB_REORDER_THRESHOLD}). Lead time is ~1.5 weeks from order to delivery.
            </p>
          </div>
        )}

        {!loading && key && (
          <>
            <div className="space-y-3">
              <h2 className="text-xl font-semibold text-white">Stock Checker</h2>
              <input
                type="text"
                value={checkerText}
                onChange={(e) => setCheckerText(e.target.value)}
                placeholder="Type a word or name to check stock..."
                className="w-full max-w-md px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white text-lg tracking-widest placeholder-gray-600 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
              />
              {stockCheck && (
                stockCheck.eligible ? (
                  <div className="inline-flex items-center gap-2 px-4 py-2.5 bg-green-950/40 border border-green-600/40 rounded-lg">
                    <span className="text-green-400 font-semibold">In Stock</span>
                    <span className="text-gray-400 text-sm">— can be made on-site ({stockCheck.totalLetters} letter{stockCheck.totalLetters !== 1 ? 's' : ''})</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="inline-flex items-center gap-2 px-4 py-2.5 bg-red-950/40 border border-red-600/40 rounded-lg">
                      <span className="text-red-400 font-semibold">Not Available On-Site</span>
                    </div>
                    <div className="text-sm text-gray-400 space-y-1 ml-1">
                      {stockCheck.shortages.map((s) => (
                        <p key={s.item}>
                          <span className="text-red-400">{s.item}</span>: need {s.needed}, have {s.available}
                        </p>
                      ))}
                    </div>
                  </div>
                )
              )}
            </div>

            {/* Recommended Batches */}
            {recommendations.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-xl font-semibold text-white">Recommended Batches to Print</h2>
                <p className="text-sm text-gray-400">Based on letters below their target, these batches will restock inventory most efficiently.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {recommendations.map((rec) => (
                    <div key={rec.batchId} className="rounded-xl border border-purple-600/30 bg-purple-950/20 p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-lg font-bold text-white">Batch {rec.batchId}</span>
                        <span className="px-3 py-1 rounded-full text-sm font-bold bg-purple-600 text-white">
                          Print {rec.count}x
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {getBatchLetterList({ letters: rec.letters }).split(' ').map((letter, i) => {
                          const isNeeded = rec.fills.some(f => f.letter === letter);
                          return (
                            <span key={i} className={`px-2 py-0.5 rounded text-xs font-mono font-semibold ${isNeeded ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'bg-gray-800 text-gray-500 border border-gray-700'}`}>
                              {letter}
                            </span>
                          );
                        })}
                      </div>
                      {rec.fills.length > 0 && (
                        <p className="text-xs text-gray-400">
                          Restocks: {rec.fills.map(f => `${f.letter} +${f.adds}`).join(', ')}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {recommendations.length === 0 && Object.keys(targets).length > 0 && (
              <div className="rounded-xl border border-green-600/30 bg-green-950/20 p-4">
                <p className="text-green-400 font-semibold">All letters are at or above target — no batches needed.</p>
              </div>
            )}

            <div className="space-y-3">
              <h2 className="text-xl font-semibold text-white">Main Items</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {MAIN_ITEMS.map(renderInput)}
              </div>
            </div>

            <div className="space-y-3">
              <h2 className="text-xl font-semibold text-white">Letter Tops (A-Z)</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
                {LETTERS.map(renderInput)}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={saveInventory}
                disabled={saving}
                className="px-5 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-60 text-white font-semibold"
              >
                {saving ? 'Saving...' : 'Save Inventory'}
              </button>
              {message && <p className="text-sm text-gray-300">{message}</p>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
