import { NextRequest, NextResponse } from 'next/server';
import { POPUP_COLOR_MAP } from '@/data/popupColorCatalog';

const apiKey = process.env.AIRTABLE_API_KEY;
const baseId = process.env.AIRTABLE_BASE_ID;
const tableName = process.env.AIRTABLE_POPUP_ORDERS || process.env.AIRTABLE_POPUP_ORDERS_TABLE || 'Popup';
const adminKey = process.env.POPUP_ORDERS_ADMIN_KEY;
const popupOrderStatusValue = process.env.AIRTABLE_POPUP_ORDER_STATUS || '';

function getAirtableUrl() {
  return `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}`;
}

function getHeaders() {
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };
}

function generateOrderNumber(): string {
  const now = Date.now().toString().slice(-6);
  return `GB-${now}`;
}

function isAuthorizedAdmin(req: NextRequest): boolean {
  if (!adminKey) return false;
  return req.headers.get('x-popup-admin-key') === adminKey;
}

export async function POST(req: NextRequest) {
  try {
    if (!apiKey || !baseId) {
      return NextResponse.json({ error: 'Airtable is not configured' }, { status: 500 });
    }

    const {
      text,
      letterColors,
      colorNumbers,
      colorMode,
      presetName,
      customerName,
      phoneNumber,
      address,
      deliveryMethod,
    } = await req.json();

    if (!text || !customerName || !phoneNumber) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const normalizedDeliveryMethod = deliveryMethod === 'ship' ? 'ship' : 'pick-up';
    const mappedOrderType = normalizedDeliveryMethod === 'ship' ? 'Ship to Customer' : 'Pickup';
    const orderNumber = generateOrderNumber();
    if (normalizedDeliveryMethod === 'ship' && !String(address || '').trim()) {
      return NextResponse.json({ error: 'Shipping address is required for shipping orders' }, { status: 400 });
    }

    const colorsByLetter = text.split('').map((char: string, idx: number) => {
      const colorNumber = Array.isArray(colorNumbers) ? colorNumbers[idx] : null;
      const matched = typeof colorNumber === 'number' ? POPUP_COLOR_MAP.get(colorNumber) : null;
      return {
        letter: char,
        colorHex: letterColors?.[idx] || '#FFFFFF',
        colorNumber: colorNumber || null,
        colorName: matched?.name || null,
      };
    });

    const fields: Record<string, string> = {
      Name: String(customerName).slice(0, 100),
      'Phone Number': String(phoneNumber).slice(0, 40),
      Address: String(address || '').slice(0, 250),
      'Name/Word': text,
      'Order Number': orderNumber,
      'Color Set': colorMode === 'custom' ? 'Custom Numbers' : (presetName || 'Preset Theme'),
      'Order Type': mappedOrderType,
      'Custom Colors': JSON.stringify({
        letterColors: letterColors || [],
        colorNumbers: colorNumbers || [],
        colorsByLetter,
        deliveryMethod: normalizedDeliveryMethod,
      }),
    };

    if (popupOrderStatusValue) {
      fields['Order Status'] = popupOrderStatusValue;
    }
    if (mappedOrderType === 'Pickup') {
      fields['Pickup Status'] = 'Not Ready';
    }

    const airtableRes = await fetch(getAirtableUrl(), {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        records: [
          {
            fields,
          },
        ],
      }),
    });

    if (!airtableRes.ok) {
      const err = await airtableRes.json();
      console.error('Popup order Airtable error:', err);
      return NextResponse.json({ error: 'Failed to save popup order' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Popup order API error:', error);
    return NextResponse.json({ error: 'Failed to submit popup order' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    if (!apiKey || !baseId) {
      return NextResponse.json({ error: 'Airtable is not configured' }, { status: 500 });
    }

    if (!adminKey) {
      return NextResponse.json({ error: 'Admin key is not configured' }, { status: 500 });
    }

    if (!isAuthorizedAdmin(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const res = await fetch(getAirtableUrl(), {
      headers: getHeaders(),
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      const err = await res.json();
      console.error('Popup order fetch error:', err);
      return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
    }

    const data = await res.json();
    const orders = (data.records || []).map((record: { id: string; createdTime?: string; fields: Record<string, string> }) => {
      const customColorsRaw = record.fields['Custom Colors'] || '[]';
      let delivery = '';
      try {
        const parsed = JSON.parse(customColorsRaw);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && parsed.deliveryMethod) {
          delivery = String(parsed.deliveryMethod);
        }
      } catch {
        delivery = '';
      }

      return ({
      id: record.id,
      text: record.fields['Name/Word'] || record.fields['Order Text'] || '',
      colorMode: record.fields['Color Set'] || '',
      presetName: '',
      letterColors: customColorsRaw,
      colorNumbers: '[]',
      colorsByLetter: customColorsRaw,
      customerName: record.fields.Name || '',
      phoneNumber: record.fields['Phone Number'] || '',
      address: record.fields.Address || '',
      date: record.createdTime || '',
      status: record.fields['Order Status'] || '',
      orderType: record.fields['Order Type'] || '',
      pickupStatus: record.fields['Pickup Status'] || '',
      orderNumber: record.fields['Order Number'] || '',
      deliveryMethod: delivery,
    });
    })
      .sort((a: { date: string }, b: { date: string }) => {
        const aTime = a.date ? new Date(a.date).getTime() : 0;
        const bTime = b.date ? new Date(b.date).getTime() : 0;
        return bTime - aTime;
      });

    return NextResponse.json({ orders });
  } catch (error) {
    console.error('Popup order API error:', error);
    return NextResponse.json({ error: 'Failed to fetch popup orders' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    if (!apiKey || !baseId) {
      return NextResponse.json({ error: 'Airtable is not configured' }, { status: 500 });
    }

    if (!adminKey) {
      return NextResponse.json({ error: 'Admin key is not configured' }, { status: 500 });
    }

    if (!isAuthorizedAdmin(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, status, pickupStatus } = await req.json();
    if (!id || (!status && !pickupStatus)) {
      return NextResponse.json({ error: 'Missing record id and update fields' }, { status: 400 });
    }

    let orderType = '';
    if (status) {
      const existingRes = await fetch(getAirtableUrl(), {
        headers: getHeaders(),
        next: { revalidate: 0 },
      });
      if (existingRes.ok) {
        const existingData = await existingRes.json();
        const match = (existingData.records || []).find((record: { id: string; fields: Record<string, string> }) => record.id === String(id));
        orderType = match?.fields?.['Order Type'] || '';
      }
    }

    const fields: Record<string, string> = {};
    if (status) {
      fields['Order Status'] = String(status);
      if (String(status).toLowerCase() === 'done' && orderType.toLowerCase() === 'pickup') {
        fields['Pickup Status'] = 'Ready for Pickup';
      }
    }
    if (pickupStatus) {
      fields['Pickup Status'] = String(pickupStatus);
    }

    const res = await fetch(getAirtableUrl(), {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify({
        records: [
          {
            id: String(id),
            fields,
          },
        ],
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      console.error('Popup order status update error:', err);
      return NextResponse.json({ error: 'Failed to update status' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Popup order PATCH error:', error);
    return NextResponse.json({ error: 'Failed to update status' }, { status: 500 });
  }
}
