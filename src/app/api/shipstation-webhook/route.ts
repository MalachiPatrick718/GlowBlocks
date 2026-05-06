import { NextRequest, NextResponse } from 'next/server';
import { notify } from '@/lib/notify';
import { deliveredEmail } from '@/lib/email-templates';

const apiKey = process.env.AIRTABLE_API_KEY;
const baseId = process.env.AIRTABLE_BASE_ID;
const ordersTable = process.env.AIRTABLE_ORDERS_TABLE || 'Orders';
const popupTable = process.env.AIRTABLE_POPUP_ORDERS || process.env.AIRTABLE_POPUP_ORDERS_TABLE || 'Popup';
const webhookSecret = process.env.SHIPSTATION_WEBHOOK_SECRET || '';

function getHeaders() {
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };
}

function isTruthy(val: unknown): boolean {
  return val === true || val === 'true' || val === 'Yes';
}

async function findOrderByTracking(trackingNumber: string): Promise<{
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  record: any;
  table: string;
  source: 'online' | 'popup';
} | null> {
  for (const [table, source] of [[ordersTable, 'online'], [popupTable, 'popup']] as const) {
    const formula = encodeURIComponent(`{Tracking Number}="${trackingNumber}"`);
    const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(table)}?filterByFormula=${formula}&maxRecords=1`;
    try {
      const res = await fetch(url, { headers: getHeaders(), cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data.records && data.records.length > 0) {
          return { record: data.records[0], table, source };
        }
      }
    } catch (err) {
      console.error(`Error searching ${table} for tracking:`, err);
    }
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    if (!apiKey || !baseId) {
      return NextResponse.json({ error: 'Airtable not configured' }, { status: 500 });
    }

    // Verify webhook secret if configured
    if (webhookSecret) {
      const providedSecret = req.headers.get('x-shipstation-webhook-secret')
        || req.nextUrl.searchParams.get('secret');
      if (providedSecret !== webhookSecret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const body = await req.json();

    // ShipStation sends a resource_url that we need to fetch for the actual data
    // OR it can send the data directly depending on webhook version
    let trackingNumber: string | undefined;
    let eventType: string | undefined;

    // Handle ShipStation v2 webhook format
    if (body.resource_url) {
      // ShipStation sends a URL we need to fetch with our API key
      const ssApiKey = process.env.SHIPSTATION_API_KEY;
      if (ssApiKey) {
        try {
          const ssRes = await fetch(body.resource_url, {
            headers: { 'api-key': ssApiKey },
          });
          if (ssRes.ok) {
            const ssData = await ssRes.json();
            // Extract tracking from the shipment data
            const shipments = ssData.shipments || [ssData];
            for (const shipment of shipments) {
              if (shipment.tracking_number) {
                trackingNumber = shipment.tracking_number;
                break;
              }
            }
          }
        } catch (err) {
          console.error('Failed to fetch ShipStation resource:', err);
        }
      }
      eventType = body.resource_type;
    } else {
      // Direct payload format
      trackingNumber = body.tracking_number || body.trackingNumber;
      eventType = body.event_type || body.resource_type || body.event;
    }

    if (!trackingNumber) {
      // Nothing to do without a tracking number, return 200 to prevent retries
      return NextResponse.json({ skipped: true, reason: 'No tracking number found' });
    }

    // Only process delivery events
    const isDelivered = eventType?.toLowerCase().includes('deliver')
      || body.status?.toLowerCase() === 'delivered'
      || body.carrier_status_description?.toLowerCase().includes('delivered');

    if (!isDelivered) {
      return NextResponse.json({ skipped: true, reason: 'Not a delivery event' });
    }

    // Find order in Airtable
    const found = await findOrderByTracking(trackingNumber);
    if (!found) {
      return NextResponse.json({ skipped: true, reason: 'Order not found for tracking number' });
    }

    const { record, table, source } = found;
    const fields = record.fields || {};

    // Check if already sent
    if (isTruthy(fields['Delivery Notification Sent'])) {
      return NextResponse.json({ skipped: true, reason: 'Delivery notification already sent' });
    }

    const customerName = source === 'popup'
      ? String(fields['Name'] || '')
      : String(fields['Customer Name'] || '');
    const firstName = customerName.trim().split(' ')[0] || 'there';
    const customerEmail = String(fields['Email'] || '') || undefined;
    const customerPhone = String(fields['Phone Number'] || '') || undefined;

    const result = await notify({
      email: customerEmail,
      phone: customerPhone,
      emailSubject: 'Your GlowBlocks have arrived!',
      emailHtml: deliveredEmail(firstName),
      smsMessage: `Hey ${firstName}, your GlowBlocks have been delivered! We hope you love them!`,
    });

    // Update order status and set flags
    const today = new Date().toISOString().split('T')[0];
    const statusField = source === 'popup' ? 'Order Status' : 'Status';
    const flagUpdates: Record<string, unknown> = {
      [statusField]: 'Delivered',
      'Delivered Date': today,
    };
    if (result.emailSent || result.smsSent) {
      flagUpdates['Delivery Notification Sent'] = true;
    }

    await fetch(`https://api.airtable.com/v0/${baseId}/${encodeURIComponent(table)}`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify({
        records: [{ id: record.id, fields: flagUpdates }],
      }),
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('ShipStation webhook error:', error);
    // Return 200 to prevent ShipStation from retrying
    return NextResponse.json({ error: 'Internal error' });
  }
}
