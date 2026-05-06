import { NextRequest, NextResponse } from 'next/server';
import { notify } from '@/lib/notify';
import { inProgressEmail, donePickupEmail, doneShipEmail } from '@/lib/email-templates';

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

async function getRecord(recordId: string): Promise<Record<string, unknown> | null> {
  if (!airtableApiKey || !airtableBaseId || !recordId) return null;
  const res = await fetch(getAirtableUrl(recordId), {
    headers: getAirtableHeaders(),
    cache: 'no-store',
  });
  if (!res.ok) return null;
  const record = await res.json();
  return record?.fields || null;
}

function isTruthy(val: unknown): boolean {
  return val === true || val === 'true' || val === 'Yes';
}

async function setFlags(recordId: string, flags: Record<string, boolean>): Promise<void> {
  if (!airtableApiKey || !airtableBaseId || !recordId) return;
  await fetch(getAirtableUrl(recordId), {
    method: 'PATCH',
    headers: getAirtableHeaders(),
    body: JSON.stringify({ fields: flags }),
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

    const { status, customerName, phoneNumber, recordId } = await req.json();
    if (!status || !customerName || !phoneNumber) {
      return NextResponse.json({ error: 'Missing required payload fields' }, { status: 400 });
    }

    const statusLower = String(status).toLowerCase();
    if (statusLower !== 'in progress' && statusLower !== 'done') {
      return NextResponse.json({ skipped: true, reason: 'Status is not Done or In Progress' });
    }

    // Fetch full record to get email and order type
    const fields = recordId ? await getRecord(String(recordId)) : null;
    const customerEmail = String((fields?.['Email'] as string) || '');
    const orderType = String((fields?.['Order Type'] as string) || '');
    const firstName = String(customerName).trim().split(' ')[0];
    const isPickup = orderType.toLowerCase() === 'pickup';

    if (statusLower === 'in progress') {
      const textSent = fields ? isTruthy(fields['In Progress Text Sent']) : false;
      const emailSent = fields ? isTruthy(fields['In Progress Email Sent']) : false;
      if (textSent && emailSent) {
        return NextResponse.json({ skipped: true, reason: 'In Progress notifications already sent' });
      }

      const result = await notify({
        email: !emailSent && customerEmail ? customerEmail : undefined,
        phone: !textSent ? String(phoneNumber) : undefined,
        emailSubject: "We're working on your GlowBlocks!",
        emailHtml: inProgressEmail(firstName),
        smsMessage: `Hey ${firstName}, we're working on your GlowBlocks order now! We'll let you know when it's ready.`,
      });

      if (recordId) {
        const flagUpdates: Record<string, boolean> = {};
        if (result.smsSent) flagUpdates['In Progress Text Sent'] = true;
        if (result.emailSent) flagUpdates['In Progress Email Sent'] = true;
        if (Object.keys(flagUpdates).length > 0) await setFlags(String(recordId), flagUpdates);
      }

      return NextResponse.json({ success: true, ...result });
    }

    // status === 'done'
    const textSent = fields ? isTruthy(fields['Done Text Sent']) : false;
    const emailSent = fields ? isTruthy(fields['Done Email Sent']) : false;
    if (textSent && emailSent) {
      return NextResponse.json({ skipped: true, reason: 'Done notifications already sent' });
    }

    const smsMsg = isPickup
      ? `Hey ${customerName}, your custom Glowblocks set is ready for pickup!`
      : `Hey ${firstName}, your GlowBlocks order is complete and being prepared for shipment! We'll send tracking info once it ships.`;

    const result = await notify({
      email: !emailSent && customerEmail ? customerEmail : undefined,
      phone: !textSent ? String(phoneNumber) : undefined,
      emailSubject: isPickup ? 'Your GlowBlocks are ready for pickup!' : 'Your GlowBlocks order is complete!',
      emailHtml: isPickup ? donePickupEmail(firstName) : doneShipEmail(firstName),
      smsMessage: smsMsg,
    });

    if (recordId) {
      const flagUpdates: Record<string, boolean> = {};
      if (result.smsSent) flagUpdates['Done Text Sent'] = true;
      if (result.emailSent) flagUpdates['Done Email Sent'] = true;
      if (Object.keys(flagUpdates).length > 0) await setFlags(String(recordId), flagUpdates);
    }

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('Popup status webhook error:', error);
    return NextResponse.json({ error: 'Failed to send popup status notification' }, { status: 500 });
  }
}
