import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { name, email, orderNumber, serviceType, details } = await req.json();

    if (!name || !email || !serviceType) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const apiKey = process.env.AIRTABLE_API_KEY;
    const baseId = process.env.AIRTABLE_BASE_ID;
    const tableName = process.env.AIRTABLE_SERVICE_TABLE || 'Service Requests';

    if (!apiKey || !baseId) {
      return NextResponse.json({ error: 'Airtable is not configured' }, { status: 500 });
    }

    const res = await fetch(
      `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fields: {
            Name: name,
            Email: email,
            'Order Number': orderNumber || '',
            'Service Type': serviceType,
            Details: details || '',
            Date: new Date().toISOString().split('T')[0],
            Status: 'New',
          },
        }),
      }
    );

    if (!res.ok) {
      const err = await res.json();
      console.error('Airtable error:', err);
      return NextResponse.json({ error: 'Failed to save service request' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Service request error:', error);
    return NextResponse.json({ error: 'Failed to submit service request.' }, { status: 500 });
  }
}
