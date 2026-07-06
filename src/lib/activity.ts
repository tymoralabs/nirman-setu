import { getDb, schema } from "@/db";

export type ActivityAction =
  | "login"
  | "otp_login"
  | "support_view_as"
  | "user_created"
  | "user_disabled"
  | "invite_accepted"
  | "password_reset_requested"
  | "password_reset"
  | "client_created"
  | "client_updated"
  | "client_login_created"
  | "project_created"
  | "project_updated"
  | "project_allocated"
  | "project_deallocated"
  | "library_item_created"
  | "library_item_updated"
  | "template_created"
  | "template_updated"
  | "checklist_created"
  | "checklist_sent"
  | "document_uploaded"
  | "document_downloaded"
  | "document_deleted"
  | "document_restored"
  | "item_received"
  | "item_rejected"
  | "item_waived"
  | "item_unwaived"
  | "hard_copy_marked"
  | "comment_added"
  | "reminder_sent"
  | "plan_changed"
  | "data_exported"
  | "client_data_deleted"
  | "firm_export";

export async function logActivity(args: {
  firmId: string | null;
  actorUserId: string | null;
  action: ActivityAction;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
}): Promise<void> {
  try {
    const db = await getDb();
    await db.insert(schema.activityLog).values({
      firmId: args.firmId,
      actorUserId: args.actorUserId,
      action: args.action,
      entityType: args.entityType,
      entityId: args.entityId,
      metadata: args.metadata,
      ipAddress: args.ipAddress,
    });
  } catch (err) {
    // activity logging must never break the mutation it decorates
    console.error("activity log failed:", err);
  }
}
