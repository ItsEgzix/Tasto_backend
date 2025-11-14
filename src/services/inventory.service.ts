import { db } from "../db";
import {
  ingredientStock,
  usageHistory,
  spoilageRecords,
  ingredients,
  storageLocations,
  suppliers,
  units,
} from "../db/schema";
import { eq, sql, and, gte, lte, desc, inArray } from "drizzle-orm";
import { randomUUID } from "crypto";
import { InventoryAnalyticsService } from "./inventory-analytics.service";

export interface StockSummary {
  ingredientId: string;
  ingredientName: string;
  totalStock: string;
  locations: Array<{
    locationId: string;
    locationName: string;
    quantity: string;
  }>;
}

export interface IngredientStockDetail {
  id: string;
  ingredientId: string;
  ingredient: {
    id: string;
    name: string;
    unit: {
      id: string;
      name: string;
    };
  };
  storageLocation: {
    id: string;
    name: string;
    description: string | null;
  };
  quantity: string;
  remainingQuantity: string;
  batchNumber: string | null;
  expirationDate: string | null;
  purchaseDate: string;
  purchasePrice: string;
  supplier: {
    id: string;
    name: string;
  };
}

export class InventoryService {
  // Calculate remaining quantity for a stock entry
  static async calculateRemainingQuantity(
    stockId: string,
    userId: string
  ): Promise<string> {
    // Get original quantity
    const [stock] = await db
      .select({ quantity: ingredientStock.quantity })
      .from(ingredientStock)
      .where(
        and(eq(ingredientStock.id, stockId), eq(ingredientStock.userId, userId))
      )
      .limit(1);

    if (!stock) return "0";

    const originalQuantity = parseFloat(stock.quantity);

    // Get total used
    const usedResult = await db
      .select({
        total: sql<string>`COALESCE(SUM(${usageHistory.quantityUsed}), 0)`,
      })
      .from(usageHistory)
      .innerJoin(
        ingredientStock,
        eq(usageHistory.ingredientStockId, ingredientStock.id)
      )
      .where(
        and(
          eq(usageHistory.ingredientStockId, stockId),
          eq(ingredientStock.userId, userId)
        )
      );

    const totalUsed = parseFloat(usedResult[0]?.total || "0");

    // Get total spoiled
    const spoiledResult = await db
      .select({
        total: sql<string>`COALESCE(SUM(${spoilageRecords.quantity}), 0)`,
      })
      .from(spoilageRecords)
      .innerJoin(
        ingredientStock,
        eq(spoilageRecords.ingredientStockId, ingredientStock.id)
      )
      .where(
        and(
          eq(spoilageRecords.ingredientStockId, stockId),
          eq(ingredientStock.userId, userId)
        )
      );

    const totalSpoiled = parseFloat(spoiledResult[0]?.total || "0");

    const remaining = originalQuantity - totalUsed - totalSpoiled;
    return Math.max(0, remaining).toFixed(2);
  }

