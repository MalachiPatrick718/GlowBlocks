'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

interface ColorEntry {
  letter: string;
  colorHex: string;
  colorName?: string | null;
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

function PackingLabelContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  const source = searchParams.get('source');
  const key = searchParams.get('key') || '';

  const [data, setData] = useState<LabelData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id || !source || !key) {
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
          setData(json);
        }
      })
      .catch(() => setError('Failed to load order'))
      .finally(() => setLoading(false));
  }, [id, source, key]);

  useEffect(() => {
    if (data && !error) {
      setTimeout(() => window.print(), 500);
    }
  }, [data, error]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">Loading order...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-red-600">{error || 'No data'}</p>
      </div>
    );
  }

  const deliveryLabel = data.source === 'popup'
    ? ((data.orderType || '').toLowerCase().includes('pickup') ? 'Pick Up' : 'Ship to Customer')
    : (data.shippingMethod || 'Ship');

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
        {/* Brand Header */}
        <h1 className="brand-title text-4xl text-center mb-8">GlowBlocks Studio</h1>

        {/* Order Text - prominent */}
        <div className="text-center mb-8">
          <p className="text-4xl font-black tracking-[0.25em] leading-relaxed">
            {data.text || '-'}
          </p>
          {data.source === 'popup' && data.orderNumber && (
            <p className="mt-2 text-lg text-gray-500">Order #{data.orderNumber}</p>
          )}
        </div>

        {/* Divider */}
        <hr className="border-gray-200 mb-6" />

        {/* Info Grid */}
        <table className="w-full text-sm mb-6">
          <tbody>
            <tr>
              <td className="py-1.5 pr-4 font-semibold text-gray-500 w-28 align-top">Customer</td>
              <td className="py-1.5">{data.customerName || '-'}</td>
            </tr>
            <tr>
              <td className="py-1.5 pr-4 font-semibold text-gray-500 align-top">Delivery</td>
              <td className="py-1.5">{deliveryLabel}</td>
            </tr>
            {data.address && (
              <tr>
                <td className="py-1.5 pr-4 font-semibold text-gray-500 align-top">Address</td>
                <td className="py-1.5">{data.address}</td>
              </tr>
            )}
            {data.phone && (
              <tr>
                <td className="py-1.5 pr-4 font-semibold text-gray-500 align-top">Phone</td>
                <td className="py-1.5">{data.phone}</td>
              </tr>
            )}
            {data.email && (
              <tr>
                <td className="py-1.5 pr-4 font-semibold text-gray-500 align-top">Email</td>
                <td className="py-1.5">{data.email}</td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Colors */}
        {data.colors.length > 0 && (
          <>
            <hr className="border-gray-200 mb-6" />
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Colors</p>
            <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
              {data.colors.map((c, idx) => {
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
          </>
        )}

        {/* Online order items */}
        {data.source === 'online' && data.items && (
          <>
            <hr className="border-gray-200 my-6" />
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Items</p>
            <div className="text-sm space-y-1">
              {data.items.split(' | ').map((item, idx) => (
                <p key={idx}>{item}</p>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}
