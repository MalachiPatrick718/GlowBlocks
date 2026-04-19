'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

const MAIN_ITEMS = ['P6 Bases', 'P2 Diffuser', 'PCB'];
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
  const [inventory, setInventory] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

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
    const qty = Number(inventory[item] || 0);
    return (
      <div key={item} className="rounded-lg border border-gray-800 bg-gray-950 p-3">
        <p className="text-sm text-gray-300">{item}</p>
        <input
          type="number"
          value={qty}
          onChange={(e) =>
            setInventory((prev) => ({
              ...prev,
              [item]: Number(e.target.value || 0),
            }))
          }
          className="mt-2 w-full px-3 py-2 rounded-md bg-black/50 border border-gray-700 text-white"
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
