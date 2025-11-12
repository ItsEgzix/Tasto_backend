-- Create ingredient_stock table if it doesn't exist
CREATE TABLE IF NOT EXISTS "ingredient_stock" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ingredient_id" uuid NOT NULL,
	"storage_location_id" uuid NOT NULL,
	"quantity" numeric(10, 2) NOT NULL,
	"batch_number" text,
	"expiration_date" date,
	"purchase_date" date NOT NULL,
	"purchase_price" numeric(10, 2) NOT NULL,
	"supplier_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- Add foreign keys for ingredient_stock if they don't exist
DO $$ 
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint WHERE conname = 'ingredient_stock_ingredient_id_fk'
	) THEN
		ALTER TABLE "ingredient_stock" 
		ADD CONSTRAINT "ingredient_stock_ingredient_id_fk" 
		FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE cascade ON UPDATE no action;
	END IF;
	
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint WHERE conname = 'ingredient_stock_storage_location_id_fk'
	) THEN
		ALTER TABLE "ingredient_stock" 
		ADD CONSTRAINT "ingredient_stock_storage_location_id_fk" 
		FOREIGN KEY ("storage_location_id") REFERENCES "public"."storage_locations"("id") ON DELETE restrict ON UPDATE no action;
	END IF;
	
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint WHERE conname = 'ingredient_stock_supplier_id_fk'
	) THEN
		ALTER TABLE "ingredient_stock" 
		ADD CONSTRAINT "ingredient_stock_supplier_id_fk" 
		FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE restrict ON UPDATE no action;
	END IF;
END $$;
--> statement-breakpoint

-- Drop and recreate usage_history with correct structure
DROP TABLE IF EXISTS "usage_history" CASCADE;
--> statement-breakpoint
CREATE TABLE "usage_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" date NOT NULL,
	"ingredient_stock_id" uuid NOT NULL,
	"quantity_used" numeric(10, 2) NOT NULL,
	"reason" text,
	"production_plan_id" uuid,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "usage_history" ADD CONSTRAINT "usage_history_ingredient_stock_id_ingredient_stock_id_fk" FOREIGN KEY ("ingredient_stock_id") REFERENCES "public"."ingredient_stock"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

-- Drop and recreate spoilage_records with correct structure
DROP TABLE IF EXISTS "spoilage_records" CASCADE;
--> statement-breakpoint
CREATE TABLE "spoilage_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ingredient_stock_id" uuid NOT NULL,
	"quantity" numeric(10, 2) NOT NULL,
	"reason" text NOT NULL,
	"date" date NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "spoilage_records" ADD CONSTRAINT "spoilage_records_ingredient_stock_id_ingredient_stock_id_fk" FOREIGN KEY ("ingredient_stock_id") REFERENCES "public"."ingredient_stock"("id") ON DELETE cascade ON UPDATE no action;