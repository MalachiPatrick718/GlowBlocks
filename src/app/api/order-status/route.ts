import { NextRequest, NextResponse } from 'next/server';

const apiKey = process.env.AIRTABLE_API_KEY;
const baseId = process.env.AIRTABLE_BASE_ID;
const popupTable = process.env.AIRTABLE_POPUP_ORDERS || process.env.AIRTABLE_POPUP_ORDERS_TABLE || 'Popup';
const ordersTable = process.env.AIRTABLE_ORDERS_TABLE || 'Orders';

function getAirtableUrl(table: string) {
  return `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(table)}`;
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
    const email = req.nextUrl.searchParams.get('email') || '';

    if (!orderNum && !email) {
      return NextResponse.json({ error: 'Order number or email is required' }, { status: 400 });
    }

    // Search popup orders by order number + phone
    if (orderNum && phone) {
      const filterFormula = `{Order Number}="${orderNum}"`;
      const url = `${getAirtableUrl(popupTable)}?filterByFormula=${encodeURIComponent(filterFormula)}`;
      const res = await fetch(url, { headers: getHeaders(), cache: 'no-store' });

      if (res.ok) {
        const data = await res.json();
        const records = data.records || [];
        const phoneDigits = phone.replace(/[^\d]/g, '');
        const match = records.find((record: { fields: Record<string, string> }) => {
          const storedPhone = (record.fields['Phone Number'] || '').replace(/[^\d]/g, '');
          return storedPhone.slice(-10) === phoneDigits.slice(-10);
        });

        if (match) {
          const fields = match.fields;
          let deliveryMethod = '';
          try {
            const cc = JSON.parse(fields['Custom Colors'] || '{}');
            deliveryMethod = cc.deliveryMethod || '';
          } catch {}

          return NextResponse.json({
            type: 'popup',
            orderNumber: fields['Order Number'] || '',
            customerName: (fields['Name'] || '').split(' ')[0],
            status: fields['Order Status'] || 'Received',
            pickupStatus: fields['Pickup Status'] || '',
            trackingNumber: fields['Tracking Number'] || '',
            deliveryMethod,
          });
        }
      }
    }

    // Search online orders by email
    if (email) {
      const filterFormula = `LOWER({Email})="${email.toLowerCase()}"`;
      const url = `${getAirtableUrl(ordersTable)}?filterByFormula=${encodeURIComponent(filterFormula)}&sort%5B0%5D%5Bfield%5D=Date&sort%5B0%5D%5Bdirection%5D=desc`;
      const res = await fetch(url, { headers: getHeaders(), cache: 'no-store' });

      if (res.ok) {
        const data = await res.json();
        const records = data.records || [];

        if (records.length > 0) {
          const onlineOrders = records.map((record: { fields: Record<string, string> }) => {
            const f = record.fields;
            return {
              type: 'online' as const,
              customerName: (f['Customer Name'] || '').split(' ')[0],
              status: f['Status'] || 'New',
              trackingNumber: f['Tracking Number'] || '',
              items: f['Items'] || f['Line Items'] || '',
              date: f['Date'] || '',
              deliveryMethod: 'ship',
            };
          });

          return NextResponse.json({ orders: onlineOrders });
        }
      }
    }

    return NextResponse.json({ error: 'No orders found' }, { status: 404 });
  } catch (error) {
    console.error('Order status lookup error:', error);
    return NextResponse.json({ error: 'Failed to look up order' }, { status: 500 });
  }
}
