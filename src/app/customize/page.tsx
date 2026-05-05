'use client';

import { Suspense, useState, useCallback, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import BlockPreview from '@/components/BlockPreview';
import TextInput from '@/components/TextInput';
import ColorPresets from '@/components/ColorPresets';
import ColorModal from '@/components/CustomColorPicker';
import PopupColorNumberModal from '@/components/PopupColorNumberModal';
import { POPUP_COLOR_MAP } from '@/data/popupColorCatalog';
import { useCart, textHasSymbols } from '@/context/CartContext';

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
  const [colorNumbers, setColorNumbers] = useState<(number | null)[]>([]);
  const [modalIndex, setModalIndex] = useState<number | null>(null);
  const [colorMode, setColorMode] = useState<'presets' | 'custom' | 'color-number'>('presets');
  const [applyAll, setApplyAll] = useState(false);
  const [selectedPresetName, setSelectedPresetName] = useState<string | null>(null);
  const [referral, setReferral] = useState<'yes' | 'no' | null>(null);
  const [referralName, setReferralName] = useState('');
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
    setColorNumbers(prev => {
      const newNums = [...prev];
      while (newNums.length < newText.length) {
        newNums.push(null);
      }
      return newNums.slice(0, newText.length);
    });
    setModalIndex(null);
  }, []);

  const handlePresetApply = useCallback((colors: string[], presetLabel?: string) => {
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
    setSelectedPresetName(presetLabel || 'Preset Theme');
  }, [text]);

  const handleColorApply = useCallback((color: string) => {
    if (modalIndex === null) return;
    if (applyAll) {
      setLetterColors(prev => prev.map((c, i) => text[i] !== ' ' ? color : c));
      setApplyAll(false);
    } else {
      setLetterColors(prev => {
        const next = [...prev];
        next[modalIndex] = color;
        return next;
      });
    }
  }, [modalIndex, applyAll, text]);

  const handleColorNumberApply = useCallback((colorNumber: number) => {
    if (modalIndex === null) return;
    const color = POPUP_COLOR_MAP.get(colorNumber);
    if (!color) return;
    if (applyAll) {
      setLetterColors(prev => prev.map((c, i) => text[i] !== ' ' ? color.hex : c));
      setColorNumbers(prev => prev.map((n, i) => text[i] !== ' ' ? colorNumber : n));
      setApplyAll(false);
    } else {
      setLetterColors(prev => {
        const next = [...prev];
        next[modalIndex] = color.hex;
        return next;
      });
      setColorNumbers(prev => {
        const next = [...prev];
        next[modalIndex] = colorNumber;
        return next;
      });
    }
  }, [modalIndex, applyAll, text]);

  const referralComplete = referral === 'no' || (referral === 'yes' && referralName.trim().length > 0);

  const handleAddToCart = () => {
    if (nonSpaceLetters.length === 0 || !referralComplete) return;
    const isCustom = colorMode === 'custom' || colorMode === 'color-number';

    // Save referral info to localStorage for checkout
    if (referral === 'yes' && referralName.trim()) {
      localStorage.setItem('glowblocks-referral', referralName.trim());
    } else {
      localStorage.removeItem('glowblocks-referral');
    }

    const symbols = textHasSymbols(text);
    if (editId) {
      updateItem(editId, { text, letterColors, customColors: isCustom, hasSymbols: symbols });
    } else {
      addItem({ text, letterColors, customColors: isCustom, hasSymbols: symbols });
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
            {textHasSymbols(text) && (
              <p className="text-sm text-purple-400">+$2.00 one-time symbol fee</p>
            )}

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
                  <button
                    onClick={() => setColorMode('color-number')}
                    className={`flex-1 py-2 text-sm font-medium transition-colors ${
                      colorMode === 'color-number'
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-900 text-gray-400 hover:text-white'
                    }`}
                  >
                    Color Guide
                  </button>
                </div>

                {colorMode === 'presets' ? (
                  <ColorPresets
                    onApplyPreset={handlePresetApply}
                    letterCount={nonSpaceLetters.length}
                    selectedPresetName={selectedPresetName}
                  />
                ) : colorMode === 'custom' ? (
                  <div className="space-y-3">
                    <p className="text-sm text-gray-400">
                      Tap a letter to pick its color. <span className="text-purple-400">+$2.00 one-time fee</span>
                    </p>
                    <div className="bg-gray-950 border border-gray-800 rounded-xl p-4">
                      <BlockPreview
                        text={text}
                        letterColors={letterColors}
                        onSelectBlock={(i) => {
                          if (text[i] !== ' ') { setApplyAll(false); setModalIndex(i); }
                        }}
                      />
                    </div>
                    {nonSpaceLetters.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          setApplyAll(true);
                          const firstNonSpace = text.split('').findIndex(ch => ch !== ' ');
                          setModalIndex(firstNonSpace >= 0 ? firstNonSpace : 0);
                        }}
                        className="w-full py-2 rounded-lg border border-purple-600 text-purple-400 text-sm font-medium hover:bg-purple-600/10 transition-colors"
                      >
                        Apply Color to All Letters
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-gray-400">
                      Tap a letter and enter its color number from the{' '}
                      <Link href="/color-guide" target="_blank" className="text-purple-400 underline hover:text-purple-300">
                        Color Guide
                      </Link>
                      . <span className="text-purple-400">+$2.00 one-time fee</span>
                    </p>
                    <div className="bg-gray-950 border border-gray-800 rounded-xl p-4">
                      <BlockPreview
                        text={text}
                        letterColors={letterColors}
                        onSelectBlock={(i) => {
                          if (text[i] !== ' ') { setApplyAll(false); setModalIndex(i); }
                        }}
                      />
                    </div>
                    {nonSpaceLetters.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          setApplyAll(true);
                          const firstNonSpace = text.split('').findIndex(ch => ch !== ' ');
                          setModalIndex(firstNonSpace >= 0 ? firstNonSpace : 0);
                        }}
                        className="w-full py-2 rounded-lg border border-purple-600 text-purple-400 text-sm font-medium hover:bg-purple-600/10 transition-colors"
                      >
                        Apply Color to All Letters
                      </button>
                    )}
                  </div>
                )}

                {/* Referral */}
                <div className="space-y-3">
                  <p className="text-sm font-medium text-gray-300">Were you referred to GlowBlocks?</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setReferral('yes')}
                      className={`py-2 rounded-lg border text-sm font-medium transition-colors ${
                        referral === 'yes'
                          ? 'bg-purple-600 border-purple-500 text-white'
                          : 'bg-gray-900 border-gray-700 text-gray-300 hover:text-white'
                      }`}
                    >
                      Yes
                    </button>
                    <button
                      type="button"
                      onClick={() => { setReferral('no'); setReferralName(''); }}
                      className={`py-2 rounded-lg border text-sm font-medium transition-colors ${
                        referral === 'no'
                          ? 'bg-purple-600 border-purple-500 text-white'
                          : 'bg-gray-900 border-gray-700 text-gray-300 hover:text-white'
                      }`}
                    >
                      No
                    </button>
                  </div>
                  {referral === 'yes' && (
                    <input
                      type="text"
                      value={referralName}
                      onChange={(e) => setReferralName(e.target.value)}
                      placeholder="Who referred you?"
                      className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                    />
                  )}
                  {referral === null && (
                    <p className="text-xs text-amber-300/80">Please answer to continue</p>
                  )}
                </div>

                {/* Add to cart */}
                <div className="pt-4 border-t border-gray-800">
                  <button
                    onClick={handleAddToCart}
                    disabled={added || !referralComplete}
                    className={`w-full py-3 rounded-lg font-semibold text-lg transition-all duration-300 ${
                      added
                        ? 'bg-green-600 text-white'
                        : !referralComplete
                          ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
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
                  {colorMode === 'presets'
                    ? 'Select a preset theme on the left'
                    : 'Tap letters on the left to customize colors'}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Color picker modal (custom hex mode) */}
      {modalIndex !== null && text[modalIndex] && colorMode === 'custom' && (
        <ColorModal
          letterChar={text[modalIndex]}
          letterIndex={modalIndex}
          currentColor={letterColors[modalIndex] || '#FFFFFF'}
          onApply={handleColorApply}
          onClose={() => { setModalIndex(null); setApplyAll(false); }}
        />
      )}

      {/* Color number modal (color guide mode) */}
      {modalIndex !== null && text[modalIndex] && colorMode === 'color-number' && (
        <PopupColorNumberModal
          letterChar={text[modalIndex]}
          letterIndex={modalIndex}
          currentColorNumber={colorNumbers[modalIndex] || null}
          onApply={handleColorNumberApply}
          onClose={() => { setModalIndex(null); setApplyAll(false); }}
        />
      )}
    </div>
  );
}
