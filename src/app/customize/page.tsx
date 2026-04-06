'use client';

import { Suspense, useState, useCallback, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import BlockPreview from '@/components/BlockPreview';
import TextInput from '@/components/TextInput';
import ColorPresets from '@/components/ColorPresets';
import ColorModal from '@/components/CustomColorPicker';
import { useCart } from '@/context/CartContext';

export default function CustomizePage() {
  return (
    <Suspense>
      <CustomizeContent />
    </Suspense>
  );
}

function CustomizeContent() {
  const searchParams = useSearchParams();
  const editId = searchParams.get('edit');

  const { addItem, updateItem, items } = useCart();
  const router = useRouter();

  const [text, setText] = useState('');
  const [letterColors, setLetterColors] = useState<string[]>([]);
  const [modalIndex, setModalIndex] = useState<number | null>(null);
  const [colorMode, setColorMode] = useState<'presets' | 'custom'>('presets');
  const [added, setAdded] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Load existing item data when editing
  useEffect(() => {
    if (editId && !initialized && items.length > 0) {
      const item = items.find(i => i.id === editId);
      if (item) {
        setText(item.text);
        setLetterColors(item.letterColors);
        setColorMode(item.customColors ? 'custom' : 'presets');
      }
      setInitialized(true);
    } else if (!editId) {
      setInitialized(true);
    }
  }, [editId, items, initialized]);

  const letters = text.split('');
  const nonSpaceLetters = text.replace(/\s/g, '');

  const handleTextChange = useCallback((newText: string) => {
    setText(newText);
    setLetterColors(prev => {
      const newColors = [...prev];
      while (newColors.length < newText.length) {
        newColors.push('#FFFFFF');
      }
      return newColors.slice(0, newText.length);
    });
    setModalIndex(null);
  }, []);

  const handlePresetApply = useCallback((colors: string[]) => {
    const mapped: string[] = [];
    let colorIdx = 0;
    for (let i = 0; i < text.length; i++) {
      if (text[i] === ' ') {
        mapped.push('#FFFFFF');
      } else {
        mapped.push(colors[colorIdx % colors.length]);
        colorIdx++;
      }
    }
    setLetterColors(mapped);
  }, [text]);

  const handleColorApply = useCallback((color: string) => {
    if (modalIndex === null) return;
    setLetterColors(prev => {
      const next = [...prev];
      next[modalIndex] = color;
      return next;
    });
  }, [modalIndex]);

  const handleAddToCart = () => {
    if (nonSpaceLetters.length === 0) return;
    if (editId) {
      updateItem(editId, { text, letterColors, customColors: colorMode === 'custom' });
    } else {
      addItem({ text, letterColors, customColors: colorMode === 'custom' });
    }
    setAdded(true);
    setTimeout(() => {
      router.push('/cart');
    }, 800);
  };

  return (
    <div className="min-h-screen py-6 sm:py-8 px-3 sm:px-4">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold gradient-text text-center mb-6 sm:mb-8">
          Customize Your GlowBlocks
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
          {/* Controls */}
          <div className="space-y-6">
            <TextInput text={text} onChange={handleTextChange} />

            {nonSpaceLetters.length > 0 && (
              <>
                {/* Color mode toggle */}
                <div className="flex rounded-lg border border-gray-700 overflow-hidden">
                  <button
                    onClick={() => setColorMode('presets')}
                    className={`flex-1 py-2 text-sm font-medium transition-colors ${
                      colorMode === 'presets'
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-900 text-gray-400 hover:text-white'
                    }`}
                  >
                    Preset Themes
                  </button>
                  <button
                    onClick={() => setColorMode('custom')}
                    className={`flex-1 py-2 text-sm font-medium transition-colors ${
                      colorMode === 'custom'
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-900 text-gray-400 hover:text-white'
                    }`}
                  >
                    Custom Colors
                  </button>
                </div>

                {colorMode === 'presets' ? (
                  <ColorPresets
                    onApplyPreset={handlePresetApply}
                    letterCount={nonSpaceLetters.length}
                  />
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-gray-400">
                      Tap a letter to pick its color. <span className="text-purple-400">+$5.00 one-time fee</span>
                    </p>
                    {/* Inline clickable tiles */}
                    <div className="bg-gray-950 border border-gray-800 rounded-xl p-4">
                      <BlockPreview
                        text={text}
                        letterColors={letterColors}
                        onSelectBlock={(i) => {
                          if (text[i] !== ' ') setModalIndex(i);
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Add to cart */}
                <div className="pt-4 border-t border-gray-800">
                  <button
                    onClick={handleAddToCart}
                    disabled={added}
                    className={`w-full py-3 rounded-lg font-semibold text-lg transition-all duration-300 ${
                      added
                        ? 'bg-green-600 text-white'
                        : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40'
                    }`}
                  >
                    {added ? (editId ? 'Updated!' : 'Added to Cart!') : (editId ? 'Save Changes' : 'Finished — Add to Cart')}
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Live Preview */}
          <div className="lg:sticky lg:top-24 h-fit">
            <div className="bg-gray-950 border border-gray-800 rounded-2xl p-6 space-y-4">
              <h2 className="text-lg font-semibold text-gray-300">Live Preview</h2>
              <BlockPreview
                text={text}
                letterColors={letterColors}
              />
              {nonSpaceLetters.length > 0 && (
                <p className="text-center text-sm text-gray-500 mt-4">
                  {colorMode === 'custom' ? 'Tap letters on the left to customize colors' : 'Select a preset theme on the left'}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Color picker modal */}
      {modalIndex !== null && text[modalIndex] && (
        <ColorModal
          letterChar={text[modalIndex]}
          letterIndex={modalIndex}
          currentColor={letterColors[modalIndex] || '#FFFFFF'}
          onApply={handleColorApply}
          onClose={() => setModalIndex(null)}
        />
      )}
    </div>
  );
}
