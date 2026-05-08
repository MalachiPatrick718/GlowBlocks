import { NextRequest, NextResponse } from 'next/server';

const apiKey = process.env.AIRTABLE_API_KEY;
const baseId = process.env.AIRTABLE_BASE_ID;
const onlineTable = process.env.AIRTABLE_ORDERS_TABLE || 'Orders';
const popupTable = process.env.AIRTABLE_POPUP_ORDERS || process.env.AIRTABLE_POPUP_ORDERS_TABLE || 'Popup';
const adminKey = process.env.POPUP_ORDERS_ADMIN_KEY;

function getHeaders() {
  return { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' };
}

function airtableUrl(table: string) {
  return `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(table)}`;
}

function parseDollars(s: string): number {
  return parseFloat((s || '').replace(/[^0-9.\-]/g, '')) || 0;
}

function formatDollars(n: number): string {
  return `$${n.toFixed(2)}`;
}

const STATUS_ORDER = ['new', 'not started', 'in progress', 'processing', 'done', 'ready to ship', 'shipped', 'delivered'];

function earliestStatus(statuses: string[]): string {
  let minIdx = STATUS_ORDER.length;
  let result = statuses[0] || 'New';
  for (const s of statuses) {
    const idx = STATUS_ORDER.indexOf(s.toLowerCase());
    if (idx !== -1 && idx < minIdx) {
      minIdx = idx;
      result = s;
    }
  }
  return result;
}

export async function POST(req: NextRequest) {
  try {
    if (!apiKey || !baseId) {
      return NextResponse.json({ error: 'Airtable is not configured' }, { status: 500 });
    }
    if (!adminKey || req.headers.get('x-popup-admin-key') !== adminKey) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { orderIds, source } = await req.json();
    if (!Array.isArray(orderIds) || orderIds.length < 2) {
      return NextResponse.json({ error: 'Need at least 2 order IDs to combine' }, { status: 400 });
    }
    if (source !== 'online' && source !== 'popup') {
      return NextResponse.json({ error: 'Source must be "online" or "popup"' }, { status: 400 });
    }

    const table = source === 'online' ? onlineTable : popupTable;
    const url = airtableUrl(table);

    // Fetch all records
    const records: { id: string; fields: Record<string, unknown> }[] = [];
    for (const id of orderIds) {
      const res = await fetch(`${url}/${encodeURIComponent(String(id))}`, {
        headers: getHeaders(),
        next: { revalidate: 0 },
      });
      if (!res.ok) {
        return NextResponse.json({ error: `Order ${id} not found` }, { status: 404 });
      }
      const record = await res.json();
      records.push({ id: record.id, fields: record.fields || {} });
    }

    const primary = records[0];
    const others = records.slice(1);
    let mergedFields: Record<string, unknown>;

    if (source === 'online') {
      mergedFields = mergeOnlineOrders(primary.fields, others.map(r => r.fields));
    } else {
      mergedFields = mergePopupOrders(primary.fields, others.map(r => r.fields));
    }

    // Update primary record
    const updateRes = await fetch(url, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify({ records: [{ id: primary.id, fields: mergedFields }] }),
    });
    if (!updateRes.ok) {
      const err = await updateRes.json();
      console.error('Combine update error:', err);
      return NextResponse.json({ error: 'Failed to update combined order' }, { status: 500 });
    }

    // Delete other records (Airtable supports up to 10 at a time via query params)
    const deleteIds = others.map(r => r.id);
    const deleteParams = deleteIds.map(id => `records[]=${encodeURIComponent(id)}`).join('&');
    const deleteRes = await fetch(`${url}?${deleteParams}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!deleteRes.ok) {
      console.error('Combine delete error:', await deleteRes.json());
      return NextResponse.json({ error: 'Combined order updated but failed to delete duplicates' }, { status: 500 });
    }

    return NextResponse.json({ success: true, primaryId: primary.id, deletedIds: deleteIds });
  } catch (error) {
    console.error('Combine orders error:', error);
    return NextResponse.json({ error: 'Failed to combine orders' }, { status: 500 });
  }
}

function mergeOnlineOrders(
  primary: Record<string, unknown>,
  others: Record<string, unknown>[],
): Record<string, unknown> {
  const all = [primary, ...others];
  const f = { ...primary };

  // Concatenate text fields
  const items = all.map(r => String(r['Items'] || '')).filter(Boolean);
  f['Items'] = items.join(' | ');

  const lineItems = all.map(r => String(r['Line Items'] || '')).filter(Boolean);
  f['Line Items'] = lineItems.join(' | ');

  const orderTexts = all.map(r => String(r['Order Text'] || '')).filter(Boolean);
  f['Order Text'] = orderTexts.join(' ');

  // Sum totals
  f['Total'] = formatDollars(all.reduce((sum, r) => sum + parseDollars(String(r['Total'] || '')), 0));

  // Keep higher shipping cost
  const shippingCosts = all.map(r => parseDollars(String(r['Shipping Cost'] || '')));
  f['Shipping Cost'] = formatDollars(Math.max(...shippingCosts));

  // Use earliest status
  const statuses = all.map(r => String(r['Status'] || 'New'));
  f['Status'] = earliestStatus(statuses);

  // Use earliest date
  const dates = all.map(r => String(r['Date'] || '')).filter(Boolean).sort();
  if (dates.length > 0) f['Date'] = dates[0];

  // Merge Order Data (items arrays and boardIds)
  const mergedOrderData: { items: unknown[]; boardIds: (string | null)[] } = { items: [], boardIds: [] };
  for (const r of all) {
    try {
      const od = JSON.parse(String(r['Order Data'] || '{}'));
      if (Array.isArray(od.items)) mergedOrderData.items.push(...od.items);
      if (Array.isArray(od.boardIds)) mergedOrderData.boardIds.push(...od.boardIds);
    } catch { /* skip */ }
  }
  f['Order Data'] = JSON.stringify(mergedOrderData);

  // Gift: keep whichever has gift data
  if (!f['Gift'] || f['Gift'] !== 'Yes') {
    for (const r of others) {
      if (r['Gift'] === 'Yes') {
        f['Gift'] = 'Yes';
        f['Gift Recipient'] = r['Gift Recipient'] || '';
        f['Gift Note'] = r['Gift Note'] || '';
        break;
      }
    }
  }

  // Reset notification flags so combined order gets fresh notifications
  f['In Progress Email Sent'] = false;
  f['In Progress Text Sent'] = false;
  f['Done Email Sent'] = false;
  f['Done Text Sent'] = false;
  f['Delivery Notification Sent'] = false;

  return f;
}

function mergePopupOrders(
  primary: Record<string, unknown>,
  others: Record<string, unknown>[],
): Record<string, unknown> {
  const all = [primary, ...others];
  const f = { ...primary };

  // Concatenate words
  const words = all.map(r => String(r['Name/Word'] || '')).filter(Boolean);
  f['Name/Word'] = words.join(' ');

  // Sum letter count
  f['Letter Count'] = all.reduce((sum, r) => sum + (Number(r['Letter Count']) || 0), 0);

  // Sum pricing
  f['Subtotal'] = all.reduce((sum, r) => sum + (Number(r['Subtotal']) || 0), 0);
  f['Custom Color Fee'] = all.reduce((sum, r) => sum + (Number(r['Custom Color Fee']) || 0), 0);
  f['Shipping Fee'] = Math.max(...all.map(r => Number(r['Shipping Fee']) || 0));
  f['Tax'] = all.reduce((sum, r) => sum + (Number(r['Tax']) || 0), 0);
  f['Discount'] = all.reduce((sum, r) => sum + (Number(r['Discount']) || 0), 0);
  f['Total'] = all.reduce((sum, r) => sum + (Number(r['Total']) || 0), 0);

  // Merge Custom Colors JSON
  try {
    const mergedColors: { colorsByLetter: unknown[]; boardIds: (string | null)[]; letterColors: string[] } = {
      colorsByLetter: [],
      boardIds: [],
      letterColors: [],
    };
    for (const r of all) {
      try {
        const cc = JSON.parse(String(r['Custom Colors'] || '{}'));
        if (Array.isArray(cc.colorsByLetter)) mergedColors.colorsByLetter.push(...cc.colorsByLetter);
        if (Array.isArray(cc.boardIds)) mergedColors.boardIds.push(...cc.boardIds);
        if (Array.isArray(cc.letterColors)) mergedColors.letterColors.push(...cc.letterColors);
      } catch { /* skip */ }
    }
    const primaryCC = JSON.parse(String(primary['Custom Colors'] || '{}'));
    f['Custom Colors'] = JSON.stringify({ ...primaryCC, ...mergedColors });
  } catch { /* skip */ }

  // Use earliest status
  const statuses = all.map(r => String(r['Order Status'] || 'Not Started'));
  f['Order Status'] = earliestStatus(statuses);

  // Reset notification flags
  f['In Progress Email Sent'] = false;
  f['In Progress Text Sent'] = false;
  f['Done Email Sent'] = false;
  f['Done Text Sent'] = false;
  f['Delivery Notification Sent'] = false;

  return f;
}
