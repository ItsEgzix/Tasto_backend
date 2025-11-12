import { db } from "../src/db";
import { sql } from "drizzle-orm";

async function createTable() {
  try {
    console.log("Creating ingredient_stock table...");

    // Check if table exists first
    const checkTable = await db.execute(
      sql`SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'ingredient_stock'
      )`
    );

    const exists = (checkTable as any)[0]?.exists || false;

    if (exists) {
      console.log("✅ Table 'ingredient_stock' already exists!");
      return;
    }

    // Create the table
    await db.execute(sql`
      CREATE TABLE "ingredient_stock" (
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
      )
    `);

    console.log("✅ Created ingredient_stock table");

    // Add foreign key constraints
    console.log("Adding foreign key constraints...");

    try {
      await db.execute(sql`
        ALTER TABLE "ingredient_stock" 
        ADD CONSTRAINT "ingredient_stock_ingredient_id_fk" 
        FOREIGN KEY ("ingredient_id") 
        REFERENCES "public"."ingredients"("id") 
        ON DELETE cascade ON UPDATE no action
      `);
      console.log("✅ Added ingredient_id foreign key");
    } catch (error: any) {
      if (error.code === "42710" || error.message?.includes("already exists")) {
        console.log("⏭️  ingredient_id foreign key already exists");
      } else {
        throw error;
      }
    }

    try {
      await db.execute(sql`
        ALTER TABLE "ingredient_stock" 
        ADD CONSTRAINT "ingredient_stock_storage_location_id_fk" 
        FOREIGN KEY ("storage_location_id") 
        REFERENCES "public"."storage_locations"("id") 
        ON DELETE restrict ON UPDATE no action
      `);
      console.log("✅ Added storage_location_id foreign key");
    } catch (error: any) {
      if (error.code === "42710" || error.message?.includes("already exists")) {
        console.log("⏭️  storage_location_id foreign key already exists");
      } else {
        throw error;
      }
    }

    try {
      await db.execute(sql`
        ALTER TABLE "ingredient_stock" 
        ADD CONSTRAINT "ingredient_stock_supplier_id_fk" 
        FOREIGN KEY ("supplier_id") 
        REFERENCES "public"."suppliers"("id") 
        ON DELETE restrict ON UPDATE no action
      `);
      console.log("✅ Added supplier_id foreign key");
    } catch (error: any) {
      if (error.code === "42710" || error.message?.includes("already exists")) {
        console.log("⏭️  supplier_id foreign key already exists");
      } else {
        throw error;
      }
    }

    console.log("\n✅ Table creation completed successfully!");
  } catch (error: any) {
    console.error("❌ Error:", error.message);
    console.error("Error code:", error.code);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

createTable();
