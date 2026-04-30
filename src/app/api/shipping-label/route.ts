import { NextRequest, NextResponse } from 'next/server';
import { sendSMS } from '@/lib/sms';
import { sendEmail } from '@/lib/email';

const apiKey = process.env.AIRTABLE_API_KEY;
const baseId = process.env.AIRTABLE_BASE_ID;
const ordersTableName = process.env.AIRTABLE_ORDERS_TABLE || 'Orders';
const popupTableName = process.env.AIRTABLE_POPUP_ORDERS || process.env.AIRTABLE_POPUP_ORDERS_TABLE || 'Popup';
const adminKey = process.env.POPUP_ORDERS_ADMIN_KEY;
const shipStationKey = process.env.SHIPSTATION_API_KEY;

function getAirtableUrl(table: string) {
  return `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(table)}`;
}

function getAirtableHeaders() {
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };
}

const SHIPSTATION_BASE = 'https://api.shipstation.com/v2';

function getShipStationHeaders() {
  return {
    'API-Key': shipStationKey!,
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
  let parts = raw.split(',').map((s) => s.trim());
  if (parts.length < 3) return null;

  // Merge bare house number with the next part
  // e.g. "171, Humphrey Street, ..." → "171 Humphrey Street, ..."
  if (/^\d+[A-Za-z]?$/.test(parts[0]) && parts.length >= 4) {
    parts = [`${parts[0]} ${parts[1]}`, ...parts.slice(2)];
  }

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
    if (!shipStationKey) {
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

    // Prevent duplicate labels
    const existingTracking = fields['Tracking Number'] || '';
    if (existingTracking) {
      return NextResponse.json({
        trackingNumber: existingTracking,
        labelUrl: fields['Label URL'] || '',
        cost: '',
        existing: true,
      });
    }

    const addressRaw = fields['Address'] || '';
    if (!addressRaw) {
      return NextResponse.json({ error: 'Order has no shipping address' }, { status: 400 });
    }

    const parsed = parseAddress(addressRaw);
    if (!parsed) {
      return NextResponse.json({ error: 'Could not parse shipping address' }, { status: 400 });
    }

    parsed.name = (isPopup ? fields['Name'] : fields['Customer Name']) || 'Customer';
    const customerPhone = fields['Phone Number'] || fields['Phone'] || '555-555-5555';

    // Step 1: Discover USPS carrier on the ShipStation account
    const carriersRes = await fetch(`${SHIPSTATION_BASE}/carriers`, {
      headers: getShipStationHeaders(),
    });
    if (!carriersRes.ok) {
      const err = await carriersRes.text();
      console.error('ShipStation carriers error:', err);
      return NextResponse.json({ error: 'Failed to fetch carriers from ShipStation' }, { status: 500 });
    }
    const carriersData = await carriersRes.json();
    const carriers = carriersData.carriers || [];
    const uspsCarrier = carriers.find(
      (c: { carrier_code?: string; friendly_name?: string }) =>
        c.carrier_code?.toLowerCase().includes('usps') ||
        c.friendly_name?.toLowerCase().includes('usps')
    );
    if (!uspsCarrier) {
      return NextResponse.json({ error: 'No USPS carrier found on ShipStation account' }, { status: 400 });
    }

    // Step 2: Get shipping rates
    const ratesRes = await fetch(`${SHIPSTATION_BASE}/rates`, {
      method: 'POST',
      headers: getShipStationHeaders(),
      body: JSON.stringify({
        rate_options: {
          carrier_ids: [uspsCarrier.carrier_id],
        },
        shipment: {
          ship_from: {
            name: process.env.GLOWBLOCKS_FROM_NAME || 'GlowBlocks',
            phone: process.env.GLOWBLOCKS_FROM_PHONE || '555-555-5555',
            address_line1: process.env.GLOWBLOCKS_FROM_STREET || '',
            city_locality: process.env.GLOWBLOCKS_FROM_CITY || '',
            state_province: process.env.GLOWBLOCKS_FROM_STATE || '',
            postal_code: process.env.GLOWBLOCKS_FROM_ZIP || '',
            country_code: process.env.GLOWBLOCKS_FROM_COUNTRY || 'US',
          },
          ship_to: {
            name: parsed.name,
            phone: customerPhone,
            address_line1: parsed.street1,
            address_line2: parsed.street2 || undefined,
            city_locality: parsed.city,
            state_province: parsed.state,
            postal_code: parsed.zip,
            country_code: parsed.country,
          },
          packages: [
            {
              weight: { value: 12, unit: 'ounce' },
              dimensions: { length: 8, width: 6, height: 4, unit: 'inch' },
            },
          ],
        },
      }),
    });

    if (!ratesRes.ok) {
      const err = await ratesRes.text();
      console.error('ShipStation rates error:', err);
      let detail = 'Failed to get shipping rates';
      try {
        const errJson = JSON.parse(err);
        if (errJson?.errors?.[0]?.message) detail = errJson.errors[0].message;
        else if (errJson?.error?.message) detail = errJson.error.message;
      } catch {}
      return NextResponse.json({ error: detail }, { status: 500 });
    }

    const ratesData = await ratesRes.json();
    const rates = ratesData.rate_response?.rates || ratesData.rates || [];

    if (rates.length === 0) {
      return NextResponse.json({ error: 'No shipping rates available' }, { status: 400 });
    }

    // Pick the cheapest rate
    const cheapest = rates.reduce(
      (min: { shipping_amount: { amount: number } }, r: { shipping_amount: { amount: number } }) =>
        r.shipping_amount.amount < min.shipping_amount.amount ? r : min,
      rates[0]
    );

    // Step 3: Purchase label from the chosen rate
    const labelRes = await fetch(`${SHIPSTATION_BASE}/labels/rates/${cheapest.rate_id}`, {
      method: 'POST',
      headers: getShipStationHeaders(),
      body: JSON.stringify({
        label_format: 'pdf',
        label_layout: '4x6',
      }),
    });

    if (!labelRes.ok) {
      const err = await labelRes.text();
      console.error('ShipStation label error:', err);
      let detail = 'Failed to purchase label';
      try {
        const errJson = JSON.parse(err);
        if (errJson?.errors?.[0]?.message) detail = errJson.errors[0].message;
        else if (errJson?.error?.message) detail = errJson.error.message;
      } catch {}
      return NextResponse.json({ error: detail }, { status: 500 });
    }

    const label = await labelRes.json();

    const trackingNumber = label.tracking_number || '';
    const labelUrl = label.label_download?.pdf || '';
    const cost = label.shipment_cost?.amount?.toString() || cheapest.shipping_amount?.amount?.toString() || '';

    // Update Airtable with tracking info
    const patchRes = await fetch(getAirtableUrl(table), {
      method: 'PATCH',
      headers: getAirtableHeaders(),
      body: JSON.stringify({
        records: [
          {
            id: orderId,
            fields: {
              'Tracking Number': trackingNumber,
              'Label URL': labelUrl,
              ...(isPopup
                ? { 'Order Status': 'Ready to Ship' }
                : { 'Status': 'Shipped' }),
            },
          },
        ],
      }),
    });
    if (!patchRes.ok) {
      const patchErr = await patchRes.text();
      console.error('Failed to update Airtable with tracking:', patchErr);
    }

    // Send tracking SMS if real phone is available
    const trackingSmsSent = fields['Tracking SMS Sent'] === true || fields['Tracking SMS Sent'] === 'true';
    if (customerPhone !== '555-555-5555' && trackingNumber && !trackingSmsSent) {
      try {
        const customerName = (isPopup ? fields['Name'] : fields['Customer Name']) || '';
        const firstName = String(customerName).trim().split(' ')[0];
        const msg = firstName
          ? `Hey ${firstName}, your GlowBlocks order is on the way! Your tracking number is ${trackingNumber}.`
          : `Your GlowBlocks order is on the way! Your tracking number is ${trackingNumber}.`;
        const sent = await sendSMS(customerPhone, msg);
        if (sent) {
          await fetch(getAirtableUrl(table), {
            method: 'PATCH',
            headers: getAirtableHeaders(),
            body: JSON.stringify({
              records: [{ id: orderId, fields: { 'Tracking SMS Sent': true } }],
            }),
          });
        }
      } catch (err) {
        console.error('Failed to send tracking SMS:', err);
      }
    }

    // Send tracking email if available
    const customerEmail = fields['Email'] || '';
    if (customerEmail && trackingNumber) {
      try {
        const customerName = (isPopup ? fields['Name'] : fields['Customer Name']) || '';
        const firstName = String(customerName).trim().split(' ')[0];
        const greeting = firstName ? `Hey ${firstName},` : 'Hi,';
        const html = `
          <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
            <h2 style="color: #7c3aed;">${greeting} your GlowBlocks are on the way!</h2>
            <p>Your order has shipped. Here are your tracking details:</p>
            <p style="background: #f3f4f6; padding: 12px 16px; border-radius: 8px; font-family: monospace; font-size: 16px;">
              <strong>Tracking Number:</strong> ${trackingNumber}
            </p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
            <p style="color: #6b7280; font-size: 13px;">If you have questions, visit our <a href="https://glowblocksstudio.com/contact" style="color: #7c3aed;">contact page</a>.</p>
          </div>
        `;
        await sendEmail(customerEmail, 'Your GlowBlocks Order Has Shipped!', html);
      } catch (err) {
        console.error('Failed to send tracking email:', err);
      }
    }

    return NextResponse.json({ trackingNumber, labelUrl, cost });
  } catch (error) {
    console.error('Shipping label error:', error);
    return NextResponse.json({ error: 'Failed to create shipping label' }, { status: 500 });
  }
}
