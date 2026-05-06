const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID || '';
const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN || '';
const twilioFromNumber = process.env.TWILIO_FROM_NUMBER || '';

export function normalizePhone(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith('+')) return trimmed;
  const digits = trimmed.replace(/[^\d]/g, '');
  if (digits.length === 10) return `+1${digits}`;
  return `+${digits}`;
}

export async function sendSMS(to: string, message: string): Promise<boolean> {
  if (!twilioAccountSid || !twilioAuthToken || !twilioFromNumber) {
    console.warn('Twilio is not configured, skipping SMS');
    return false;
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
  const auth = Buffer.from(`${twilioAccountSid}:${twilioAuthToken}`).toString('base64');

  const params = new URLSearchParams();
  params.append('To', normalizePhone(to));
  params.append('From', twilioFromNumber);
  params.append('Body', message);

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('Twilio send error:', err);
    return false;
  }

  return true;
}
