import { NextRequest, NextResponse } from 'next/server';

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY || '';
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || '';
const AIRTABLE_TABLE_NAME = process.env.AIRTABLE_TABLE_NAME || 'Reviews';

const airtableUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE_NAME)}`;

const headers = {
  Authorization: `Bearer ${AIRTABLE_API_KEY}`,
  'Content-Type': 'application/json',
};

interface ReviewPhoto {
  url: string;
  filename?: string;
  thumbnails?: {
    small?: { url: string };
    large?: { url: string };
  };
}

interface Review {
  name: string;
  rating: number;
  text: string;
  date: string;
  order: string;
  photos: ReviewPhoto[];
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
    const reviews: Review[] = data.records.map((record: { fields: Record<string, unknown> }) => {
      const photos = Array.isArray(record.fields.Photos)
        ? (record.fields.Photos as ReviewPhoto[]).map((p) => ({
            url: p.url,
            filename: p.filename,
            thumbnails: p.thumbnails,
          }))
        : [];
      return {
        name: record.fields.Name || '',
        rating: Number(record.fields.Rating) || 5,
        text: record.fields.Text || '',
        date: record.fields.Date || '',
        order: record.fields.Order || '',
        photos,
      };
    });

    return NextResponse.json(reviews);
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const name = formData.get('name') as string | null;
    const ratingStr = formData.get('rating') as string | null;
    const text = formData.get('text') as string | null;
    const order = formData.get('order') as string | null;
    const photo = formData.get('photo') as File | null;

    if (!name || !text || !ratingStr) {
      return NextResponse.json({ error: 'Name, rating, and review are required.' }, { status: 400 });
    }

    const rating = Number(ratingStr);
    if (isNaN(rating) || rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'Rating must be between 1 and 5.' }, { status: 400 });
    }

    // Validate photo if provided
    if (photo) {
      if (!ALLOWED_TYPES.includes(photo.type)) {
        return NextResponse.json({ error: 'Photo must be JPEG, PNG, or WebP.' }, { status: 400 });
      }
      if (photo.size > MAX_FILE_SIZE) {
        return NextResponse.json({ error: 'Photo must be under 5MB.' }, { status: 400 });
      }
    }

    const now = new Date();
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const dateStr = `${months[now.getMonth()]} ${now.getFullYear()}`;

    // Create review record
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

    const created = await res.json();
    const recordId = created.records?.[0]?.id;

    // Upload photo to Airtable attachment field if provided
    if (photo && recordId) {
      try {
        const photoBuffer = await photo.arrayBuffer();
        const uploadUrl = `https://content.airtable.com/v0/${AIRTABLE_BASE_ID}/${recordId}/Photos/uploadAttachment`;
        const uploadForm = new FormData();
        uploadForm.append('file', new Blob([photoBuffer], { type: photo.type }), photo.name || 'photo.jpg');

        await fetch(uploadUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${AIRTABLE_API_KEY}`,
          },
          body: uploadForm,
        });
      } catch (err) {
        console.error('Failed to upload photo to Airtable:', err);
        // Review was still saved, just without photo
      }
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to save review.' }, { status: 500 });
  }
}
