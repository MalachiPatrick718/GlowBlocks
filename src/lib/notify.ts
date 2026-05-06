import { sendEmail } from '@/lib/email';
import { sendSMS } from '@/lib/sms';

interface NotifyParams {
  email?: string;
  phone?: string;
  emailSubject: string;
  emailHtml: string;
  smsMessage: string;
}

interface NotifyResult {
  emailSent: boolean;
  smsSent: boolean;
}

export async function notify(params: NotifyParams): Promise<NotifyResult> {
  const { email, phone, emailSubject, emailHtml, smsMessage } = params;
  const results: NotifyResult = { emailSent: false, smsSent: false };
  const promises: Promise<void>[] = [];

  if (email) {
    promises.push(
      sendEmail(email, emailSubject, emailHtml)
        .then((ok) => { results.emailSent = ok; })
        .catch((err) => { console.error('notify email error:', err); })
    );
  }

  if (phone) {
    promises.push(
      sendSMS(phone, smsMessage)
        .then((ok) => { results.smsSent = ok; })
        .catch((err) => { console.error('notify sms error:', err); })
    );
  }

  await Promise.allSettled(promises);
  return results;
}
