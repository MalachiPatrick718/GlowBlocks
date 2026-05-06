import { NextRequest, NextResponse } from 'next/server';
import { notify } from '@/lib/notify';
import { inProgressEmail, doneShipEmail, deliveredEmail } from '@/lib/email-templates';

const apiKey = process.env.AIRTABLE_API_KEY;
const baseId = process.env.AIRTABLE_BASE_ID;
const tableName = process.env.AIRTABLE_ORDERS_TABLE || 'Orders';
const popupTableName = process.env.AIRTABLE_POPUP_ORDERS || process.env.AIRTABLE_POPUP_ORDERS_TABLE || 'Popup';
const adminKey = process.env.POPUP_ORDERS_ADMIN_KEY;

function getAirtableUrl() {
  return `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}`;
}

function getPopupAirtableUrl() {
  return `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(popupTableName)}`;
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

    const res = await fetch(getAirtableUrl(), {
      headers: getHeaders(),
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      const err = await res.json();
      console.error('Orders fetch error:', err);
      return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
    }

    const data = await res.json();
    const orders = (data.records || [])
      .map((record: { id: string; createdTime?: string; fields: Record<string, string> }) => {
        let boardIds: (string | null)[] = [];
        try {
          const od = JSON.parse(record.fields['Order Data'] || '{}');
          if (Array.isArray(od.boardIds)) boardIds = od.boardIds;
        } catch {}

        return {
          id: record.id,
          customerName: record.fields['Customer Name'] || '',
          email: record.fields['Email'] || '',
          address: record.fields['Address'] || '',
          shippingMethod: record.fields['Shipping Method'] || '',
          items: record.fields['Items'] || '',
          lineItems: record.fields['Line Items'] || '',
          total: record.fields['Total'] || '',
          shippingCost: record.fields['Shipping Cost'] || '',
          stripeSessionId: record.fields['Stripe Session ID'] || '',
          date: record.fields['Date'] || record.createdTime?.split('T')[0] || '',
          status: record.fields['Status'] || 'New',
          trackingNumber: record.fields['Tracking Number'] || '',
          labelUrl: record.fields['Label URL'] || '',
          orderText: record.fields['Order Text'] || '',
          boardIds,
        };
      })
      .sort((a: { date: string }, b: { date: string }) => {
        const aTime = a.date ? new Date(a.date).getTime() : 0;
        const bTime = b.date ? new Date(b.date).getTime() : 0;
        return bTime - aTime;
      });

    return NextResponse.json({ orders });
  } catch (error) {
    console.error('Orders API error:', error);
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    if (!apiKey || !baseId) {
      return NextResponse.json({ error: 'Airtable is not configured' }, { status: 500 });
    }
    if (!isAuthorized(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, status, trackingNumber, labelUrl, scanBoard } = await req.json();
    if (!id) {
      return NextResponse.json({ error: 'Missing record id' }, { status: 400 });
    }

    // Handle board scanning
    if (scanBoard) {
      const { letterIndex, boardId: bid } = scanBoard;
      if (typeof letterIndex !== 'number' || letterIndex < 0) {
        return NextResponse.json({ error: 'Invalid letterIndex' }, { status: 400 });
      }
      if (!bid || !/^GB\d{4}$/.test(String(bid))) {
        return NextResponse.json({ error: 'Invalid board ID format. Expected GBXXXX (e.g. GB0001)' }, { status: 400 });
      }
      const boardIdStr = String(bid);

      // Fetch existing order
      const existingRes = await fetch(`${getAirtableUrl()}/${encodeURIComponent(String(id))}`, {
        headers: getHeaders(),
        next: { revalidate: 0 },
      });
      if (!existingRes.ok) {
        return NextResponse.json({ error: 'Order record not found' }, { status: 404 });
      }
      const existingRecord = await existingRes.json();
      const existingFields = existingRecord.fields || {};
      const orderText = String(existingFields['Order Text'] || '');

      if (letterIndex >= orderText.length || orderText[letterIndex] === ' ') {
        return NextResponse.json({ error: 'Invalid letter index for this order' }, { status: 400 });
      }

      // Cross-table duplicate check: Online orders
      const allOrdersRes = await fetch(getAirtableUrl(), {
        headers: getHeaders(),
        next: { revalidate: 0 },
      });
      if (allOrdersRes.ok) {
        const allData = await allOrdersRes.json();
        for (const r of (allData.records || []) as { id: string; fields: Record<string, string> }[]) {
          try {
            const od = JSON.parse(r.fields['Order Data'] || '{}');
            const ids: (string | null)[] = Array.isArray(od.boardIds) ? od.boardIds : [];
            const foundIdx = ids.indexOf(boardIdStr);
            if (foundIdx !== -1) {
              if (r.id === String(id) && foundIdx === letterIndex) continue;
              const customerName = r.fields['Customer Name'] || r.id;
              return NextResponse.json({
                error: `${boardIdStr} is already linked to Online Order (${customerName})`,
              }, { status: 409 });
            }
          } catch { /* skip */ }
        }
      }

      // Cross-table duplicate check: Popup orders
      const allPopupRes = await fetch(getPopupAirtableUrl(), {
        headers: getHeaders(),
        next: { revalidate: 0 },
      });
      if (allPopupRes.ok) {
        const allData = await allPopupRes.json();
        for (const r of (allData.records || []) as { id: string; fields: Record<string, string> }[]) {
          try {
            const cc = JSON.parse(r.fields['Custom Colors'] || '{}');
            const ids: (string | null)[] = Array.isArray(cc.boardIds) ? cc.boardIds : [];
            const foundIdx = ids.indexOf(boardIdStr);
            if (foundIdx !== -1) {
              const orderNum = r.fields['Order Number'] || r.id;
              return NextResponse.json({
                error: `${boardIdStr} is already linked to Popup Order #${orderNum}`,
              }, { status: 409 });
            }
          } catch { /* skip */ }
        }
      }

      // Update boardIds in Order Data
      let orderData: Record<string, unknown> = {};
      try {
        const parsed = JSON.parse(existingFields['Order Data'] || '{}');
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          orderData = parsed;
        }
      } catch { /* keep empty */ }

      const boardIds: (string | null)[] = Array.isArray(orderData.boardIds)
        ? [...(orderData.boardIds as (string | null)[])]
        : Array.from({ length: orderText.length }, () => null);
      while (boardIds.length < orderText.length) boardIds.push(null);

      boardIds[letterIndex] = boardIdStr;
      orderData.boardIds = boardIds;

      const scanRes = await fetch(getAirtableUrl(), {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({
          records: [{ id: String(id), fields: { 'Order Data': JSON.stringify(orderData) } }],
        }),
      });
      if (!scanRes.ok) {
        return NextResponse.json({ error: 'Failed to save board scan' }, { status: 500 });
      }

      return NextResponse.json({ success: true, boardIds });
    }

    // Handle status/tracking updates
    const fields: Record<string, string> = {};
    if (status) fields['Status'] = String(status);
    if (trackingNumber !== undefined) fields['Tracking Number'] = String(trackingNumber);
    if (labelUrl !== undefined) fields['Label URL'] = String(labelUrl);

    if (Object.keys(fields).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const res = await fetch(getAirtableUrl(), {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify({
        records: [{ id: String(id), fields }],
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      console.error('Order status update error:', err);
      return NextResponse.json({ error: 'Failed to update status' }, { status: 500 });
    }

    // Send notifications on status changes
    if (status) {
      const statusLower = String(status).toLowerCase();
      if (statusLower === 'processing' || statusLower === 'ready to ship' || statusLower === 'delivered') {
        try {
          const recordRes = await fetch(`${getAirtableUrl()}/${encodeURIComponent(String(id))}`, {
            headers: getHeaders(),
            next: { revalidate: 0 },
          });
          if (recordRes.ok) {
            const record = await recordRes.json();
            const f = record.fields || {};
            const customerName = String(f['Customer Name'] || '');
            const firstName = customerName.trim().split(' ')[0] || 'there';
            const customerEmail = String(f['Email'] || '') || undefined;
            const customerPhone = String(f['Phone Number'] || '') || undefined;

            const isTruthy = (v: unknown) => v === true || v === 'true' || v === 'Yes';

            if (statusLower === 'processing' && !isTruthy(f['In Progress Email Sent'])) {
              const result = await notify({
                email: customerEmail,
                phone: !isTruthy(f['In Progress Text Sent']) ? customerPhone : undefined,
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
                  body: JSON.stringify({ records: [{ id: String(id), fields: flagUpdates }] }),
                });
              }
            }

            if (statusLower === 'ready to ship' && !isTruthy(f['Done Email Sent'])) {
              const result = await notify({
                email: customerEmail,
                phone: !isTruthy(f['Done Text Sent']) ? customerPhone : undefined,
                emailSubject: 'Your GlowBlocks order is complete!',
                emailHtml: doneShipEmail(firstName),
                smsMessage: `Hey ${firstName}, your GlowBlocks order is complete and being prepared for shipment! We'll send tracking info once it ships.`,
              });
              const flagUpdates: Record<string, boolean> = {};
              if (result.smsSent) flagUpdates['Done Text Sent'] = true;
              if (result.emailSent) flagUpdates['Done Email Sent'] = true;
              if (Object.keys(flagUpdates).length > 0) {
                await fetch(getAirtableUrl(), {
                  method: 'PATCH',
                  headers: getHeaders(),
                  body: JSON.stringify({ records: [{ id: String(id), fields: flagUpdates }] }),
                });
              }
            }

            if (statusLower === 'delivered' && !isTruthy(f['Delivery Notification Sent'])) {
              const today = new Date().toISOString().split('T')[0];
              const result = await notify({
                email: customerEmail,
                phone: customerPhone,
                emailSubject: 'Your GlowBlocks have arrived!',
                emailHtml: deliveredEmail(firstName),
                smsMessage: `Hey ${firstName}, your GlowBlocks have been delivered! We hope you love them!`,
              });
              const flagUpdates: Record<string, unknown> = { 'Delivered Date': today };
              if (result.emailSent || result.smsSent) flagUpdates['Delivery Notification Sent'] = true;
              await fetch(getAirtableUrl(), {
                method: 'PATCH',
                headers: getHeaders(),
                body: JSON.stringify({ records: [{ id: String(id), fields: flagUpdates }] }),
              });
            }
          }
        } catch (err) {
          console.error('Failed to send status notification:', err);
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Orders PATCH error:', error);
    return NextResponse.json({ error: 'Failed to update status' }, { status: 500 });
  }
}
