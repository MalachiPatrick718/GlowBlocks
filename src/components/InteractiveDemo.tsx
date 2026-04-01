'use client';

import { useState } from 'react';

const DEMO_COLORS = ['#FF0000', '#FF8C00', '#FFD700', '#00C853', '#2979FF', '#651FFF', '#D500F9'];

function getColor(index: number) {
  return DEMO_COLORS[index % DEMO_COLORS.length];
}

function getBlockSize(count: number) {
  if (count <= 4) return { tile: 'w-14 h-14 sm:w-20 sm:h-20 text-xl sm:text-3xl', connected: 3, disconnected: 20 };
  if (count <= 7) return { tile: 'w-11 h-11 sm:w-16 sm:h-16 text-lg sm:text-2xl', connected: 3, disconnected: 16 };
  if (count <= 10) return { tile: 'w-9 h-9 sm:w-12 sm:h-12 text-base sm:text-xl', connected: 2, disconnected: 12 };
  return { tile: 'w-7 h-7 sm:w-10 sm:h-10 text-sm sm:text-lg', connected: 2, disconnected: 10 };
}

function BlockRow({ text, connected }: { text: string; connected: boolean }) {
  const letters = text.replace(/\s/g, '').split('');
  const size = getBlockSize(letters.length);

  return (
    <div className="flex items-center justify-center flex-wrap">
      {letters.map((letter, i) => {
        const color = getColor(i);
        return (
          <div
            key={i}
            className={`${size.tile} flex items-center justify-center font-bold rounded-lg border-2 select-none`}
            style={{
              marginLeft: i === 0 ? 0 : connected ? size.connected : size.disconnected,
              backgroundColor: '#111827',
              borderColor: connected ? color : '#374151',
              color: connected ? color : '#555555',
              textShadow: connected ? `0 0 8px ${color}90, 0 0 16px ${color}50` : '0 0 0px transparent',
              boxShadow: connected ? `0 0 12px ${color}40, 0 0 24px ${color}20` : '0 0 0px transparent',
              opacity: connected ? 1 : 0.6,
              transition: 'all 700ms cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          >
            {letter}
          </div>
        );
      })}
    </div>
  );
}

export default function InteractiveDemo() {
  const [connected, setConnected] = useState(true);
  const [customText, setCustomText] = useState('');

  const filteredCustom = customText.replace(/\s/g, '');

  return (
    <section className="py-10 sm:py-14 px-4 bg-gray-950/50">
      <div className="max-w-3xl mx-auto text-center space-y-8">
        <h2 className="text-2xl sm:text-3xl font-bold gradient-text">How it works</h2>
        <p className="text-gray-300 text-base sm:text-lg leading-relaxed max-w-xl mx-auto">
          Place them together, they glow. Pull one away, it goes dark. That&apos;s it.
        </p>

        {/* Toggle */}
        <div className="flex items-center justify-center gap-4">
          <span className={`text-sm font-medium transition-colors duration-300 ${!connected ? 'text-white' : 'text-gray-500'}`}>
            Disconnected
          </span>
          <button
            onClick={() => setConnected(!connected)}
            role="switch"
            aria-checked={connected}
            className={`relative w-16 h-8 rounded-full transition-colors duration-300 ${
              connected ? 'bg-purple-600' : 'bg-gray-700'
            }`}
          >
            <div
              className={`absolute top-1 w-6 h-6 rounded-full bg-white transition-transform duration-300 ${
                connected ? 'translate-x-9' : 'translate-x-1'
              }`}
            />
          </button>
          <span className={`text-sm font-medium transition-colors duration-300 ${connected ? 'text-white' : 'text-gray-500'}`}>
            Connected
          </span>
        </div>

        {/* Default GLOW demo */}
        <div className="py-4">
          <BlockRow text="GLOW" connected={connected} />
        </div>

        {/* Tagline */}
        <div className="space-y-2">
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm text-gray-400">
            <span>No cables</span>
            <span className="text-gray-600">&bull;</span>
            <span>No power blocks</span>
            <span className="text-gray-600">&bull;</span>
            <span>No magnets</span>
            <span className="text-gray-600">&bull;</span>
            <span>No WiFi</span>
          </div>
          <p className="text-gray-300 text-base sm:text-lg font-medium">
            Just connect and illuminate.
          </p>
        </div>

        {/* Preview your own */}
        <div className="space-y-5 pt-4">
          <h3 className="text-lg font-semibold text-gray-300">Preview your own</h3>
          <input
            type="text"
            value={customText}
            onChange={(e) => setCustomText(e.target.value.toUpperCase())}
            placeholder="TYPE A NAME OR WORD..."
            maxLength={15}
            className="w-full max-w-sm mx-auto block px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white text-center text-lg tracking-widest placeholder-gray-600 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
          />
          {filteredCustom.length > 0 && (
            <div className="py-4">
              <BlockRow text={filteredCustom} connected={connected} />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
