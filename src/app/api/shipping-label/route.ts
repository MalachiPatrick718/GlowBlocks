import { NextRequest, NextResponse } from 'next/server';

const apiKey = process.env.AIRTABLE_API_KEY;
const baseId = process.env.AIRTABLE_BASE_ID;
const ordersTableName = process.env.AIRTABLE_ORDERS_TABLE || 'Orders';
const popupTableName = process.env.AIRTABLE_POPUP_ORDERS || process.env.AIRTABLE_POPUP_ORDERS_TABLE || 'Popup';
const adminKey = process.env.POPUP_ORDERS_ADMIN_KEY;
const shipStationKey = process.env.SHIPSTATION_API_KEY;
const shipStationSecret = process.env.SHIPSTATION_API_SECRET;

function getAirtableUrl(table: string) {
  return `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(table)}`;
}

function getAirtableHeaders() {
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };
}

const SHIPSTATION_BASE = 'https://ssapi.shipstation.com';

function getShipStationHeaders() {
  const credentials = Buffer.from(`${shipStationKey}:${shipStationSecret}`).toString('base64');
  return {
    Authorization: `Basic ${credentials}`,
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
    if (!shipStationKey || !shipStationSecret) {
      return NextResponse.json({ error: 'ShipStation is not configured' }, { status: 500 });
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

    // Step 1: Discover USPS carrier on the ShipStation account
    const carriersRes = await fetch(`${SHIPSTATION_BASE}/carriers`, {
      headers: getShipStationHeaders(),
    });
    if (!carriersRes.ok) {
      const err = await carriersRes.text();
      console.error('ShipStation carriers error:', err);
      return NextResponse.json({ error: 'Failed to fetch carriers from ShipStation' }, { status: 500 });
    }
    const carriers: { code: string; name: string }[] = await carriersRes.json();
    const uspsCarrier = carriers.find(
      (c) =>
        c.code?.toLowerCase().includes('usps') ||
        c.code?.toLowerCase() === 'stamps_com' ||
        c.name?.toLowerCase().includes('usps')
    );
    if (!uspsCarrier) {
      return NextResponse.json({ error: 'No USPS carrier found on ShipStation account' }, { status: 400 });
    }

    // Step 2: Get shipping rates
    const ratesRes = await fetch(`${SHIPSTATION_BASE}/shipments/getrates`, {
      method: 'POST',
      headers: getShipStationHeaders(),
      body: JSON.stringify({
        carrierCode: uspsCarrier.code,
        fromPostalCode: process.env.GLOWBLOCKS_FROM_ZIP || '',
        toPostalCode: parsed.zip,
        toState: parsed.state,
        toCountry: parsed.country,
        toCity: parsed.city,
        weight: { value: 12, units: 'ounces' },
        dimensions: { units: 'inches', length: 8, width: 6, height: 4 },
      }),
    });

    if (!ratesRes.ok) {
      const err = await ratesRes.text();
      console.error('ShipStation rates error:', err);
      let detail = 'Failed to get shipping rates';
      try {
        const errJson = JSON.parse(err);
        if (errJson?.ExceptionMessage) detail = errJson.ExceptionMessage;
        else if (errJson?.Message) detail = errJson.Message;
      } catch {}
      return NextResponse.json({ error: detail }, { status: 500 });
    }

    const rates: { serviceName: string; serviceCode: string; shipmentCost: number; otherCost: number }[] = await ratesRes.json();

    if (rates.length === 0) {
      return NextResponse.json({ error: 'No shipping rates available' }, { status: 400 });
    }

    // Pick the cheapest rate
    const cheapest = rates.reduce((min, r) =>
      r.shipmentCost < min.shipmentCost ? r : min,
      rates[0]
    );

    // Step 3: Create label with the chosen service
    const shipDate = new Date().toISOString().split('T')[0];
    const labelRes = await fetch(`${SHIPSTATION_BASE}/shipments/createlabel`, {
      method: 'POST',
      headers: getShipStationHeaders(),
      body: JSON.stringify({
        carrierCode: uspsCarrier.code,
        serviceCode: cheapest.serviceCode,
        packageCode: 'package',
        shipDate,
        weight: { value: 12, units: 'ounces' },
        dimensions: { units: 'inches', length: 8, width: 6, height: 4 },
        shipFrom: {
          name: process.env.GLOWBLOCKS_FROM_NAME || 'GlowBlocks',
          street1: process.env.GLOWBLOCKS_FROM_STREET || '',
          city: process.env.GLOWBLOCKS_FROM_CITY || '',
          state: process.env.GLOWBLOCKS_FROM_STATE || '',
          postalCode: process.env.GLOWBLOCKS_FROM_ZIP || '',
          country: process.env.GLOWBLOCKS_FROM_COUNTRY || 'US',
        },
        shipTo: {
          name: parsed.name,
          street1: parsed.street1,
          street2: parsed.street2 || undefined,
          city: parsed.city,
          state: parsed.state,
          postalCode: parsed.zip,
          country: parsed.country,
        },
        testLabel: false,
      }),
    });

    if (!labelRes.ok) {
      const err = await labelRes.text();
      console.error('ShipStation label error:', err);
      let detail = 'Failed to purchase label';
      try {
        const errJson = JSON.parse(err);
        if (errJson?.ExceptionMessage) detail = errJson.ExceptionMessage;
        else if (errJson?.Message) detail = errJson.Message;
      } catch {}
      return NextResponse.json({ error: detail }, { status: 500 });
    }

    const label = await labelRes.json();

    const trackingNumber = label.trackingNumber || '';
    const labelUrl = label.labelData
      ? `data:application/pdf;base64,${label.labelData}`
      : '';
    const cost = label.shipmentCost?.toString() || cheapest.shipmentCost?.toString() || '';

    // Update Airtable with tracking number
    await fetch(getAirtableUrl(table), {
      method: 'PATCH',
      headers: getAirtableHeaders(),
      body: JSON.stringify({
        records: [
          {
            id: orderId,
            fields: {
              'Tracking Number': trackingNumber,
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
