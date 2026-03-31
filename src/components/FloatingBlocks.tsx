'use client';

import { useEffect, useState } from 'react';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const COLORS = [
  '#FF6B6B', '#FF8C00', '#FFD700', '#00C853', '#2979FF',
  '#651FFF', '#D500F9', '#FF1493', '#00BFFF', '#00CED1',
  '#E040FB', '#FF4081', '#69F0AE', '#FFAB40', '#7C4DFF',
];

interface Block {
  id: number;
  letter: string;
  color: string;
  x: number;
  y: number;
  size: number;
  delay: number;
  duration: number;
  opacity: number;
}

function generateBlocks(): Block[] {
  // Place blocks in a grid-like pattern so they fill evenly without clustering
  const blocks: Block[] = [];
  const cols = 7;
  const rows = 5;
  const total = cols * rows; // 35 blocks

  for (let i = 0; i < total; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);

    // Base position from grid + random offset for organic feel
    const baseX = (col / cols) * 100;
    const baseY = (row / rows) * 100;

    blocks.push({
      id: i,
      letter: LETTERS[Math.floor(Math.random() * LETTERS.length)],
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      x: baseX + (Math.random() - 0.5) * (100 / cols) * 0.6,
      y: baseY + (Math.random() - 0.5) * (100 / rows) * 0.6,
      size: 30 + Math.random() * 24,
      delay: Math.random() * 6,
      duration: 10 + Math.random() * 14,
      opacity: 0.12 + Math.random() * 0.15,
    });
  }
  return blocks;
}

export default function FloatingBlocks() {
  const [blocks, setBlocks] = useState<Block[]>([]);

  useEffect(() => {
    setBlocks(generateBlocks());
  }, []);

  if (blocks.length === 0) return null;

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {blocks.map((block) => (
        <div
          key={block.id}
          className="absolute rounded-lg flex items-center justify-center font-bold uppercase select-none"
          style={{
            left: `${block.x}%`,
            top: `${block.y}%`,
            width: `${block.size}px`,
            height: `${block.size}px`,
            fontSize: `${block.size * 0.5}px`,
            color: block.color,
            opacity: block.opacity,
            border: `1px solid ${block.color}40`,
            backgroundColor: `${block.color}10`,
            textShadow: `0 0 10px ${block.color}50`,
            animation: `float ${block.duration}s ease-in-out ${block.delay}s infinite`,
          }}
        >
          {block.letter}
        </div>
      ))}
    </div>
  );
}
