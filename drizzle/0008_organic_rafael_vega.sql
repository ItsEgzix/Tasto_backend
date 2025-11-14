-- Drop old unique constraints
ALTER TABLE "categories" DROP CONSTRAINT IF EXISTS "categories_name_unique";--> statement-breakpoint
ALTER TABLE "daily_inventory_snapshots" DROP CONSTRAINT IF EXISTS "daily_inventory_snapshots_snapshot_date_unique";--> statement-breakpoint
ALTER TABLE "ingredient_analytics" DROP CONSTRAINT IF EXISTS "ingredient_analytics_ingredient_id_unique";--> statement-breakpoint
ALTER TABLE "ingredients" DROP CONSTRAINT IF EXISTS "ingredients_name_unique";--> statement-breakpoint
ALTER TABLE "recipe_categories" DROP CONSTRAINT IF EXISTS "recipe_categories_name_unique";--> statement-breakpoint
ALTER TABLE "recipes" DROP CONSTRAINT IF EXISTS "recipes_name_unique";--> statement-breakpoint
ALTER TABLE "storage_locations" DROP CONSTRAINT IF EXISTS "storage_locations_name_unique";--> statement-breakpoint
ALTER TABLE "units" DROP CONSTRAINT IF EXISTS "units_name_unique";--> statement-breakpoint

-- Add user_id columns as nullable first
ALTER TABLE "categories" ADD COLUMN "user_id" uuid;--> statement-breakpoint
ALTER TABLE "daily_inventory_snapshots" ADD COLUMN "user_id" uuid;--> statement-breakpoint
ALTER TABLE "ingredient_analytics" ADD COLUMN "user_id" uuid;--> statement-breakpoint
ALTER TABLE "ingredient_stock" ADD COLUMN "user_id" uuid;--> statement-breakpoint
ALTER TABLE "ingredients" ADD COLUMN "user_id" uuid;--> statement-breakpoint
ALTER TABLE "recipe_categories" ADD COLUMN "user_id" uuid;--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "user_id" uuid;--> statement-breakpoint
ALTER TABLE "storage_locations" ADD COLUMN "user_id" uuid;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "user_id" uuid;--> statement-breakpoint
ALTER TABLE "units" ADD COLUMN "user_id" uuid;--> statement-breakpoint

-- Update all existing rows to link to Test User (802caa6f-6890-4269-bed4-3fd5e9808a02)
UPDATE "categories" SET "user_id" = '802caa6f-6890-4269-bed4-3fd5e9808a02' WHERE "user_id" IS NULL;--> statement-breakpoint
UPDATE "daily_inventory_snapshots" SET "user_id" = '802caa6f-6890-4269-bed4-3fd5e9808a02' WHERE "user_id" IS NULL;--> statement-breakpoint
UPDATE "ingredient_analytics" SET "user_id" = '802caa6f-6890-4269-bed4-3fd5e9808a02' WHERE "user_id" IS NULL;--> statement-breakpoint
UPDATE "ingredient_stock" SET "user_id" = '802caa6f-6890-4269-bed4-3fd5e9808a02' WHERE "user_id" IS NULL;--> statement-breakpoint
UPDATE "ingredients" SET "user_id" = '802caa6f-6890-4269-bed4-3fd5e9808a02' WHERE "user_id" IS NULL;--> statement-breakpoint
UPDATE "recipe_categories" SET "user_id" = '802caa6f-6890-4269-bed4-3fd5e9808a02' WHERE "user_id" IS NULL;--> statement-breakpoint
UPDATE "recipes" SET "user_id" = '802caa6f-6890-4269-bed4-3fd5e9808a02' WHERE "user_id" IS NULL;--> statement-breakpoint
UPDATE "storage_locations" SET "user_id" = '802caa6f-6890-4269-bed4-3fd5e9808a02' WHERE "user_id" IS NULL;--> statement-breakpoint
UPDATE "suppliers" SET "user_id" = '802caa6f-6890-4269-bed4-3fd5e9808a02' WHERE "user_id" IS NULL;--> statement-breakpoint
UPDATE "units" SET "user_id" = '802caa6f-6890-4269-bed4-3fd5e9808a02' WHERE "user_id" IS NULL;--> statement-breakpoint

-- Now make user_id NOT NULL
ALTER TABLE "categories" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "daily_inventory_snapshots" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "ingredient_analytics" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "ingredient_stock" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "ingredients" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "recipe_categories" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "recipes" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "storage_locations" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "suppliers" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "units" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint

-- Add foreign key constraints
ALTER TABLE "categories" ADD CONSTRAINT "categories_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_inventory_snapshots" ADD CONSTRAINT "daily_inventory_snapshots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingredient_analytics" ADD CONSTRAINT "ingredient_analytics_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingredient_stock" ADD CONSTRAINT "ingredient_stock_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingredients" ADD CONSTRAINT "ingredients_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_categories" ADD CONSTRAINT "recipe_categories_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storage_locations" ADD CONSTRAINT "storage_locations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "units" ADD CONSTRAINT "units_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

-- Add new user-scoped unique constraints
ALTER TABLE "categories" ADD CONSTRAINT "categories_user_id_name_unique" UNIQUE("user_id","name");--> statement-breakpoint
ALTER TABLE "daily_inventory_snapshots" ADD CONSTRAINT "daily_inventory_snapshots_user_id_snapshot_date_unique" UNIQUE("user_id","snapshot_date");--> statement-breakpoint
ALTER TABLE "ingredient_analytics" ADD CONSTRAINT "ingredient_analytics_user_id_ingredient_id_unique" UNIQUE("user_id","ingredient_id");--> statement-breakpoint
ALTER TABLE "ingredients" ADD CONSTRAINT "ingredients_user_id_name_unique" UNIQUE("user_id","name");--> statement-breakpoint
ALTER TABLE "recipe_categories" ADD CONSTRAINT "recipe_categories_user_id_name_unique" UNIQUE("user_id","name");--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_user_id_name_unique" UNIQUE("user_id","name");--> statement-breakpoint
ALTER TABLE "storage_locations" ADD CONSTRAINT "storage_locations_user_id_name_unique" UNIQUE("user_id","name");--> statement-breakpoint
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_user_id_name_unique" UNIQUE("user_id","name");--> statement-breakpoint
ALTER TABLE "units" ADD CONSTRAINT "units_user_id_name_unique" UNIQUE("user_id","name");