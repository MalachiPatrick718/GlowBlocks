'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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
  const [showContact, setShowContact] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [address, setAddress] = useState('');
  const [deliveryMethod, setDeliveryMethod] = useState<'pick-up' | 'ship'>('pick-up');
  const [addressSuggestions, setAddressSuggestions] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [orderConfirmed, setOrderConfirmed] = useState(false);
  const [confirmedWord, setConfirmedWord] = useState('');

  const nonSpaceLetters = text.replace(/\s/g, '');

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
    const hasContact = customerName.trim().length > 1 && phoneNumber.trim().length > 6;
    const hasRequiredAddress = deliveryMethod === 'ship' ? address.trim().length > 5 : true;
    return nonSpaceLetters.length > 0 && hasContact && hasRequiredAddress;
  }, [nonSpaceLetters.length, customerName, phoneNumber, deliveryMethod, address]);

  useEffect(() => {
    if (!orderConfirmed) return;
    const timeout = setTimeout(() => {
      setOrderConfirmed(false);
      setSubmitMessage(null);
      setConfirmedWord('');
    }, 8000);
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
      setShowContact(false);
      setSelectedPresetName(null);
      setModalIndex(null);
    } catch {
      setSubmitMessage('Failed to submit popup order.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen py-6 sm:py-8 px-3 sm:px-4">
      <div className="max-w-6xl mx-auto">
        {orderConfirmed ? (
          <div className="max-w-2xl mx-auto mt-6 sm:mt-10 rounded-2xl border border-green-700 bg-green-950/30 p-6 sm:p-8 text-center space-y-4">
            <h1 className="text-3xl sm:text-4xl font-bold text-green-300">Order Received</h1>
            <p className="text-gray-200">
              Your pop-up order for <span className="font-semibold text-white">{confirmedWord || 'your word'}</span> has been submitted.
            </p>
            <p className="text-sm text-gray-400">
              We got your details. Please complete your payment at the kiosk.
            </p>
            <p className="text-sm text-gray-300">
              Your GlowBlocks should be ready in about 10-15 minutes, and you will be texted when they are ready.
            </p>
            <button
              onClick={() => {
                setOrderConfirmed(false);
                setSubmitMessage(null);
                setConfirmedWord('');
              }}
              className="mt-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-semibold transition-all"
            >
              Done
            </button>
          </div>
        ) : (
          <>
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold gradient-text text-center mb-6 sm:mb-8">
          Pop-Up Orders
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
          <div className="space-y-6">
            <TextInput text={text} onChange={handleTextChange} />

            {nonSpaceLetters.length > 0 && (
              <>
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
                  </div>
                )}

                <div className="pt-4 border-t border-gray-800 space-y-3">
                  {!showContact ? (
                    <button
                      onClick={() => setShowContact(true)}
                      className="w-full py-3 rounded-lg font-semibold text-lg bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 transition-all duration-300"
                    >
                      Submit Pop-Up Order
                    </button>
                  ) : (
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
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        placeholder="Phone number"
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
                      <button
                        onClick={submitOrder}
                        disabled={!canSubmit || submitting}
                        className="w-full py-3 rounded-lg font-semibold text-lg bg-gradient-to-r from-green-600 to-emerald-600 disabled:opacity-60 disabled:cursor-not-allowed hover:from-green-500 hover:to-emerald-500 text-white transition-all duration-300"
                      >
                        {submitting ? 'Submitting...' : 'Confirm Pop-Up Order'}
                      </button>
                    </div>
                  )}
                  {submitMessage && <p className="text-sm text-gray-300">{submitMessage}</p>}
                </div>
              </>
            )}
          </div>

          <div className="lg:sticky lg:top-24 h-fit">
            <div className="bg-gray-950 border border-gray-800 rounded-2xl p-6 space-y-4">
              <h2 className="text-lg font-semibold text-gray-300">Live Preview</h2>
              <BlockPreview text={text} letterColors={letterColors} />
              {nonSpaceLetters.length > 0 && (
                <p className="text-center text-sm text-gray-500 mt-4">
                  {colorMode === 'custom' ? 'Tap letters on the left and enter color numbers' : 'Select a preset theme on the left'}
                </p>
              )}
            </div>
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
