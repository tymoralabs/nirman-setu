CREATE TYPE "public"."checklist_item_status" AS ENUM('pending', 'uploaded', 'received', 'rejected', 'waived');--> statement-breakpoint
CREATE TYPE "public"."checklist_status" AS ENUM('draft', 'sent', 'in_progress', 'completed');--> statement-breakpoint
CREATE TYPE "public"."document_status" AS ENUM('active', 'superseded');--> statement-breakpoint
CREATE TYPE "public"."firm_status" AS ENUM('active', 'suspended', 'pending_deletion');--> statement-breakpoint
CREATE TYPE "public"."language" AS ENUM('en', 'hi');--> statement-breakpoint
CREATE TYPE "public"."notification_channel" AS ENUM('whatsapp', 'sms', 'email');--> statement-breakpoint
CREATE TYPE "public"."notification_status" AS ENUM('queued', 'sent', 'delivered', 'failed');--> statement-breakpoint
CREATE TYPE "public"."otp_purpose" AS ENUM('login');--> statement-breakpoint
CREATE TYPE "public"."plan_status" AS ENUM('trialing', 'active', 'past_due', 'cancelled', 'expired');--> statement-breakpoint
CREATE TYPE "public"."plan_tier" AS ENUM('silver', 'gold', 'platinum');--> statement-breakpoint
CREATE TYPE "public"."project_status" AS ENUM('active', 'on_hold', 'completed', 'archived');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('platform_owner', 'firm_admin', 'associate', 'client');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('invited', 'active', 'disabled');--> statement-breakpoint
CREATE TABLE "activity_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"firm_id" uuid,
	"actor_user_id" uuid,
	"action" text NOT NULL,
	"entity_type" text,
	"entity_id" uuid,
	"metadata" jsonb,
	"ip_address" text
);
--> statement-breakpoint
CREATE TABLE "checklist_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"checklist_id" uuid NOT NULL,
	"library_item_id" uuid,
	"title" text NOT NULL,
	"title_hi" text,
	"description" text,
	"help_text" text,
	"is_mandatory" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"status" "checklist_item_status" DEFAULT 'pending' NOT NULL,
	"waived_reason" text,
	"hard_copy_received" boolean DEFAULT false NOT NULL,
	"hard_copy_noted_by" uuid,
	"hard_copy_noted_at" timestamp with time zone,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"rejection_reason" text
);
--> statement-breakpoint
CREATE TABLE "checklist_library_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"firm_id" uuid NOT NULL,
	"title" text NOT NULL,
	"title_hi" text,
	"description" text,
	"category" text NOT NULL,
	"help_text" text,
	"sample_image_key" text,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "checklist_template_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"template_id" uuid NOT NULL,
	"library_item_id" uuid NOT NULL,
	"is_mandatory" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "checklist_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"firm_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "checklists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"firm_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"title" text NOT NULL,
	"notes" text,
	"status" "checklist_status" DEFAULT 'draft' NOT NULL,
	"created_by" uuid NOT NULL,
	"sent_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"reminder_cadence_days" integer DEFAULT 3 NOT NULL,
	"last_reminder_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"firm_id" uuid NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"email" text,
	"whatsapp_opt_in" boolean DEFAULT true NOT NULL,
	"notes" text,
	"data_consent_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"firm_id" uuid NOT NULL,
	"checklist_item_id" uuid NOT NULL,
	"uploaded_by" uuid NOT NULL,
	"file_name" text NOT NULL,
	"file_size_bytes" bigint NOT NULL,
	"mime_type" text NOT NULL,
	"storage_key" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"status" "document_status" DEFAULT 'active' NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "documents_storage_key_unique" UNIQUE("storage_key")
);
--> statement-breakpoint
CREATE TABLE "firms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"status" "firm_status" DEFAULT 'active' NOT NULL,
	"gstin" text,
	"billing_address" text,
	"state" text,
	"plan_tier" "plan_tier" DEFAULT 'silver' NOT NULL,
	"plan_status" "plan_status" DEFAULT 'trialing' NOT NULL,
	"trial_ends_at" timestamp with time zone,
	"read_only_since" timestamp with time zone,
	"delete_after" timestamp with time zone,
	"razorpay_subscription_id" text,
	"storage_used_bytes" bigint DEFAULT 0 NOT NULL,
	"grievance_email" text,
	CONSTRAINT "firms_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "item_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"checklist_item_id" uuid NOT NULL,
	"author_user_id" uuid NOT NULL,
	"body" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"firm_id" uuid,
	"recipient_user_id" uuid,
	"channel" "notification_channel" NOT NULL,
	"template_key" text NOT NULL,
	"status" "notification_status" DEFAULT 'queued' NOT NULL,
	"provider_message_id" text
);
--> statement-breakpoint
CREATE TABLE "otp_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"phone" text NOT NULL,
	"code_hash" text NOT NULL,
	"purpose" "otp_purpose" DEFAULT 'login' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"consumed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "plan_limits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"tier" "plan_tier" NOT NULL,
	"max_associates" integer NOT NULL,
	"max_active_projects" integer NOT NULL,
	"max_storage_bytes" bigint NOT NULL,
	"max_clients" integer NOT NULL,
	"max_file_size_bytes" bigint NOT NULL,
	"whatsapp_quota_per_month" integer NOT NULL,
	"price_inr_monthly" integer NOT NULL,
	CONSTRAINT "plan_limits_tier_unique" UNIQUE("tier")
);
--> statement-breakpoint
CREATE TABLE "project_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"project_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"assigned_by" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"firm_id" uuid NOT NULL,
	"name" text NOT NULL,
	"site_address" text,
	"city" text,
	"description" text,
	"client_id" uuid NOT NULL,
	"status" "project_status" DEFAULT 'active' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"firm_id" uuid,
	"role" "user_role" NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"phone" text,
	"password_hash" text,
	"preferred_language" "language" DEFAULT 'en' NOT NULL,
	"client_id" uuid,
	"status" "user_status" DEFAULT 'invited' NOT NULL,
	"last_login_at" timestamp with time zone,
	"invite_token" text,
	"invite_token_expires_at" timestamp with time zone,
	"reset_token" text,
	"reset_token_expires_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_items" ADD CONSTRAINT "checklist_items_checklist_id_checklists_id_fk" FOREIGN KEY ("checklist_id") REFERENCES "public"."checklists"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_items" ADD CONSTRAINT "checklist_items_library_item_id_checklist_library_items_id_fk" FOREIGN KEY ("library_item_id") REFERENCES "public"."checklist_library_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_items" ADD CONSTRAINT "checklist_items_hard_copy_noted_by_users_id_fk" FOREIGN KEY ("hard_copy_noted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_items" ADD CONSTRAINT "checklist_items_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_library_items" ADD CONSTRAINT "checklist_library_items_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_template_items" ADD CONSTRAINT "checklist_template_items_template_id_checklist_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."checklist_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_template_items" ADD CONSTRAINT "checklist_template_items_library_item_id_checklist_library_items_id_fk" FOREIGN KEY ("library_item_id") REFERENCES "public"."checklist_library_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklist_templates" ADD CONSTRAINT "checklist_templates_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklists" ADD CONSTRAINT "checklists_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklists" ADD CONSTRAINT "checklists_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checklists" ADD CONSTRAINT "checklists_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_checklist_item_id_checklist_items_id_fk" FOREIGN KEY ("checklist_item_id") REFERENCES "public"."checklist_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_comments" ADD CONSTRAINT "item_comments_checklist_item_id_checklist_items_id_fk" FOREIGN KEY ("checklist_item_id") REFERENCES "public"."checklist_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_comments" ADD CONSTRAINT "item_comments_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications_log" ADD CONSTRAINT "notifications_log_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications_log" ADD CONSTRAINT "notifications_log_recipient_user_id_users_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_assignments" ADD CONSTRAINT "project_assignments_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_assignments" ADD CONSTRAINT "project_assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_assignments" ADD CONSTRAINT "project_assignments_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_firm_idx" ON "activity_log" USING btree ("firm_id");--> statement-breakpoint
