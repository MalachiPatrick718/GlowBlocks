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

  // Retry up to 3 times for transient network errors (ECONNRESET, etc.)
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
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
        console.error(`Twilio send error (attempt ${attempt}):`, err);
        return false;
      }

      return true;
    } catch (err) {
      console.error(`Twilio network error (attempt ${attempt}/${3}):`, err);
      if (attempt < 3) {
        await new Promise(r => setTimeout(r, 500 * attempt));
      }
    }
  }

  console.error('Twilio SMS failed after 3 attempts');
  return false;
}