  // Record a purchase (creates ingredient_stock entry)
  static async recordPurchase(
    data: {
      ingredientId: string;
      storageLocationId: string;
      quantity: number;
      batchNumber?: string;
      expirationDate?: string;
      purchaseDate: string;
      purchasePrice: number;
      supplierId: string;
    },
    userId: string
  ) {
    // Verify ingredient exists
    const [ingredient] = await db
      .select()
      .from(ingredients)
      .where(
        and(
          eq(ingredients.id, data.ingredientId),
          eq(ingredients.userId, userId)
        )
      )
      .limit(1);
    if (!ingredient) {
      throw new Error("Ingredient not found");
    }

    // Verify storage location exists
    const [location] = await db
      .select()
      .from(storageLocations)
      .where(
        and(
          eq(storageLocations.id, data.storageLocationId),
          eq(storageLocations.userId, userId)
        )
      )
      .limit(1);
    if (!location) {
      throw new Error("Storage location not found");
    }

    // Verify supplier exists
    const [supplier] = await db
      .select()
      .from(suppliers)
      .where(
        and(eq(suppliers.id, data.supplierId), eq(suppliers.userId, userId))
      )
      .limit(1);
    if (!supplier) {
      throw new Error("Supplier not found");
    }

    // Generate UUID explicitly to avoid Drizzle's default handling issue
    const stockId = randomUUID();

    try {
      const [newStock] = await db
        .insert(ingredientStock)
        .values({
          id: stockId,
          ingredientId: data.ingredientId,
          storageLocationId: data.storageLocationId,
          quantity: data.quantity.toString(),
          batchNumber: data.batchNumber || null,
          expirationDate: data.expirationDate || null,
          purchaseDate: data.purchaseDate,
          purchasePrice: data.purchasePrice.toString(),
          supplierId: data.supplierId,
          createdAt: sql`now()`,
          updatedAt: sql`now()`,
          userId,
        })
        .returning();

      // Trigger analytics recalculation (async - don't block)
      setImmediate(async () => {
        try {
          await InventoryAnalyticsService.saveDailySnapshot(userId);
          await InventoryAnalyticsService.updateIngredientAnalytics(
            data.ingredientId,
            userId
          );
        } catch (error) {
          console.error("Error updating analytics after purchase:", error);
          // Don't throw - analytics update shouldn't fail the purchase
        }
      });

      return newStock;
    } catch (error: any) {
      // Log the full error for debugging
      console.error("Database insert error:", error);
      console.error("Error details:", {
        message: error.message,
        code: error.code,
        detail: error.detail,
        constraint: error.constraint,
      });
      throw error;
    }
  }

  // Record ingredient usage
  static async recordUsage(
    data: {
      ingredientStockId: string;
      quantityUsed: number;
      date: string;
      reason?: string;
      notes?: string;
    },
    userId: string
  ) {
    // Verify stock exists
    const [stock] = await db
      .select()
      .from(ingredientStock)
      .where(
        and(
          eq(ingredientStock.id, data.ingredientStockId),
          eq(ingredientStock.userId, userId)
        )
      )
      .limit(1);
    if (!stock) {
      throw new Error("Ingredient stock not found");
    }

    // Check if enough quantity remains
    const remaining = await this.calculateRemainingQuantity(
      data.ingredientStockId,
      userId
    );
    if (parseFloat(remaining) < data.quantityUsed) {
      throw new Error("Insufficient stock available");
    }

    const [newUsage] = await db
      .insert(usageHistory)
      .values({
        ingredientStockId: data.ingredientStockId,
        quantityUsed: data.quantityUsed.toString(),
        date: data.date,
        reason: data.reason || null,
        notes: data.notes || null,
      })
      .returning();

    // Get ingredient ID from stock
    const [stockEntry] = await db
      .select({ ingredientId: ingredientStock.ingredientId })
      .from(ingredientStock)
      .where(
        and(
          eq(ingredientStock.id, data.ingredientStockId),
          eq(ingredientStock.userId, userId)
        )
      )
      .limit(1);

    // Trigger analytics recalculation (async)
    setImmediate(async () => {
      try {
        await InventoryAnalyticsService.saveDailySnapshot(userId);
        if (stockEntry) {
          await InventoryAnalyticsService.updateIngredientAnalytics(
            stockEntry.ingredientId,
            userId
          );
        }
      } catch (error) {
        console.error("Error updating analytics after usage:", error);
      }
    });

    return newUsage;
  }

