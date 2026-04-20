const twilioSid = process.env.TWILIO_ACCOUNT_SID || '';
const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN || '';
const twilioFromNumber = process.env.TWILIO_FROM_NUMBER || process.env.TWILIO_PHONE_NUMBER || '';

export function normalizePhone(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith('+')) return trimmed;
  const digits = trimmed.replace(/[^\d]/g, '');
  if (digits.length === 10) return `+1${digits}`;
  return `+${digits}`;
}

export async function sendSMS(to: string, message: string): Promise<boolean> {
  if (!twilioSid || !twilioAuthToken || !twilioFromNumber) {
    console.warn('Twilio is not configured, skipping SMS');
    return false;
  }

  const body = new URLSearchParams({
    To: normalizePhone(to),
    From: twilioFromNumber,
    Body: message,
  });

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${twilioSid}:${twilioAuthToken}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    console.error('Twilio send error:', err);
    return false;
  }

  return true;
}
