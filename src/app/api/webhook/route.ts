import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { sendEmail } from '@/lib/email';
import { sendSMS } from '@/lib/sms';
import { onlineOrderConfirmationEmail } from '@/lib/email-templates';

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!);
}

function titleCase(s: string): string {
  return s.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

type InventoryRecord = { id: string; fields: { Item?: string; Quantity?: number } };

const COLOR_PRESETS: { label: string; colors: string[] }[] = [
  { label: 'Rainbow', colors: ['#FF3C3C', '#FF8C00', '#FFDC3C', '#50DC50'] },
  { label: 'American Flag', colors: ['#C82828', '#F0F0F0', '#283C78'] },
  { label: 'Party', colors: ['#FF3C8C', '#50B4FF', '#64DC64', '#FFDC50'] },
  { label: 'Tropical', colors: ['#FF7864', '#50C8C8', '#FFB43C', '#50B464'] },
  { label: 'Sunset', colors: ['#FF783C', '#FF508C', '#A050FF', '#FFB450'] },
  { label: 'Ocean', colors: ['#3CA096', '#28508C', '#64DCDC', '#50A064'] },
];

function detectPreset(colors: string[]): string | null {
  const nonWhite = colors.filter((c) => c.toUpperCase() !== '#FFFFFF');
  if (nonWhite.length === 0) return null;
  for (const preset of COLOR_PRESETS) {
    const expected = nonWhite.map((_, i) => preset.colors[i % preset.colors.length]);
    if (expected.every((c, i) => c.toUpperCase() === nonWhite[i].toUpperCase())) {
      return preset.label;
    }
  }
  return null;
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
      const fs = fullSession as any;
      const shipping = (fs.collected_information?.shipping_details || fs.shipping_details) as {
        name?: string;
        address?: { line1?: string; line2?: string; city?: string; state?: string; postal_code?: string; country?: string };
      } | null;
      const address = shipping?.address;
      const customerName = shipping?.name || fullSession.customer_details?.name || '';
      const customerEmail = fullSession.customer_details?.email || '';
      const customerPhone = fullSession.customer_details?.phone || '';

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
          const presetName = item.colors ? detectPreset(item.colors) : null;
          const colorLabel = presetName
            ? `Preset: ${presetName}`
            : item.colors?.length
              ? 'Custom Colors'
              : 'Default';
          return `"${item.text}" (${colorLabel})`;
        })
        .join(' | ');

      // Build structured order data for board scanning
      const fullOrderText = items
        .flatMap((item: { text: string; quantity?: number }) => {
          const qty = item.quantity || 1;
          return Array.from({ length: qty }, () => item.text);
        })
        .join(' ');
      const orderData = {
        items: items.map((item: { text: string; colors: string[]; quantity?: number }) => ({
          text: item.text,
          colors: item.colors || [],
          quantity: item.quantity || 1,
        })),
        boardIds: Array.from({ length: fullOrderText.length }, () => null),
      };

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

      // Parse gift data from metadata
      let giftFields: Record<string, string> = {};
      try {
        const giftRaw = fullSession.metadata?.gift_data;
        if (giftRaw) {
          const giftData = JSON.parse(giftRaw);
          if (giftData.isGift) {
            giftFields = {
              'Gift': 'Yes',
              'Gift Recipient': String(giftData.recipientName || ''),
              'Gift Note': String(giftData.giftNote || ''),
            };
          }
        }
      } catch {}

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
                'Customer Name': titleCase(customerName),
                'Email': customerEmail,
                'Phone Number': customerPhone,
                'Address': fullAddress,
                'Shipping Method': shippingMethod,
                'Items': itemsSummary,
                'Line Items': lineItemsSummary,
                'Total': `$${((fullSession.amount_total || 0) / 100).toFixed(2)}`,
                'Shipping Cost': `$${((shippingCost?.amount_total || 0) / 100).toFixed(2)}`,
                'Stripe Session ID': session.id,
                'Date': new Date().toISOString().split('T')[0],
                'Status': 'New',
                'Order Text': fullOrderText,
                'Order Data': JSON.stringify(orderData),
                ...(fullSession.metadata?.referral ? { 'Referral': fullSession.metadata.referral } : {}),
                ...giftFields,
              },
            }),
          }
        );

        if (!res.ok) {
          const err = await res.json();
          console.error('Airtable order save error:', err);
        }

        // Send order confirmation email + SMS + admin notification
        {
          const firstName = customerName.split(' ')[0] || 'there';
          const totalFormatted = `$${((fullSession.amount_total || 0) / 100).toFixed(2)}`;
          const itemListHtml = items
            .map((item: { text: string; quantity?: number }) =>
              `<li>"${item.text}" × ${item.quantity || 1}</li>`
            )
            .join('');

          const smsPromises: Promise<unknown>[] = [];

          if (customerEmail) {
            const html = onlineOrderConfirmationEmail(firstName, itemListHtml, totalFormatted, fullAddress || '', customerEmail);
            smsPromises.push(
              sendEmail(customerEmail, 'Your GlowBlocks Order Confirmation', html)
            );
          }

          if (customerPhone) {
            smsPromises.push(
              sendSMS(customerPhone, `Hey ${firstName}, thanks for your GlowBlocks order! We've received it and are getting started. Expect delivery in 5-7 business days!`)
                .catch((err) => console.error('Failed to send order confirmation SMS:', err))
            );
          }

          // Notify admin of new order
          const adminPhone = process.env.ADMIN_PHONE;
          if (adminPhone) {
            const orderSummary = items.map((item: { text: string; quantity?: number }) => `"${item.text}" x${item.quantity || 1}`).join(', ');
            smsPromises.push(
              sendSMS(adminPhone, `New online order from ${customerName}: ${orderSummary} — ${totalFormatted}`)
                .catch((err) => console.error('Failed to send admin order notification:', err))
            );
          }

          await Promise.allSettled(smsPromises);
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
