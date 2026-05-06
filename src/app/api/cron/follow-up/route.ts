import { NextRequest, NextResponse } from 'next/server';
import { notify } from '@/lib/notify';
import { followUpEmail } from '@/lib/email-templates';

const apiKey = process.env.AIRTABLE_API_KEY;
const baseId = process.env.AIRTABLE_BASE_ID;
const ordersTable = process.env.AIRTABLE_ORDERS_TABLE || 'Orders';
const popupTable = process.env.AIRTABLE_POPUP_ORDERS || process.env.AIRTABLE_POPUP_ORDERS_TABLE || 'Popup';
const cronSecret = process.env.CRON_SECRET || '';
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://glowblocks.shop';

function getHeaders() {
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };
}

function isTruthy(val: unknown): boolean {
  return val === true || val === 'true' || val === 'Yes';
}

function daysAgo(dateStr: string): number {
  const then = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - then.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

interface AirtableRecord {
  id: string;
  fields: Record<string, unknown>;
}

async function fetchDeliveredOrders(table: string): Promise<AirtableRecord[]> {
  const formula = encodeURIComponent(
    'AND({Delivery Notification Sent}=TRUE(), NOT({Follow Up Sent}))'
  );
  const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(table)}?filterByFormula=${formula}&pageSize=100`;
  const records: AirtableRecord[] = [];
  let offset: string | undefined;

  do {
    const fetchUrl = offset ? `${url}&offset=${offset}` : url;
    const res = await fetch(fetchUrl, { headers: getHeaders(), cache: 'no-store' });
    if (!res.ok) break;
    const data = await res.json();
    records.push(...(data.records || []));
    offset = data.offset;
  } while (offset);

  return records;
}

export async function GET(req: NextRequest) {
  try {
    if (!apiKey || !baseId) {
      return NextResponse.json({ error: 'Airtable not configured' }, { status: 500 });
    }

    // Verify cron secret
    if (cronSecret) {
      const auth = req.headers.get('authorization');
      if (auth !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const reviewUrl = `${siteUrl}/reviews`;
    let processed = 0;
    let sent = 0;

    for (const [table, source] of [[ordersTable, 'online'], [popupTable, 'popup']] as const) {
      const records = await fetchDeliveredOrders(table);

      for (const record of records) {
        const fields = record.fields;
        const deliveredDate = String(fields['Delivered Date'] || '');
        if (!deliveredDate || daysAgo(deliveredDate) < 3) continue;
        if (isTruthy(fields['Follow Up Sent'])) continue;

        processed++;

        const customerName = source === 'popup'
          ? String(fields['Name'] || '')
          : String(fields['Customer Name'] || '');
        const firstName = customerName.trim().split(' ')[0] || 'there';
        const customerEmail = String(fields['Email'] || '') || undefined;
        const customerPhone = String(fields['Phone Number'] || '') || undefined;

        const result = await notify({
          email: customerEmail,
          phone: customerPhone,
          emailSubject: 'How are you loving your GlowBlocks?',
          emailHtml: followUpEmail(firstName, reviewUrl),
          smsMessage: `Hey ${firstName}, how are you loving your GlowBlocks? We'd love to hear from you! Leave a review at ${siteUrl}/reviews`,
        });

        if (result.emailSent || result.smsSent) {
          sent++;
          await fetch(`https://api.airtable.com/v0/${baseId}/${encodeURIComponent(table)}`, {
            method: 'PATCH',
            headers: getHeaders(),
            body: JSON.stringify({
              records: [{ id: record.id, fields: { 'Follow Up Sent': true } }],
            }),
          });
        }

        // Respect Airtable rate limit (5 req/s)
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    }

    return NextResponse.json({ success: true, processed, sent });
  } catch (error) {
    console.error('Follow-up cron error:', error);
    return NextResponse.json({ error: 'Cron job failed' }, { status: 500 });
  }
}
