# Database Setup

This directory contains the Drizzle ORM schema and database connection setup for Supabase.

## Files

- `index.ts` - Database connection using Drizzle ORM with Supabase
- `schema.ts` - Database schema definitions (tables, relations, etc.)

## Usage

Import the database instance in your services:

```typescript
import { db } from "../db";
import { ingredients } from "../db/schema";

// Example query
const allIngredients = await db.select().from(ingredients);
```

## Connection Details

The connection is configured for Supabase with:

- Transaction pool mode support (prepare: false)
- Automatic schema type inference
- Environment variable: `DATABASE_URL`

Make sure your `.env` file contains:

```
DATABASE_URL=postgresql://user:password@host:port/database?sslmode=require
```
