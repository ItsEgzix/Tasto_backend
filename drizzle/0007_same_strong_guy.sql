CREATE TABLE "daily_inventory_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"snapshot_date" date NOT NULL,
	"total_value" numeric(12, 2) DEFAULT '0' NOT NULL,
	"remaining_value" numeric(12, 2) DEFAULT '0' NOT NULL,
	"total_purchases" integer DEFAULT 0 NOT NULL,
	"total_ingredients" integer DEFAULT 0 NOT NULL,
	"low_stock_count" integer DEFAULT 0 NOT NULL,
	"ingredient_stats" jsonb DEFAULT '[]' NOT NULL,
	"supplier_stats" jsonb DEFAULT '[]' NOT NULL,
	"category_distribution" jsonb DEFAULT '[]' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "daily_inventory_snapshots_snapshot_date_unique" UNIQUE("snapshot_date")
);
--> statement-breakpoint
CREATE TABLE "ingredient_analytics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ingredient_id" uuid NOT NULL,
	"total_value" numeric(12, 2) DEFAULT '0' NOT NULL,
	"remaining_value" numeric(12, 2) DEFAULT '0' NOT NULL,
	"average_price_per_unit" numeric(10, 2) DEFAULT '0' NOT NULL,
	"total_purchases" integer DEFAULT 0 NOT NULL,
	"price_trend" jsonb DEFAULT '[]' NOT NULL,
	"stock_value_trend" jsonb DEFAULT '[]' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ingredient_analytics_ingredient_id_unique" UNIQUE("ingredient_id")
);
--> statement-breakpoint
ALTER TABLE "ingredient_analytics" ADD CONSTRAINT "ingredient_analytics_ingredient_id_ingredients_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE cascade ON UPDATE no action;