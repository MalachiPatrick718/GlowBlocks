import { NextRequest, NextResponse } from 'next/server';
import { POPUP_COLOR_MAP } from '@/data/popupColorCatalog';
import { sendSMS } from '@/lib/sms';

const apiKey = process.env.AIRTABLE_API_KEY;
const baseId = process.env.AIRTABLE_BASE_ID;
const tableName = process.env.AIRTABLE_POPUP_ORDERS || process.env.AIRTABLE_POPUP_ORDERS_TABLE || 'Popup';
const inventoryTableName = process.env.AIRTABLE_INVENTORY_TABLE || 'Inventory';
const adminKey = process.env.POPUP_ORDERS_ADMIN_KEY;
const popupOrderStatusValue = process.env.AIRTABLE_POPUP_ORDER_STATUS || '';
const taxRate = parseFloat(process.env.POPUP_TAX_RATE || '0.08875');

function getPricePerLetter(letterCount: number): number {
  if (letterCount <= 3) return 12.00;
  if (letterCount <= 6) return 11.00;
  if (letterCount <= 9) return 10.00;
  return 9.00; // 10+
}

function getAirtableUrl() {
  return `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}`;
}

function getInventoryAirtableUrl() {
  return `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(inventoryTableName)}`;
}

function getHeaders() {
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };
}

function generateOrderNumber(): string {
  // Generate 2-digit order number (01-99)
  const num = Math.floor(Math.random() * 99) + 1;
  return num.toString().padStart(2, '0');
}

function isAuthorizedAdmin(req: NextRequest): boolean {
  if (!adminKey) return false;
  return req.headers.get('x-popup-admin-key') === adminKey;
}

type InventoryRecord = { id: string; fields: { Item?: string; Quantity?: number } };

function isTruthy(value: unknown): boolean {
  return value === true || value === 'true' || value === 'Yes' || value === 1;
}

function getLetterCounts(text: string): Record<string, number> {
  return text
    .toUpperCase()
    .split('')
    .filter((ch) => ch >= 'A' && ch <= 'Z')
    .reduce((acc: Record<string, number>, ch) => {
      acc[ch] = (acc[ch] || 0) + 1;
      return acc;
    }, {});
}

async function deductInventoryForOrder(orderText: string): Promise<boolean> {
  if (!apiKey || !baseId) return false;

  const inventoryRes = await fetch(getInventoryAirtableUrl(), {
    headers: getHeaders(),
    next: { revalidate: 0 },
  });
  if (!inventoryRes.ok) return false;

  const inventoryData = await inventoryRes.json();
  const records: InventoryRecord[] = inventoryData.records || [];
  const byItem = new Map<string, InventoryRecord>();
  records.forEach((record) => {
    const key = (record.fields.Item || '').trim();
    if (key) byItem.set(key, record);
  });

  const letterCounts = getLetterCounts(orderText);
  const totalLetters = Object.values(letterCounts).reduce((sum, n) => sum + n, 0);
  const deductions: Record<string, number> = {
    ...letterCounts,
    'P6 Bases': totalLetters,
    'PCB': totalLetters,
  };

  const updateRecords: Array<{ id: string; fields: { Quantity: number } }> = [];
  const createRecords: Array<{ fields: { Item: string; Quantity: number } }> = [];

  Object.entries(deductions).forEach(([item, amount]) => {
    const existing = byItem.get(item);
    if (existing) {
      const currentQty = Number(existing.fields.Quantity) || 0;
      updateRecords.push({
        id: existing.id,
        fields: { Quantity: Math.max(0, currentQty - amount) },
      });
    } else {
      createRecords.push({
        fields: { Item: item, Quantity: 0 },
      });
    }
  });

  // Batch updates in groups of 10 (Airtable limit)
  for (let i = 0; i < updateRecords.length; i += 10) {
    const batch = updateRecords.slice(i, i + 10);
    const patchRes = await fetch(getInventoryAirtableUrl(), {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify({ records: batch }),
    });
    if (!patchRes.ok) return false;
  }

  // Batch creates in groups of 10 (Airtable limit)
  for (let i = 0; i < createRecords.length; i += 10) {
    const batch = createRecords.slice(i, i + 10);
    const createRes = await fetch(getInventoryAirtableUrl(), {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ records: batch }),
    });
    if (!createRes.ok) return false;
  }

  return true;
}

