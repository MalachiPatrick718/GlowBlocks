import { NextRequest, NextResponse } from 'next/server';
import { sendSMS } from '@/lib/sms';

const webhookSecret = process.env.POPUP_STATUS_WEBHOOK_SECRET || '';
const airtableApiKey = process.env.AIRTABLE_API_KEY || '';
const airtableBaseId = process.env.AIRTABLE_BASE_ID || '';
const airtablePopupTable = process.env.AIRTABLE_POPUP_ORDERS || process.env.AIRTABLE_POPUP_ORDERS_TABLE || 'Popup';

function getAirtableUrl(recordId?: string): string {
  const base = `https://api.airtable.com/v0/${airtableBaseId}/${encodeURIComponent(airtablePopupTable)}`;
  if (!recordId) return base;
  return `${base}/${recordId}`;
}

function getAirtableHeaders() {
  return {
    Authorization: `Bearer ${airtableApiKey}`,
    'Content-Type': 'application/json',
  };
}

async function hasTextAlreadySent(recordId: string, field: string): Promise<boolean> {
  if (!airtableApiKey || !airtableBaseId || !recordId) return false;

  const res = await fetch(getAirtableUrl(recordId), {
    headers: getAirtableHeaders(),
    cache: 'no-store',
  });
  if (!res.ok) return false;

  const record = await res.json();
  const value = record?.fields?.[field];
  return value === true || value === 'true' || value === 'Yes';
}

async function markTextSent(recordId: string, field: string): Promise<void> {
  if (!airtableApiKey || !airtableBaseId || !recordId) return;

  await fetch(getAirtableUrl(recordId), {
    method: 'PATCH',
    headers: getAirtableHeaders(),
    body: JSON.stringify({
      fields: {
        [field]: true,
      },
    }),
  });
}

export async function POST(req: NextRequest) {
  try {
    if (!webhookSecret) {
      return NextResponse.json({ error: 'Webhook secret is not configured' }, { status: 500 });
    }

    const providedSecret = req.headers.get('x-popup-webhook-secret');
    if (providedSecret !== webhookSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { status, customerName, customLetters, phoneNumber, recordId } = await req.json();
    if (!status || !customerName || !customLetters || !phoneNumber) {
      return NextResponse.json({ error: 'Missing required payload fields' }, { status: 400 });
    }

    const statusLower = String(status).toLowerCase();

    if (statusLower === 'in progress') {
      const sentField = 'In Progress Text Sent';
      if (recordId && await hasTextAlreadySent(String(recordId), sentField)) {
        return NextResponse.json({ skipped: true, reason: 'In Progress SMS already sent for this order' });
      }

      const firstName = String(customerName).trim().split(' ')[0];
      const message = `Hey ${firstName}, we're working on your GlowBlocks order now! We'll let you know when it's ready.`;
      const sent = await sendSMS(String(phoneNumber), message);

      if (!sent) {
        return NextResponse.json({ error: 'Failed to send SMS' }, { status: 500 });
      }

      if (recordId) {
        await markTextSent(String(recordId), sentField);
      }

      return NextResponse.json({ success: true });
    }

    if (statusLower !== 'done') {
      return NextResponse.json({ skipped: true, reason: 'Status is not Done or In Progress' });
    }

    if (recordId && await hasTextAlreadySent(String(recordId), 'Done Text Sent')) {
      return NextResponse.json({ skipped: true, reason: 'Done SMS already sent for this order' });
    }

    const message = `Hey ${customerName}, your custom Glowblocks set is ready for pickup!`;
    const sent = await sendSMS(String(phoneNumber), message);

    if (!sent) {
      return NextResponse.json({ error: 'Failed to send SMS' }, { status: 500 });
    }

    if (recordId) {
      await markTextSent(String(recordId), 'Done Text Sent');
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Popup status webhook error:', error);
    return NextResponse.json({ error: 'Failed to send popup status SMS' }, { status: 500 });
  }
}
