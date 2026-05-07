'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function RedirectContent() {
  const searchParams = useSearchParams();
  const key = searchParams.get('key') || '';

  useEffect(() => {
    const url = key ? `/orders?key=${encodeURIComponent(key)}&filter=popup` : '/orders';
    window.location.replace(url);
  }, [key]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-400">Redirecting to orders...</p>
    </div>
  );
}

export default function PopupOrdersPage() {
  return (
    <Suspense>
      <RedirectContent />
    </Suspense>
  );
}
