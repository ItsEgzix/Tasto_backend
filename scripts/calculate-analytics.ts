import { db } from "../src/db";
import { ingredients } from "../src/db/schema";
import { InventoryAnalyticsService } from "../src/services/inventory-analytics.service";
import { eq } from "drizzle-orm";

/**
 * Script to calculate and save all analytics to the database
 *
 * This script:
 * 1. Calculates and saves the daily inventory snapshot (overall analytics)
 * 2. Calculates and saves analytics for all ingredients
 *
 * Usage:
 *   npm run db:calculate-analytics
 */

async function calculateAllAnalytics() {
  console.log("🚀 Starting analytics calculation...\n");

  try {
    // Step 1: Calculate and save daily snapshot
    console.log("📊 Step 1: Calculating daily inventory snapshot...");
    const startSnapshot = Date.now();
    await InventoryAnalyticsService.saveDailySnapshot();
    const snapshotTime = ((Date.now() - startSnapshot) / 1000).toFixed(2);
    console.log(`✅ Daily snapshot saved successfully (${snapshotTime}s)\n`);

    // Step 2: Get all ingredients
    console.log("📦 Step 2: Fetching all ingredients...");
    const allIngredients = await db
      .select({ id: ingredients.id, name: ingredients.name })
      .from(ingredients);

    if (allIngredients.length === 0) {
      console.log("⚠️  No ingredients found. Skipping ingredient analytics.");
      return;
    }

    console.log(`Found ${allIngredients.length} ingredients to process\n`);

    // Step 3: Calculate analytics for each ingredient
    console.log("🔢 Step 3: Calculating ingredient analytics...");
    const startIngredients = Date.now();
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < allIngredients.length; i++) {
      const ingredient = allIngredients[i];
      const progress = `[${i + 1}/${allIngredients.length}]`;

      try {
        await InventoryAnalyticsService.updateIngredientAnalytics(
          ingredient.id
        );
        successCount++;

        // Log progress every 10 ingredients or for the last one
        if ((i + 1) % 10 === 0 || i === allIngredients.length - 1) {
          console.log(
            `  ${progress} Processed: ${successCount} successful, ${errorCount} errors`
          );
        }
      } catch (error) {
        errorCount++;
        console.error(
          `  ❌ ${progress} Error processing ingredient "${ingredient.name}" (${ingredient.id}):`,
          error instanceof Error ? error.message : error
        );
      }
    }

    const ingredientsTime = ((Date.now() - startIngredients) / 1000).toFixed(2);
    console.log(
      `\n✅ Ingredient analytics calculation complete (${ingredientsTime}s)`
    );
    console.log(`   ✅ Successful: ${successCount}`);
    if (errorCount > 0) {
      console.log(`   ❌ Errors: ${errorCount}`);
    }

    // Summary
    const totalTime = ((Date.now() - startSnapshot) / 1000).toFixed(2);
    console.log(`\n🎉 Analytics calculation complete!`);
    console.log(`   ⏱️  Total time: ${totalTime}s`);
    console.log(`   📊 Daily snapshot: ✅`);
    console.log(
      `   🔢 Ingredient analytics: ${successCount}/${allIngredients.length} successful`
    );
  } catch (error) {
    console.error("\n❌ Fatal error during analytics calculation:", error);
    process.exit(1);
  }
}

// Run the script
calculateAllAnalytics().catch((error) => {
  console.error("Unhandled error:", error);
  process.exit(1);
});
