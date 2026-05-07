'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

interface ColorEntry {
  letter: string;
  colorHex: string;
  colorName?: string | null;
}

interface SetEntry {
  text: string;
  colorMode?: string;
  colors: ColorEntry[];
}

interface LabelData {
  source: string;
  customerName: string;
  phone?: string;
  email?: string;
  address?: string;
  text: string;
  orderNumber?: string;
  orderType?: string;
  colorMode?: string;
  items?: string;
  shippingMethod?: string;
  total?: string;
  colors: ColorEntry[];
  sets?: SetEntry[];
  date?: string;
}

export default function PackingLabelPage() {
  return (
    <Suspense>
      <PackingLabelContent />
    </Suspense>
  );
}

function BlockRow({ colors }: { colors: ColorEntry[] }) {
  return (
    <div className="flex justify-center gap-2 flex-wrap">
      {colors.map((c, idx) => (
        <span
          key={idx}
          className="text-3xl font-black"
          style={{ color: c.colorHex }}
        >
          {c.letter}
        </span>
      ))}
    </div>
  );
}

function getColors(data: LabelData): { text: string; colors: ColorEntry[] }[] {
  if (data.source === 'popup' && data.sets && data.sets.length > 0) {
    return data.sets.map((set) => ({ text: set.text, colors: set.colors }));
  }
  return [{ text: data.text || '-', colors: data.colors }];
}

function SlipSection({ data, showDivider }: { data: LabelData; showDivider: boolean }) {
  const sections = getColors(data);
  return (
    <div style={{ breakInside: 'avoid' }}>
      {showDivider && <hr className="border-gray-300 border-dashed my-8" />}

      <p className="text-lg font-bold text-black text-center mb-1">
        {data.customerName || '-'}
      </p>

      {data.orderNumber && (
        <p className="text-sm text-gray-500 text-center mb-4">Order #{data.orderNumber}</p>
      )}

      {sections.map((section, idx) => (
        <div key={idx} className={idx > 0 ? 'mt-6' : ''}>
          {section.colors.length > 0 ? (
            <>
              <BlockRow colors={section.colors} />
              <div className="flex justify-center gap-3 mt-2 flex-wrap">
                {section.colors.map((c, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-xs text-gray-500">
                    <span className="inline-block w-3 h-3 rounded-full border border-gray-300" style={{ backgroundColor: c.colorHex }} />
                    {c.colorName || c.colorHex}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-3xl font-black tracking-[0.2em] text-center">
              {section.text}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

function PackingLabelContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  const source = searchParams.get('source');
  const ordersParam = searchParams.get('orders');
  const key = searchParams.get('key') || '';

  const [dataList, setDataList] = useState<LabelData[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!key) {
      setError('Missing required parameters');
      setLoading(false);
      return;
    }

    // Multi-order mode
    if (ordersParam) {
      fetch(`/api/packing-label?orders=${encodeURIComponent(ordersParam)}`, {
        headers: { 'x-popup-admin-key': key },
      })
        .then((res) => res.json())
        .then((json) => {
          if (json.error) {
            setError(json.error);
          } else if (json.multi && Array.isArray(json.orders)) {
            setDataList(json.orders);
          } else {
            setError('Unexpected response');
          }
        })
        .catch(() => setError('Failed to load orders'))
        .finally(() => setLoading(false));
      return;
    }

    // Single-order mode
    if (!id || !source) {
      setError('Missing required parameters');
      setLoading(false);
      return;
    }

    fetch(`/api/packing-label?id=${encodeURIComponent(id)}&source=${encodeURIComponent(source)}`, {
      headers: { 'x-popup-admin-key': key },
    })
      .then((res) => res.json())
      .then((json) => {
        if (json.error) {
          setError(json.error);
        } else {
          setDataList([json]);
        }
      })
      .catch(() => setError('Failed to load order'))
      .finally(() => setLoading(false));
  }, [id, source, ordersParam, key]);

  useEffect(() => {
    if (dataList.length > 0 && !error) {
      setTimeout(() => window.print(), 500);
    }
  }, [dataList, error]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">Loading order...</p>
      </div>
    );
  }

  if (error || dataList.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-red-600">{error || 'No data'}</p>
      </div>
    );
  }

  return (
    <>
      <style jsx global>{`
        @page { size: letter; margin: 0.75in; }
        nav, footer { display: none !important; }
        body { margin: 0; background: white !important; color: black !important; }
        main { flex: unset !important; }
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
        }
        @media screen {
          body { background: #f3f4f6 !important; }
        }
        .brand-title {
          font-family: var(--font-baloo), 'Baloo 2', cursive;
          font-weight: 700;
          font-size: 2.5rem;
          background: linear-gradient(to right, #9333ea, #ec4899);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
      `}</style>

      <div className="no-print fixed top-4 right-4 z-50">
        <button
          onClick={() => window.print()}
          className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-lg shadow-lg"
        >
          Print
        </button>
      </div>

      <div className="max-w-[7in] mx-auto my-8 print:my-0 bg-white print:shadow-none border border-gray-200 print:border-none rounded-lg print:rounded-none p-10 font-sans text-black">
        <h1 className="brand-title text-4xl text-center mb-1">Glowblocks Studio</h1>
        <p className="text-sm text-gray-400 text-center tracking-widest uppercase mb-8">Packing Slip</p>

        {dataList.map((data, idx) => (
          <SlipSection
            key={idx}
            data={data}
            showDivider={idx > 0}
          />
        ))}

        <div className="mt-10 pt-6 border-t border-gray-200 text-center">
          <p className="text-base font-semibold text-black mb-2">Thank you for your order!</p>
          <p className="text-sm text-gray-500 mb-3">We hope you love your Glowblocks. Enjoy 10% off your next order, use code: <span className="font-bold text-purple-600">POP</span></p>
          <p className="text-xs text-gray-400 mt-3">glowblocks.shop</p>
        </div>

        <div className="mt-6 pt-4 border-t border-gray-100 text-center">
          <p className="text-xs text-gray-500 leading-relaxed max-w-md mx-auto">
            <span className="font-semibold text-gray-600">Battery Info: </span> Your Glowblocks battery lasts approximately 5–6 months. When it&apos;s time for a replacement, you can return your Glowblock(s) to us for servicing, or purchase a CR2450 coin-cell battery and replace it yourself at your own risk. To request a return label and box, submit a Glowblocks Service Request on our Contact page at glowblocks.shop/service or email orders@glowblocks.shop.
          </p>
        </div>
      </div>
    </>
  );
}
