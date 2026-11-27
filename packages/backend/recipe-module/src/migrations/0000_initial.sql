CREATE SCHEMA IF NOT EXISTS "recipes";
--> statement-breakpoint
CREATE TABLE "recipes"."ingredients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" varchar(160) NOT NULL,
	"unit" varchar(8) NOT NULL,
	"cost_per_unit" numeric(14, 4) DEFAULT '0' NOT NULL,
	"supplier" varchar(160),
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ingredients_cost_not_negative" CHECK ("cost_per_unit" >= 0)
);
--> statement-breakpoint
CREATE TABLE "recipes"."recipe_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"recipe_id" uuid NOT NULL,
	"ingredient_id" uuid NOT NULL,
	"quantity" numeric(14, 4) NOT NULL,
	"unit" varchar(8) NOT NULL,
	"notes" text,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recipe_lines_quantity_positive" CHECK ("quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "recipes"."recipes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"product_id" varchar(128) NOT NULL,
	"yield_portions" numeric(14, 4) DEFAULT '1' NOT NULL,
	"preparation_time_minutes" integer,
	"instructions" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recipes_yield_positive" CHECK ("yield_portions" > 0),
	CONSTRAINT "recipes_preparation_not_negative" CHECK ("preparation_time_minutes" is null or "preparation_time_minutes" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_ingredients_company_id" ON "recipes"."ingredients" USING btree ("company_id","id");--> statement-breakpoint
ALTER TABLE "recipes"."recipe_lines" ADD CONSTRAINT "recipe_lines_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "recipes"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipes"."recipe_lines" ADD CONSTRAINT "recipe_lines_ingredient_fk" FOREIGN KEY ("company_id","ingredient_id") REFERENCES "recipes"."ingredients"("company_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_ingredients_company_name" ON "recipes"."ingredients" USING btree ("company_id","name");--> statement-breakpoint
CREATE INDEX "idx_recipe_lines_recipe" ON "recipes"."recipe_lines" USING btree ("recipe_id","position");--> statement-breakpoint
CREATE INDEX "idx_recipe_lines_ingredient" ON "recipes"."recipe_lines" USING btree ("company_id","ingredient_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_recipes_company_product" ON "recipes"."recipes" USING btree ("company_id","product_id");