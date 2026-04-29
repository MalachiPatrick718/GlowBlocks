import { NextRequest, NextResponse } from 'next/server';

const apiKey = process.env.AIRTABLE_API_KEY;
const baseId = process.env.AIRTABLE_BASE_ID;
const tableName = process.env.AIRTABLE_POPUP_ORDERS || process.env.AIRTABLE_POPUP_ORDERS_TABLE || 'Popup';

function getAirtableUrl() {
  return `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}`;
}

function getHeaders() {
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };
}

export async function GET(req: NextRequest) {
  try {
    if (!apiKey || !baseId) {
      return NextResponse.json({ error: 'Not configured' }, { status: 500 });
    }

    const orderNum = req.nextUrl.searchParams.get('order') || '';
    const phone = req.nextUrl.searchParams.get('phone') || '';

    if (!orderNum || !phone) {
      return NextResponse.json({ error: 'Order number and phone number are required' }, { status: 400 });
    }

    const filterFormula = `{Order Number}="${orderNum}"`;
    const url = `${getAirtableUrl()}?filterByFormula=${encodeURIComponent(filterFormula)}`;
    const res = await fetch(url, {
      headers: getHeaders(),
      cache: 'no-store',
    });

    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to look up order' }, { status: 500 });
    }

    const data = await res.json();
    const records = data.records || [];

    const phoneDigits = phone.replace(/[^\d]/g, '');
    const match = records.find((record: { fields: Record<string, string> }) => {
      const storedPhone = (record.fields['Phone Number'] || '').replace(/[^\d]/g, '');
      return storedPhone.slice(-10) === phoneDigits.slice(-10);
    });

    if (!match) {
      return NextResponse.json({ error: 'No order found matching that order number and phone number' }, { status: 404 });
    }

    const fields = match.fields;

    let deliveryMethod = '';
    try {
      const cc = JSON.parse(fields['Custom Colors'] || '{}');
      deliveryMethod = cc.deliveryMethod || '';
    } catch {}

    return NextResponse.json({
      orderNumber: fields['Order Number'] || '',
      customerName: (fields['Name'] || '').split(' ')[0],
      status: fields['Order Status'] || 'Received',
      pickupStatus: fields['Pickup Status'] || '',
      trackingNumber: fields['Tracking Number'] || '',
      deliveryMethod,
    });
  } catch (error) {
    console.error('Order status lookup error:', error);
    return NextResponse.json({ error: 'Failed to look up order' }, { status: 500 });
  }
}
