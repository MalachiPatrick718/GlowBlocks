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

export async function GET(req: NextRequest) {
  try {
    if (!apiKey || !baseId) {
      return NextResponse.json({ error: 'Airtable is not configured' }, { status: 500 });
    }
    if (!isAuthorized(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const id = req.nextUrl.searchParams.get('id');
    const source = req.nextUrl.searchParams.get('source');

    if (!id || !source) {
      return NextResponse.json({ error: 'Missing id or source param' }, { status: 400 });
    }

    const tableName = source === 'popup' ? popupTableName : onlineTableName;
    const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}/${encodeURIComponent(id)}`;

    const res = await fetch(url, {
      headers: getHeaders(),
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 });
    }

    const record = await res.json();
    const fields = record.fields || {};

    if (source === 'popup') {
      // Parse color data
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

      return NextResponse.json({
        source: 'popup',
        customerName: fields['Name'] || '',
        phone: fields['Phone Number'] || '',
        email: fields['Email'] || '',
        address: fields['Address'] || '',
        text: fields['Name/Word'] || '',
        orderNumber: fields['Order Number'] || '',
        orderType: fields['Order Type'] || '',
        colorMode: fields['Color Set'] || '',
        colors,
        date: record.createdTime?.split('T')[0] || '',
      });
    } else {
      // Online order
      let colors: ColorEntry[] = [];
      let orderText = fields['Order Text'] || '';
      try {
        const orderData = JSON.parse(fields['Order Data'] || '{}');
        if (orderData.items && Array.isArray(orderData.items)) {
          // Build colors from items data
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

      return NextResponse.json({
        source: 'online',
        customerName: fields['Customer Name'] || '',
        email: fields['Email'] || '',
        address: fields['Address'] || '',
        text: orderText,
        items: fields['Items'] || fields['Line Items'] || '',
        shippingMethod: fields['Shipping Method'] || '',
        total: fields['Total'] || '',
        colors,
        date: fields['Date'] || record.createdTime?.split('T')[0] || '',
      });
    }
  } catch (error) {
    console.error('Packing label API error:', error);
    return NextResponse.json({ error: 'Failed to fetch order' }, { status: 500 });
  }
}
