'use client';

import { useState, useEffect } from 'react';

interface ColorModalProps {
  letterChar: string;
  letterIndex: number;
  currentColor: string;
  onApply: (color: string) => void;
  onClose: () => void;
}

const COLOR_PALETTE = [
  '#FF0000', '#FF4444', '#FF6B6B', '#CC0000',
  '#FF6D00', '#FF8C00', '#FFA500', '#FF9800',
  '#FFD700', '#FFEA00', '#FFC107', '#FFB300',
  '#00C853', '#00E676', '#4CAF50', '#2E7D32',
  '#2979FF', '#448AFF', '#2196F3', '#0D47A1',
  '#00BFFF', '#03A9F4', '#00FFFF', '#00CED1',
  '#651FFF', '#7C4DFF', '#9C27B0', '#8E24AA',
  '#D500F9', '#AA00FF', '#E040FB', '#9B30FF',
  '#FF1493', '#FF69B4', '#E91E63', '#C2185B',
  '#FFFFFF', '#E0E0E0', '#9E9E9E', '#424242',
];

export default function ColorModal({ letterChar, letterIndex, currentColor, onApply, onClose }: ColorModalProps) {
  const [color, setColor] = useState(currentColor);
  const [hexInput, setHexInput] = useState(currentColor);

  useEffect(() => {
    setColor(currentColor);
    setHexInput(currentColor);
  }, [currentColor]);

  const handleHexSubmit = () => {
    let hex = hexInput.trim();
    if (!hex.startsWith('#')) hex = '#' + hex;
    if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
      setColor(hex);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative bg-gray-900 border border-gray-700 rounded-t-2xl sm:rounded-2xl p-5 sm:p-6 w-full sm:max-w-sm shadow-2xl max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with letter preview */}
        <div className="flex flex-col items-center gap-3 mb-5">
          <p className="text-sm text-gray-400">Block {letterIndex + 1}</p>
          <div
            className="w-20 h-20 bg-gray-950 rounded-xl flex items-center justify-center text-4xl font-bold uppercase border-2 border-gray-600"
            style={{
              color,
              textShadow: `0 0 6px ${color}90`,
            }}
          >
            {letterChar}
          </div>
        </div>

        {/* Color grid */}
        <div className="grid grid-cols-8 gap-1.5 mb-4">
          {COLOR_PALETTE.map((c, i) => (
            <button
              key={i}
              className={`w-full aspect-square rounded-md border-2 transition-all ${
                color === c ? 'border-white scale-110' : 'border-transparent hover:border-gray-400'
              }`}
              style={{ backgroundColor: c }}
              onClick={() => {
                setColor(c);
                setHexInput(c);
              }}
            />
          ))}
        </div>

        {/* Hex input + native picker */}
        <div className="flex gap-2 mb-2">
          <input
            type="color"
            value={color}
            onChange={(e) => {
              setColor(e.target.value.toUpperCase());
              setHexInput(e.target.value.toUpperCase());
            }}
            className="w-10 h-10 rounded cursor-pointer bg-transparent border border-gray-700 shrink-0"
          />
          <input
            type="text"
            value={hexInput}
            onChange={(e) => setHexInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleHexSubmit()}
            placeholder="#FF00FF"
            maxLength={7}
            className="flex-1 px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg text-white font-mono text-sm focus:outline-none focus:border-purple-500"
          />
          <button
            onClick={handleHexSubmit}
            className="px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-300 transition-colors"
          >
            Set
          </button>
        </div>
        <a
          href="https://htmlcolorcodes.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-purple-400 hover:text-purple-300 underline"
        >
          Find hex color codes here
        </a>

        {/* Actions */}
        <div className="flex gap-3 mt-5">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 border border-gray-700 rounded-lg text-gray-400 hover:text-white hover:border-gray-500 transition-colors text-sm font-medium"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onApply(color);
              onClose();
            }}
            className="flex-1 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-lg text-white text-sm font-semibold transition-all"
          >
            Apply Color
          </button>
        </div>
      </div>
    </div>
  );
}
