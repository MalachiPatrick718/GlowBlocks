import { NextRequest, NextResponse } from 'next/server';
import { POPUP_COLOR_MAP } from '@/data/popupColorCatalog';
import { notify } from '@/lib/notify';
import { sendSMS } from '@/lib/sms';
import { popupOrderConfirmationEmail, inProgressEmail, donePickupEmail, doneShipEmail, deliveredEmail } from '@/lib/email-templates';

const apiKey = process.env.AIRTABLE_API_KEY;
const baseId = process.env.AIRTABLE_BASE_ID;
const tableName = process.env.AIRTABLE_POPUP_ORDERS || process.env.AIRTABLE_POPUP_ORDERS_TABLE || 'Popup';
const inventoryTableName = process.env.AIRTABLE_INVENTORY_TABLE || 'Inventory';
const onlineOrdersTableName = process.env.AIRTABLE_ORDERS_TABLE || 'Orders';
const adminKey = process.env.POPUP_ORDERS_ADMIN_KEY;
const popupOrderStatusValue = process.env.AIRTABLE_POPUP_ORDER_STATUS || '';
const taxRate = parseFloat(process.env.POPUP_TAX_RATE || '0.08875');

function titleCase(s: string): string {
  return s.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

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

function getOnlineOrdersAirtableUrl() {
  return `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(onlineOrdersTableName)}`;
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

interface SetData {
  text: string;
  letterColors: string[];
  colorNumbers: (number | null)[];
  colorMode: string;
  presetName: string | null;
}

export async function POST(req: NextRequest) {
  try {
    if (!apiKey || !baseId) {
      return NextResponse.json({ error: 'Airtable is not configured' }, { status: 500 });
    }

    const body = await req.json();
    const {
      customerName,
      phoneNumber,
      email,
      address,
      deliveryMethod,
      paymentMethod,
      discountCode,
      smsOptInAt,
    } = body;

    // Support multi-set or single-set (backward compat)
    const sets: SetData[] = Array.isArray(body.sets) && body.sets.length > 0
      ? body.sets
      : [{
          text: body.text,
          letterColors: body.letterColors,
          colorNumbers: body.colorNumbers,
          colorMode: body.colorMode,
          presetName: body.presetName,
        }];

    if (!sets[0].text || !customerName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const normalizedDeliveryMethod = String(deliveryMethod || 'ship').toLowerCase() === 'pick-up' ? 'pick-up' : 'ship';
    const mappedOrderType = normalizedDeliveryMethod === 'pick-up' ? 'Pickup' : 'Ship to Customer';
    const orderNumber = generateOrderNumber();
    if (normalizedDeliveryMethod === 'ship' && !String(address || '').trim()) {
      return NextResponse.json({ error: 'Shipping address is required for shipping orders' }, { status: 400 });
    }

    const normalizedPayment = paymentMethod === 'card' ? 'mobile' : (paymentMethod || 'mobile');
    const isCash = normalizedPayment === 'cash';
    const normalizedDiscountCode = String(discountCode || '').trim().toUpperCase();
    const freeShippingCode = ['POP', 'MARTEL'].includes(normalizedDiscountCode);

    // Combined pricing across all sets
    const totalLetterCount = sets.reduce((sum, s) => sum + s.text.length, 0);
    const pricePerLetter = getPricePerLetter(totalLetterCount);
    const letterSubtotal = totalLetterCount * pricePerLetter;
    const totalCustomColorFee = sets.reduce((sum, s) => sum + (s.colorMode === 'custom' ? 2.00 : 0), 0);
    const subtotalBeforeDiscount = letterSubtotal + totalCustomColorFee;
    const discount = subtotalBeforeDiscount * 0.10;
    const discountedSubtotal = subtotalBeforeDiscount - discount;
    const shippingFee = normalizedDeliveryMethod === 'pick-up' || freeShippingCode ? 0 : (isCash ? 6.00 : 5.99);
    const tax = isCash ? 0 : discountedSubtotal * taxRate;
    const total = discountedSubtotal + tax + shippingFee;

    const paymentMethodLabel = normalizedPayment === 'mobile' ? 'Mobile'
      : normalizedPayment === 'kiosk-card' ? 'Kiosk Card'
      : 'Cash';

    // Build Airtable records — one per set, shared order number
    const recordIds: string[] = [];
    for (let si = 0; si < sets.length; si++) {
      const s = sets[si];
      const setLetterCount = s.text.length;
      const setCustomColorFee = s.colorMode === 'custom' ? 2.00 : 0;
      const setLetterSubtotal = setLetterCount * pricePerLetter;
      const setSubtotalBeforeDiscount = setLetterSubtotal + setCustomColorFee;
      const setDiscount = setSubtotalBeforeDiscount * 0.10;
      const setSubtotal = setSubtotalBeforeDiscount - setDiscount;
      // Only charge shipping/tax on the first set to avoid double-counting
      const setShippingFee = si === 0 ? shippingFee : 0;
      const setTax = si === 0 ? tax : (isCash ? 0 : setSubtotal * taxRate);
      const setTotal = si === 0 ? total : (setSubtotal + (isCash ? 0 : setSubtotal * taxRate));

      const colorsByLetter = s.text.split('').map((char: string, idx: number) => {
        const colorNumber = Array.isArray(s.colorNumbers) ? s.colorNumbers[idx] : null;
        const matched = typeof colorNumber === 'number' ? POPUP_COLOR_MAP.get(colorNumber) : null;
        return {
          letter: char,
          colorHex: s.letterColors?.[idx] || '#FFFFFF',
          colorNumber: colorNumber || null,
          colorName: matched?.name || null,
        };
      });

      const onSiteEligible = await checkStockEligibility(s.text);

      const fields: Record<string, string | boolean | number> = {
        Name: titleCase(String(customerName).slice(0, 100)),
        'Phone Number': String(phoneNumber || '').slice(0, 40),
        Email: String(email || '').slice(0, 100),
        'SMS Opt-In': smsOptInAt ? String(smsOptInAt) : '',
        Address: String(address || '').slice(0, 250),
        'Name/Word': s.text,
        'Order Number': orderNumber,
        'Color Set': s.colorMode === 'custom' ? 'Custom Numbers' : (s.presetName || 'Preset Theme'),
        'Order Type': mappedOrderType,
        'Custom Colors': JSON.stringify({
          letterColors: s.letterColors || [],
          colorNumbers: s.colorNumbers || [],
          colorsByLetter,
          deliveryMethod: normalizedDeliveryMethod,
          onSiteEligible,
        }),
        'Inventory Deducted': false,
        'Letter Count': setLetterCount,
        'Custom Color Fee': setCustomColorFee,
        'Shipping Fee': setShippingFee,
        'Subtotal': setSubtotal,
        'Tax': setTax,
        'Total': setTotal,
        'Discount': setDiscount,
        ...(normalizedDiscountCode ? { 'Discount Code': normalizedDiscountCode } : {}),
        'Payment Method': paymentMethodLabel,
        'Payment': 'Awaiting Payment',
      };

      if (popupOrderStatusValue) {
        fields['Order Status'] = popupOrderStatusValue;
      }
      fields['Pickup Status'] = normalizedDeliveryMethod === 'pick-up' ? 'Not Ready' : 'Not Applicable';

      const airtableRes = await fetch(getAirtableUrl(), {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ records: [{ fields }] }),
      });

      if (!airtableRes.ok) {
        const err = await airtableRes.json();
        console.error('Popup order Airtable error:', JSON.stringify(err));
        const detail = err?.error?.message || 'Failed to save popup order';
        return NextResponse.json({ error: detail }, { status: 500 });
      }

      const airtableData = await airtableRes.json();
      const recordId = airtableData.records?.[0]?.id || '';
      recordIds.push(recordId);

      // Deduct inventory per set
      const deducted = await deductInventoryForOrder(s.text);
      if (deducted && recordId) {
        await fetch(getAirtableUrl(), {
          method: 'PATCH',
          headers: getHeaders(),
          body: JSON.stringify({
            records: [{ id: recordId, fields: { 'Inventory Deducted': true } }],
          }),
        });
      } else if (!deducted) {
        console.error('Failed to deduct inventory for popup order:', orderNumber, s.text);
      }
    }

    // Send confirmation email + SMS
    {
      const firstName = String(customerName).trim().split(' ')[0];
      const setCount = sets.length;
      const setsLabel = setCount > 1 ? `${setCount} sets` : 'your set';
      const smsMsg = normalizedDeliveryMethod === 'pick-up'
        ? `Hey ${firstName}, thanks for your GlowBlocks order! Your order number is ${orderNumber} (${setsLabel}). We'll text you when your order is ready for pickup!`
        : `Hey ${firstName}, thanks for your GlowBlocks order (${setsLabel})! Your order has been received. Be on the lookout for your GlowBlocks in 5-7 business days!`;
      const phone = phoneNumber && String(phoneNumber).replace(/\D/g, '').length >= 10
        ? String(phoneNumber)
        : undefined;
      const customerEmail = typeof email === 'string' && email.trim() ? email.trim() : undefined;
      // Send all notifications in parallel and wait for them to complete
      // (serverless functions terminate after response, so we must await)
      const notificationPromises: Promise<unknown>[] = [];

      notificationPromises.push(
        notify({
          email: customerEmail,
          phone,
          emailSubject: 'Your GlowBlocks Order Confirmation',
          emailHtml: popupOrderConfirmationEmail(firstName, orderNumber, setsLabel, normalizedDeliveryMethod, customerEmail),
          smsMessage: smsMsg,
        }).catch((err) => console.error('Failed to send order confirmation:', err))
      );

      // Notify admin of new order
      const adminPhone = process.env.ADMIN_PHONE;
      if (adminPhone) {
        const wordsList = sets.map((s: { text: string }) => `"${s.text}"`).join(', ');
        notificationPromises.push(
          sendSMS(adminPhone, `New popup order #${orderNumber} from ${String(customerName)}: ${wordsList} (${normalizedDeliveryMethod})`)
            .catch((err) => console.error('Failed to send admin order notification:', err))
        );
      }

      await Promise.allSettled(notificationPromises);
    }

    return NextResponse.json({
      success: true,
      orderNumber,
      recordId: recordIds[0] || '',
      recordIds,
      setCount: sets.length,
      pricing: {
        letterCount: totalLetterCount,
        pricePerLetter,
        letterSubtotal,
        customColorFee: totalCustomColorFee,
        discount,
        shippingFee,
        subtotal: discountedSubtotal,
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

    // Public inventory eligibility check (no admin key needed)
    const checkWord = req.nextUrl.searchParams.get('check');
    if (checkWord) {
      const eligible = await checkStockEligibility(checkWord);
      return NextResponse.json({ eligible });
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
      let eligible: boolean | null = null;
      let boardIds: (string | null)[] = [];
      try {
        const parsed = JSON.parse(customColorsRaw);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          if (parsed.deliveryMethod) delivery = String(parsed.deliveryMethod);
          if (typeof parsed.onSiteEligible === 'boolean') eligible = parsed.onSiteEligible;
          if (Array.isArray(parsed.boardIds)) boardIds = parsed.boardIds;
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
      email: record.fields['Email'] || '',
      phoneNumber: record.fields['Phone Number'] || '',
      address: record.fields.Address || '',
      date: record.createdTime || '',
      status: record.fields['Order Status'] || '',
      orderType: record.fields['Order Type'] || '',
      pickupStatus: record.fields['Pickup Status'] || '',
      orderNumber: record.fields['Order Number'] || '',
      inventoryDeducted: record.fields['Inventory Deducted'] || false,
      onSiteEligible: eligible,
      boardIds,
      deliveryMethod: delivery,
      letterCount: record.fields['Letter Count'] || 0,
      customColorFee: record.fields['Custom Color Fee'] || 0,
      subtotal: record.fields['Subtotal'] || 0,
      discount: record.fields['Discount'] || 0,
      shippingFee: record.fields['Shipping Fee'] || 0,
      tax: record.fields['Tax'] || 0,
      total: record.fields['Total'] || 0,
      trackingNumber: record.fields['Tracking Number'] || '',
      labelUrl: record.fields['Label URL'] || '',
      paymentStatus: record.fields['Payment'] || 'Awaiting Payment',
      paymentMethod: record.fields['Payment Method'] || '',
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

    const { id, status, pickupStatus, scanBoard, paymentStatus: newPaymentStatus } = await req.json();
    if (!id || (!status && !pickupStatus && !scanBoard && !newPaymentStatus)) {
      return NextResponse.json({ error: 'Missing record id and update fields' }, { status: 400 });
    }

    // Validate scanBoard if provided
    if (scanBoard) {
      const { letterIndex, boardId: bid } = scanBoard;
      if (typeof letterIndex !== 'number' || letterIndex < 0) {
        return NextResponse.json({ error: 'Invalid letterIndex' }, { status: 400 });
      }
      if (!bid || !/^GB\d{4}$/.test(String(bid))) {
        return NextResponse.json({ error: 'Invalid board ID format. Expected GBXXXX (e.g. GB0001)' }, { status: 400 });
      }
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

    // Handle per-letter board scanning
    if (scanBoard) {
      const { letterIndex, boardId: bid } = scanBoard;
      const boardIdStr = String(bid);

      // Validate letterIndex is within the word length
      if (letterIndex >= orderText.length || orderText[letterIndex] === ' ') {
        return NextResponse.json({ error: 'Invalid letter index for this order' }, { status: 400 });
      }

      // Check for duplicates across ALL orders
      const allRes = await fetch(getAirtableUrl(), {
        headers: getHeaders(),
        next: { revalidate: 0 },
      });
      if (allRes.ok) {
        const allData = await allRes.json();
        for (const r of (allData.records || []) as { id: string; fields: Record<string, string> }[]) {
          try {
            const cc = JSON.parse(r.fields['Custom Colors'] || '{}');
            const ids: (string | null)[] = Array.isArray(cc.boardIds) ? cc.boardIds : [];
            const foundIdx = ids.indexOf(boardIdStr);
            if (foundIdx !== -1) {
              // Skip if it's the same order and same letter position (replacing)
              if (r.id === String(id) && foundIdx === letterIndex) continue;
              const orderNum = r.fields['Order Number'] || r.id;
              return NextResponse.json({
                error: `${boardIdStr} is already linked to Order #${orderNum}`,
              }, { status: 409 });
            }
          } catch { /* skip */ }
        }
      }

      // Also check online orders for duplicates
      const onlineRes = await fetch(getOnlineOrdersAirtableUrl(), {
        headers: getHeaders(),
        next: { revalidate: 0 },
      });
      if (onlineRes.ok) {
        const onlineData = await onlineRes.json();
        for (const r of (onlineData.records || []) as { id: string; fields: Record<string, string> }[]) {
          try {
            const od = JSON.parse(r.fields['Order Data'] || '{}');
            const ids: (string | null)[] = Array.isArray(od.boardIds) ? od.boardIds : [];
            const foundIdx = ids.indexOf(boardIdStr);
            if (foundIdx !== -1) {
              const customerName = r.fields['Customer Name'] || r.id;
              return NextResponse.json({
                error: `${boardIdStr} is already linked to Online Order (${customerName})`,
              }, { status: 409 });
            }
          } catch { /* skip */ }
        }
      }

      // Parse existing Custom Colors and update boardIds array
      let customColors: Record<string, unknown> = {};
      try {
        const parsed = JSON.parse(existingFields['Custom Colors'] || '{}');
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          customColors = parsed;
        }
      } catch { /* keep empty */ }

      // Initialize boardIds array if not present
      const boardIds: (string | null)[] = Array.isArray(customColors.boardIds)
        ? [...(customColors.boardIds as (string | null)[])]
        : Array.from({ length: orderText.length }, () => null);
      // Ensure array is long enough
      while (boardIds.length < orderText.length) boardIds.push(null);

      boardIds[letterIndex] = boardIdStr;
      customColors.boardIds = boardIds;

      // Save just the Custom Colors update — no status change
      const scanRes = await fetch(getAirtableUrl(), {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({
          records: [{ id: String(id), fields: { 'Custom Colors': JSON.stringify(customColors) } }],
        }),
      });
      if (!scanRes.ok) {
        return NextResponse.json({ error: 'Failed to save board scan' }, { status: 500 });
      }

      return NextResponse.json({ success: true, boardIds });
    }

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
    if (newPaymentStatus) {
      fields['Payment'] = String(newPaymentStatus);
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

    // Send "in progress" notification when status → In Progress
    const inProgressTextAlreadySent = isTruthy(existingFields['In Progress Text Sent']);
    const inProgressEmailAlreadySent = isTruthy(existingFields['In Progress Email Sent']);

    if (isNewInProgress && (!inProgressTextAlreadySent || !inProgressEmailAlreadySent)) {
      const customerPhone = !inProgressTextAlreadySent ? String(existingFields['Phone Number'] || '') : undefined;
      const customerEmail = !inProgressEmailAlreadySent ? String(existingFields['Email'] || '') : undefined;
      const customerName = String(existingFields['Name'] || '');
      const firstName = customerName.trim().split(' ')[0];
      const result = await notify({
        email: customerEmail || undefined,
        phone: customerPhone || undefined,
        emailSubject: "We're working on your GlowBlocks!",
        emailHtml: inProgressEmail(firstName),
        smsMessage: `Hey ${firstName}, we're working on your GlowBlocks order now! We'll let you know when it's ready.`,
      });
      const flagUpdates: Record<string, boolean> = {};
      if (result.smsSent) flagUpdates['In Progress Text Sent'] = true;
      if (result.emailSent) flagUpdates['In Progress Email Sent'] = true;
      if (Object.keys(flagUpdates).length > 0) {
        await fetch(getAirtableUrl(), {
          method: 'PATCH',
          headers: getHeaders(),
          body: JSON.stringify({
            records: [{ id: String(id), fields: flagUpdates }],
          }),
        });
      }
    }

    // Send "done" notification when status → Done
    const isNewDone = String(status).toLowerCase() === 'done'
      && existingStatus.toLowerCase() !== 'done';
    const doneTextAlreadySent = isTruthy(existingFields['Done Text Sent']);
    const doneEmailAlreadySent = isTruthy(existingFields['Done Email Sent']);

    if (isNewDone && (!doneTextAlreadySent || !doneEmailAlreadySent)) {
      const customerPhone = !doneTextAlreadySent ? String(existingFields['Phone Number'] || '') : undefined;
      const customerEmail = !doneEmailAlreadySent ? String(existingFields['Email'] || '') : undefined;
      const customerName = String(existingFields['Name'] || '');
      const firstName = customerName.trim().split(' ')[0];
      const isPickup = orderType.toLowerCase() === 'pickup';
      const smsMsg = isPickup
        ? `Hey ${customerName}, your custom Glowblocks set is ready for pickup!`
        : `Hey ${firstName}, your GlowBlocks order is complete and being prepared for shipment! We'll send tracking info once it ships.`;
      const result = await notify({
        email: customerEmail || undefined,
        phone: customerPhone || undefined,
        emailSubject: isPickup ? 'Your GlowBlocks are ready for pickup!' : 'Your GlowBlocks order is complete!',
        emailHtml: isPickup ? donePickupEmail(firstName) : doneShipEmail(firstName),
        smsMessage: smsMsg,
      });
      const flagUpdates: Record<string, boolean> = {};
      if (result.smsSent) flagUpdates['Done Text Sent'] = true;
      if (result.emailSent) flagUpdates['Done Email Sent'] = true;
      if (Object.keys(flagUpdates).length > 0) {
        await fetch(getAirtableUrl(), {
          method: 'PATCH',
          headers: getHeaders(),
          body: JSON.stringify({
            records: [{ id: String(id), fields: flagUpdates }],
          }),
        });
      }
    }

    // Send "delivered" notification when status → Delivered
    const isNewDelivered = String(status).toLowerCase() === 'delivered'
      && existingStatus.toLowerCase() !== 'delivered';
    const deliveryAlreadySent = isTruthy(existingFields['Delivery Notification Sent']);

    if (isNewDelivered && !deliveryAlreadySent) {
      const customerPhone = String(existingFields['Phone Number'] || '') || undefined;
      const customerEmail = String(existingFields['Email'] || '') || undefined;
      const customerName = String(existingFields['Name'] || '');
      const firstName = customerName.trim().split(' ')[0];
      const today = new Date().toISOString().split('T')[0];
      const result = await notify({
        email: customerEmail,
        phone: customerPhone,
        emailSubject: 'Your GlowBlocks have arrived!',
        emailHtml: deliveredEmail(firstName),
        smsMessage: `Hey ${firstName}, your GlowBlocks have been delivered! We hope you love them!`,
      });
      const deliveredFlags: Record<string, unknown> = { 'Delivered Date': today };
      if (result.emailSent || result.smsSent) deliveredFlags['Delivery Notification Sent'] = true;
      await fetch(getAirtableUrl(), {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({
          records: [{ id: String(id), fields: deliveredFlags }],
        }),
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Popup order PATCH error:', error);
    return NextResponse.json({ error: 'Failed to update status' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    if (!apiKey || !baseId) {
      return NextResponse.json({ error: 'Airtable is not configured' }, { status: 500 });
    }
    if (!isAuthorizedAdmin(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, customerName, email, phoneNumber, address, text } = await req.json();
    if (!id) {
      return NextResponse.json({ error: 'Missing record id' }, { status: 400 });
    }

    const fields: Record<string, string> = {};
    if (customerName !== undefined) fields['Name'] = titleCase(String(customerName));
    if (email !== undefined) fields['Email'] = String(email);
    if (phoneNumber !== undefined) fields['Phone Number'] = String(phoneNumber);
    if (address !== undefined) fields['Address'] = String(address);
    if (text !== undefined) fields['Name/Word'] = String(text);

    if (Object.keys(fields).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const res = await fetch(getAirtableUrl(), {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify({ records: [{ id: String(id), fields }] }),
    });

    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to update order' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Popup order PUT error:', error);
    return NextResponse.json({ error: 'Failed to update order' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    if (!apiKey || !baseId) {
      return NextResponse.json({ error: 'Airtable is not configured' }, { status: 500 });
    }
    if (!isAuthorizedAdmin(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await req.json();
    if (!id) {
      return NextResponse.json({ error: 'Missing record id' }, { status: 400 });
    }

    const res = await fetch(`${getAirtableUrl()}/${encodeURIComponent(String(id))}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });

    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to delete order' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Popup order DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete order' }, { status: 500 });
  }
}
