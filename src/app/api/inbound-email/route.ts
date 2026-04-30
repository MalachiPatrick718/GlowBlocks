import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email';

const FORWARD_TO = process.env.INBOUND_FORWARD_TO || 'm.patrick0718@gmail.com';
const RESEND_API_KEY = process.env.RESEND_API_KEY;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Resend wraps inbound data in { type: "email.received", data: { ... } }
    const event = body.data || body;
    const emailId = event.email_id;
    const from = event.from || 'Unknown sender';
    const subject = event.subject || '(No subject)';

    // Webhook only includes metadata — fetch full content via Resend API
    let htmlBody = '';
    let textBody = '';

    if (emailId && RESEND_API_KEY) {
      const res = await fetch(`https://api.resend.com/emails/received/${emailId}`, {
        headers: { Authorization: `Bearer ${RESEND_API_KEY}` },
      });
      if (res.ok) {
        const emailData = await res.json();
        htmlBody = emailData.html || '';
        textBody = emailData.text || '';
      }
    }

    const html = `
      <div style="font-family: sans-serif; max-width: 600px;">
        <p style="color: #6b7280; font-size: 13px; margin-bottom: 16px;">
          <strong>From:</strong> ${from}<br/>
          <strong>Subject:</strong> ${subject}
        </p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 16px 0;" />
        ${htmlBody || `<pre style="white-space: pre-wrap;">${textBody || '(empty message)'}</pre>`}
      </div>
    `;

    await sendEmail(FORWARD_TO, `[GlowBlocks Reply] ${subject}`, html);

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Inbound email error:', error);
    return NextResponse.json({ error: 'Failed to process inbound email' }, { status: 500 });
  }
}