CREATE INDEX "activity_entity_idx" ON "activity_log" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "checklist_items_checklist_idx" ON "checklist_items" USING btree ("checklist_id");--> statement-breakpoint
CREATE INDEX "library_items_firm_idx" ON "checklist_library_items" USING btree ("firm_id");--> statement-breakpoint
CREATE INDEX "template_items_template_idx" ON "checklist_template_items" USING btree ("template_id");--> statement-breakpoint
CREATE INDEX "templates_firm_idx" ON "checklist_templates" USING btree ("firm_id");--> statement-breakpoint
CREATE INDEX "checklists_firm_idx" ON "checklists" USING btree ("firm_id");--> statement-breakpoint
CREATE INDEX "checklists_project_idx" ON "checklists" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "clients_firm_idx" ON "clients" USING btree ("firm_id");--> statement-breakpoint
CREATE INDEX "documents_item_idx" ON "documents" USING btree ("checklist_item_id");--> statement-breakpoint
CREATE INDEX "documents_firm_idx" ON "documents" USING btree ("firm_id");--> statement-breakpoint
CREATE INDEX "item_comments_item_idx" ON "item_comments" USING btree ("checklist_item_id");--> statement-breakpoint
CREATE INDEX "notifications_firm_idx" ON "notifications_log" USING btree ("firm_id");--> statement-breakpoint
CREATE INDEX "otp_codes_phone_idx" ON "otp_codes" USING btree ("phone");--> statement-breakpoint
CREATE UNIQUE INDEX "project_assignments_unique" ON "project_assignments" USING btree ("project_id","user_id");--> statement-breakpoint
CREATE INDEX "project_assignments_user_idx" ON "project_assignments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "projects_firm_idx" ON "projects" USING btree ("firm_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_staff_email_unique" ON "users" USING btree ("email") WHERE "users"."role" != 'client';--> statement-breakpoint
CREATE UNIQUE INDEX "users_client_firm_phone_unique" ON "users" USING btree ("firm_id","phone") WHERE "users"."role" = 'client';--> statement-breakpoint
CREATE INDEX "users_firm_idx" ON "users" USING btree ("firm_id");--> statement-breakpoint
CREATE INDEX "users_phone_idx" ON "users" USING btree ("phone");