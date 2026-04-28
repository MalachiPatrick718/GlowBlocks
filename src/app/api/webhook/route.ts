import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!);
}

type InventoryRecord = { id: string; fields: { Item?: string; Quantity?: number } };

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

async function deductInventory(
  orderItems: { text: string; quantity?: number }[],
  apiKey: string,
  baseId: string
): Promise<boolean> {
  const inventoryTable = process.env.AIRTABLE_INVENTORY_TABLE || 'Inventory';
  const inventoryUrl = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(inventoryTable)}`;
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };

  const inventoryRes = await fetch(inventoryUrl, { headers, cache: 'no-store' });
  if (!inventoryRes.ok) return false;

  const inventoryData = await inventoryRes.json();
  const records: InventoryRecord[] = inventoryData.records || [];
  const byItem = new Map<string, InventoryRecord>();
  records.forEach((record) => {
    const key = (record.fields.Item || '').trim();
    if (key) byItem.set(key, record);
  });

  // Aggregate letter counts across all items (accounting for quantity)
  const totalDeductions: Record<string, number> = {};
  let totalLetters = 0;
  for (const item of orderItems) {
    const qty = item.quantity || 1;
    const counts = getLetterCounts(item.text);
    for (const [letter, count] of Object.entries(counts)) {
      totalDeductions[letter] = (totalDeductions[letter] || 0) + count * qty;
    }
    totalLetters += Object.values(counts).reduce((sum, n) => sum + n, 0) * qty;
  }
  totalDeductions['P6 Bases'] = (totalDeductions['P6 Bases'] || 0) + totalLetters;
  totalDeductions['PCB'] = (totalDeductions['PCB'] || 0) + totalLetters;

  const updateRecords: Array<{ id: string; fields: { Quantity: number } }> = [];
  const createRecords: Array<{ fields: { Item: string; Quantity: number } }> = [];

  Object.entries(totalDeductions).forEach(([item, amount]) => {
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

  for (let i = 0; i < updateRecords.length; i += 10) {
    const batch = updateRecords.slice(i, i + 10);
    const patchRes = await fetch(inventoryUrl, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ records: batch }),
    });
    if (!patchRes.ok) return false;
  }

  for (let i = 0; i < createRecords.length; i += 10) {
    const batch = createRecords.slice(i, i + 10);
    const createRes = await fetch(inventoryUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ records: batch }),
    });
    if (!createRes.ok) return false;
  }

  return true;
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature');

  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Missing signature or webhook secret' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;

    try {
      // Get full session with line items
      const stripe = getStripe();
      const fullSession = await stripe.checkout.sessions.retrieve(session.id, {
        expand: ['line_items', 'shipping_cost.shipping_rate'],
      }) as Stripe.Checkout.Session;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const shipping = (fullSession as any).shipping_details as {
        name?: string;
        address?: { line1?: string; line2?: string; city?: string; state?: string; postal_code?: string; country?: string };
      } | null;
      const address = shipping?.address;
      const customerName = shipping?.name || fullSession.customer_details?.name || '';
      const customerEmail = fullSession.customer_details?.email || '';

      // Get shipping method name
      const shippingCost = fullSession.shipping_cost;
      let shippingMethod = 'Unknown';
      if (shippingCost?.shipping_rate && typeof shippingCost.shipping_rate === 'object') {
        const rate = shippingCost.shipping_rate as Stripe.ShippingRate;
        shippingMethod = rate.display_name || 'Unknown';
      }

      // Get order details from metadata
      const orderDetails = fullSession.metadata?.order_details || '[]';

      // Format items for display
      const items = JSON.parse(orderDetails);
      const itemsSummary = items
        .map((item: { text: string; colors: string[] }) => {
          const colors = item.colors?.join(', ') || 'default';
          return `"${item.text}" (colors: ${colors})`;
        })
        .join(' | ');

      // Format full address
      const fullAddress = [
        address?.line1,
        address?.line2,
        address?.city,
        address?.state,
        address?.postal_code,
        address?.country,
      ]
        .filter(Boolean)
        .join(', ');

      // Get line items summary with quantities
      const lineItemsList = fullSession.line_items?.data || [];
      const lineItemsSummary = lineItemsList
        .map((li) => `${li.description} x${li.quantity}`)
        .join(' | ');

      // Save to Airtable
      const apiKey = process.env.AIRTABLE_API_KEY;
      const baseId = process.env.AIRTABLE_BASE_ID;
      const tableName = process.env.AIRTABLE_ORDERS_TABLE || 'Orders';

      if (apiKey && baseId) {
        const res = await fetch(
          `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              fields: {
                'Customer Name': customerName,
                'Email': customerEmail,
                'Address': fullAddress,
                'Shipping Method': shippingMethod,
                'Items': itemsSummary,
                'Line Items': lineItemsSummary,
                'Total': `$${((fullSession.amount_total || 0) / 100).toFixed(2)}`,
                'Shipping Cost': `$${((shippingCost?.amount_total || 0) / 100).toFixed(2)}`,
                'Stripe Session ID': session.id,
                'Date': new Date().toISOString().split('T')[0],
                'Status': 'New',
              },
            }),
          }
        );

        if (!res.ok) {
          const err = await res.json();
          console.error('Airtable order save error:', err);
        }

        // Deduct inventory immediately for online orders
        const orderItems = items.map((item: { text: string; quantity?: number }) => ({
          text: item.text,
          quantity: item.quantity || 1,
        }));
        const deducted = await deductInventory(orderItems, apiKey, baseId);
        if (!deducted) {
          console.error('Failed to deduct inventory for online order:', session.id);
        }
      }
    } catch (err) {
      console.error('Error processing checkout session:', err);
    }
  }

  return NextResponse.json({ received: true });
}