  // Record spoilage/waste
  static async recordSpoilage(
    data: {
      ingredientStockId: string;
      quantity: number;
      reason: string;
      date: string;
      notes?: string;
    },
    userId: string
  ) {
    // Verify stock exists
    const [stock] = await db
      .select()
      .from(ingredientStock)
      .where(
        and(
          eq(ingredientStock.id, data.ingredientStockId),
          eq(ingredientStock.userId, userId)
        )
      )
      .limit(1);
    if (!stock) {
      throw new Error("Ingredient stock not found");
    }

    // Check if enough quantity remains
    const remaining = await this.calculateRemainingQuantity(
      data.ingredientStockId,
      userId
    );
    if (parseFloat(remaining) < data.quantity) {
      throw new Error("Insufficient stock available");
    }

    const [newSpoilage] = await db
      .insert(spoilageRecords)
      .values({
        ingredientStockId: data.ingredientStockId,
        quantity: data.quantity.toString(),
        reason: data.reason,
        date: data.date,
        notes: data.notes || null,
      })
      .returning();

    // Get ingredient ID from stock
    const [stockEntry] = await db
      .select({ ingredientId: ingredientStock.ingredientId })
      .from(ingredientStock)
      .where(
        and(
          eq(ingredientStock.id, data.ingredientStockId),
          eq(ingredientStock.userId, userId)
        )
      )
      .limit(1);

    // Trigger analytics recalculation (async)
    setImmediate(async () => {
      try {
        await InventoryAnalyticsService.saveDailySnapshot(userId);
        if (stockEntry) {
          await InventoryAnalyticsService.updateIngredientAnalytics(
            stockEntry.ingredientId,
            userId
          );
        }
      } catch (error) {
        console.error("Error updating analytics after spoilage:", error);
      }
    });

    return newSpoilage;
  }

  // Get all stock levels (aggregated by ingredient) - OPTIMIZED WITH SQL
  static async getAllStock(userId: string): Promise<StockSummary[]> {
    // Get all ingredients
    const allIngredients = await db
      .select()
      .from(ingredients)
      .where(eq(ingredients.userId, userId));
    if (allIngredients.length === 0) return [];

    // Use SQL to calculate remaining quantities with aggregations
    // This is much faster than doing it in JavaScript
    const stockWithRemaining = await db
      .select({
        ingredientId: ingredientStock.ingredientId,
        storageLocationId: ingredientStock.storageLocationId,
        originalQuantity: ingredientStock.quantity,
        totalUsed: sql<string>`COALESCE(SUM(${usageHistory.quantityUsed}), 0)`,
        totalSpoiled: sql<string>`COALESCE(SUM(${spoilageRecords.quantity}), 0)`,
      })
      .from(ingredientStock)
      .leftJoin(
        usageHistory,
        eq(usageHistory.ingredientStockId, ingredientStock.id)
      )
      .leftJoin(
        spoilageRecords,
        eq(spoilageRecords.ingredientStockId, ingredientStock.id)
      )
      .where(eq(ingredientStock.userId, userId))
      .groupBy(
        ingredientStock.id,
        ingredientStock.ingredientId,
        ingredientStock.storageLocationId,
        ingredientStock.quantity
      );

    // Get all storage locations
    const allLocations = await db
      .select()
      .from(storageLocations)
      .where(eq(storageLocations.userId, userId));
    const locationMap = new Map(allLocations.map((loc) => [loc.id, loc.name]));

    // Group by ingredient and location, calculating remaining in JavaScript (minimal work)
    const stockByIngredient = new Map<
      string,
      Map<string, { remaining: number }>
    >();

    for (const stock of stockWithRemaining) {
      const originalQty = parseFloat(stock.originalQuantity);
      const used = parseFloat(stock.totalUsed);
      const spoiled = parseFloat(stock.totalSpoiled);
      const remaining = Math.max(0, originalQty - used - spoiled);

      if (remaining <= 0) continue; // Skip zero/negative stock

      if (!stockByIngredient.has(stock.ingredientId)) {
        stockByIngredient.set(stock.ingredientId, new Map());
      }
      const ingredientStock = stockByIngredient.get(stock.ingredientId)!;

      if (!ingredientStock.has(stock.storageLocationId)) {
        ingredientStock.set(stock.storageLocationId, { remaining: 0 });
      }
      const locationStock = ingredientStock.get(stock.storageLocationId)!;
      locationStock.remaining += remaining;
    }

    // Build summaries
    const summaries: StockSummary[] = [];
    for (const ingredient of allIngredients) {
      const ingredientStock = stockByIngredient.get(ingredient.id);
      if (!ingredientStock) {
        summaries.push({
          ingredientId: ingredient.id,
          ingredientName: ingredient.name,
          totalStock: "0.00",
          locations: [],
        });
        continue;
      }

      let totalStock = 0;
      const locations: Array<{
        locationId: string;
        locationName: string;
        quantity: string;
      }> = [];

      for (const [locationId, stock] of ingredientStock.entries()) {
        if (stock.remaining > 0) {
          totalStock += stock.remaining;
          locations.push({
            locationId,
            locationName: locationMap.get(locationId) || "Unknown",
            quantity: stock.remaining.toFixed(2),
          });
        }
      }

      summaries.push({
        ingredientId: ingredient.id,
        ingredientName: ingredient.name,
        totalStock: totalStock.toFixed(2),
        locations,
      });
    }

    return summaries;
  }

