import {
  pgTable,
  pgEnum,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  bigint,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ---------- Enums ----------

export const firmStatusEnum = pgEnum("firm_status", [
  "active",
  "suspended",
  "pending_deletion",
]);

export const planTierEnum = pgEnum("plan_tier", ["silver", "gold", "platinum"]);

export const planStatusEnum = pgEnum("plan_status", [
  "trialing",
  "active",
  "past_due",
  "cancelled",
  "expired",
]);

export const userRoleEnum = pgEnum("user_role", [
  "platform_owner",
  "firm_admin",
  "associate",
  "client",
]);

export const userStatusEnum = pgEnum("user_status", [
  "invited",
  "active",
  "disabled",
]);

export const languageEnum = pgEnum("language", ["en", "hi"]);

export const otpPurposeEnum = pgEnum("otp_purpose", ["login"]);

export const projectStatusEnum = pgEnum("project_status", [
  "active",
  "on_hold",
  "completed",
  "archived",
]);

export const checklistStatusEnum = pgEnum("checklist_status", [
  "draft",
  "sent",
  "in_progress",
  "completed",
]);

export const checklistItemStatusEnum = pgEnum("checklist_item_status", [
  "pending",
  "uploaded",
  "received",
  "rejected",
  "waived",
]);

export const documentStatusEnum = pgEnum("document_status", [
  "active",
  "superseded",
]);

export const notificationChannelEnum = pgEnum("notification_channel", [
  "whatsapp",
  "sms",
  "email",
]);

export const notificationStatusEnum = pgEnum("notification_status", [
  "queued",
  "sent",
  "delivered",
  "failed",
]);

// ---------- Shared column helpers ----------

const id = uuid("id").primaryKey().defaultRandom();
const createdAt = timestamp("created_at", { withTimezone: true })
  .notNull()
  .defaultNow();
const updatedAt = timestamp("updated_at", { withTimezone: true })
  .notNull()
  .defaultNow()
  .$onUpdate(() => new Date());

// ---------- Tables ----------

export const firms = pgTable("firms", {
  id,
  createdAt,
  updatedAt,
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  status: firmStatusEnum("status").notNull().default("active"),
  gstin: text("gstin"),
  billingAddress: text("billing_address"),
  state: text("state"), // GST place-of-supply
  planTier: planTierEnum("plan_tier").notNull().default("silver"),
  planStatus: planStatusEnum("plan_status").notNull().default("trialing"),
  trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
  readOnlySince: timestamp("read_only_since", { withTimezone: true }),
  deleteAfter: timestamp("delete_after", { withTimezone: true }),
  razorpaySubscriptionId: text("razorpay_subscription_id"),
  // mutate only via SQL increment/decrement — never read-modify-write
  storageUsedBytes: bigint("storage_used_bytes", { mode: "number" })
    .notNull()
    .default(0),
  grievanceEmail: text("grievance_email"),
});

export const users = pgTable(
  "users",
  {
    id,
    createdAt,
    updatedAt,
    firmId: uuid("firm_id").references(() => firms.id), // null only for PLATFORM_OWNER
    role: userRoleEnum("role").notNull(),
    name: text("name").notNull(),
    email: text("email"), // NOT NULL for staff (enforced by partial index + service layer)
    phone: text("phone"), // E.164; required for clients
    passwordHash: text("password_hash"), // null for OTP-only clients
    preferredLanguage: languageEnum("preferred_language").notNull().default("en"),
    clientId: uuid("client_id"), // FK → clients.id when role=client (added via relation; circular)
    status: userStatusEnum("status").notNull().default("invited"),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    inviteToken: text("invite_token"),
    inviteTokenExpiresAt: timestamp("invite_token_expires_at", {
      withTimezone: true,
    }),
    resetToken: text("reset_token"),
    resetTokenExpiresAt: timestamp("reset_token_expires_at", {
      withTimezone: true,
    }),
  },
  (t) => [
    // staff log in by email — globally unique among non-client roles
    uniqueIndex("users_staff_email_unique")
      .on(t.email)
      .where(sql`${t.role} != 'client'`),
    // same phone MAY exist as client in multiple firms; unique within a firm
    uniqueIndex("users_client_firm_phone_unique")
      .on(t.firmId, t.phone)
      .where(sql`${t.role} = 'client'`),
    index("users_firm_idx").on(t.firmId),
    index("users_phone_idx").on(t.phone),
  ]
);

export const otpCodes = pgTable(
  "otp_codes",
  {
    id,
    createdAt,
    updatedAt,
    phone: text("phone").notNull(),
    codeHash: text("code_hash").notNull(),
    purpose: otpPurposeEnum("purpose").notNull().default("login"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    attempts: integer("attempts").notNull().default(0),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
  },
  (t) => [index("otp_codes_phone_idx").on(t.phone)]
);

export const clients = pgTable(
  "clients",
  {
    id,
    createdAt,
    updatedAt,
    firmId: uuid("firm_id")
      .notNull()
      .references(() => firms.id),
    name: text("name").notNull(),
    phone: text("phone").notNull(),
    email: text("email"),
    whatsappOptIn: boolean("whatsapp_opt_in").notNull().default(true),
    notes: text("notes"),
    dataConsentAt: timestamp("data_consent_at", { withTimezone: true }),
  },
  (t) => [index("clients_firm_idx").on(t.firmId)]
);

export const projects = pgTable(
  "projects",
  {
    id,
    createdAt,
    updatedAt,
    firmId: uuid("firm_id")
      .notNull()
      .references(() => firms.id),
    name: text("name").notNull(),
    siteAddress: text("site_address"),
    city: text("city"),
    description: text("description"),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id),
    status: projectStatusEnum("status").notNull().default("active"),
  },
  (t) => [index("projects_firm_idx").on(t.firmId)]
);

export const projectAssignments = pgTable(
  "project_assignments",
  {
    id,
    createdAt,
    updatedAt,
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    assignedBy: uuid("assigned_by")
      .notNull()
      .references(() => users.id),
  },
  (t) => [
    uniqueIndex("project_assignments_unique").on(t.projectId, t.userId),
    index("project_assignments_user_idx").on(t.userId),
  ]
);

export const checklistLibraryItems = pgTable(
  "checklist_library_items",
  {
    id,
    createdAt,
    updatedAt,
    firmId: uuid("firm_id")
      .notNull()
      .references(() => firms.id),
    title: text("title").notNull(),
    titleHi: text("title_hi"),
    description: text("description"),
    category: text("category").notNull(),
    helpText: text("help_text"), // plain-language "what is this / where do you get it"
    sampleImageKey: text("sample_image_key"),
    isActive: boolean("is_active").notNull().default(true),
  },
  (t) => [index("library_items_firm_idx").on(t.firmId)]
);

export const checklistTemplates = pgTable(
  "checklist_templates",
  {
    id,
    createdAt,
    updatedAt,
    firmId: uuid("firm_id")
      .notNull()
      .references(() => firms.id),
    name: text("name").notNull(),
    description: text("description"),
    isActive: boolean("is_active").notNull().default(true),
  },
  (t) => [index("templates_firm_idx").on(t.firmId)]
);

export const checklistTemplateItems = pgTable(
  "checklist_template_items",
  {
    id,
    createdAt,
    updatedAt,
    templateId: uuid("template_id")
      .notNull()
      .references(() => checklistTemplates.id),
    libraryItemId: uuid("library_item_id")
      .notNull()
      .references(() => checklistLibraryItems.id),
    isMandatory: boolean("is_mandatory").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("template_items_template_idx").on(t.templateId)]
);

export const checklists = pgTable(
  "checklists",
  {
    id,
    createdAt,
    updatedAt,
    firmId: uuid("firm_id")
      .notNull()
      .references(() => firms.id),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id),
    title: text("title").notNull(),
    notes: text("notes"),
    status: checklistStatusEnum("status").notNull().default("draft"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    reminderCadenceDays: integer("reminder_cadence_days").notNull().default(3), // 0 = off
    lastReminderAt: timestamp("last_reminder_at", { withTimezone: true }),
  },
  (t) => [
    index("checklists_firm_idx").on(t.firmId),
    index("checklists_project_idx").on(t.projectId),
  ]
);

export const checklistItems = pgTable(
  "checklist_items",
  {
    id,
    createdAt,
    updatedAt,
    checklistId: uuid("checklist_id")
      .notNull()
      .references(() => checklists.id),
    libraryItemId: uuid("library_item_id").references(
      () => checklistLibraryItems.id
    ),
    // snapshot-copied — later library edits must not mutate sent checklists
    title: text("title").notNull(),
    titleHi: text("title_hi"),
    description: text("description"),
    helpText: text("help_text"),
    isMandatory: boolean("is_mandatory").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    status: checklistItemStatusEnum("status").notNull().default("pending"),
    waivedReason: text("waived_reason"),
    hardCopyReceived: boolean("hard_copy_received").notNull().default(false),
    hardCopyNotedBy: uuid("hard_copy_noted_by").references(() => users.id),
    hardCopyNotedAt: timestamp("hard_copy_noted_at", { withTimezone: true }),
    reviewedBy: uuid("reviewed_by").references(() => users.id),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    rejectionReason: text("rejection_reason"),
  },
  (t) => [index("checklist_items_checklist_idx").on(t.checklistId)]
);

export const documents = pgTable(
  "documents",
  {
    id,
    createdAt,
    updatedAt,
    firmId: uuid("firm_id")
      .notNull()
      .references(() => firms.id),
    checklistItemId: uuid("checklist_item_id")
      .notNull()
      .references(() => checklistItems.id),
    uploadedBy: uuid("uploaded_by")
      .notNull()
      .references(() => users.id),
    fileName: text("file_name").notNull(), // sanitized
    fileSizeBytes: bigint("file_size_bytes", { mode: "number" }).notNull(),
    mimeType: text("mime_type").notNull(),
    storageKey: text("storage_key").notNull().unique(),
    version: integer("version").notNull().default(1),
    status: documentStatusEnum("status").notNull().default("active"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }), // soft delete / trash
  },
  (t) => [
    index("documents_item_idx").on(t.checklistItemId),
    index("documents_firm_idx").on(t.firmId),
  ]
);

