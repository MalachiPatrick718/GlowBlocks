const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'GlowBlocks <noreply@resend.dev>';
const REPLY_TO = process.env.RESEND_REPLY_TO || 'orders@glowblocks.shop';

export async function sendEmail(
  to: string,
  subject: string,
  html: string
): Promise<boolean> {
  if (!RESEND_API_KEY || !to) return false;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to,
        subject,
        html,
        ...(REPLY_TO && { reply_to: REPLY_TO }),
      }),
    });
    return res.ok;
  } catch (err) {
    console.error('Failed to send email:', err);
    return false;
  }
}