async function checkStockEligibility(orderText: string): Promise<boolean> {
  if (!apiKey || !baseId) return false;

  const inventoryRes = await fetch(getInventoryAirtableUrl(), {
    headers: getHeaders(),
    next: { revalidate: 0 },
  });
  if (!inventoryRes.ok) return false;

  const inventoryData = await inventoryRes.json();
  const records: InventoryRecord[] = inventoryData.records || [];
  const stock = new Map<string, number>();
  records.forEach((record) => {
    const key = (record.fields.Item || '').trim();
    if (key) stock.set(key, Number(record.fields.Quantity) || 0);
  });

  const letterCounts = getLetterCounts(orderText);
  const totalLetters = Object.values(letterCounts).reduce((sum, n) => sum + n, 0);

  for (const [letter, needed] of Object.entries(letterCounts)) {
    if ((stock.get(letter) || 0) < needed) return false;
  }
  if ((stock.get('P6 Bases') || 0) < totalLetters) return false;
  if ((stock.get('PCB') || 0) < totalLetters) return false;

  return true;
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

    // Calculate pricing with tiered rates
    const letterCount = text.length;
    const pricePerLetter = getPricePerLetter(letterCount);
    const letterSubtotal = letterCount * pricePerLetter;
    const customColorFee = colorMode === 'custom' ? 2.00 : 0;
    const subtotal = letterSubtotal + customColorFee;
    const tax = subtotal * taxRate;
    const total = subtotal + tax;

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

    const onSiteEligible = await checkStockEligibility(text);

    const fields: Record<string, string | boolean | number> = {
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
      'Inventory Deducted': false,
      'On-Site Eligible': onSiteEligible,
      'Letter Count': letterCount,
      'Custom Color Fee': customColorFee,
      'Subtotal': subtotal,
      'Tax': tax,
      'Total': total,
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

    // Send confirmation SMS for pickup orders
    if (mappedOrderType === 'Pickup' && phoneNumber) {
      const msg = `Hey, ${String(customerName).trim()}, Thanks for your Glowblocks Set Order! Your order number is ${orderNumber}. We will message you once your set is ready for pickup! It will take between 10-15 minutes! See you again soon!`;
      sendSMS(String(phoneNumber), msg).catch((err) =>
        console.error('Failed to send order confirmation SMS:', err)
      );
    }

    return NextResponse.json({
      success: true,
      orderNumber,
      pricing: {
        letterCount,
        pricePerLetter,
        letterSubtotal,
        customColorFee,
        subtotal,
        tax,
        taxRate,
        total,
      },
    });
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
      inventoryDeducted: record.fields['Inventory Deducted'] || false,
      onSiteEligible: record.fields['On-Site Eligible'] ?? null,
      deliveryMethod: delivery,
      letterCount: record.fields['Letter Count'] || 0,
      customColorFee: record.fields['Custom Color Fee'] || 0,
      subtotal: record.fields['Subtotal'] || 0,
      tax: record.fields['Tax'] || 0,
      total: record.fields['Total'] || 0,
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

    const existingRes = await fetch(`${getAirtableUrl()}/${encodeURIComponent(String(id))}`, {
      headers: getHeaders(),
      next: { revalidate: 0 },
    });
    if (!existingRes.ok) {
      return NextResponse.json({ error: 'Order record not found' }, { status: 404 });
    }
    const existingRecord = await existingRes.json();
    const existingFields = existingRecord.fields || {};
    const orderType = String(existingFields['Order Type'] || '');
    const orderText = String(existingFields['Name/Word'] || '');
    const existingStatus = String(existingFields['Order Status'] || '');
    const existingPickupStatus = String(existingFields['Pickup Status'] || '');
    const inventoryAlreadyDeducted = isTruthy(existingFields['Inventory Deducted']);

    const fields: Record<string, string | boolean> = {};
    if (status) {
      fields['Order Status'] = String(status);
      if (String(status).toLowerCase() === 'done' && orderType.toLowerCase() === 'pickup') {
        fields['Pickup Status'] = 'Ready for Pickup';
      }
    }
    if (pickupStatus) {
      fields['Pickup Status'] = String(pickupStatus);
    }

    const nextStatus = String(fields['Order Status'] || existingStatus || '');
    const nextPickupStatus = String(fields['Pickup Status'] || existingPickupStatus || '');

    // Deduct inventory when status moves to "In Progress"
    const isNewInProgress = nextStatus.toLowerCase() === 'in progress' && existingStatus.toLowerCase() !== 'in progress';
    // Fallback: also deduct at fulfillment if somehow missed
    const pickupComplete = orderType.toLowerCase() === 'pickup' && nextPickupStatus.toLowerCase() === 'picked up';
    const shipComplete = orderType.toLowerCase() === 'ship to customer' && nextStatus.toLowerCase() === 'ready to ship';
    const shouldDeduct = isNewInProgress || pickupComplete || shipComplete;

    if (shouldDeduct && !inventoryAlreadyDeducted) {
      const deducted = await deductInventoryForOrder(orderText);
      if (deducted) {
        fields['Inventory Deducted'] = true;
      }
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

    // Send "ready for pickup" SMS when status → Done for pickup orders
    const isNewDone = String(status).toLowerCase() === 'done'
      && existingStatus.toLowerCase() !== 'done'
      && orderType.toLowerCase() === 'pickup';
    const doneTextAlreadySent = isTruthy(existingFields['Done Text Sent']);

    if (isNewDone && !doneTextAlreadySent) {
      const customerPhone = String(existingFields['Phone Number'] || '');
      const customerName = String(existingFields['Name'] || '');
      if (customerPhone) {
        const msg = `Hey ${customerName}, your custom Glowblocks set is ready for pickup!`;
        const sent = await sendSMS(customerPhone, msg);
        if (sent) {
          await fetch(getAirtableUrl(), {
            method: 'PATCH',
            headers: getHeaders(),
            body: JSON.stringify({
              records: [{ id: String(id), fields: { 'Done Text Sent': true } }],
            }),
          });
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Popup order PATCH error:', error);
    return NextResponse.json({ error: 'Failed to update status' }, { status: 500 });
  }
}
