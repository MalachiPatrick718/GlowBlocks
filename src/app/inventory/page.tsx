'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

const MAIN_ITEMS = ['P6 Bases', 'PCB'];
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

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
  const [lowStock, setLowStock] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
        body: JSON.stringify({ inventory }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || 'Failed to save inventory.');
        return;
      }
      setMessage('Inventory saved.');
    } catch {
      setMessage('Failed to save inventory.');
    } finally {
      setSaving(false);
    }
  };

  const renderInput = (item: string) => {
    const raw = inventory[item];
    const display = raw === undefined || raw === null ? '0' : String(raw);
    const isLowStock = lowStock.includes(item);
    return (
      <div key={item} className={`rounded-lg border p-3 ${isLowStock ? 'border-red-500 bg-red-950/20' : 'border-gray-800 bg-gray-950'}`}>
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-300">{item}</p>
          {isLowStock && (
            <span className="text-xs font-semibold text-red-400 flex items-center gap-1">
              ⚠ Low
            </span>
          )}
        </div>
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
            setInventory((prev) => ({
              ...prev,
              [item]: Math.max(0, Number(prev[item] || 0)),
            }));
          }}
          className={`mt-2 w-full px-3 py-2 rounded-md bg-black/50 border text-white ${isLowStock ? 'border-red-500' : 'border-gray-700'}`}
        />
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
