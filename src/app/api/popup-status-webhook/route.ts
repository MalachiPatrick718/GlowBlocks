import { NextRequest, NextResponse } from 'next/server';

const webhookSecret = process.env.POPUP_STATUS_WEBHOOK_SECRET || '';
const twilioSid = process.env.TWILIO_ACCOUNT_SID || '';
const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN || '';
const twilioFromNumber = process.env.TWILIO_FROM_NUMBER || '';

function normalizePhone(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith('+')) return trimmed;
  const digits = trimmed.replace(/[^\d]/g, '');
  if (digits.length === 10) return `+1${digits}`;
  return `+${digits}`;
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

    const { status, customerName, customLetters, phoneNumber } = await req.json();
    if (!status || !customerName || !customLetters || !phoneNumber) {
      return NextResponse.json({ error: 'Missing required payload fields' }, { status: 400 });
    }

    if (String(status).toLowerCase() !== 'done') {
      return NextResponse.json({ skipped: true, reason: 'Status is not Done' });
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

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Popup status webhook error:', error);
    return NextResponse.json({ error: 'Failed to send popup status SMS' }, { status: 500 });
  }
}