  // Get stock for a specific ingredient
  static async getIngredientStock(
    ingredientId: string,
    userId: string
  ): Promise<IngredientStockDetail[]> {
    // Verify ingredient exists
    const [ingredient] = await db
      .select()
      .from(ingredients)
      .where(
        and(eq(ingredients.id, ingredientId), eq(ingredients.userId, userId))
      )
      .limit(1);
    if (!ingredient) {
      throw new Error("Ingredient not found");
    }

    const stockEntries = await db
      .select({
        id: ingredientStock.id,
        ingredientId: ingredientStock.ingredientId,
        quantity: ingredientStock.quantity,
        batchNumber: ingredientStock.batchNumber,
        expirationDate: ingredientStock.expirationDate,
        purchaseDate: ingredientStock.purchaseDate,
        purchasePrice: ingredientStock.purchasePrice,
        ingredientId2: ingredients.id,
        ingredientName: ingredients.name,
        unitId: units.id,
        unitName: units.name,
        locationId: storageLocations.id,
        locationName: storageLocations.name,
        locationDescription: storageLocations.description,
        supplierId: suppliers.id,
        supplierName: suppliers.name,
      })
      .from(ingredientStock)
      .innerJoin(ingredients, eq(ingredientStock.ingredientId, ingredients.id))
      .innerJoin(units, eq(ingredients.unitId, units.id))
      .innerJoin(
        storageLocations,
        eq(ingredientStock.storageLocationId, storageLocations.id)
      )
      .innerJoin(suppliers, eq(ingredientStock.supplierId, suppliers.id))
      .where(
        and(
          eq(ingredientStock.ingredientId, ingredientId),
          eq(ingredientStock.userId, userId)
        )
      )
      .orderBy(desc(ingredientStock.purchaseDate));

    // Calculate remaining quantity for each entry
    const details: IngredientStockDetail[] = [];
    for (const entry of stockEntries) {
      const remainingQuantity = await this.calculateRemainingQuantity(
        entry.id,
        userId
      );
      details.push({
        id: entry.id,
        ingredientId: entry.ingredientId,
        ingredient: {
          id: entry.ingredientId2,
          name: entry.ingredientName,
          unit: {
            id: entry.unitId,
            name: entry.unitName,
          },
        },
        storageLocation: {
          id: entry.locationId,
          name: entry.locationName,
          description: entry.locationDescription,
        },
        quantity: entry.quantity,
        remainingQuantity,
        batchNumber: entry.batchNumber,
        expirationDate: entry.expirationDate
          ? String(entry.expirationDate).split("T")[0]
          : null,
        purchaseDate: String(entry.purchaseDate).split("T")[0],
        purchasePrice: entry.purchasePrice,
        supplier: {
          id: entry.supplierId,
          name: entry.supplierName,
        },
      });
    }

    return details;
  }

