import { NextRequest, NextResponse } from 'next/server';

const apiKey = process.env.AIRTABLE_API_KEY;
const baseId = process.env.AIRTABLE_BASE_ID;
const tableName = process.env.AIRTABLE_INVENTORY_TABLE || 'Inventory';
const adminKey = process.env.POPUP_ORDERS_ADMIN_KEY;

const MAIN_ITEMS = ['P6 Bases', 'P2 Diffuser', 'PCB'];
const LETTER_ITEMS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

function getAirtableUrl() {
  return `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}`;
}

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

export async function GET(req: NextRequest) {
  try {
    if (!apiKey || !baseId) {
      return NextResponse.json({ error: 'Airtable is not configured' }, { status: 500 });
    }
    if (!isAuthorized(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const res = await fetch(getAirtableUrl(), { headers: getHeaders(), next: { revalidate: 0 } });
    if (!res.ok) {
      const err = await res.json();
      console.error('Inventory fetch error:', err);
      return NextResponse.json({ error: 'Failed to fetch inventory' }, { status: 500 });
    }

    const data = await res.json();
    const records = data.records || [];
    const inventory: Record<string, number> = {};
    const targets: Record<string, number> = {};
    const needed: Record<string, number> = {};
    const recordIds: Record<string, string> = {};

    records.forEach((record: { id: string; fields: Record<string, unknown> }) => {
      const item = String(record.fields.Item || '').trim();
      if (!item) return;
      inventory[item] = Number(record.fields.Quantity) || 0;
      if (record.fields.Target != null) targets[item] = Number(record.fields.Target) || 0;
      if (record.fields.Needed != null) needed[item] = Number(record.fields.Needed) || 0;
      recordIds[item] = record.id;
    });

    [...MAIN_ITEMS, ...LETTER_ITEMS].forEach((item) => {
      if (!(item in inventory)) inventory[item] = 0;
    });

    const lowStock = Object.entries(inventory)
      .filter(([, qty]) => qty <= 6)
      .map(([item]) => item);

    return NextResponse.json({ inventory, targets, needed, recordIds, lowStock });
  } catch (error) {
    console.error('Inventory API error:', error);
    return NextResponse.json({ error: 'Failed to fetch inventory' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    if (!apiKey || !baseId) {
      return NextResponse.json({ error: 'Airtable is not configured' }, { status: 500 });
    }
    if (!isAuthorized(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { inventory } = await req.json();
    if (!inventory || typeof inventory !== 'object') {
      return NextResponse.json({ error: 'Invalid inventory payload' }, { status: 400 });
    }

    const currentRes = await fetch(getAirtableUrl(), { headers: getHeaders(), next: { revalidate: 0 } });
    if (!currentRes.ok) {
      return NextResponse.json({ error: 'Failed to fetch current inventory' }, { status: 500 });
    }
    const currentData = await currentRes.json();
    const currentRecords = currentData.records || [];
    const existingByItem = new Map<string, { id: string; quantity: number }>();

    currentRecords.forEach((record: { id: string; fields: Record<string, unknown> }) => {
      const item = String(record.fields.Item || '').trim();
      if (!item) return;
      existingByItem.set(item, { id: record.id, quantity: Number(record.fields.Quantity) || 0 });
    });

    const updates: Array<{ id: string; fields: { Quantity: number } }> = [];
    const creates: Array<{ fields: { Item: string; Quantity: number } }> = [];
    Object.entries(inventory as Record<string, number>).forEach(([item, value]) => {
      const qty = Number(value) || 0;
      const existing = existingByItem.get(item);
      if (existing) {
        updates.push({ id: existing.id, fields: { Quantity: qty } });
      } else {
        creates.push({ fields: { Item: item, Quantity: qty } });
      }
    });

    // Batch updates in groups of 10 (Airtable limit)
    for (let i = 0; i < updates.length; i += 10) {
      const batch = updates.slice(i, i + 10);
      const patchRes = await fetch(getAirtableUrl(), {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({ records: batch }),
      });
      if (!patchRes.ok) {
        const err = await patchRes.json();
        console.error('Inventory update error:', err);
        return NextResponse.json({ error: 'Failed to update inventory' }, { status: 500 });
      }
    }

    // Batch creates in groups of 10 (Airtable limit)
    for (let i = 0; i < creates.length; i += 10) {
      const batch = creates.slice(i, i + 10);
      const createRes = await fetch(getAirtableUrl(), {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ records: batch }),
      });
      if (!createRes.ok) {
        const err = await createRes.json();
        console.error('Inventory create error:', err);
        return NextResponse.json({ error: 'Failed to create inventory items' }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Inventory API error:', error);
    return NextResponse.json({ error: 'Failed to save inventory' }, { status: 500 });
  }
}
