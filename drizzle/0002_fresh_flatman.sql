ALTER TABLE "ingredients" ADD COLUMN "category_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "ingredients" ADD CONSTRAINT "ingredients_category_id_ingredient_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."ingredient_categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingredients" DROP COLUMN "category";