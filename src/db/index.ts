import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import dotenv from "dotenv";

dotenv.config();
const client = postgres(process.env.DATABASE_URL as string, { prepare: false });
const db = drizzle({ client, schema });

export { db, schema };
