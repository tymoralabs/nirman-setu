import { env } from "@/env";
import { getDb, schema } from "@/db";

/**
 * Outbound notifications. Client-facing chain: WhatsApp → SMS → email.
 * Every send is recorded in notifications_log. Providers are behind drivers;
 * without MSG91/Resend keys the mock driver logs to console (local dev).
 *
 * Fire-and-forget: callers must NOT await-and-fail mutations on notify errors.
 */

type Channel = "whatsapp" | "sms" | "email";

export interface SendArgs {
  firmId: string | null;
  recipientUserId: string | null;
  templateKey: string;
  /** Rendered message body (template params already applied). */
  body: string;
  phone?: string;
  email?: string;
}

interface NotifyDriver {
  sendWhatsApp(phone: string, body: string): Promise<string>; // returns provider message id
  sendSms(phone: string, body: string): Promise<string>;
  sendEmail(email: string, subject: string, body: string): Promise<string>;
}

const mockDriver: NotifyDriver = {
  async sendWhatsApp(phone, body) {
    console.log(`📱 [MOCK WhatsApp → ${phone}] ${body}`);
    return `mock-wa-${crypto.randomUUID()}`;
  },
  async sendSms(phone, body) {
    console.log(`💬 [MOCK SMS → ${phone}] ${body}`);
    return `mock-sms-${crypto.randomUUID()}`;
  },
  async sendEmail(email, subject, body) {
    console.log(`✉️  [MOCK Email → ${email}] ${subject}: ${body}`);
    return `mock-email-${crypto.randomUUID()}`;
  },
};

function getDriver(): NotifyDriver {
  // TODO(prod): MSG91 + Resend drivers when keys are configured.
  if (env.MSG91_AUTH_KEY) {
    console.warn("MSG91 configured but driver not implemented — using mock");
  }
  return mockDriver;
}

async function logSend(
  args: SendArgs,
  channel: Channel,
  status: "sent" | "failed",
  providerMessageId?: string
) {
  const db = await getDb();
  await db.insert(schema.notificationsLog).values({
    firmId: args.firmId,
    recipientUserId: args.recipientUserId,
    channel,
    templateKey: args.templateKey,
    status,
    providerMessageId,
  });
}

/** Client-facing send with WhatsApp → SMS → email fallback chain. */
export async function sendToClient(args: SendArgs): Promise<void> {
  const driver = getDriver();
  if (args.phone) {
    try {
      const id = await driver.sendWhatsApp(args.phone, args.body);
      await logSend(args, "whatsapp", "sent", id);
      return;
    } catch {
      await logSend(args, "whatsapp", "failed");
    }
    try {
      const id = await driver.sendSms(args.phone, args.body);
      await logSend(args, "sms", "sent", id);
      return;
    } catch {
      await logSend(args, "sms", "failed");
    }
  }
  if (args.email) {
    try {
      const id = await driver.sendEmail(args.email, "Update from your architect", args.body);
      await logSend(args, "email", "sent", id);
      return;
    } catch {
      await logSend(args, "email", "failed");
    }
  }
  console.error(`notify: all channels failed/unavailable for template ${args.templateKey}`);
}

/** Staff notifications go by email only. */
export async function sendToStaff(args: SendArgs & { subject: string }): Promise<void> {
  if (!args.email) return;
  const driver = getDriver();
  try {
    const id = await driver.sendEmail(args.email, args.subject, args.body);
    await logSend(args, "email", "sent", id);
  } catch {
    await logSend(args, "email", "failed");
  }
}
