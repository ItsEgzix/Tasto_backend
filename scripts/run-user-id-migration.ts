import { db } from "../src/db";
import { readFileSync } from "fs";
import { join } from "path";
import { sql } from "drizzle-orm";

const TEST_USER_ID = "802caa6f-6890-4269-bed4-3fd5e9808a02";

async function runMigration() {
  try {
    console.log("Running migration 0008_organic_rafael_vega.sql...");
    console.log(`Linking all existing data to user: ${TEST_USER_ID}`);

    // First, verify the user exists
    const userCheck = await db.execute(
      sql`SELECT id, name, email FROM users WHERE id = ${TEST_USER_ID}`
    );
    const user = (userCheck as any)[0];
    if (!user) {
      throw new Error(
        `User with ID ${TEST_USER_ID} not found. Please verify the user exists.`
      );
    }
    console.log(`✅ Found user: ${user.name} (${user.email})`);

    const migrationPath = join(
      __dirname,
      "../drizzle/0008_organic_rafael_vega.sql"
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
          // Replace IF EXISTS with proper handling
          let processedStatement = statement;

          // For DROP CONSTRAINT IF EXISTS, check if constraint exists first
          if (statement.includes("DROP CONSTRAINT IF EXISTS")) {
            const constraintMatch = statement.match(
              /DROP CONSTRAINT IF EXISTS "([^"]+)"/
            );
            if (constraintMatch) {
              const constraintName = constraintMatch[1];
              const tableMatch = statement.match(/ALTER TABLE "([^"]+)"/);
              if (tableMatch) {
                const tableName = tableMatch[1];
                const checkConstraint = await db.execute(
                  sql.raw(`
                    SELECT constraint_name 
                    FROM information_schema.table_constraints 
                    WHERE table_name = '${tableName}' 
                    AND constraint_name = '${constraintName}'
                  `)
                );
                if ((checkConstraint as any).length === 0) {
                  console.log(
                    `⏭️  Constraint ${constraintName} does not exist, skipping`
                  );
                  continue;
                }
              }
            }
            processedStatement = statement.replace(" IF EXISTS", "");
          }

          // For ADD COLUMN, check if column already exists
          if (statement.includes("ADD COLUMN")) {
            const tableMatch = statement.match(/ALTER TABLE "([^"]+)"/);
            const columnMatch = statement.match(/"([^"]+)" uuid/);
            if (tableMatch && columnMatch) {
              const tableName = tableMatch[1];
              const columnName = columnMatch[1];
              const checkColumn = await db.execute(
                sql.raw(`
                  SELECT column_name 
                  FROM information_schema.columns 
                  WHERE table_name = '${tableName}' 
                  AND column_name = '${columnName}'
                `)
              );
              if ((checkColumn as any).length > 0) {
                console.log(
                  `⏭️  Column ${tableName}.${columnName} already exists, skipping`
                );
                continue;
              }
            }
          }

          // For ADD CONSTRAINT, check if constraint already exists
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

          await db.execute(sql.raw(processedStatement));
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
    console.log("All existing data has been linked to Test User");
  } catch (error: any) {
    console.error("❌ Migration failed:", error.message);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

runMigration();
