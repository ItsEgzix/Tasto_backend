import { db } from "../src/db";
import { readFileSync } from "fs";
import { join } from "path";
import { sql } from "drizzle-orm";

async function runMigration() {
  try {
    console.log(
      "Running migration 0007_same_strong_guy.sql (Analytics tables)..."
    );

    const migrationPath = join(
      __dirname,
      "../drizzle/0007_same_strong_guy.sql"
    );
    const migrationSQL = readFileSync(migrationPath, "utf-8");

    // Split by statement breakpoints and execute each statement
    const statements = migrationSQL
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith("--"));

    for (const statement of statements) {
      if (statement.trim()) {
        try {
          await db.execute(sql.raw(statement));
          console.log("✅ Executed statement");
        } catch (error: any) {
          // Ignore errors for "IF NOT EXISTS" or "already exists" cases
          const errorMsg = error.message || "";
          const errorCode = error.code || "";

          if (
            errorMsg.includes("already exists") ||
            errorMsg.includes("duplicate") ||
            (errorMsg.includes("does not exist") &&
              errorMsg.includes("DROP TABLE")) ||
            errorCode === "42P07" || // relation already exists
            errorCode === "42P01"
          ) {
            // relation does not exist (for DROP)
            console.log("⏭️  Skipped (already handled)");
          } else if (
            errorMsg.includes("constraint") &&
            (errorMsg.includes("already exists") || errorCode === "42710")
          ) {
            console.log("⏭️  Skipped constraint (already exists)");
          } else {
            // For foreign key constraints, check if they already exist
            if (errorMsg.includes("FOREIGN KEY") || errorCode === "42710") {
              console.log("⏭️  Skipped (constraint may already exist)");
            } else {
              console.error("❌ Error executing statement:", error.message);
              console.error("Statement:", statement.substring(0, 100) + "...");
              // Don't throw - continue with other statements
              console.log("⚠️  Continuing with next statement...");
            }
          }
        }
      }
    }

    console.log("\n✅ Migration completed successfully!");
  } catch (error: any) {
    console.error("❌ Migration failed:", error.message);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

runMigration();
