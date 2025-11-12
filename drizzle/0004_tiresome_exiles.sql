CREATE TYPE "public"."unit_type_enum" AS ENUM('weight', 'volume', 'count', 'other');--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"color" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "categories_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "units" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" "unit_type_enum" NOT NULL,
	"symbol" text,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "units_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "ingredient_categories" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "ingredient_categories" CASCADE;--> statement-breakpoint
ALTER TABLE "ingredients" DROP CONSTRAINT "ingredients_category_id_ingredient_categories_id_fk";
--> statement-breakpoint
ALTER TABLE "usage_history" DROP CONSTRAINT "usage_history_ingredient_id_ingredients_id_fk";
--> statement-breakpoint
ALTER TABLE "usage_history" DROP CONSTRAINT "usage_history_stock_id_ingredient_stock_id_fk";
--> statement-breakpoint
ALTER TABLE "ingredients" ADD COLUMN "unit_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "spoilage_records" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "storage_locations" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "storage_locations" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "usage_history" ADD COLUMN "ingredient_stock_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "usage_history" ADD COLUMN "reason" text;--> statement-breakpoint
ALTER TABLE "usage_history" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "ingredients" ADD CONSTRAINT "ingredients_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingredients" ADD CONSTRAINT "ingredients_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_history" ADD CONSTRAINT "usage_history_ingredient_stock_id_ingredient_stock_id_fk" FOREIGN KEY ("ingredient_stock_id") REFERENCES "public"."ingredient_stock"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingredients" DROP COLUMN "unit_type";--> statement-breakpoint
ALTER TABLE "usage_history" DROP COLUMN "recipe_id";--> statement-breakpoint
ALTER TABLE "usage_history" DROP COLUMN "ingredient_id";--> statement-breakpoint
ALTER TABLE "usage_history" DROP COLUMN "stock_id";--> statement-breakpoint
DROP TYPE "public"."unit_type";