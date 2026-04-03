'use client';

interface BlockPreviewProps {
  text: string;
  letterColors: string[];
  selectedIndex?: number;
  onSelectBlock?: (index: number) => void;
  size?: 'sm' | 'md' | 'lg';
}

export default function BlockPreview({ text, letterColors, selectedIndex, onSelectBlock, size = 'lg' }: BlockPreviewProps) {
  const letters = text.split('');
  const nonSpaceCount = text.replace(/\s/g, '').length;

  if (letters.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-500">
        Type your text to see the preview
      </div>
    );
  }

  // For 'sm' size (cart), use fixed small tiles
  if (size === 'sm') {
    // Scale cart tiles based on letter count — bigger when possible
    const getCartSize = () => {
      if (nonSpaceCount <= 4) return { block: 'w-12 h-12 text-xl', space: 'w-4' };
      if (nonSpaceCount <= 8) return { block: 'w-10 h-10 text-lg', space: 'w-3' };
      if (nonSpaceCount <= 12) return { block: 'w-8 h-8 text-base', space: 'w-2' };
      return { block: 'w-6 h-6 text-xs', space: 'w-1.5' };
    };
    const cartSize = getCartSize();

    return (
      <div className="flex gap-1 justify-center items-center">
        {letters.map((letter, i) => {
          if (letter === ' ') {
            return <div key={i} className={cartSize.space} />;
          }
          const color = letterColors[i] || '#ffffff';
          return (
            <div
              key={i}
              className={`${cartSize.block} bg-gray-900 rounded-md flex items-center justify-center font-bold uppercase border border-gray-700 shrink-0`}
              style={{
                color,
                textShadow: `0 0 4px ${color}80`,
              }}
            >
              {letter}
            </div>
          );
        })}
      </div>
    );
  }

  // Dynamic sizing: scale tiles to always fit in one line
  // More letters = smaller tiles
  const getBlockSize = () => {
    if (nonSpaceCount <= 4) return { block: 'min-w-[4.5rem] h-[4.5rem] text-3xl', space: 'w-8' };
    if (nonSpaceCount <= 6) return { block: 'min-w-[3.5rem] h-[3.5rem] text-2xl', space: 'w-6' };
    if (nonSpaceCount <= 10) return { block: 'min-w-[2.75rem] h-[2.75rem] text-xl', space: 'w-4' };
    if (nonSpaceCount <= 15) return { block: 'min-w-[2.25rem] h-[2.25rem] text-lg', space: 'w-3' };
    if (nonSpaceCount <= 20) return { block: 'min-w-[1.75rem] h-[1.75rem] text-sm', space: 'w-2' };
    return { block: 'min-w-[1.5rem] h-[1.5rem] text-xs', space: 'w-1.5' };
  };

  const { block: blockClass, space: spaceClass } = getBlockSize();

  return (
    <div className="flex gap-1.5 justify-center items-center overflow-x-auto">
      {letters.map((letter, i) => {
        if (letter === ' ') {
          return <div key={i} className={`shrink-0 ${spaceClass}`} />;
        }

        const color = letterColors[i] || '#ffffff';
        const isSelected = selectedIndex === i;

        return (
          <div key={i} className="flex flex-col items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => onSelectBlock?.(i)}
              className={`
                ${blockClass} shrink-0 aspect-square
                bg-gray-900 rounded-lg flex items-center justify-center font-bold uppercase
                border-2 transition-all duration-200
                ${isSelected ? 'border-white scale-110 shadow-lg' : 'border-gray-700 hover:border-gray-500'}
                ${onSelectBlock ? 'cursor-pointer' : 'cursor-default'}
              `}
              style={{
                color,
                textShadow: `0 0 6px ${color}90`,
              }}
            >
              {letter}
            </button>
            {onSelectBlock && (
              <span
                className="text-[9px] text-gray-500 font-mono cursor-pointer hover:text-gray-300 transition-colors"
                title="Click to copy"
                onClick={() => navigator.clipboard.writeText(color)}
              >
                {color.toUpperCase()}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
