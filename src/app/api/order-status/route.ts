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

interface PopupResult {
  type: 'popup';
  orderNumber: string;
  customerName: string;
  status: string;
  pickupStatus: string;
  trackingNumber: string;
  deliveryMethod: string;
}

interface OnlineResult {
  type: 'online';
  customerName: string;
  status: string;
  trackingNumber: string;
  items: string;
  date: string;
  deliveryMethod: string;
}

export async function GET(req: NextRequest) {
  try {
    if (!apiKey || !baseId) {
      return NextResponse.json({ error: 'Not configured' }, { status: 500 });
    }

    const orderNum = req.nextUrl.searchParams.get('order') || '';
    const phone = req.nextUrl.searchParams.get('phone') || '';
    const email = req.nextUrl.searchParams.get('email') || '';

    if (!email && !phone) {
      return NextResponse.json({ error: 'Email or phone number is required' }, { status: 400 });
    }

    const results: (PopupResult | OnlineResult)[] = [];

    // --- Search popup orders ---
    {
      const filters: string[] = [];
      if (email) filters.push(`LOWER({Email})="${email.toLowerCase()}"`);
      if (phone) {
        const phoneDigits = phone.replace(/[^\d]/g, '');
        if (phoneDigits.length >= 10) {
          filters.push(`RIGHT(SUBSTITUTE({Phone Number},"-",""), 10)="${phoneDigits.slice(-10)}"`);
        }
      }

      if (filters.length > 0) {
        const filterFormula = filters.length === 1 ? filters[0] : `OR(${filters.join(',')})`;
        const url = `${getAirtableUrl(popupTable)}?filterByFormula=${encodeURIComponent(filterFormula)}`;
        const res = await fetch(url, { headers: getHeaders(), cache: 'no-store' });

        if (res.ok) {
          const data = await res.json();
          const records = data.records || [];

          for (const record of records as { fields: Record<string, string> }[]) {
            const fields = record.fields;

            // If order number was provided, only include matching records
            if (orderNum && fields['Order Number'] !== orderNum) continue;

            let deliveryMethod = '';
            try {
              const cc = JSON.parse(fields['Custom Colors'] || '{}');
              deliveryMethod = cc.deliveryMethod || '';
            } catch {}

            results.push({
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
    }

    // --- Search online orders ---
    {
      const filters: string[] = [];
      if (email) filters.push(`LOWER({Email})="${email.toLowerCase()}"`);

      if (filters.length > 0) {
        const filterFormula = filters[0];
        const url = `${getAirtableUrl(ordersTable)}?filterByFormula=${encodeURIComponent(filterFormula)}&sort%5B0%5D%5Bfield%5D=Date&sort%5B0%5D%5Bdirection%5D=desc`;
        const res = await fetch(url, { headers: getHeaders(), cache: 'no-store' });

        if (res.ok) {
          const data = await res.json();
          for (const record of (data.records || []) as { fields: Record<string, string> }[]) {
            const f = record.fields;
            results.push({
              type: 'online',
              customerName: (f['Customer Name'] || '').split(' ')[0],
              status: f['Status'] || 'New',
              trackingNumber: f['Tracking Number'] || '',
              items: f['Items'] || f['Line Items'] || '',
              date: f['Date'] || '',
              deliveryMethod: 'ship',
            });
          }
        }
      }
    }

    if (results.length === 0) {
      return NextResponse.json({ error: 'No orders found' }, { status: 404 });
    }

    return NextResponse.json({ orders: results });
  } catch (error) {
    console.error('Order status lookup error:', error);
    return NextResponse.json({ error: 'Failed to look up order' }, { status: 500 });
  }
}
