'use client';

import { useState, useMemo } from 'react';
import { POPUP_COLOR_CATALOG } from '@/data/popupColorCatalog';

export default function ColorGuidePage() {
  const [search, setSearch] = useState('');

  const filteredColors = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return POPUP_COLOR_CATALOG;
    return POPUP_COLOR_CATALOG.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.id.toString().includes(q) ||
        c.hex.toLowerCase().includes(q)
    );
  }, [search]);

  return (
    <div className="min-h-screen py-6 sm:py-8 px-3 sm:px-4">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl sm:text-4xl font-bold gradient-text">Color Guide</h1>
          <p className="text-gray-400 text-sm">Browse all 200 colors. Use the color number when customizing your GlowBlocks.</p>
        </div>

        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, number, or hex..."
          className="w-full max-w-md mx-auto block px-4 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
        />

        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
          {filteredColors.map((color) => (
            <div
              key={color.id}
              className="bg-gray-900 border border-gray-800 rounded-xl p-3 flex flex-col items-center gap-2"
            >
              <div
                className="w-full aspect-square rounded-lg border border-gray-700"
                style={{ backgroundColor: color.hex }}
              />
              <div className="text-center">
                <p className="text-white font-bold text-lg leading-tight">{color.id}</p>
                <p className="text-gray-300 text-xs leading-tight">{color.name}</p>
                <p className="text-gray-500 text-[10px] font-mono">{color.hex}</p>
              </div>
            </div>
          ))}
        </div>

        {filteredColors.length === 0 && (
          <p className="text-center text-gray-500 py-8">No colors match your search.</p>
        )}
      </div>
    </div>
  );
}
