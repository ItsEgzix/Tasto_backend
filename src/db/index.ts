import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import dotenv from "dotenv";

dotenv.config();

// Configure postgres client for optimal parallel request handling
// - max: Maximum number of connections in the pool (default: 10)
// - idle_timeout: How long a connection can be idle before being closed (seconds)
// - max_lifetime: Maximum lifetime of a connection (seconds)
// - prepare: false = Use transaction pool mode (better for Supabase/serverless)
// - connection: Additional connection parameters
const client = postgres(process.env.DATABASE_URL as string, {
  prepare: false, // Transaction pool mode for Supabase
  max: 20, // Allow up to 20 concurrent connections per user
  idle_timeout: 20, // Close idle connections after 20 seconds
  max_lifetime: 60 * 30, // Maximum connection lifetime: 30 minutes
  connect_timeout: 10, // Connection timeout: 10 seconds
  // Enable connection pooling for parallel requests
  transform: {
    undefined: null, // Transform undefined to null for PostgreSQL
  },
});

const db = drizzle({ client, schema });

export { db, schema };
