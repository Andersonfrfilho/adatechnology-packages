CREATE SCHEMA "expense";
--> statement-breakpoint
CREATE TABLE "expense"."amount_changes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" text NOT NULL,
	"expense_id" uuid NOT NULL,
	"kind" varchar(12) NOT NULL,
	"previous_amount" numeric(14, 2) NOT NULL,
	"new_amount" numeric(14, 2) NOT NULL,
	"effective_competence" varchar(7) NOT NULL,
	"until_competence" varchar(7),
	"changed_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "amount_changes_kind_check" CHECK ("expense"."amount_changes"."kind" in ('adjustment', 'correction'))
);
--> statement-breakpoint
CREATE TABLE "expense"."categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" text NOT NULL,
	"name" varchar(80) NOT NULL,
	"cost_group" varchar(20) DEFAULT 'administrative' NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "categories_cost_group_check" CHECK ("expense"."categories"."cost_group" in ('asset_fixed', 'per_distance', 'administrative', 'in_unit'))
);
--> statement-breakpoint
CREATE TABLE "expense"."occurrences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" text NOT NULL,
	"expense_id" uuid NOT NULL,
	"competence" varchar(7) NOT NULL,
	"slot" smallint DEFAULT 1 NOT NULL,
	"due_date" date NOT NULL,
	"expected_amount" numeric(14, 2) NOT NULL,
	"installment_number" integer,
	"status" varchar(10) DEFAULT 'open' NOT NULL,
	"paid_amount" numeric(14, 2),
	"paid_at" date,
	"paid_by" text,
	"settled_via" varchar(10),
	"settlement_note" text,
	"cancel_reason" text,
	"canceled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "occurrences_status_check" CHECK ("expense"."occurrences"."status" in ('open', 'paid', 'canceled')),
	CONSTRAINT "occurrences_paid_check" CHECK (("expense"."occurrences"."status" = 'paid') = ("expense"."occurrences"."paid_amount" is not null and "expense"."occurrences"."paid_at" is not null))
);
--> statement-breakpoint
CREATE TABLE "expense"."reminder_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" text NOT NULL,
	"occurrence_id" uuid NOT NULL,
	"kind" varchar(12) NOT NULL,
	"reminder_date" date NOT NULL,
	"recipient_ref" text NOT NULL,
	"channel" varchar(12) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expense"."expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" text NOT NULL,
	"category_id" uuid NOT NULL,
	"kind" varchar(10) NOT NULL,
	"name" varchar(120) NOT NULL,
	"expected_amount" numeric(14, 2) NOT NULL,
	"recurrence" varchar(12),
	"due_day" smallint,
	"anchor_competence" varchar(7) NOT NULL,
	"installments_total" integer,
	"notes" text,
	"supplier" varchar(120),
	"bill_url" text,
	"payee_ref" text,
	"payee_name" varchar(120),
	"asset_ref" text,
	"responsible_user_id" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_by" text,
	"created_via" varchar(10) DEFAULT 'panel' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "expenses_kind_check" CHECK ("expense"."expenses"."kind" in ('fixed', 'variable')),
	CONSTRAINT "expenses_schedule_check" CHECK (("expense"."expenses"."kind" = 'variable' and "expense"."expenses"."recurrence" is null and "expense"."expenses"."due_day" is null)
        or ("expense"."expenses"."kind" = 'fixed' and "expense"."expenses"."recurrence" = 'fortnightly' and "expense"."expenses"."due_day" is null)
        or ("expense"."expenses"."kind" = 'fixed' and "expense"."expenses"."recurrence" in ('monthly', 'bimonthly', 'quarterly', 'yearly')
            and "expense"."expenses"."due_day" between 1 and 31)),
	CONSTRAINT "expenses_amount_check" CHECK ("expense"."expenses"."expected_amount" > 0),
	CONSTRAINT "expenses_installments_check" CHECK ("expense"."expenses"."installments_total" is null or "expense"."expenses"."installments_total" > 0)
);
--> statement-breakpoint
ALTER TABLE "expense"."amount_changes" ADD CONSTRAINT "amount_changes_expense_id_expenses_id_fk" FOREIGN KEY ("expense_id") REFERENCES "expense"."expenses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense"."occurrences" ADD CONSTRAINT "occurrences_expense_id_expenses_id_fk" FOREIGN KEY ("expense_id") REFERENCES "expense"."expenses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense"."reminder_deliveries" ADD CONSTRAINT "reminder_deliveries_occurrence_id_occurrences_id_fk" FOREIGN KEY ("occurrence_id") REFERENCES "expense"."occurrences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense"."expenses" ADD CONSTRAINT "expenses_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "expense"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "amount_changes_expense_idx" ON "expense"."amount_changes" USING btree ("company_id","expense_id");--> statement-breakpoint
CREATE UNIQUE INDEX "categories_company_name_unique" ON "expense"."categories" USING btree ("company_id",lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "occurrences_expense_competence_slot_unique" ON "expense"."occurrences" USING btree ("expense_id","competence","slot");--> statement-breakpoint
CREATE INDEX "occurrences_company_due_idx" ON "expense"."occurrences" USING btree ("company_id","due_date");--> statement-breakpoint
CREATE UNIQUE INDEX "reminder_deliveries_unique" ON "expense"."reminder_deliveries" USING btree ("occurrence_id","kind","reminder_date","recipient_ref","channel");--> statement-breakpoint
CREATE INDEX "expenses_company_idx" ON "expense"."expenses" USING btree ("company_id","active");