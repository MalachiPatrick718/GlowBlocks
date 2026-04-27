import { NextRequest, NextResponse } from 'next/server';

const apiKey = process.env.AIRTABLE_API_KEY;
const baseId = process.env.AIRTABLE_BASE_ID;
const ordersTableName = process.env.AIRTABLE_ORDERS_TABLE || 'Orders';
const popupTableName = process.env.AIRTABLE_POPUP_ORDERS || process.env.AIRTABLE_POPUP_ORDERS_TABLE || 'Popup';
const adminKey = process.env.POPUP_ORDERS_ADMIN_KEY;
const easypostKey = process.env.EASYPOST_API_KEY;

function getAirtableUrl(table: string) {
  return `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(table)}`;
}

function getAirtableHeaders() {
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };
}

function getEasyPostHeaders() {
  return {
    Authorization: `Basic ${Buffer.from(`${easypostKey}:`).toString('base64')}`,
    'Content-Type': 'application/json',
  };
}

function isAuthorized(req: NextRequest): boolean {
  if (!adminKey) return false;
  return req.headers.get('x-popup-admin-key') === adminKey;
}

function parseAddress(raw: string): {
  name: string;
  street1: string;
  street2: string;
  city: string;
  state: string;
  zip: string;
  country: string;
} | null {
  // Stripe webhook format: "Line1, Line2?, City, State ZIP, Country"
  // e.g. "123 Main St, Apt 4, Springfield, IL 62704, US"
  // or   "123 Main St, Springfield, IL 62704, US"
  const parts = raw.split(',').map((s) => s.trim());
  if (parts.length < 3) return null;

  const country = parts[parts.length - 1] || 'US';
  const stateZip = parts[parts.length - 2] || '';
  const city = parts[parts.length - 3] || '';
  const street1 = parts[0] || '';
  const street2 = parts.length >= 5 ? parts.slice(1, parts.length - 3).join(', ') : '';

  // Split "IL 62704" into state and zip
  const stateZipMatch = stateZip.match(/^([A-Z]{2})\s+(.+)$/);
  const state = stateZipMatch ? stateZipMatch[1] : stateZip;
  const zip = stateZipMatch ? stateZipMatch[2] : '';

  return { name: '', street1, street2, city, state, zip, country };
}

export async function POST(req: NextRequest) {
  try {
    if (!apiKey || !baseId) {
      return NextResponse.json({ error: 'Airtable is not configured' }, { status: 500 });
    }
    if (!easypostKey) {
      return NextResponse.json({ error: 'EasyPost is not configured' }, { status: 500 });
    }
    if (!isAuthorized(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { orderId, source } = await req.json();
    if (!orderId) {
      return NextResponse.json({ error: 'Missing orderId' }, { status: 400 });
    }

    const isPopup = source === 'popup';
    const table = isPopup ? popupTableName : ordersTableName;

    // Fetch the order from Airtable
    const orderRes = await fetch(`${getAirtableUrl(table)}/${orderId}`, {
      headers: getAirtableHeaders(),
    });
    if (!orderRes.ok) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }
    const orderData = await orderRes.json();
    const fields = orderData.fields || {};

    const addressRaw = fields['Address'] || '';
    if (!addressRaw) {
      return NextResponse.json({ error: 'Order has no shipping address' }, { status: 400 });
    }

    const parsed = parseAddress(addressRaw);
    if (!parsed) {
      return NextResponse.json({ error: 'Could not parse shipping address' }, { status: 400 });
    }

    parsed.name = (isPopup ? fields['Name'] : fields['Customer Name']) || 'Customer';

    // Step 1: Create shipment to get rates
    const shipmentRes = await fetch('https://api.easypost.com/v2/shipments', {
      method: 'POST',
      headers: getEasyPostHeaders(),
      body: JSON.stringify({
        shipment: {
          from_address: {
            name: process.env.GLOWBLOCKS_FROM_NAME || 'GlowBlocks',
            street1: process.env.GLOWBLOCKS_FROM_STREET || '',
            city: process.env.GLOWBLOCKS_FROM_CITY || '',
            state: process.env.GLOWBLOCKS_FROM_STATE || '',
            zip: process.env.GLOWBLOCKS_FROM_ZIP || '',
            country: process.env.GLOWBLOCKS_FROM_COUNTRY || 'US',
            email: process.env.GLOWBLOCKS_FROM_EMAIL || '',
          },
          to_address: {
            name: parsed.name,
            street1: parsed.street1,
            street2: parsed.street2,
            city: parsed.city,
            state: parsed.state,
            zip: parsed.zip,
            country: parsed.country,
          },
          parcel: {
            length: 8,
            width: 6,
            height: 4,
            weight: 12,
          },
          options: {
            label_format: 'PDF',
          },
        },
      }),
    });

    if (!shipmentRes.ok) {
      const err = await shipmentRes.text();
      console.error('EasyPost shipment error:', err);
      return NextResponse.json({ error: 'Failed to create shipment' }, { status: 500 });
    }

    const shipment = await shipmentRes.json();
    const rates = shipment.rates || [];

    if (rates.length === 0) {
      return NextResponse.json({ error: 'No shipping rates available' }, { status: 400 });
    }

    // Find cheapest USPS rate, fall back to cheapest overall
    const uspsRates = rates.filter((r: { carrier: string }) =>
      r.carrier?.toUpperCase() === 'USPS'
    );
    const pool = uspsRates.length > 0 ? uspsRates : rates;
    const cheapest = pool.reduce(
      (min: { rate: string }, r: { rate: string }) =>
        parseFloat(r.rate) < parseFloat(min.rate) ? r : min,
      pool[0]
    );

    // Step 2: Purchase label
    const buyRes = await fetch(`https://api.easypost.com/v2/shipments/${shipment.id}/buy`, {
      method: 'POST',
      headers: getEasyPostHeaders(),
      body: JSON.stringify({
        rate: { id: cheapest.id },
      }),
    });

    if (!buyRes.ok) {
      const err = await buyRes.text();
      console.error('EasyPost buy error:', err);
      return NextResponse.json({ error: 'Failed to purchase label' }, { status: 500 });
    }

    const purchased = await buyRes.json();

    const trackingNumber = purchased.tracking_code || '';
    const labelUrl = purchased.postage_label?.label_url || '';
    const cost = cheapest.rate;

    // Update Airtable with tracking info
    await fetch(getAirtableUrl(table), {
      method: 'PATCH',
      headers: getAirtableHeaders(),
      body: JSON.stringify({
        records: [
          {
            id: orderId,
            fields: {
              'Tracking Number': trackingNumber,
              'Label URL': labelUrl,
            },
          },
        ],
      }),
    }).catch((err) => console.error('Failed to update Airtable with tracking:', err));

    return NextResponse.json({ trackingNumber, labelUrl, cost });
  } catch (error) {
    console.error('Shipping label error:', error);
    return NextResponse.json({ error: 'Failed to create shipping label' }, { status: 500 });
  }
}
