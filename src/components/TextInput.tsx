'use client';

import { getPricePerBlock } from '@/context/CartContext';

const SYMBOLS = [
  { char: '\u2665', label: 'Heart' },
  { char: '\u262E', label: 'Peace' },
  { char: '\u2605', label: 'Star' },
  { char: '\u263A', label: 'Smiley' },
  { char: '\u266A', label: 'Music' },
  { char: '\u26A1', label: 'Lightning' },
  { char: '\u263D', label: 'Moon' },
  { char: '\u2600', label: 'Sun' },
];

interface TextInputProps {
  text: string;
  onChange: (text: string) => void;
}

export default function TextInput({ text, onChange }: TextInputProps) {
  const blockCount = text.replace(/\s/g, '').length;
  const pricePerBlock = getPricePerBlock(blockCount);
  const totalPrice = blockCount * pricePerBlock;

  const insertSymbol = (symbol: string) => {
    if (text.length >= 30) return;
    onChange(text + symbol);
  };

  return (
    <div className="space-y-3">
      <input
        type="text"
        value={text}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        placeholder="YOUR CUSTOM WORD OR NAME..."
        maxLength={30}
        className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white text-lg tracking-widest placeholder-gray-600 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
      />
      <div className="flex flex-wrap gap-1.5">
        {SYMBOLS.map((s) => (
          <button
            key={s.char}
            type="button"
            onClick={() => insertSymbol(s.char)}
            disabled={text.length >= 30}
            title={s.label}
            className="w-9 h-9 rounded-md bg-gray-800 border border-gray-700 hover:border-purple-500 hover:bg-gray-700 text-white text-lg flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {s.char}
          </button>
        ))}
      </div>
      <div className="flex justify-between text-sm text-gray-400">
        <span>{blockCount} block{blockCount !== 1 ? 's' : ''} &middot; {text.length}/30 characters</span>
        {blockCount > 0 && (
          <span className="text-white font-medium">${totalPrice.toFixed(2)}</span>
        )}
      </div>
    </div>
  );
}
