'use client';

import { useState } from 'react';
import { POPUP_COLOR_MAP } from '@/data/popupColorCatalog';

interface PopupColorNumberModalProps {
  letterChar: string;
  letterIndex: number;
  currentColorNumber: number | null;
  onApply: (colorNumber: number) => void;
  onClose: () => void;
}

export default function PopupColorNumberModal({
  letterChar,
  letterIndex,
  currentColorNumber,
  onApply,
  onClose,
}: PopupColorNumberModalProps) {
  const [numberInput, setNumberInput] = useState(currentColorNumber?.toString() || '');
  const parsed = Number(numberInput);
  const color = Number.isInteger(parsed) ? POPUP_COLOR_MAP.get(parsed) : undefined;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative bg-gray-900 border border-gray-700 rounded-t-2xl sm:rounded-2xl p-5 sm:p-6 w-full sm:max-w-md shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col items-center gap-3 mb-5">
          <p className="text-sm text-gray-400">Block {letterIndex + 1}</p>
          <div
            className="w-20 h-20 bg-gray-950 rounded-xl flex items-center justify-center text-4xl font-bold uppercase border-2 border-gray-600"
            style={{
              color: color?.hex || '#FFFFFF',
              textShadow: `0 0 6px ${(color?.hex || '#FFFFFF')}90`,
            }}
          >
            {letterChar}
          </div>
        </div>

        <label className="block text-sm font-medium text-gray-300 mb-2">
          Enter Color Guide Color Number (1-200)
        </label>
        <input
          type="number"
          min={1}
          max={200}
          value={numberInput}
          onChange={(e) => setNumberInput(e.target.value)}
          placeholder="Example: 145"
          className="w-full px-4 py-3 bg-gray-950 border border-gray-700 rounded-lg text-white text-lg focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
        />

        <div className="mt-3 min-h-14 rounded-lg border border-gray-800 bg-gray-950/60 p-3">
          {color ? (
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-white font-semibold">{color.name}</p>
                <p className="text-xs text-gray-400">
                  #{color.id} - RGB({color.rgb.join(', ')}) - {color.hex}
                </p>
              </div>
              <div
                className="w-10 h-10 rounded-lg border border-gray-700 shrink-0"
                style={{ backgroundColor: color.hex }}
              />
            </div>
          ) : (
            <p className="text-sm text-gray-400">
              Enter the number bold number in the Color Guide.
            </p>
          )}
        </div>

        <div className="flex gap-3 mt-5">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 border border-gray-700 rounded-lg text-gray-400 hover:text-white hover:border-gray-500 transition-colors text-sm font-medium"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (!color) return;
              onApply(color.id);
              onClose();
            }}
            disabled={!color}
            className="flex-1 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 disabled:opacity-50 disabled:cursor-not-allowed hover:from-purple-500 hover:to-pink-500 rounded-lg text-white text-sm font-semibold transition-all"
          >
            Apply Color
          </button>
        </div>
      </div>
    </div>
  );
}
