import { db } from "../src/db";
import { sql } from "drizzle-orm";

async function markMigrationsApplied() {
  try {
    const migrations = [
      "0000_lumpy_otto_octavius",
      "0001_friendly_stark_industries",
      "0002_fresh_flatman",
      "0003_ordinary_blue_marvel",
      "0004_tiresome_exiles",
    ];

    for (const migrationTag of migrations) {
      // Drizzle uses the migration tag/name as the hash, not a SHA256 hash
      const hash = migrationTag;
      const createdAt = BigInt(Date.now());

      // Check if already exists
      const existing = await db.execute(sql`
        SELECT hash FROM drizzle.__drizzle_migrations 
        WHERE hash = ${hash}
      `);

      // postgres-js returns an array directly
      const existingArray = Array.isArray(existing)
        ? existing
        : (existing as any).rows || [];

      if (existingArray.length === 0) {
        // Insert migration record (no unique constraint on hash, so no ON CONFLICT)
        await db.execute(sql`
          INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
          VALUES (${hash}, ${createdAt})
        `);
        console.log(`✅ Marked ${migrationTag} as applied`);
      } else {
        console.log(`⏭️  ${migrationTag} already marked as applied`);
      }
    }

    console.log("\n✅ All migrations marked as applied!");
    console.log("Now run: npm run db:migrate");
  } catch (error: any) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

markMigrationsApplied();
