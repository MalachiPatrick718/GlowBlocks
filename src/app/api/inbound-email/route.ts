import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email';

const FORWARD_TO = process.env.INBOUND_FORWARD_TO || 'm.patrick0718@gmail.com';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const from = body.from || 'Unknown sender';
    const subject = body.subject || '(No subject)';
    const text = body.text || '';
    const htmlBody = body.html || '';

    const html = `
      <div style="font-family: sans-serif; max-width: 600px;">
        <p style="color: #6b7280; font-size: 13px; margin-bottom: 16px;">
          <strong>From:</strong> ${from}<br/>
          <strong>Subject:</strong> ${subject}
        </p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 16px 0;" />
        ${htmlBody || `<pre style="white-space: pre-wrap;">${text}</pre>`}
      </div>
    `;

    await sendEmail(FORWARD_TO, `[GlowBlocks Reply] ${subject}`, html);

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Inbound email error:', error);
    return NextResponse.json({ error: 'Failed to process inbound email' }, { status: 500 });
  }
}
