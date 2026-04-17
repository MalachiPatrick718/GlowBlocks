'use client';

interface ColorPresetsProps {
  onApplyPreset: (colors: string[], presetLabel?: string) => void;
  letterCount: number;
}

const PRESETS: { name: string; colors: string[]; label: string }[] = [
  {
    name: 'rainbow',
    label: 'Rainbow',
    colors: ['#FF3C3C', '#FF8C00', '#FFDC3C', '#50DC50'],
  },
  {
    name: 'american',
    label: 'American Flag',
    colors: ['#C82828', '#F0F0F0', '#283C78'],
  },
  {
    name: 'party',
    label: 'Party',
    colors: ['#FF3C8C', '#50B4FF', '#64DC64', '#FFDC50'],
  },
  {
    name: 'tropical',
    label: 'Tropical',
    colors: ['#FF7864', '#50C8C8', '#FFB43C', '#50B464'],
  },
  {
    name: 'sunset',
    label: 'Sunset',
    colors: ['#FF783C', '#FF508C', '#A050FF', '#FFB450'],
  },
  {
    name: 'ocean',
    label: 'Ocean',
    colors: ['#3CA096', '#28508C', '#64DCDC', '#50A064'],
  },
];

export default function ColorPresets({ onApplyPreset, letterCount }: ColorPresetsProps) {
  const handlePreset = (presetColors: string[], presetLabel: string) => {
    const applied = Array.from({ length: letterCount }, (_, i) => presetColors[i % presetColors.length]);
    onApplyPreset(applied, presetLabel);
  };

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-300">Color Presets</label>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {PRESETS.map((preset) => (
          <button
            key={preset.name}
            onClick={() => handlePreset(preset.colors, preset.label)}
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