export const itemComments = pgTable(
  "item_comments",
  {
    id,
    createdAt,
    updatedAt,
    checklistItemId: uuid("checklist_item_id")
      .notNull()
      .references(() => checklistItems.id),
    authorUserId: uuid("author_user_id")
      .notNull()
      .references(() => users.id),
    body: text("body").notNull(), // plain text, escaped on render
  },
  (t) => [index("item_comments_item_idx").on(t.checklistItemId)]
);

export const notificationsLog = pgTable(
  "notifications_log",
  {
    id,
    createdAt,
    updatedAt,
    firmId: uuid("firm_id").references(() => firms.id),
    recipientUserId: uuid("recipient_user_id").references(() => users.id),
    channel: notificationChannelEnum("channel").notNull(),
    templateKey: text("template_key").notNull(),
    status: notificationStatusEnum("status").notNull().default("queued"),
    providerMessageId: text("provider_message_id"),
  },
  (t) => [index("notifications_firm_idx").on(t.firmId)]
);

export const activityLog = pgTable(
  "activity_log",
  {
    id,
    createdAt,
    updatedAt,
    firmId: uuid("firm_id").references(() => firms.id),
    actorUserId: uuid("actor_user_id").references(() => users.id),
    action: text("action").notNull(),
    entityType: text("entity_type"),
    entityId: uuid("entity_id"),
    metadata: jsonb("metadata"),
    ipAddress: text("ip_address"),
  },
  (t) => [
    index("activity_firm_idx").on(t.firmId),
    index("activity_entity_idx").on(t.entityType, t.entityId),
  ]
);

export const planLimits = pgTable("plan_limits", {
  id,
  createdAt,
  updatedAt,
  tier: planTierEnum("tier").notNull().unique(),
  maxAssociates: integer("max_associates").notNull(), // -1 = unlimited
  maxActiveProjects: integer("max_active_projects").notNull(),
  maxStorageBytes: bigint("max_storage_bytes", { mode: "number" }).notNull(),
  maxClients: integer("max_clients").notNull(),
  maxFileSizeBytes: bigint("max_file_size_bytes", { mode: "number" }).notNull(),
  whatsappQuotaPerMonth: integer("whatsapp_quota_per_month").notNull(),
  priceInrMonthly: integer("price_inr_monthly").notNull(),
});

// ---------- Inferred types ----------

export type Firm = typeof firms.$inferSelect;
export type User = typeof users.$inferSelect;
export type Client = typeof clients.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type Checklist = typeof checklists.$inferSelect;
export type ChecklistItem = typeof checklistItems.$inferSelect;
export type Document = typeof documents.$inferSelect;
export type LibraryItem = typeof checklistLibraryItems.$inferSelect;
export type ChecklistTemplate = typeof checklistTemplates.$inferSelect;
export type PlanLimit = typeof planLimits.$inferSelect;
