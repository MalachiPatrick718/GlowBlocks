'use client';

import { getPricePerBlock } from '@/context/CartContext';

interface TextInputProps {
  text: string;
  onChange: (text: string) => void;
}

export default function TextInput({ text, onChange }: TextInputProps) {
  const blockCount = text.replace(/\s/g, '').length;
  const pricePerBlock = getPricePerBlock(blockCount);
  const totalPrice = blockCount * pricePerBlock;

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-300">
        Enter your text
      </label>
      <input
        type="text"
        value={text}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        placeholder="TYPE YOUR TEXT..."
        maxLength={30}
        className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white text-lg tracking-widest placeholder-gray-600 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
      />
      <div className="flex justify-between text-sm text-gray-400">
        <span>{blockCount} letter{blockCount !== 1 ? 's' : ''} &middot; {text.length}/30 characters</span>
        {blockCount > 0 && (
          <span className="text-white font-medium">${totalPrice.toFixed(2)}</span>
        )}
      </div>
    </div>
  );
}
