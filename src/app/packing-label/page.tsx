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

interface PricingData {
  subtotal: number;
  customColorFee: number;
  discount: number;
  shipping: number;
  tax: number;
  total: number;
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
  pricing?: PricingData;
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
        <div
          key={idx}
          className="w-12 h-12 rounded-lg flex items-center justify-center text-xl font-black"
          style={{ backgroundColor: '#1a1a1a', color: c.colorHex }}
        >
          {c.letter}
        </div>
      ))}
    </div>
  );
}

function fmt(n: number): string {
  return `$${n.toFixed(2)}`;
}

function PricingBreakdown({ pricing }: { pricing: PricingData }) {
  return (
    <div className="text-sm text-center mt-4 space-y-1">
      <div className="flex justify-between max-w-[14rem] mx-auto">
        <span className="text-gray-500">Subtotal</span>
        <span>{fmt(pricing.subtotal)}</span>
      </div>
      {pricing.customColorFee > 0 && (
        <div className="flex justify-between max-w-[14rem] mx-auto">
          <span className="text-gray-500">Custom Color Fee</span>
          <span>{fmt(pricing.customColorFee)}</span>
        </div>
      )}
      {pricing.discount > 0 && (
        <div className="flex justify-between max-w-[14rem] mx-auto">
          <span className="text-gray-500">Discount</span>
          <span className="text-green-600">-{fmt(pricing.discount)}</span>
        </div>
      )}
      {pricing.shipping > 0 && (
        <div className="flex justify-between max-w-[14rem] mx-auto">
          <span className="text-gray-500">Shipping</span>
          <span>{fmt(pricing.shipping)}</span>
        </div>
      )}
      {pricing.tax > 0 && (
        <div className="flex justify-between max-w-[14rem] mx-auto">
          <span className="text-gray-500">Tax</span>
          <span>{fmt(pricing.tax)}</span>
        </div>
      )}
      <div className="flex justify-between max-w-[14rem] mx-auto font-bold pt-1 border-t border-gray-200">
        <span>Total</span>
        <span>{fmt(pricing.total)}</span>
      </div>
    </div>
  );
}

function getColors(data: LabelData): { text: string; colors: ColorEntry[] }[] {
  if (data.source === 'popup' && data.sets && data.sets.length > 0) {
    return data.sets.map((set) => ({ text: set.text, colors: set.colors }));
  }
  return [{ text: data.text || '-', colors: data.colors }];
}

function SlipSection({ data, showDivider, showPricing }: { data: LabelData; showDivider: boolean; showPricing: boolean }) {
  const sections = getColors(data);
  return (
    <div style={{ breakInside: 'avoid' }}>
      {showDivider && <hr className="border-gray-300 border-dashed my-8" />}

      <p className="text-lg font-bold text-black text-center mb-4">
        {data.customerName || '-'}
      </p>

      {sections.map((section, idx) => (
        <div key={idx} className={idx > 0 ? 'mt-6' : ''}>
          {section.colors.length > 0 ? (
            <BlockRow colors={section.colors} />
          ) : (
            <p className="text-3xl font-black tracking-[0.2em] text-center">
              {section.text}
            </p>
          )}
        </div>
      ))}

      {showPricing && data.pricing && (
        <PricingBreakdown pricing={data.pricing} />
      )}
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
        <h1 className="brand-title text-4xl text-center mb-1">GlowBlocks Studio</h1>
        <p className="text-sm text-gray-400 text-center tracking-widest uppercase mb-8">Packing Slip</p>

        {dataList.map((data, idx) => (
          <SlipSection
            key={idx}
            data={data}
            showDivider={idx > 0}
            showPricing
          />
        ))}

        {dataList.length > 1 && (() => {
          const combined: PricingData = { subtotal: 0, customColorFee: 0, discount: 0, shipping: 0, tax: 0, total: 0 };
          for (const d of dataList) {
            if (d.pricing) {
              combined.subtotal += d.pricing.subtotal;
              combined.customColorFee += d.pricing.customColorFee;
              combined.discount += d.pricing.discount;
              combined.shipping += d.pricing.shipping;
              combined.tax += d.pricing.tax;
              combined.total += d.pricing.total;
            }
          }
          return (
            <>
              <hr className="border-gray-300 border-dashed my-8" />
              <p className="text-lg font-bold text-black text-center mb-2">Combined Total</p>
              <PricingBreakdown pricing={combined} />
            </>
          );
        })()}
      </div>
    </>
  );
}
