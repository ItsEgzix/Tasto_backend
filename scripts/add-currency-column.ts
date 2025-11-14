/**
 * Migration script to add currency column to users table
 * Run this script to add the currency column to existing users table
 */

import { db } from "../src/db";
import { sql } from "drizzle-orm";

async function addCurrencyColumn() {
  try {
    console.log("Adding currency column to users table...");

    // Add currency column with default value 'USD'
    await db.execute(sql`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'USD';
    `);

    console.log("✅ Currency column added successfully!");
    console.log("All existing users have been set to USD currency.");
  } catch (error) {
    console.error("❌ Error adding currency column:", error);
    throw error;
  } finally {
    process.exit(0);
  }
}

addCurrencyColumn();




