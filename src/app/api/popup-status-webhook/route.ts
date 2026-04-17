import { NextRequest, NextResponse } from 'next/server';

const webhookSecret = process.env.POPUP_STATUS_WEBHOOK_SECRET || '';
const twilioSid = process.env.TWILIO_ACCOUNT_SID || '';
const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN || '';
const twilioFromNumber = process.env.TWILIO_FROM_NUMBER || '';
const airtableApiKey = process.env.AIRTABLE_API_KEY || '';
const airtableBaseId = process.env.AIRTABLE_BASE_ID || '';
const airtablePopupTable = process.env.AIRTABLE_POPUP_ORDERS || process.env.AIRTABLE_POPUP_ORDERS_TABLE || 'Popup';

function normalizePhone(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith('+')) return trimmed;
  const digits = trimmed.replace(/[^\d]/g, '');
  if (digits.length === 10) return `+1${digits}`;
  return `+${digits}`;
}

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

async function hasDoneTextAlreadySent(recordId: string): Promise<boolean> {
  if (!airtableApiKey || !airtableBaseId || !recordId) return false;

  const res = await fetch(getAirtableUrl(recordId), {
    headers: getAirtableHeaders(),
    cache: 'no-store',
  });
  if (!res.ok) return false;

  const record = await res.json();
  const field = record?.fields?.['Done Text Sent'];
  return field === true || field === 'true' || field === 'Yes';
}

async function markDoneTextSent(recordId: string): Promise<void> {
  if (!airtableApiKey || !airtableBaseId || !recordId) return;

  await fetch(getAirtableUrl(recordId), {
    method: 'PATCH',
    headers: getAirtableHeaders(),
    body: JSON.stringify({
      fields: {
        'Done Text Sent': true,
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

    if (!twilioSid || !twilioAuthToken || !twilioFromNumber) {
      return NextResponse.json({ error: 'Twilio is not configured' }, { status: 500 });
    }

    const { status, customerName, customLetters, phoneNumber, recordId } = await req.json();
    if (!status || !customerName || !customLetters || !phoneNumber) {
      return NextResponse.json({ error: 'Missing required payload fields' }, { status: 400 });
    }

    if (String(status).toLowerCase() !== 'done') {
      return NextResponse.json({ skipped: true, reason: 'Status is not Done' });
    }

    if (recordId && await hasDoneTextAlreadySent(String(recordId))) {
      return NextResponse.json({ skipped: true, reason: 'Done SMS already sent for this order' });
    }

    const message = `Hey ${customerName}, your Glowblocks order of ${customLetters} is ready for pickup! See you soon!`;
    const to = normalizePhone(String(phoneNumber));

    const twilioBody = new URLSearchParams({
      To: to,
      From: twilioFromNumber,
      Body: message,
    });

    const twilioRes = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${twilioSid}:${twilioAuthToken}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: twilioBody.toString(),
      }
    );

    if (!twilioRes.ok) {
      const err = await twilioRes.text();
      console.error('Twilio send error:', err);
      return NextResponse.json({ error: 'Failed to send SMS' }, { status: 500 });
    }

    if (recordId) {
      await markDoneTextSent(String(recordId));
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Popup status webhook error:', error);
    return NextResponse.json({ error: 'Failed to send popup status SMS' }, { status: 500 });
  }
}
