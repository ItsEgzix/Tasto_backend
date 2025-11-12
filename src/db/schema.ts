import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  pgEnum,
  numeric,
  date,
  jsonb,
  integer,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  password: text("password").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const refreshTokens = pgTable("refresh_tokens", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Categories table
export const categories = pgTable("categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  color: text("color"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Units table
export const unitTypeEnum = pgEnum("unit_type_enum", [
  "weight",
  "volume",
  "count",
  "other",
]);

export const units = pgTable("units", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull().unique(),
  type: unitTypeEnum("type").notNull(),
  symbol: text("symbol"),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Suppliers table
export const suppliers = pgTable("suppliers", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  contactInfo: text("contact_info"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Storage locations table
export const storageLocations = pgTable("storage_locations", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Ingredients table
export const ingredients = pgTable("ingredients", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull().unique(),
  categoryId: uuid("category_id")
    .notNull()
    .references(() => categories.id, { onDelete: "restrict" }),
  unitId: uuid("unit_id")
    .notNull()
    .references(() => units.id, { onDelete: "restrict" }),
  restockThreshold: numeric("restock_threshold", { precision: 10, scale: 2 })
    .default("0")
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Ingredient stock table - tracks inventory with purchase details
export const ingredientStock = pgTable("ingredient_stock", {
  id: uuid("id").defaultRandom().primaryKey(),
  ingredientId: uuid("ingredient_id")
    .notNull()
    .references(() => ingredients.id, { onDelete: "cascade" }),
  storageLocationId: uuid("storage_location_id")
    .notNull()
    .references(() => storageLocations.id, { onDelete: "restrict" }),
  quantity: numeric("quantity", { precision: 10, scale: 2 }).notNull(),
  batchNumber: text("batch_number"), // Optional batch/lot number
  expirationDate: date("expiration_date"), // Optional expiration date
  purchaseDate: date("purchase_date").notNull(),
  purchasePrice: numeric("purchase_price", {
    precision: 10,
    scale: 2,
  }).notNull(),
  supplierId: uuid("supplier_id")
    .notNull()
    .references(() => suppliers.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Usage history table - tracks when ingredients are used
export const usageHistory = pgTable("usage_history", {
  id: uuid("id").defaultRandom().primaryKey(),
  date: date("date").notNull(),
  ingredientStockId: uuid("ingredient_stock_id")
    .notNull()
    .references(() => ingredientStock.id, { onDelete: "cascade" }),
  quantityUsed: numeric("quantity_used", { precision: 10, scale: 2 }).notNull(),
  reason: text("reason"), // e.g., "production", "manual", "recipe"
  productionPlanId: uuid("production_plan_id"), // Optional: link to production plan
  notes: text("notes"), // Additional notes
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Spoilage records table - tracks waste/spoilage
export const spoilageRecords = pgTable("spoilage_records", {
  id: uuid("id").defaultRandom().primaryKey(),
  ingredientStockId: uuid("ingredient_stock_id")
    .notNull()
    .references(() => ingredientStock.id, { onDelete: "cascade" }),
  quantity: numeric("quantity", { precision: 10, scale: 2 }).notNull(),
  reason: text("reason").notNull(), // e.g., "expired", "damaged", "spoiled"
  date: date("date").notNull(),
  notes: text("notes"), // Additional details
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Recipe categories table
export const recipeCategories = pgTable("recipe_categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  color: text("color"), // For UI display (hex color)
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Recipes table
export const recipes = pgTable("recipes", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull().unique(),
  categoryId: uuid("category_id")
    .notNull()
    .references(() => recipeCategories.id, { onDelete: "restrict" }),
  description: text("description"), // Optional description
  instructions: text("instructions").notNull(), // Step-by-step instructions
  serves: numeric("serves", { precision: 10, scale: 2 }).notNull(), // Base serving size (e.g., 4 people)
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Recipe ingredients table - links recipes to ingredients with quantities
export const recipeIngredients = pgTable("recipe_ingredients", {
  id: uuid("id").defaultRandom().primaryKey(),
  recipeId: uuid("recipe_id")
    .notNull()
    .references(() => recipes.id, { onDelete: "cascade" }),
  ingredientId: uuid("ingredient_id")
    .notNull()
    .references(() => ingredients.id, { onDelete: "restrict" }),
  quantity: numeric("quantity", { precision: 10, scale: 2 }).notNull(), // Base quantity for the recipe's base serving size
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Daily inventory snapshots table - stores pre-computed analytics per day
export const dailyInventorySnapshots = pgTable("daily_inventory_snapshots", {
  id: uuid("id").defaultRandom().primaryKey(),
  snapshotDate: date("snapshot_date").notNull().unique(),

  // Overall statistics (current state as of this date)
  totalValue: numeric("total_value", { precision: 12, scale: 2 })
    .notNull()
    .default("0"),
  remainingValue: numeric("remaining_value", { precision: 12, scale: 2 })
    .notNull()
    .default("0"),
  totalPurchases: integer("total_purchases").notNull().default(0),
  totalIngredients: integer("total_ingredients").notNull().default(0),
  lowStockCount: integer("low_stock_count").notNull().default(0),

  // Detailed data (stored as JSONB for flexibility)
  ingredientStats: jsonb("ingredient_stats").notNull().default("[]"), // Array of per-ingredient stats
  supplierStats: jsonb("supplier_stats").notNull().default("[]"), // Array of per-supplier stats
  categoryDistribution: jsonb("category_distribution").notNull().default("[]"), // Array of category stats

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Ingredient analytics table - stores pre-computed analytics per ingredient
export const ingredientAnalytics = pgTable("ingredient_analytics", {
  id: uuid("id").defaultRandom().primaryKey(),
  ingredientId: uuid("ingredient_id")
    .notNull()
    .references(() => ingredients.id, { onDelete: "cascade" })
    .unique(),

  // Current statistics
  totalValue: numeric("total_value", { precision: 12, scale: 2 })
    .notNull()
    .default("0"),
  remainingValue: numeric("remaining_value", { precision: 12, scale: 2 })
    .notNull()
    .default("0"),
  averagePricePerUnit: numeric("average_price_per_unit", {
    precision: 10,
    scale: 2,
  })
    .notNull()
    .default("0"),
  totalPurchases: integer("total_purchases").notNull().default(0),

  // Trend data (last 90 days)
  priceTrend: jsonb("price_trend").notNull().default("[]"), // [{date, averagePrice}]
  stockValueTrend: jsonb("stock_value_trend").notNull().default("[]"), // [{date, totalValue, remainingValue}]

  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Type inference helpers
export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
export type Unit = typeof units.$inferSelect;
export type NewUnit = typeof units.$inferInsert;
export type Supplier = typeof suppliers.$inferSelect;
export type NewSupplier = typeof suppliers.$inferInsert;
export type StorageLocation = typeof storageLocations.$inferSelect;
export type NewStorageLocation = typeof storageLocations.$inferInsert;
export type Ingredient = typeof ingredients.$inferSelect;
export type NewIngredient = typeof ingredients.$inferInsert;
export type IngredientStock = typeof ingredientStock.$inferSelect;
export type NewIngredientStock = typeof ingredientStock.$inferInsert;
export type UsageHistory = typeof usageHistory.$inferSelect;
export type NewUsageHistory = typeof usageHistory.$inferInsert;
export type SpoilageRecord = typeof spoilageRecords.$inferSelect;
export type NewSpoilageRecord = typeof spoilageRecords.$inferInsert;
export type RecipeCategory = typeof recipeCategories.$inferSelect;
export type NewRecipeCategory = typeof recipeCategories.$inferInsert;
export type Recipe = typeof recipes.$inferSelect;
export type NewRecipe = typeof recipes.$inferInsert;
export type RecipeIngredient = typeof recipeIngredients.$inferSelect;
export type NewRecipeIngredient = typeof recipeIngredients.$inferInsert;
export type DailyInventorySnapshot =
  typeof dailyInventorySnapshots.$inferSelect;
export type NewDailyInventorySnapshot =
  typeof dailyInventorySnapshots.$inferInsert;
export type IngredientAnalytic = typeof ingredientAnalytics.$inferSelect;
export type NewIngredientAnalytic = typeof ingredientAnalytics.$inferInsert;
