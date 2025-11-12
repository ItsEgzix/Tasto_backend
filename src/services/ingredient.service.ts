import { db } from "../db";
import {
  ingredients,
  categories,
  units,
  ingredientStock,
  usageHistory,
  spoilageRecords,
  storageLocations,
  suppliers,
} from "../db/schema";
import { eq, sql, inArray } from "drizzle-orm";

export interface IngredientWithDetails {
  id: string;
  name: string;
  category: {
    id: string;
    name: string;
    description: string | null;
    color: string | null;
  };
  unit: {
    id: string;
    name: string;
    type: string;
    symbol: string | null;
    description: string | null;
  };
  restockThreshold: string;
  currentStock: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class IngredientService {
  // Calculate current stock for an ingredient
  private static async calculateCurrentStock(
    ingredientId: string
  ): Promise<string | null> {
    try {
      // Check if any stock records exist for this ingredient first
      const stockExists = await db
        .select({ count: sql<number>`count(*)` })
        .from(ingredientStock)
        .where(eq(ingredientStock.ingredientId, ingredientId));

      // If no stock records exist, return 0
      if (!stockExists[0] || Number(stockExists[0].count) === 0) {
        return "0.00";
      }

      // Get total purchased quantity
      const purchasedResult = await db
        .select({
          total: sql<string>`COALESCE(SUM(${ingredientStock.quantity}), 0)`,
        })
        .from(ingredientStock)
        .where(eq(ingredientStock.ingredientId, ingredientId));

      const totalPurchased = purchasedResult[0]?.total ?? "0";

      // Get total used quantity
      const usedResult = await db
        .select({
          total: sql<string>`COALESCE(SUM(${usageHistory.quantityUsed}), 0)`,
        })
        .from(usageHistory)
        .innerJoin(
          ingredientStock,
          eq(usageHistory.ingredientStockId, ingredientStock.id)
        )
        .where(eq(ingredientStock.ingredientId, ingredientId));

      const totalUsed = usedResult[0]?.total ?? "0";

      // Get total spoiled quantity
      const spoiledResult = await db
        .select({
          total: sql<string>`COALESCE(SUM(${spoilageRecords.quantity}), 0)`,
        })
        .from(spoilageRecords)
        .innerJoin(
          ingredientStock,
          eq(spoilageRecords.ingredientStockId, ingredientStock.id)
        )
        .where(eq(ingredientStock.ingredientId, ingredientId));

      const totalSpoiled = spoiledResult[0]?.total ?? "0";

      // Calculate current stock: purchased - used - spoiled
      const purchased = parseFloat(String(totalPurchased)) || 0;
      const used = parseFloat(String(totalUsed)) || 0;
      const spoiled = parseFloat(String(totalSpoiled)) || 0;
      const currentStock = purchased - used - spoiled;

      return currentStock > 0 ? currentStock.toFixed(2) : "0.00";
    } catch (error) {
      // If there's an error (e.g., no stock records exist yet, table doesn't exist), return 0
      console.error("Error calculating current stock:", error);
      return "0.00";
    }
  }

  static async getAllIngredients(): Promise<IngredientWithDetails[]> {
    const result = await db
      .select({
        id: ingredients.id,
        name: ingredients.name,
        categoryId: ingredients.categoryId,
        unitId: ingredients.unitId,
        restockThreshold: ingredients.restockThreshold,
        createdAt: ingredients.createdAt,
        updatedAt: ingredients.updatedAt,
        category: {
          id: categories.id,
          name: categories.name,
          description: categories.description,
          color: categories.color,
        },
        unit: {
          id: units.id,
          name: units.name,
          type: units.type,
          symbol: units.symbol,
          description: units.description,
        },
      })
      .from(ingredients)
      .leftJoin(categories, eq(ingredients.categoryId, categories.id))
      .leftJoin(units, eq(ingredients.unitId, units.id));

    if (result.length === 0) return [];

    // OPTIMIZED: Calculate all stock in batch queries
    const ingredientIds = result.map((r) => r.id);

    // Get all stock entries for all ingredients
    const allStock = await db
      .select({
        ingredientId: ingredientStock.ingredientId,
        quantity: ingredientStock.quantity,
      })
      .from(ingredientStock)
      .where(inArray(ingredientStock.ingredientId, ingredientIds));

    // Get all usage grouped by ingredient
    const allUsage = await db
      .select({
        ingredientId: ingredientStock.ingredientId,
        totalUsed: sql<string>`COALESCE(SUM(${usageHistory.quantityUsed}), 0)`,
      })
      .from(usageHistory)
      .innerJoin(
        ingredientStock,
        eq(usageHistory.ingredientStockId, ingredientStock.id)
      )
      .where(inArray(ingredientStock.ingredientId, ingredientIds))
      .groupBy(ingredientStock.ingredientId);

    // Get all spoilage grouped by ingredient
    const allSpoilage = await db
      .select({
        ingredientId: ingredientStock.ingredientId,
        totalSpoiled: sql<string>`COALESCE(SUM(${spoilageRecords.quantity}), 0)`,
      })
      .from(spoilageRecords)
      .innerJoin(
        ingredientStock,
        eq(spoilageRecords.ingredientStockId, ingredientStock.id)
      )
      .where(inArray(ingredientStock.ingredientId, ingredientIds))
      .groupBy(ingredientStock.ingredientId);

    // Create maps for quick lookup
    const stockMap = new Map<string, number>();
    for (const stock of allStock) {
      const current = stockMap.get(stock.ingredientId) || 0;
      stockMap.set(stock.ingredientId, current + parseFloat(stock.quantity));
    }

    const usageMap = new Map(
      allUsage.map((u) => [u.ingredientId, parseFloat(u.totalUsed)])
    );
    const spoilageMap = new Map(
      allSpoilage.map((s) => [s.ingredientId, parseFloat(s.totalSpoiled)])
    );

    // Build result with calculated stock
    const ingredientsWithStock = result.map((item) => {
      const purchased = stockMap.get(item.id) || 0;
      const used = usageMap.get(item.id) || 0;
      const spoiled = spoilageMap.get(item.id) || 0;
      const currentStock = Math.max(0, purchased - used - spoiled);

      return {
        id: item.id,
        name: item.name,
        category: item.category!,
        unit: item.unit!,
        restockThreshold: item.restockThreshold,
        currentStock: currentStock > 0 ? currentStock.toFixed(2) : "0.00",
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      };
    });

    return ingredientsWithStock;
  }

  static async getIngredientById(
    id: string
  ): Promise<IngredientWithDetails | null> {
    const [result] = await db
      .select({
        id: ingredients.id,
        name: ingredients.name,
        categoryId: ingredients.categoryId,
        unitId: ingredients.unitId,
        restockThreshold: ingredients.restockThreshold,
        createdAt: ingredients.createdAt,
        updatedAt: ingredients.updatedAt,
        category: {
          id: categories.id,
          name: categories.name,
          description: categories.description,
          color: categories.color,
        },
        unit: {
          id: units.id,
          name: units.name,
          type: units.type,
          symbol: units.symbol,
          description: units.description,
        },
      })
      .from(ingredients)
      .leftJoin(categories, eq(ingredients.categoryId, categories.id))
      .leftJoin(units, eq(ingredients.unitId, units.id))
      .where(eq(ingredients.id, id))
      .limit(1);

    if (!result) {
      return null;
    }

    const currentStock = await this.calculateCurrentStock(result.id);

    return {
      id: result.id,
      name: result.name,
      category: result.category!,
      unit: result.unit!,
      restockThreshold: result.restockThreshold,
      currentStock,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
    };
  }

  static async createIngredient(data: {
    name: string;
    categoryId: string;
    unitId: string;
    restockThreshold?: number;
  }): Promise<IngredientWithDetails> {
    const [existing] = await db
      .select()
      .from(ingredients)
      .where(eq(ingredients.name, data.name))
      .limit(1);

    if (existing) {
      throw new Error("Ingredient with this name already exists");
    }

    const [category] = await db
      .select()
      .from(categories)
      .where(eq(categories.id, data.categoryId))
      .limit(1);

    if (!category) {
      throw new Error("Category not found");
    }

    const [unit] = await db
      .select()
      .from(units)
      .where(eq(units.id, data.unitId))
      .limit(1);

    if (!unit) {
      throw new Error("Unit not found");
    }

    const [newIngredient] = await db
      .insert(ingredients)
      .values({
        name: data.name,
        categoryId: data.categoryId,
        unitId: data.unitId,
        restockThreshold: data.restockThreshold?.toString() || "0",
      })
      .returning();

    const ingredient = await this.getIngredientById(newIngredient.id);
    if (!ingredient) {
      throw new Error("Failed to create ingredient");
    }

    return ingredient;
  }

  static async updateIngredient(
    id: string,
    data: {
      name?: string;
      categoryId?: string;
      unitId?: string;
      restockThreshold?: number;
    }
  ): Promise<IngredientWithDetails> {
    const [existing] = await db
      .select()
      .from(ingredients)
      .where(eq(ingredients.id, id))
      .limit(1);

    if (!existing) {
      throw new Error("Ingredient not found");
    }

    if (data.name && data.name !== existing.name) {
      const [nameConflict] = await db
        .select()
        .from(ingredients)
        .where(eq(ingredients.name, data.name))
        .limit(1);

      if (nameConflict) {
        throw new Error("Ingredient with this name already exists");
      }
    }

    if (data.categoryId) {
      const [category] = await db
        .select()
        .from(categories)
        .where(eq(categories.id, data.categoryId))
        .limit(1);

      if (!category) {
        throw new Error("Category not found");
      }
    }

    if (data.unitId) {
      const [unit] = await db
        .select()
        .from(units)
        .where(eq(units.id, data.unitId))
        .limit(1);

      if (!unit) {
        throw new Error("Unit not found");
      }
    }

    const updateData: {
      name?: string;
      categoryId?: string;
      unitId?: string;
      restockThreshold?: string;
      updatedAt?: Date;
    } = {
      updatedAt: new Date(),
    };

    if (data.name) updateData.name = data.name;
    if (data.categoryId) updateData.categoryId = data.categoryId;
    if (data.unitId) updateData.unitId = data.unitId;
    if (data.restockThreshold !== undefined) {
      updateData.restockThreshold = data.restockThreshold.toString();
    }

    await db.update(ingredients).set(updateData).where(eq(ingredients.id, id));

    const ingredient = await this.getIngredientById(id);
    if (!ingredient) {
      throw new Error("Failed to update ingredient");
    }

    return ingredient;
  }

  static async deleteIngredient(id: string): Promise<void> {
    const [existing] = await db
      .select()
      .from(ingredients)
      .where(eq(ingredients.id, id))
      .limit(1);

    if (!existing) {
      throw new Error("Ingredient not found");
    }

    await db.delete(ingredients).where(eq(ingredients.id, id));
  }

  // Get stock levels across locations
  static async getIngredientStock(id: string): Promise<any[]> {
    // First get the ingredient info
    const [ingredient] = await db
      .select({
        id: ingredients.id,
        name: ingredients.name,
        unit: {
          id: units.id,
          name: units.name,
        },
      })
      .from(ingredients)
      .leftJoin(units, eq(ingredients.unitId, units.id))
      .where(eq(ingredients.id, id))
      .limit(1);

    if (!ingredient) {
      throw new Error("Ingredient not found");
    }

    const stockRecords = await db
      .select({
        id: ingredientStock.id,
        ingredientId: ingredientStock.ingredientId,
        storageLocation: {
          id: storageLocations.id,
          name: storageLocations.name,
          description: storageLocations.description,
        },
        quantity: ingredientStock.quantity,
        batchNumber: ingredientStock.batchNumber,
        expirationDate: ingredientStock.expirationDate,
        purchaseDate: ingredientStock.purchaseDate,
        purchasePrice: ingredientStock.purchasePrice,
        supplier: {
          id: suppliers.id,
          name: suppliers.name,
        },
      })
      .from(ingredientStock)
      .leftJoin(
        storageLocations,
        eq(ingredientStock.storageLocationId, storageLocations.id)
      )
      .leftJoin(suppliers, eq(ingredientStock.supplierId, suppliers.id))
      .where(eq(ingredientStock.ingredientId, id));

    // Calculate remaining quantity for each stock record
    const stockWithRemaining = await Promise.all(
      stockRecords.map(async (stock) => {
        // Get total used from this stock record
        const usedResult = await db
          .select({
            total: sql<string>`COALESCE(SUM(${usageHistory.quantityUsed}), 0)`,
          })
          .from(usageHistory)
          .where(eq(usageHistory.ingredientStockId, stock.id));

        const totalUsed = parseFloat(usedResult[0]?.total || "0");

        // Get total spoiled from this stock record
        const spoiledResult = await db
          .select({
            total: sql<string>`COALESCE(SUM(${spoilageRecords.quantity}), 0)`,
          })
          .from(spoilageRecords)
          .where(eq(spoilageRecords.ingredientStockId, stock.id));

        const totalSpoiled = parseFloat(spoiledResult[0]?.total || "0");

        const remaining = parseFloat(stock.quantity) - totalUsed - totalSpoiled;

        return {
          ...stock,
          ingredient: {
            id: ingredient.id,
            name: ingredient.name,
            unit: ingredient.unit,
          },
          remainingQuantity: remaining > 0 ? remaining.toFixed(2) : "0.00",
        };
      })
    );

    return stockWithRemaining;
  }
}
