'use client';

interface ColorPresetsProps {
  onApplyPreset: (colors: string[]) => void;
  letterCount: number;
}

const PRESETS: { name: string; colors: string[]; label: string }[] = [
  {
    name: 'rainbow',
    label: 'Rainbow',
    colors: ['#FF0000', '#FF8C00', '#FFD700', '#00C853', '#2979FF', '#651FFF', '#D500F9'],
  },
  {
    name: 'american',
    label: 'American Flag',
    colors: ['#B22234', '#FFFFFF', '#3C3B6E'],
  },
  {
    name: 'party',
    label: 'Party',
    colors: ['#FF1493', '#00BFFF', '#32CD32', '#FFD700', '#9B30FF'],
  },
  {
    name: 'tropical',
    label: 'Tropical',
    colors: ['#FF6B6B', '#00CED1', '#FFA500', '#2E8B57'],
  },
  {
    name: 'sunset',
    label: 'Sunset',
    colors: ['#FF6B35', '#FF1493', '#8B5CF6', '#F59E0B'],
  },
  {
    name: 'ocean',
    label: 'Ocean',
    colors: ['#0D9488', '#1E3A5F', '#00FFFF', '#2E8B57'],
  },
];

export default function ColorPresets({ onApplyPreset, letterCount }: ColorPresetsProps) {
  const handlePreset = (presetColors: string[]) => {
    const applied = Array.from({ length: letterCount }, (_, i) => presetColors[i % presetColors.length]);
    onApplyPreset(applied);
  };

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-300">Color Presets</label>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {PRESETS.map((preset) => (
          <button
            key={preset.name}
            onClick={() => handlePreset(preset.colors)}
            className="flex items-center gap-2 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg hover:border-purple-500 transition-colors text-sm"
          >
            <div className="flex gap-0.5">
              {preset.colors.slice(0, 4).map((color, i) => (
                <div key={i} className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
              ))}
            </div>
            <span className="text-gray-300">{preset.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
