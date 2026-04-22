import { NextRequest, NextResponse } from 'next/server';

const apiKey = process.env.AIRTABLE_API_KEY;
const baseId = process.env.AIRTABLE_BASE_ID;
const tableName = process.env.AIRTABLE_ORDERS_TABLE || 'Orders';
const adminKey = process.env.POPUP_ORDERS_ADMIN_KEY;

function getAirtableUrl() {
  return `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}`;
}

function getHeaders() {
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };
}

function isAuthorized(req: NextRequest): boolean {
  if (!adminKey) return false;
  return req.headers.get('x-popup-admin-key') === adminKey;
}

export async function GET(req: NextRequest) {
  try {
    if (!apiKey || !baseId) {
      return NextResponse.json({ error: 'Airtable is not configured' }, { status: 500 });
    }
    if (!isAuthorized(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const res = await fetch(getAirtableUrl(), {
      headers: getHeaders(),
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      const err = await res.json();
      console.error('Orders fetch error:', err);
      return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
    }

    const data = await res.json();
    const orders = (data.records || [])
      .map((record: { id: string; createdTime?: string; fields: Record<string, string> }) => ({
        id: record.id,
        customerName: record.fields['Customer Name'] || '',
        email: record.fields['Email'] || '',
        address: record.fields['Address'] || '',
        shippingMethod: record.fields['Shipping Method'] || '',
        items: record.fields['Items'] || '',
        lineItems: record.fields['Line Items'] || '',
        total: record.fields['Total'] || '',
        shippingCost: record.fields['Shipping Cost'] || '',
        stripeSessionId: record.fields['Stripe Session ID'] || '',
        date: record.fields['Date'] || record.createdTime?.split('T')[0] || '',
        status: record.fields['Status'] || 'New',
      }))
      .sort((a: { date: string }, b: { date: string }) => {
        const aTime = a.date ? new Date(a.date).getTime() : 0;
        const bTime = b.date ? new Date(b.date).getTime() : 0;
        return bTime - aTime;
      });

    return NextResponse.json({ orders });
  } catch (error) {
    console.error('Orders API error:', error);
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    if (!apiKey || !baseId) {
      return NextResponse.json({ error: 'Airtable is not configured' }, { status: 500 });
    }
    if (!isAuthorized(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, status } = await req.json();
    if (!id || !status) {
      return NextResponse.json({ error: 'Missing record id or status' }, { status: 400 });
    }

    const res = await fetch(getAirtableUrl(), {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify({
        records: [{ id: String(id), fields: { Status: String(status) } }],
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      console.error('Order status update error:', err);
      return NextResponse.json({ error: 'Failed to update status' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Orders PATCH error:', error);
    return NextResponse.json({ error: 'Failed to update status' }, { status: 500 });
  }
}
