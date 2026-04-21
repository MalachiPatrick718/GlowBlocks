'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import BlockPreview from '@/components/BlockPreview';
import TextInput from '@/components/TextInput';
import ColorPresets from '@/components/ColorPresets';
import PopupColorNumberModal from '@/components/PopupColorNumberModal';
import { POPUP_COLOR_MAP } from '@/data/popupColorCatalog';

export default function PopupPage() {
  const [text, setText] = useState('');
  const [letterColors, setLetterColors] = useState<string[]>([]);
  const [colorNumbers, setColorNumbers] = useState<(number | null)[]>([]);
  const [modalIndex, setModalIndex] = useState<number | null>(null);
  const [colorMode, setColorMode] = useState<'presets' | 'custom'>('presets');
  const [selectedPresetName, setSelectedPresetName] = useState<string | null>(null);
  const [highlightSection, setHighlightSection] = useState<'text' | 'colors' | 'contact' | null>(null);

  const textRef = useRef<HTMLDivElement>(null);
  const colorsRef = useRef<HTMLDivElement>(null);
  const contactRef = useRef<HTMLDivElement>(null);
  const [customerName, setCustomerName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [address, setAddress] = useState('');
  const [deliveryMethod, setDeliveryMethod] = useState<'pick-up' | 'ship'>('pick-up');
  const [addressSuggestions, setAddressSuggestions] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [orderConfirmed, setOrderConfirmed] = useState(false);
  const [confirmedWord, setConfirmedWord] = useState('');
  const [confirmedOrderNumber, setConfirmedOrderNumber] = useState('');
  const [confirmedPricing, setConfirmedPricing] = useState<{
    letterCount: number;
    pricePerLetter: number;
    letterSubtotal: number;
    customColorFee: number;
    subtotal: number;
    tax: number;
    taxRate: number;
    total: number;
  } | null>(null);

  const nonSpaceLetters = text.replace(/\s/g, '');

  // Calculate live pricing preview
  const livePrice = useMemo(() => {
    const count = nonSpaceLetters.length;
    if (count === 0) return null;

    let pricePerLetter = 12;
    if (count >= 10) pricePerLetter = 9;
    else if (count >= 7) pricePerLetter = 10;
    else if (count >= 4) pricePerLetter = 11;

    const letterSubtotal = count * pricePerLetter;
    const customColorFee = colorMode === 'custom' ? 2.00 : 0;
    const subtotal = letterSubtotal + customColorFee;
    const tax = subtotal * 0.08875;
    const total = subtotal + tax;

    return { count, pricePerLetter, letterSubtotal, customColorFee, subtotal, tax, total };
  }, [nonSpaceLetters, colorMode]);

  const handleTextChange = useCallback((newText: string) => {
    setText(newText);
    setLetterColors((prev) => {
      const next = [...prev];
      while (next.length < newText.length) next.push('#FFFFFF');
      return next.slice(0, newText.length);
    });
    setColorNumbers((prev) => {
      const next = [...prev];
      while (next.length < newText.length) next.push(null);
      return next.slice(0, newText.length);
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
    setColorNumbers(Array.from({ length: text.length }, (_, idx) => (text[idx] === ' ' ? null : null)));
    setSelectedPresetName(presetLabel || 'Preset Theme');
  }, [text]);

  const handleCustomApply = useCallback((colorNumber: number) => {
    if (modalIndex === null) return;
    const selected = POPUP_COLOR_MAP.get(colorNumber);
    if (!selected) return;

    setLetterColors((prev) => {
      const next = [...prev];
      next[modalIndex] = selected.hex;
      return next;
    });
    setColorNumbers((prev) => {
      const next = [...prev];
      next[modalIndex] = selected.id;
      return next;
    });
    setSelectedPresetName(null);
  }, [modalIndex]);

  const canSubmit = useMemo(() => {
    const hasContact = customerName.trim().length > 1 && phoneNumber.replace(/\D/g, '').length === 10;
    const hasRequiredAddress = deliveryMethod === 'ship' ? address.trim().length > 5 : true;
    const hasColors = colorMode === 'presets'
      ? selectedPresetName !== null
      : text.split('').every((ch, i) => ch === ' ' || colorNumbers[i] != null);
    return nonSpaceLetters.length > 0 && hasContact && hasRequiredAddress && hasColors;
  }, [nonSpaceLetters.length, customerName, phoneNumber, deliveryMethod, address, colorMode, selectedPresetName, text, colorNumbers]);

  const textComplete = nonSpaceLetters.length > 0;

  const colorsComplete = useMemo(() => {
    if (!textComplete) return false;
    if (colorMode === 'presets') return selectedPresetName !== null;
    return text.split('').every((ch, i) => ch === ' ' || colorNumbers[i] != null);
  }, [textComplete, colorMode, selectedPresetName, text, colorNumbers]);

  const contactComplete = useMemo(() => {
    const hasContact = customerName.trim().length > 1 && phoneNumber.replace(/\D/g, '').length === 10;
    const hasRequiredAddress = deliveryMethod === 'ship' ? address.trim().length > 5 : true;
    return hasContact && hasRequiredAddress;
  }, [customerName, phoneNumber, deliveryMethod, address]);

  const uncoloredCount = useMemo(() => {
    if (colorMode !== 'custom' || !textComplete) return 0;
    return text.split('').filter((ch, i) => ch !== ' ' && colorNumbers[i] == null).length;
  }, [text, colorNumbers, colorMode, textComplete]);

  useEffect(() => {
    if (!highlightSection) return;
    const timeout = setTimeout(() => setHighlightSection(null), 2000);
    return () => clearTimeout(timeout);
  }, [highlightSection]);

  useEffect(() => {
    if (!orderConfirmed) return;
    const timeout = setTimeout(() => {
      setOrderConfirmed(false);
      setSubmitMessage(null);
      setConfirmedWord('');
      setConfirmedOrderNumber('');
      setConfirmedPricing(null);
    }, 15000);
    return () => clearTimeout(timeout);
  }, [orderConfirmed]);

  useEffect(() => {
    if (deliveryMethod !== 'ship' || address.trim().length < 5) {
      setAddressSuggestions([]);
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      try {
        const q = encodeURIComponent(address.trim());
        const res = await fetch(`/api/address-suggest?q=${q}`, {
          signal: controller.signal,
        });

        if (!res.ok) return;
        const data = await res.json();
        const suggestions = Array.isArray(data?.suggestions) ? data.suggestions : [];
        setAddressSuggestions(suggestions);
      } catch {
        // Ignore autocomplete failures and let manual address entry continue.
      }
    }, 300);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [address, deliveryMethod]);

  const submitOrder = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setSubmitMessage(null);
    try {
      const res = await fetch('/api/popup-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          letterColors,
          colorNumbers,
          colorMode,
          presetName: selectedPresetName,
          customerName: customerName.trim(),
          phoneNumber: phoneNumber.trim(),
          address: address.trim(),
          deliveryMethod,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setSubmitMessage(data.error || 'Failed to submit popup order.');
        return;
      }

      setConfirmedWord(text);
      setConfirmedOrderNumber(data.orderNumber || '');
      setConfirmedPricing(data.pricing || null);
      setOrderConfirmed(true);
      setSubmitMessage('Pop-up order submitted successfully.');
      setText('');
      setLetterColors([]);
      setColorNumbers([]);
      setCustomerName('');
      setPhoneNumber('');
      setAddress('');
      setDeliveryMethod('pick-up');
      setAddressSuggestions([]);
      setSelectedPresetName(null);
      setModalIndex(null);
    } catch {
      setSubmitMessage('Failed to submit popup order.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitClick = () => {
    if (!textComplete) {
      setHighlightSection('text');
      textRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (!colorsComplete) {
      setHighlightSection('colors');
      colorsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (!contactComplete) {
      setHighlightSection('contact');
      contactRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    submitOrder();
  };

  const getSectionClass = (section: 'text' | 'colors' | 'contact') => {
    const isHighlighted = highlightSection === section;
    const isLocked = (section === 'colors' && !textComplete) || (section === 'contact' && !colorsComplete);
    return [
      'rounded-xl border p-4 sm:p-5 transition-all duration-300',
      isHighlighted ? 'border-amber-500 ring-2 ring-amber-500/60' : 'border-gray-800',
      isLocked ? 'opacity-40' : '',
    ].filter(Boolean).join(' ');
  };

  return (
    <div className="min-h-screen py-6 sm:py-8 px-3 sm:px-4">
      <div className="max-w-6xl mx-auto">
        {orderConfirmed ? (
          <div className="max-w-2xl mx-auto mt-6 sm:mt-10 rounded-2xl border border-green-700 bg-green-950/30 p-6 sm:p-8 space-y-6">
            <div className="text-center space-y-2">
              <h1 className="text-3xl sm:text-4xl font-bold text-green-300">Order Received!</h1>
              <p className="text-gray-200">
                Your pop-up order for <span className="font-semibold text-white text-xl">{confirmedWord || 'your word'}</span>
              </p>
            </div>

            {/* Order Number - Large and Bold */}
            <div className="bg-gray-950/50 border-2 border-green-500 rounded-xl p-6 text-center">
              <p className="text-sm text-gray-400 mb-2">Tell this number at the kiosk to checkout</p>
              <p className="text-7xl sm:text-8xl font-black text-white tracking-wider">
                {confirmedOrderNumber || '--'}
              </p>
            </div>

            {/* Pricing Breakdown */}
            {confirmedPricing && (
              <div className="bg-gray-950/50 border border-gray-700 rounded-xl p-5 space-y-3">
                <h3 className="font-semibold text-gray-300 text-center mb-3">Order Summary</h3>

                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">
                    {confirmedPricing.letterCount} Letter{confirmedPricing.letterCount !== 1 ? 's' : ''} × ${confirmedPricing.pricePerLetter.toFixed(2)} each
                  </span>
                  <span className="text-white font-medium">
                    ${confirmedPricing.letterSubtotal.toFixed(2)}
                  </span>
                </div>
                <p className="text-xs text-gray-500">
                  {confirmedPricing.letterCount <= 3 ? 'Tier: 1-3 letters ($12 each)' :
                   confirmedPricing.letterCount <= 6 ? 'Tier: 4-6 letters ($11 each)' :
                   confirmedPricing.letterCount <= 9 ? 'Tier: 7-9 letters ($10 each)' :
                   'Tier: 10+ letters ($9 each)'}
                </p>

                {confirmedPricing.customColorFee > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Custom Color Fee</span>
                    <span className="text-white font-medium">
                      ${confirmedPricing.customColorFee.toFixed(2)}
                    </span>
                  </div>
                )}

                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">
                    Tax
                  </span>
                  <span className="text-white font-medium">
                    ${confirmedPricing.tax.toFixed(2)}
                  </span>
                </div>

                <div className="border-t border-gray-700 pt-3 flex justify-between text-lg font-bold">
                  <span className="text-white">Total</span>
                  <span className="text-green-400">
                    ${confirmedPricing.total.toFixed(2)}
                  </span>
                </div>
              </div>
            )}

            <div className="bg-gray-900/60 border border-gray-700 rounded-xl p-5 text-center space-y-3">
              <p className="text-white font-bold text-lg">
                Please complete payment at the kiosk
              </p>
              <div className="space-y-1 text-sm text-gray-400">
                <p>Your GlowBlocks should be ready in about 10-15 minutes</p>
                <p>We&apos;ll text you when they&apos;re ready for pickup!</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => {
                  setOrderConfirmed(false);
                  setSubmitMessage(null);
                  setConfirmedWord('');
                  setConfirmedOrderNumber('');
                  setConfirmedPricing(null);
                }}
                className="py-3 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-semibold transition-all"
              >
                Place Another Order
              </button>
              <button
                onClick={() => {
                  setOrderConfirmed(false);
                  setSubmitMessage(null);
                  setConfirmedWord('');
                  setConfirmedOrderNumber('');
                  setConfirmedPricing(null);
                }}
                className="py-3 rounded-lg border border-gray-600 bg-gray-800 hover:bg-gray-700 text-white font-semibold transition-all"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <>
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold gradient-text text-center mb-6 sm:mb-8">
          Pop-Up Orders
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
          <div className="space-y-4">
            {/* Section 1: Enter your word */}
            <div ref={textRef} className={getSectionClass('text')}>
              <div className="flex items-center gap-2 mb-3">
                {textComplete
                  ? <span className="flex items-center justify-center w-5 h-5 rounded-full bg-green-600 text-white text-xs font-bold">✓</span>
                  : <span className="flex items-center justify-center w-5 h-5 rounded-full border border-gray-600 text-gray-500 text-xs font-bold">1</span>
                }
                <span className={`text-sm font-medium ${textComplete ? 'text-green-400' : 'text-gray-300'}`}>Enter your word</span>
              </div>
              <TextInput text={text} onChange={handleTextChange} />
            </div>

            {/* Section 2: Choose your colors */}
            <div ref={colorsRef} className={getSectionClass('colors')}>
              <div className="flex items-center gap-2 mb-3">
                {colorsComplete
                  ? <span className="flex items-center justify-center w-5 h-5 rounded-full bg-green-600 text-white text-xs font-bold">✓</span>
                  : <span className="flex items-center justify-center w-5 h-5 rounded-full border border-gray-600 text-gray-500 text-xs font-bold">2</span>
                }
                <span className={`text-sm font-medium ${colorsComplete ? 'text-green-400' : 'text-gray-300'}`}>Choose your colors</span>
              </div>
              {!textComplete ? (
                <p className="text-sm text-gray-500">Enter your word above to continue</p>
              ) : (
                <div className="space-y-4">
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
                    <div className="space-y-2">
                      <ColorPresets
                        onApplyPreset={handlePresetApply}
                        letterCount={nonSpaceLetters.length}
                        selectedPresetName={selectedPresetName}
                      />
                      {!selectedPresetName && (
                        <p className="text-sm text-amber-300/80">Select a theme above</p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-sm text-gray-400">
                        Tap each letter and enter a saved color number (1-200).
                      </p>
                      <div className="bg-gray-950 border border-gray-800 rounded-xl p-4">
                        <BlockPreview
                          text={text}
                          letterColors={letterColors}
                          onSelectBlock={(i) => {
                            if (text[i] !== ' ') setModalIndex(i);
                          }}
                        />
                      </div>
                      {uncoloredCount > 0 && (
                        <p className="text-sm text-amber-300/80">
                          {uncoloredCount === 1 ? '1 letter still needs a color' : `${uncoloredCount} letters still need a color`}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Section 3: Your details */}
            <div ref={contactRef} className={getSectionClass('contact')}>
              <div className="flex items-center gap-2 mb-3">
                {contactComplete
                  ? <span className="flex items-center justify-center w-5 h-5 rounded-full bg-green-600 text-white text-xs font-bold">✓</span>
                  : <span className="flex items-center justify-center w-5 h-5 rounded-full border border-gray-600 text-gray-500 text-xs font-bold">3</span>
                }
                <span className={`text-sm font-medium ${contactComplete ? 'text-green-400' : 'text-gray-300'}`}>Your details</span>
              </div>
              <div className="space-y-3">
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="First Name"
                  className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                />
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
                    if (digits.length >= 7) {
                      setPhoneNumber(`(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`);
                    } else if (digits.length >= 4) {
                      setPhoneNumber(`(${digits.slice(0, 3)}) ${digits.slice(3)}`);
                    } else {
                      setPhoneNumber(digits);
                    }
                  }}
                  placeholder="(555) 555-5555"
                  className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                />
                <div className="space-y-2">
                  <p className="text-sm text-gray-300">Delivery Method</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setDeliveryMethod('pick-up')}
                      className={`py-2 rounded-lg border text-sm font-medium transition-colors ${
                        deliveryMethod === 'pick-up'
                          ? 'bg-purple-600 border-purple-500 text-white'
                          : 'bg-gray-900 border-gray-700 text-gray-300 hover:text-white'
                      }`}
                    >
                      Pick Up
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeliveryMethod('ship')}
                      className={`py-2 rounded-lg border text-sm font-medium transition-colors ${
                        deliveryMethod === 'ship'
                          ? 'bg-purple-600 border-purple-500 text-white'
                          : 'bg-gray-900 border-gray-700 text-gray-300 hover:text-white'
                      }`}
                    >
                      Ship to Me
                    </button>
                  </div>
                </div>
                {deliveryMethod === 'ship' && (
                  <>
                    <input
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Shipping address (required)"
                      className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                    />
                    {addressSuggestions.length > 0 && (
                      <div className="rounded-lg border border-gray-800 bg-gray-950/90 max-h-44 overflow-y-auto">
                        {addressSuggestions.map((suggestion) => (
                          <button
                            key={suggestion}
                            type="button"
                            onClick={() => {
                              setAddress(suggestion);
                              setAddressSuggestions([]);
                            }}
                            className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-800/80"
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    )}
                    {address.trim().length <= 5 && (
                      <p className="text-xs text-amber-300">Shipping requires a complete address.</p>
                    )}
                  </>
                )}
                {deliveryMethod === 'pick-up' && (
                  <p className="text-xs text-gray-500">
                    By submitting, you agree to receive SMS order updates at the number provided. Msg &amp; data rates may apply. View our{' '}
                    <a href="/privacy" className="text-purple-400 hover:text-purple-300 underline">Privacy Policy</a> and{' '}
                    <a href="/terms" className="text-purple-400 hover:text-purple-300 underline">Terms</a>.
                  </p>
                )}
              </div>
            </div>

            {/* Submit */}
            <div className="pt-2">
              <button
                onClick={handleSubmitClick}
                disabled={submitting}
                className="w-full py-3 rounded-lg font-semibold text-lg bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white transition-all duration-300"
              >
                {submitting ? 'Submitting...' : 'Confirm Pop-Up Order'}
              </button>
              {highlightSection && (
                <p className="text-sm text-amber-300 mt-2 text-center">Please complete the highlighted section above</p>
              )}
              {submitMessage && <p className="text-sm text-gray-300 mt-2">{submitMessage}</p>}
            </div>
          </div>

          <div className="lg:sticky lg:top-24 h-fit space-y-4">
            <div className="bg-gray-950 border border-gray-800 rounded-2xl p-6 space-y-4">
              <h2 className="text-lg font-semibold text-gray-300">Live Preview</h2>
              <BlockPreview text={text} letterColors={letterColors} />
              {nonSpaceLetters.length > 0 && (
                <p className="text-center text-sm text-gray-500 mt-4">
                  {colorMode === 'custom' ? 'Tap letters on the left and enter color numbers' : 'Select a preset theme on the left'}
                </p>
              )}
            </div>

            {livePrice && (
              <div className="bg-gradient-to-br from-purple-950/50 to-pink-950/50 border border-purple-700/50 rounded-2xl p-6 space-y-3">
                <h2 className="text-lg font-semibold text-purple-300">Price Estimate</h2>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-gray-300">
                    <span>{livePrice.count} letter{livePrice.count !== 1 ? 's' : ''} × ${livePrice.pricePerLetter}</span>
                    <span>${livePrice.letterSubtotal.toFixed(2)}</span>
                  </div>
                  {livePrice.customColorFee > 0 && (
                    <div className="flex justify-between text-gray-300">
                      <span>Custom Color Fee</span>
                      <span>${livePrice.customColorFee.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-gray-300">
                    <span>Tax</span>
                    <span>${livePrice.tax.toFixed(2)}</span>
                  </div>
                  <div className="border-t border-purple-700/50 pt-2 flex justify-between text-lg font-bold">
                    <span className="text-white">Total</span>
                    <span className="text-green-400">${livePrice.total.toFixed(2)}</span>
                  </div>
                </div>
                <p className="text-xs text-gray-400 text-center">
                  {livePrice.count <= 3 ? '1-3 letters: $12 each' :
                   livePrice.count <= 6 ? '4-6 letters: $11 each' :
                   livePrice.count <= 9 ? '7-9 letters: $10 each' :
                   '10+ letters: $9 each'}
                </p>
              </div>
            )}
          </div>
        </div>
          </>
        )}
      </div>

      {modalIndex !== null && text[modalIndex] && (
        <PopupColorNumberModal
          key={`${modalIndex}-${colorNumbers[modalIndex] || 'none'}`}
          letterChar={text[modalIndex]}
          letterIndex={modalIndex}
          currentColorNumber={colorNumbers[modalIndex] || null}
          onApply={handleCustomApply}
          onClose={() => setModalIndex(null)}
        />
      )}
    </div>
  );
}
