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

const COUNTRY_CODES = new Set([
  'US', 'CA', 'GB', 'AU', 'UK', 'United States', 'Canada',
  'United Kingdom', 'Australia',
]);

const US_STATE_ABBREV: Record<string, string> = {
  'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR',
  'california': 'CA', 'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE',
  'florida': 'FL', 'georgia': 'GA', 'hawaii': 'HI', 'idaho': 'ID',
  'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA', 'kansas': 'KS',
  'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
  'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS',
  'missouri': 'MO', 'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV',
  'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY',
  'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH', 'oklahoma': 'OK',
  'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
  'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT',
  'vermont': 'VT', 'virginia': 'VA', 'washington': 'WA', 'west virginia': 'WV',
  'wisconsin': 'WI', 'wyoming': 'WY', 'district of columbia': 'DC',
};

function toStateAbbrev(s: string): string {
  if (/^[A-Za-z]{2}$/.test(s)) return s.toUpperCase();
  return US_STATE_ABBREV[s.toLowerCase()] || s;
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
  // Formats:
  //   "Line1, Line2?, City, State ZIP, Country"
  //   "Line1, Line2?, City, State ZIP"  (no country)
  //   "Line1, Line2?, City, County?, State, ZIP, Country"
  const parts = raw.split(',').map((s) => s.trim());
  if (parts.length < 3) return null;

  // Detect if the last part is a country
  const lastPart = parts[parts.length - 1];
  const hasCountry = COUNTRY_CODES.has(lastPart);

  let country = 'US';
  let remaining = parts;
  if (hasCountry) {
    country = lastPart === 'United States' ? 'US'
      : lastPart === 'Canada' ? 'CA'
      : lastPart === 'United Kingdom' || lastPart === 'UK' ? 'GB'
      : lastPart === 'Australia' ? 'AU'
      : lastPart;
    remaining = parts.slice(0, -1);
  }

  // Try "State ZIP" combined format first (e.g. "NJ 07631")
  const stateZipRaw = remaining[remaining.length - 1] || '';
  const stateZipMatch = stateZipRaw.match(/^([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)$/);

  if (stateZipMatch) {
    const state = stateZipMatch[1].toUpperCase();
    const zip = stateZipMatch[2];
    const city = remaining[remaining.length - 2] || '';
    const street1 = remaining[0] || '';
    const street2 = remaining.length >= 4
      ? remaining.slice(1, remaining.length - 2).join(', ')
      : '';
    return { name: '', street1, street2, city, state, zip, country };
  }

  // Handle separate state and ZIP parts
  // e.g. "171, Humphrey Street, Englewood, Bergen County, New Jersey, 07631"
  const bareZip = stateZipRaw.match(/^\d{5}(?:-\d{4})?$/);
  if (bareZip && remaining.length >= 4) {
    const zip = stateZipRaw;
    const stateRaw = remaining[remaining.length - 2] || '';
    const state = toStateAbbrev(stateRaw);

    // Find city index, skipping any "County" part
    let cityIdx = remaining.length - 3;
    if (cityIdx > 0 && /county/i.test(remaining[cityIdx])) {
      cityIdx--;
    }
    const city = remaining[cityIdx] || '';
    const street1 = remaining[0] || '';
    const street2 = cityIdx > 1
      ? remaining.slice(1, cityIdx).join(', ')
      : '';
    return { name: '', street1, street2, city, state, zip, country };
  }

  // Fallback
  const city = remaining[remaining.length - 2] || '';
  const street1 = remaining[0] || '';
  const street2 = remaining.length >= 4
    ? remaining.slice(1, remaining.length - 2).join(', ')
    : '';
  const state = toStateAbbrev(stateZipRaw);
  return { name: '', street1, street2, city, state, zip: '', country };
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
      let detail = 'Failed to create shipment';
      try {
        const errJson = JSON.parse(err);
        if (errJson?.error?.message) detail = errJson.error.message;
      } catch {}
      return NextResponse.json({ error: detail }, { status: 500 });
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
      let detail = 'Failed to purchase label';
      try {
        const errJson = JSON.parse(err);
        if (errJson?.error?.message) detail = errJson.error.message;
      } catch {}
      return NextResponse.json({ error: detail }, { status: 500 });
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
