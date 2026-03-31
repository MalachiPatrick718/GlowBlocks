import { NextRequest, NextResponse } from 'next/server';

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY || '';
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || '';
const AIRTABLE_TABLE_NAME = process.env.AIRTABLE_TABLE_NAME || 'Reviews';

const airtableUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE_NAME)}`;

const headers = {
  Authorization: `Bearer ${AIRTABLE_API_KEY}`,
  'Content-Type': 'application/json',
};

interface Review {
  name: string;
  rating: number;
  text: string;
  date: string;
  order: string;
}

export async function GET() {
  try {
    const res = await fetch(`${airtableUrl}?sort%5B0%5D%5Bfield%5D=Date&sort%5B0%5D%5Bdirection%5D=desc`, {
      headers,
      next: { revalidate: 60 },
    });

    if (!res.ok) {
      return NextResponse.json([], { status: 200 });
    }

    const data = await res.json();
    const reviews: Review[] = data.records.map((record: { fields: Record<string, unknown> }) => ({
      name: record.fields.Name || '',
      rating: Number(record.fields.Rating) || 5,
      text: record.fields.Text || '',
      date: record.fields.Date || '',
      order: record.fields.Order || '',
    }));

    return NextResponse.json(reviews);
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { name, rating, text, order } = await req.json();

    if (!name || !text || !rating) {
      return NextResponse.json({ error: 'Name, rating, and review are required.' }, { status: 400 });
    }

    if (typeof rating !== 'number' || rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'Rating must be between 1 and 5.' }, { status: 400 });
    }

    const now = new Date();
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const dateStr = `${months[now.getMonth()]} ${now.getFullYear()}`;

    const res = await fetch(airtableUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        records: [{
          fields: {
            Name: String(name).slice(0, 50),
            Rating: Math.round(rating),
            Text: String(text).slice(0, 1000),
            Date: dateStr,
            Order: order ? String(order).slice(0, 100) : '',
          },
        }],
      }),
    });

    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to save review.' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to save review.' }, { status: 500 });
  }
}
