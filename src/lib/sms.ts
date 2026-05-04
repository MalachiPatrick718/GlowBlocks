const telnyxApiKey = process.env.TELNYX_API_KEY || '';
const telnyxFromNumber = process.env.TELNYX_FROM_NUMBER || '';

export function normalizePhone(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith('+')) return trimmed;
  const digits = trimmed.replace(/[^\d]/g, '');
  if (digits.length === 10) return `+1${digits}`;
  return `+${digits}`;
}

export async function sendSMS(to: string, message: string): Promise<boolean> {
  if (!telnyxApiKey || !telnyxFromNumber) {
    console.warn('Telnyx is not configured, skipping SMS');
    return false;
  }

  const res = await fetch('https://api.telnyx.com/v2/messages', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${telnyxApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: telnyxFromNumber,
      to: normalizePhone(to),
      text: message,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('Telnyx send error:', err);
    return false;
  }

  return true;
}