  // Get usage history
  static async getUsageHistory(
    userId: string,
    params?: {
      startDate?: string;
      endDate?: string;
      ingredientId?: string;
    }
  ) {
    const conditions: any[] = [eq(ingredientStock.userId, userId)];
    if (params?.startDate) {
      conditions.push(gte(usageHistory.date, params.startDate));
    }
    if (params?.endDate) {
      conditions.push(lte(usageHistory.date, params.endDate));
    }
    if (params?.ingredientId) {
      conditions.push(eq(ingredients.id, params.ingredientId));
    }

    let query = db
      .select({
        id: usageHistory.id,
        date: usageHistory.date,
        quantityUsed: usageHistory.quantityUsed,
        reason: usageHistory.reason,
        notes: usageHistory.notes,
        stockId: ingredientStock.id,
        ingredientId: ingredients.id,
        ingredientName: ingredients.name,
      })
      .from(usageHistory)
      .innerJoin(
        ingredientStock,
        eq(usageHistory.ingredientStockId, ingredientStock.id)
      )
      .innerJoin(ingredients, eq(ingredientStock.ingredientId, ingredients.id));

    query = query.where(and(...conditions)) as any;

    const results = await query.orderBy(desc(usageHistory.date));

    // Map to expected format
    return results.map((row) => ({
      id: row.id,
      date: row.date,
      quantityUsed: row.quantityUsed,
      reason: row.reason,
      notes: row.notes,
      ingredientStock: {
        id: row.stockId,
        ingredient: {
          id: row.ingredientId,
          name: row.ingredientName,
        },
      },
    }));
  }

  // Get items expiring soon - OPTIMIZED VERSION
  static async getExpiringItems(userId: string, days: number = 7) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const futureDate = new Date();
    futureDate.setDate(today.getDate() + days);
    futureDate.setHours(23, 59, 59, 999);

    // Get items that expire within the next N days (including today and expired items)
    const expiringItems = await db
      .select({
        id: ingredientStock.id,
        expirationDate: ingredientStock.expirationDate,
        quantity: ingredientStock.quantity,
        ingredient: {
          id: ingredients.id,
          name: ingredients.name,
        },
        storageLocation: {
          id: storageLocations.id,
          name: storageLocations.name,
        },
      })
      .from(ingredientStock)
      .innerJoin(ingredients, eq(ingredientStock.ingredientId, ingredients.id))
      .innerJoin(
        storageLocations,
        eq(ingredientStock.storageLocationId, storageLocations.id)
      )
      .where(
        and(
          eq(ingredientStock.userId, userId),
          sql`${ingredientStock.expirationDate} IS NOT NULL`,
          lte(
            ingredientStock.expirationDate,
            futureDate.toISOString().split("T")[0]
          )
        )
      )
      .orderBy(ingredientStock.expirationDate);

    if (expiringItems.length === 0) return [];

    // OPTIMIZED: Get ALL usage and spoilage in batch queries
    const stockIds = expiringItems.map((item) => item.id);

    const allUsage = await db
      .select({
        ingredientStockId: usageHistory.ingredientStockId,
        totalUsed: sql<string>`COALESCE(SUM(${usageHistory.quantityUsed}), 0)`,
      })
      .from(usageHistory)
      .where(inArray(usageHistory.ingredientStockId, stockIds))
      .groupBy(usageHistory.ingredientStockId);

    const allSpoilage = await db
      .select({
        ingredientStockId: spoilageRecords.ingredientStockId,
        totalSpoiled: sql<string>`COALESCE(SUM(${spoilageRecords.quantity}), 0)`,
      })
      .from(spoilageRecords)
      .where(inArray(spoilageRecords.ingredientStockId, stockIds))
      .groupBy(spoilageRecords.ingredientStockId);

    // Create maps for quick lookup
    const usageMap = new Map(
      allUsage.map((u) => [u.ingredientStockId, parseFloat(u.totalUsed)])
    );
    const spoilageMap = new Map(
      allSpoilage.map((s) => [s.ingredientStockId, parseFloat(s.totalSpoiled)])
    );

    // Calculate remaining quantity for each (using maps, no DB queries!)
    const items = [];
    for (const item of expiringItems) {
      const quantity = parseFloat(item.quantity);
      const used = usageMap.get(item.id) || 0;
      const spoiled = spoilageMap.get(item.id) || 0;
      const remaining = Math.max(0, quantity - used - spoiled);

      if (remaining > 0) {
        items.push({
          ...item,
          remainingQuantity: remaining.toFixed(2),
        });
      }
    }

