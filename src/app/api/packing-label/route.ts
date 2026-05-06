import { NextRequest, NextResponse } from 'next/server';

const apiKey = process.env.AIRTABLE_API_KEY;
const baseId = process.env.AIRTABLE_BASE_ID;
const popupTableName = process.env.AIRTABLE_POPUP_ORDERS || process.env.AIRTABLE_POPUP_ORDERS_TABLE || 'Popup';
const onlineTableName = process.env.AIRTABLE_ORDERS_TABLE || 'Orders';
const adminKey = process.env.POPUP_ORDERS_ADMIN_KEY;

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

interface ColorEntry {
  letter: string;
  colorHex: string;
  colorName?: string | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parsePopupRecord(record: any) {
  const fields = record.fields || {};
  let colors: ColorEntry[] = [];
  try {
    const parsed = JSON.parse(fields['Custom Colors'] || '{}');
    const list = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.colorsByLetter)
        ? parsed.colorsByLetter
        : [];
    if (list.length > 0) {
      colors = list
        .filter((item: { letter?: string }) => item?.letter && item.letter !== ' ')
        .map((item: { letter?: string; colorHex?: string; colorName?: string | null }) => ({
          letter: item.letter || '',
          colorHex: item.colorHex || '#FFFFFF',
          colorName: item.colorName || null,
        }));
    } else if (parsed?.letterColors && Array.isArray(parsed.letterColors)) {
      const text = fields['Name/Word'] || '';
      colors = text.split('').map((ch: string, idx: number) => ({
        letter: ch,
        colorHex: parsed.letterColors[idx] || '#FFFFFF',
        colorName: null,
      })).filter((c: ColorEntry) => c.letter !== ' ');
    }
  } catch {}
  return {
    text: fields['Name/Word'] || '',
    colorMode: fields['Color Set'] || '',
    colors,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function buildPopupOrder(record: any) {
  const fields = record.fields || {};
  const orderNumber = fields['Order Number'] || '';

  // Fetch ALL records with the same order number
  let allRecords = [record];
  if (orderNumber) {
    const formula = encodeURIComponent(`{Order Number}="${orderNumber}"`);
    const listUrl = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(popupTableName)}?filterByFormula=${formula}`;
    try {
      const listRes = await fetch(listUrl, { headers: getHeaders(), next: { revalidate: 0 } });
      if (listRes.ok) {
        const listData = await listRes.json();
        if (listData.records && listData.records.length > 0) {
          allRecords = listData.records;
        }
      }
    } catch {}
  }

  const sets = allRecords.map(parsePopupRecord);

  // Aggregate pricing across all sets
  let subtotal = 0;
  let customColorFee = 0;
  let discount = 0;
  let shipping = 0;
  let tax = 0;
  let total = 0;
  for (const rec of allRecords) {
    const f = rec.fields || {};
    subtotal += parseFloat(f['Subtotal'] || '0') || 0;
    customColorFee += parseFloat(f['Custom Color Fee'] || '0') || 0;
    discount += parseFloat(f['Discount'] || '0') || 0;
    shipping += parseFloat(f['Shipping Fee'] || '0') || 0;
    tax += parseFloat(f['Tax'] || '0') || 0;
    total += parseFloat(f['Total'] || '0') || 0;
  }

  return {
    source: 'popup' as const,
    customerName: fields['Name'] || '',
    phone: fields['Phone Number'] || '',
    email: fields['Email'] || '',
    address: fields['Address'] || '',
    text: sets.map((s) => s.text).join(' / '),
    orderNumber,
    orderType: fields['Order Type'] || '',
    sets,
    date: record.createdTime?.split('T')[0] || '',
    pricing: { subtotal, customColorFee, discount, shipping, tax, total },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildOnlineOrder(record: any) {
  const fields = record.fields || {};
  let colors: ColorEntry[] = [];
  let orderText = fields['Order Text'] || '';
  try {
    const orderData = JSON.parse(fields['Order Data'] || '{}');
    if (orderData.items && Array.isArray(orderData.items)) {
      for (const item of orderData.items) {
        const text = item.text || '';
        const itemColors = item.colors || [];
        for (let i = 0; i < text.length; i++) {
          if (text[i] === ' ') continue;
          colors.push({
            letter: text[i],
            colorHex: itemColors[i] || '#FFFFFF',
            colorName: null,
          });
        }
      }
      if (!orderText) {
        orderText = orderData.items.map((item: { text: string }) => item.text).join(' ');
      }
    }
  } catch {}

  const totalVal = parseFloat(fields['Total'] || '0') || 0;

  return {
    source: 'online' as const,
    customerName: fields['Customer Name'] || '',
    email: fields['Email'] || '',
    address: fields['Address'] || '',
    text: orderText,
    items: fields['Items'] || fields['Line Items'] || '',
    shippingMethod: fields['Shipping Method'] || '',
    total: fields['Total'] || '',
    colors,
    date: fields['Date'] || record.createdTime?.split('T')[0] || '',
    pricing: { subtotal: totalVal, customColorFee: 0, discount: 0, shipping: 0, tax: 0, total: totalVal },
  };
}

async function fetchRecord(source: string, id: string) {
  const tableName = source === 'popup' ? popupTableName : onlineTableName;
  const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}/${encodeURIComponent(id)}`;
  const res = await fetch(url, { headers: getHeaders(), next: { revalidate: 0 } });
  if (!res.ok) return null;
  return res.json();
}

export async function GET(req: NextRequest) {
  try {
    if (!apiKey || !baseId) {
      return NextResponse.json({ error: 'Airtable is not configured' }, { status: 500 });
    }
    if (!isAuthorized(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Multi-order mode: ?orders=popup:recXXX,online:recYYY
    const ordersParam = req.nextUrl.searchParams.get('orders');
    if (ordersParam) {
      const entries = ordersParam.split(',').map((e) => {
        const [source, id] = e.split(':');
        return { source, id };
      }).filter((e) => e.source && e.id);

      if (entries.length === 0) {
        return NextResponse.json({ error: 'No valid order entries' }, { status: 400 });
      }

      const results = await Promise.all(
        entries.map(async ({ source, id }) => {
          const record = await fetchRecord(source, id);
          if (!record) return null;
          if (source === 'popup') return buildPopupOrder(record);
          return buildOnlineOrder(record);
        })
      );

      const orders = results.filter(Boolean);
      if (orders.length === 0) {
        return NextResponse.json({ error: 'No records found' }, { status: 404 });
      }

      return NextResponse.json({ multi: true, orders });
    }

    // Single-order mode (backward compat)
    const id = req.nextUrl.searchParams.get('id');
    const source = req.nextUrl.searchParams.get('source');

    if (!id || !source) {
      return NextResponse.json({ error: 'Missing id or source param' }, { status: 400 });
    }

    const record = await fetchRecord(source, id);
    if (!record) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 });
    }

    if (source === 'popup') {
      return NextResponse.json(await buildPopupOrder(record));
    } else {
      return NextResponse.json(buildOnlineOrder(record));
    }
  } catch (error) {
    console.error('Packing label API error:', error);
    return NextResponse.json({ error: 'Failed to fetch order' }, { status: 500 });
  }
}
