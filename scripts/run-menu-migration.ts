import { db } from "../src/db";
import { readFileSync } from "fs";
import { join } from "path";
import { sql } from "drizzle-orm";

async function runMigration() {
  try {
    console.log("Running migration 0009_sweet_groot.sql (Menu tables)...");

    const migrationPath = join(__dirname, "../drizzle/0009_sweet_groot.sql");
    const migrationSQL = readFileSync(migrationPath, "utf-8");

    // Split by statement breakpoints and execute each statement
    const statements = migrationSQL
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith("--"));

    for (const statement of statements) {
      if (statement.trim()) {
        try {
          // Check if table already exists for CREATE TABLE statements
          if (statement.includes("CREATE TABLE")) {
            const tableMatch = statement.match(/CREATE TABLE "([^"]+)"/);
            if (tableMatch) {
              const tableName = tableMatch[1];
              const checkTable = await db.execute(
                sql.raw(`
                  SELECT table_name 
                  FROM information_schema.tables 
                  WHERE table_name = '${tableName}'
                `)
              );
              if ((checkTable as any).length > 0) {
                console.log(`⏭️  Table ${tableName} already exists, skipping`);
                continue;
              }
            }
          }

          // Check if constraint already exists for ALTER TABLE ADD CONSTRAINT
          if (statement.includes("ADD CONSTRAINT")) {
            const constraintMatch = statement.match(/ADD CONSTRAINT "([^"]+)"/);
            if (constraintMatch) {
              const constraintName = constraintMatch[1];
              const checkConstraint = await db.execute(
                sql.raw(`
                  SELECT constraint_name 
                  FROM information_schema.table_constraints 
                  WHERE constraint_name = '${constraintName}'
                `)
              );
              if ((checkConstraint as any).length > 0) {
                console.log(
                  `⏭️  Constraint ${constraintName} already exists, skipping`
                );
                continue;
              }
            }
          }

          await db.execute(sql.raw(statement));
          console.log("✅ Executed statement");
        } catch (error: any) {
          // Ignore errors for "already exists" or "does not exist" cases
          const errorMsg = error.message || "";
          const errorCode = error.code || "";

          if (
            errorMsg.includes("already exists") ||
            errorMsg.includes("duplicate") ||
            (errorMsg.includes("does not exist") &&
              errorMsg.includes("DROP")) ||
            errorCode === "42P07" || // relation already exists
            errorCode === "42P01" || // relation does not exist (for DROP)
            errorCode === "42710" // constraint already exists
          ) {
            console.log("⏭️  Skipped (already handled)");
          } else {
            console.error("❌ Error executing statement:", error.message);
            console.error("Statement:", statement.substring(0, 100) + "...");
            throw error; // Re-throw for critical errors
          }
        }
      }
    }

    console.log("\n✅ Migration completed successfully!");
    console.log("Menu tables (menu_plans and menu_items) have been created");
  } catch (error: any) {
    console.error("❌ Migration failed:", error.message);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

runMigration();
