/**
 * Verification script to check that all users have a currency set
 */

import { db } from "../src/db";
import { users } from "../src/db/schema";
import { sql } from "drizzle-orm";

async function verifyCurrencyMigration() {
  try {
    console.log("Verifying currency migration...\n");

    // Check total users
    const totalUsers = await db
      .select({ count: sql<number>`count(*)` })
      .from(users);

    console.log(`Total users: ${totalUsers[0].count}`);

    // Check users with currency set
    const usersWithCurrency = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(sql`currency IS NOT NULL`);

    console.log(`Users with currency set: ${usersWithCurrency[0].count}`);

    // Get currency distribution
    const currencyDistribution = await db
      .select({
        currency: users.currency,
        count: sql<number>`count(*)`,
      })
      .from(users)
      .groupBy(users.currency);

    console.log("\nCurrency distribution:");
    currencyDistribution.forEach((item) => {
      console.log(`  ${item.currency || "NULL"}: ${item.count} user(s)`);
    });

    // Check for any users without currency
    const usersWithoutCurrency = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(sql`currency IS NULL`);

    if (usersWithoutCurrency[0].count > 0) {
      console.log(
        `\n⚠️  Warning: ${usersWithoutCurrency[0].count} user(s) without currency set!`
      );
      console.log("Updating them to USD...");

      await db
        .update(users)
        .set({ currency: "USD" })
        .where(sql`currency IS NULL`);

      console.log("✅ All users now have currency set to USD");
    } else {
      console.log("\n✅ All users have currency set!");
    }
  } catch (error) {
    console.error("❌ Error verifying migration:", error);
    throw error;
  } finally {
    process.exit(0);
  }
}

verifyCurrencyMigration();




