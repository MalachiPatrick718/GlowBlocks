import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const query = req.nextUrl.searchParams.get('q')?.trim() || '';
    if (query.length < 5) {
      return NextResponse.json({ suggestions: [] });
    }

    const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&countrycodes=us&limit=5&q=${encodeURIComponent(query)}`;
    const res = await fetch(nominatimUrl, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'GlowBlocks/1.0 (popup-orders)',
      },
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      return NextResponse.json({ suggestions: [] });
    }

    const data = await res.json();
    const suggestions = Array.isArray(data)
      ? data
          .map((item: { display_name?: string }) => item.display_name || '')
          .filter(Boolean)
          .slice(0, 5)
      : [];

    return NextResponse.json({ suggestions });
  } catch {
    return NextResponse.json({ suggestions: [] });
  }
}
