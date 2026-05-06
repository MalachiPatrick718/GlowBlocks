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

function hexToRgb(hex: string): string | null {
  if (!hex || !/^#[0-9A-Fa-f]{6}$/.test(hex)) return null;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r}, ${g}, ${b}`;
}

function ColorGrid({ colors }: { colors: ColorEntry[] }) {
  return (
    <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
      {colors.map((c, idx) => {
        const rgb = hexToRgb(c.colorHex);
        return (
          <div key={idx} className="flex items-center gap-2.5">
            <span
              className="w-5 h-5 rounded border border-gray-200 shrink-0"
              style={{ backgroundColor: c.colorHex }}
            />
            <span className="font-semibold">{c.letter}</span>
            <span className="text-gray-500">
              {c.colorName || (rgb ? `(${rgb})` : c.colorHex)}
            </span>
          </div>
        );
      })}
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

      {sections.map((section, idx) => (
        <div key={idx} className={idx > 0 ? 'mt-6' : ''}>
          <p className="text-3xl font-black tracking-[0.2em] text-center mb-1">
            {section.text}
          </p>
          {idx === 0 && (
            <p className="text-sm text-gray-500 text-center mb-4">
              {data.customerName || '-'}
            </p>
          )}
          {idx > 0 && <div className="mb-4" />}
          {section.colors.length > 0 && (
            <ColorGrid colors={section.colors} />
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
        <h1 className="brand-title text-4xl text-center mb-8">GlowBlocks Studio</h1>

        {dataList.map((data, idx) => (
          <SlipSection key={idx} data={data} showDivider={idx > 0} />
        ))}
      </div>
    </>
  );
}