    return items;
  }

  // OPTIMIZED: Batch calculate remaining quantities for multiple stock entries
  static async batchCalculateRemainingQuantities(
    stockIds: string[],
    userId: string
  ): Promise<Map<string, string>> {
    if (stockIds.length === 0) {
      return new Map();
    }

    // Get all stock entries in one query
    const stockEntries = await db
      .select({
        id: ingredientStock.id,
        quantity: ingredientStock.quantity,
      })
      .from(ingredientStock)
      .where(
        and(
          inArray(ingredientStock.id, stockIds),
          eq(ingredientStock.userId, userId)
        )
      );

    if (stockEntries.length === 0) {
      return new Map();
    }

    // Get ALL usage in one batch query
    const allUsage = await db
      .select({
        ingredientStockId: usageHistory.ingredientStockId,
        totalUsed: sql<string>`COALESCE(SUM(${usageHistory.quantityUsed}), 0)`,
      })
      .from(usageHistory)
      .innerJoin(
        ingredientStock,
        eq(usageHistory.ingredientStockId, ingredientStock.id)
      )
      .where(
        and(
          inArray(usageHistory.ingredientStockId, stockIds),
          eq(ingredientStock.userId, userId)
        )
      )
      .groupBy(usageHistory.ingredientStockId);

    // Get ALL spoilage in one batch query
    const allSpoilage = await db
      .select({
        ingredientStockId: spoilageRecords.ingredientStockId,
        totalSpoiled: sql<string>`COALESCE(SUM(${spoilageRecords.quantity}), 0)`,
      })
      .from(spoilageRecords)
      .innerJoin(
        ingredientStock,
        eq(spoilageRecords.ingredientStockId, ingredientStock.id)
      )
      .where(
        and(
          inArray(spoilageRecords.ingredientStockId, stockIds),
          eq(ingredientStock.userId, userId)
        )
      )
      .groupBy(spoilageRecords.ingredientStockId);

    // Create maps for quick lookup
    const usageMap = new Map(
      allUsage.map((u) => [u.ingredientStockId, parseFloat(u.totalUsed)])
    );
    const spoilageMap = new Map(
      allSpoilage.map((s) => [s.ingredientStockId, parseFloat(s.totalSpoiled)])
    );

    // Calculate remaining quantity for each (using maps, no DB queries!)
    const result = new Map<string, string>();
    for (const stock of stockEntries) {
      const quantity = parseFloat(stock.quantity);
      const used = usageMap.get(stock.id) || 0;
      const spoiled = spoilageMap.get(stock.id) || 0;
      const remaining = Math.max(0, quantity - used - spoiled);
      result.set(stock.id, remaining.toFixed(2));
    }

    return result;
  }

  // OPTIMIZED: Get stock for multiple ingredients with remaining quantities
  static async batchGetIngredientStock(
    ingredientIds: string[],
    userId: string
  ): Promise<Map<string, IngredientStockDetail[]>> {
    if (ingredientIds.length === 0) {
      return new Map();
    }

    // Get all stock entries for all ingredients in one query
    const stockEntries = await db
      .select({
        id: ingredientStock.id,
        ingredientId: ingredientStock.ingredientId,
        quantity: ingredientStock.quantity,
        batchNumber: ingredientStock.batchNumber,
        expirationDate: ingredientStock.expirationDate,
        purchaseDate: ingredientStock.purchaseDate,
        purchasePrice: ingredientStock.purchasePrice,
        ingredientId2: ingredients.id,
        ingredientName: ingredients.name,
        unitId: units.id,
        unitName: units.name,
        locationId: storageLocations.id,
        locationName: storageLocations.name,
        locationDescription: storageLocations.description,
        supplierId: suppliers.id,
        supplierName: suppliers.name,
      })
      .from(ingredientStock)
      .innerJoin(ingredients, eq(ingredientStock.ingredientId, ingredients.id))
      .innerJoin(units, eq(ingredients.unitId, units.id))
      .innerJoin(
        storageLocations,
        eq(ingredientStock.storageLocationId, storageLocations.id)
      )
      .innerJoin(suppliers, eq(ingredientStock.supplierId, suppliers.id))
      .where(
        and(
          inArray(ingredientStock.ingredientId, ingredientIds),
          eq(ingredientStock.userId, userId)
        )
      )
      .orderBy(desc(ingredientStock.purchaseDate));

    if (stockEntries.length === 0) {
      return new Map();
    }

    // Batch calculate remaining quantities
    const stockIds = stockEntries.map((e) => e.id);
    const remainingQuantities = await this.batchCalculateRemainingQuantities(
      stockIds,
      userId
    );

    // Group by ingredient ID
    const result = new Map<string, IngredientStockDetail[]>();
    for (const entry of stockEntries) {
      if (!result.has(entry.ingredientId)) {
        result.set(entry.ingredientId, []);
      }

      const remaining = remainingQuantities.get(entry.id) || "0.00";
      result.get(entry.ingredientId)!.push({
        id: entry.id,
        ingredientId: entry.ingredientId,
        ingredient: {
          id: entry.ingredientId2,
          name: entry.ingredientName,
          unit: {
            id: entry.unitId,
            name: entry.unitName,
          },
        },
        storageLocation: {
          id: entry.locationId,
          name: entry.locationName,
          description: entry.locationDescription,
        },
        quantity: entry.quantity,
        remainingQuantity: remaining,
        batchNumber: entry.batchNumber,
        expirationDate: entry.expirationDate
          ? String(entry.expirationDate).split("T")[0]
          : null,
        purchaseDate: String(entry.purchaseDate).split("T")[0],
        purchasePrice: entry.purchasePrice,
        supplier: {
          id: entry.supplierId,
          name: entry.supplierName,
        },
      });
    }

    return result;
  }

  // OPTIMIZED: Batch record usage in a single transaction
  static async batchRecordUsage(
    usages: Array<{
      ingredientStockId: string;
      quantityUsed: number;
      date: string;
      reason?: string;
      notes?: string;
    }>,
    userId: string
  ): Promise<void> {
    if (usages.length === 0) {
      return;
    }

    // Get all stock IDs
    const stockIds = [...new Set(usages.map((u) => u.ingredientStockId))];

    // Batch calculate remaining quantities
    const remainingQuantities = await this.batchCalculateRemainingQuantities(
      stockIds,
      userId
    );

    // Validate all usages before inserting
    const usageRecords = [];
    for (const usage of usages) {
      const remaining = parseFloat(remainingQuantities.get(usage.ingredientStockId) || "0");
      if (remaining < usage.quantityUsed) {
        throw new Error(
          `Insufficient stock available for stock ID ${usage.ingredientStockId}`
        );
      }

      usageRecords.push({
        ingredientStockId: usage.ingredientStockId,
        quantityUsed: usage.quantityUsed.toString(),
        date: usage.date,
        reason: usage.reason || null,
        notes: usage.notes || null,
      });
    }

    // Insert all usage records in one transaction
    await db.insert(usageHistory).values(usageRecords);

    // Trigger analytics recalculation (async)
    const ingredientIds = new Set<string>();
    const stockEntries = await db
      .select({
        ingredientId: ingredientStock.ingredientId,
      })
      .from(ingredientStock)
      .where(
        and(
          inArray(ingredientStock.id, stockIds),
          eq(ingredientStock.userId, userId)
        )
      );

    for (const entry of stockEntries) {
      ingredientIds.add(entry.ingredientId);
    }

    setImmediate(async () => {
      try {
        await InventoryAnalyticsService.saveDailySnapshot(userId);
        for (const ingredientId of ingredientIds) {
          await InventoryAnalyticsService.updateIngredientAnalytics(
            ingredientId,
            userId
          );
        }
      } catch (error) {
        console.error("Error updating analytics after batch usage:", error);
      }
    });
  }
}
