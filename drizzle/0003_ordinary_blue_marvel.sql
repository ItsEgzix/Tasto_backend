CREATE TABLE "spoilage_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ingredient_stock_id" uuid NOT NULL,
	"quantity" numeric(10, 2) NOT NULL,
	"reason" text NOT NULL,
	"date" date NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usage_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" date NOT NULL,
	"recipe_id" uuid,
	"production_plan_id" uuid,
	"ingredient_id" uuid NOT NULL,
	"stock_id" uuid NOT NULL,
	"quantity_used" numeric(10, 2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "spoilage_records" ADD CONSTRAINT "spoilage_records_ingredient_stock_id_ingredient_stock_id_fk" FOREIGN KEY ("ingredient_stock_id") REFERENCES "public"."ingredient_stock"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_history" ADD CONSTRAINT "usage_history_ingredient_id_ingredients_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_history" ADD CONSTRAINT "usage_history_stock_id_ingredient_stock_id_fk" FOREIGN KEY ("stock_id") REFERENCES "public"."ingredient_stock"("id") ON DELETE cascade ON UPDATE no action;