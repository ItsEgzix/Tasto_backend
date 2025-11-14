import { db } from "../db";
import {
  ingredientStock,
  ingredients,
  suppliers,
  categories,
  dailyInventorySnapshots,
  ingredientAnalytics,
  usageHistory,
  spoilageRecords,
} from "../db/schema";
import { eq, sql, inArray, desc, and, gte, lte } from "drizzle-orm";

export class InventoryAnalyticsService {
  /**
   * Calculate overall statistics for today
   * Called when purchase/usage/spoilage happens
   */
  static async calculateOverallStatistics(userId: string): Promise<{
    totalValue: number;
    remainingValue: number;
    totalPurchases: number;
    totalIngredients: number;
    lowStockCount: number;
    ingredientStats: Array<{
      ingredientId: string;
      name: string;
      totalValue: number;
      remainingValue: number;
      purchaseCount: number;
    }>;
    supplierStats: Array<{
      supplierId: string;
      name: string;
      averagePricePerUnit: number;
      totalPurchases: number;
      totalSpent: number;
    }>;
    categoryDistribution: Array<{
      categoryName: string;
      categoryColor: string;
      totalStock: number;
    }>;
  }> {
    // Get all stock entries with related data
    const allStock = await db
      .select({
        id: ingredientStock.id,
        ingredientId: ingredientStock.ingredientId,
        quantity: ingredientStock.quantity,
        purchasePrice: ingredientStock.purchasePrice,
        supplierId: ingredientStock.supplierId,
        ingredientName: ingredients.name,
        supplierName: suppliers.name,
        categoryName: categories.name,
        categoryColor: categories.color,
        restockThreshold: ingredients.restockThreshold,
      })
      .from(ingredientStock)
      .innerJoin(ingredients, eq(ingredientStock.ingredientId, ingredients.id))
      .innerJoin(suppliers, eq(ingredientStock.supplierId, suppliers.id))
      .leftJoin(categories, eq(ingredients.categoryId, categories.id))
      .where(eq(ingredientStock.userId, userId));

    let totalValue = 0;
    let remainingValue = 0;
    let totalPurchases = 0;
    const ingredientMap = new Map<
      string,
      {
        ingredientId: string;
        name: string;
        totalValue: number;
        remainingValue: number;
        remainingQuantity: number; // Track quantity for low stock check
        purchaseCount: number;
        restockThreshold: number | null;
      }
    >();
    const supplierMap = new Map<
      string,
      {
        supplierId: string;
        name: string;
        totalPrice: number;
        totalQuantity: number;
        purchaseCount: number;
      }
    >();
    const categoryMap = new Map<
      string,
      {
        categoryName: string;
        categoryColor: string;
        totalStock: number;
      }
    >();
    const lowStockIngredients = new Set<string>();

    // OPTIMIZED: Get ALL usage and spoilage in batch queries
    if (allStock.length === 0) {
      return {
        totalValue: 0,
        remainingValue: 0,
        totalPurchases: 0,
        totalIngredients: 0,
        lowStockCount: 0,
        ingredientStats: [],
        supplierStats: [],
        categoryDistribution: [],
      };
    }

    const stockIds = allStock.map((s) => s.id);

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

    // Calculate remaining quantity for each stock entry (using maps, no DB queries!)
    for (const stock of allStock) {
      const quantity = parseFloat(stock.quantity);
      const pricePerUnit = parseFloat(stock.purchasePrice) / quantity;

      // Calculate remaining using the maps (no database queries!)
      const used = usageMap.get(stock.id) || 0;
      const spoiled = spoilageMap.get(stock.id) || 0;
      const remainingQty = Math.max(0, quantity - used - spoiled);
      const validRemaining = Math.min(remainingQty, quantity);

      // Overall values
      totalValue += quantity * pricePerUnit;
      remainingValue += validRemaining * pricePerUnit;
      totalPurchases += 1;

      // Per-ingredient stats
      if (!ingredientMap.has(stock.ingredientId)) {
        ingredientMap.set(stock.ingredientId, {
          ingredientId: stock.ingredientId,
          name: stock.ingredientName,
          totalValue: 0,
          remainingValue: 0,
          remainingQuantity: 0,
          purchaseCount: 0,
          restockThreshold: stock.restockThreshold
            ? parseFloat(stock.restockThreshold)
            : null,
        });
      }
      const ing = ingredientMap.get(stock.ingredientId)!;
      ing.totalValue += quantity * pricePerUnit;
      ing.remainingValue += validRemaining * pricePerUnit;
      ing.remainingQuantity += validRemaining; // Track total remaining quantity
      ing.purchaseCount += 1;

      // Per-supplier stats
      if (!supplierMap.has(stock.supplierId)) {
        supplierMap.set(stock.supplierId, {
          supplierId: stock.supplierId,
          name: stock.supplierName,
          totalPrice: 0,
          totalQuantity: 0,
          purchaseCount: 0,
        });
      }
      const sup = supplierMap.get(stock.supplierId)!;
      sup.totalPrice += parseFloat(stock.purchasePrice);
      sup.totalQuantity += quantity;
      sup.purchaseCount += 1;

      // Category distribution
      if (stock.categoryName) {
        if (!categoryMap.has(stock.categoryName)) {
          categoryMap.set(stock.categoryName, {
            categoryName: stock.categoryName,
            categoryColor: stock.categoryColor || "#5B5FEF",
            totalStock: 0,
          });
        }
        const cat = categoryMap.get(stock.categoryName)!;
        cat.totalStock += validRemaining;
      }

      // Low stock check will be done after the loop using ingredientMap
    }

    // Check low stock for all ingredients (using already calculated data)
    for (const ing of ingredientMap.values()) {
      if (
        ing.restockThreshold &&
        ing.remainingQuantity < ing.restockThreshold
      ) {
        lowStockIngredients.add(ing.ingredientId);
      }
    }

    // Get unique ingredients count
    const uniqueIngredients = await db
      .select({ count: sql<number>`COUNT(DISTINCT ${ingredients.id})` })
      .from(ingredients)
      .where(eq(ingredients.userId, userId));

    // Format supplier stats with average price
    const supplierStats = Array.from(supplierMap.values()).map((s) => ({
      supplierId: s.supplierId,
      name: s.name,
      averagePricePerUnit:
        s.totalQuantity > 0 ? s.totalPrice / s.totalQuantity : 0,
      totalPurchases: s.purchaseCount,
      totalSpent: s.totalPrice,
    }));

    // Format ingredient stats (remove internal fields)
    const ingredientStats = Array.from(ingredientMap.values()).map((ing) => ({
      ingredientId: ing.ingredientId,
      name: ing.name,
      totalValue: ing.totalValue,
      remainingValue: ing.remainingValue,
      purchaseCount: ing.purchaseCount,
    }));

    return {
      totalValue,
      remainingValue,
      totalPurchases,
      totalIngredients: uniqueIngredients[0]?.count || 0,
      lowStockCount: lowStockIngredients.size,
      ingredientStats,
      supplierStats,
      categoryDistribution: Array.from(categoryMap.values()),
    };
  }

  /**
   * Calculate ingredient-specific analytics - OPTIMIZED VERSION
   */
  static async calculateIngredientAnalytics(
    ingredientId: string,
    userId: string
  ): Promise<{
    totalValue: number;
    remainingValue: number;
    averagePricePerUnit: number;
    totalPurchases: number;
    priceTrend: Array<{ date: string; averagePrice: number }>;
    stockValueTrend: Array<{
      date: string;
      totalValue: number;
      remainingValue: number;
    }>;
  }> {
    const [ingredient] = await db
      .select({ id: ingredients.id })
      .from(ingredients)
      .where(
        and(eq(ingredients.id, ingredientId), eq(ingredients.userId, userId))
      )
      .limit(1);

    if (!ingredient) {
      throw new Error("Ingredient not found");
    }

    // OPTIMIZED: Get stock entries, ordered by date (most recent first)
    const stockEntries = await db
      .select({
        id: ingredientStock.id,
        quantity: ingredientStock.quantity,
        purchasePrice: ingredientStock.purchasePrice,
        purchaseDate: ingredientStock.purchaseDate,
      })
      .from(ingredientStock)
      .where(
        and(
          eq(ingredientStock.ingredientId, ingredientId),
          eq(ingredientStock.userId, userId)
        )
      )
      .orderBy(desc(ingredientStock.purchaseDate));

    if (stockEntries.length === 0) {
      return {
        totalValue: 0,
        remainingValue: 0,
        averagePricePerUnit: 0,
        totalPurchases: 0,
        priceTrend: [],
        stockValueTrend: [],
      };
    }

    // OPTIMIZED: Get ALL usage and spoilage in batch queries
    const stockIds = stockEntries.map((s) => s.id);

    // Get all usage records grouped by stock ID
    const allUsage = await db
      .select({
        ingredientStockId: usageHistory.ingredientStockId,
        totalUsed: sql<string>`COALESCE(SUM(${usageHistory.quantityUsed}), 0)`,
      })
      .from(usageHistory)
      .where(inArray(usageHistory.ingredientStockId, stockIds))
      .groupBy(usageHistory.ingredientStockId);

    // Get all spoilage records grouped by stock ID
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

    let totalValue = 0;
    let remainingValue = 0;
    let totalPricePerUnit = 0;
    const purchaseCount = stockEntries.length;

    // Group purchases by date for price trends
    const purchaseDateMap = new Map<
      string,
      { prices: number[]; purchaseValue: number }
    >();

    // Track cumulative stock value over time
    // We'll build this by processing purchases chronologically
    const purchaseEvents: Array<{
      date: Date;
      pricePerUnit: number;
      quantity: number;
      purchaseValue: number;
      remainingQty: number;
      remainingValue: number;
    }> = [];

    for (const stock of stockEntries) {
      const quantity = parseFloat(stock.quantity);
      const pricePerUnit = parseFloat(stock.purchasePrice) / quantity;

      // Calculate remaining using the maps (no database queries!)
      const used = usageMap.get(stock.id) || 0;
      const spoiled = spoilageMap.get(stock.id) || 0;
      const remainingQty = Math.max(0, quantity - used - spoiled);
      const validRemaining = Math.min(remainingQty, quantity);

      totalValue += quantity * pricePerUnit;
      remainingValue += validRemaining * pricePerUnit;
      totalPricePerUnit += pricePerUnit;

      // Store purchase event for cumulative trend
      const purchaseDate = new Date(stock.purchaseDate);
      purchaseEvents.push({
        date: purchaseDate,
        pricePerUnit,
        quantity,
        purchaseValue: quantity * pricePerUnit,
        remainingQty: validRemaining,
        remainingValue: validRemaining * pricePerUnit,
      });

      // Group by date for price trends (average price per day)
      const dateStr = purchaseDate.toISOString().split("T")[0];
      if (!purchaseDateMap.has(dateStr)) {
        purchaseDateMap.set(dateStr, { prices: [], purchaseValue: 0 });
      }
      const dayData = purchaseDateMap.get(dateStr)!;
      dayData.prices.push(pricePerUnit);
      dayData.purchaseValue += quantity * pricePerUnit;
    }

    // Sort purchase events by date
    purchaseEvents.sort((a, b) => a.date.getTime() - b.date.getTime());

    // Build trends (last 90 days) - Show cumulative values over time
    const now = new Date();
    const ninetyDaysAgo = new Date(now);
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    ninetyDaysAgo.setHours(0, 0, 0, 0);

    const priceTrend: Array<{ date: string; averagePrice: number }> = [];
    const stockValueTrend: Array<{
      date: string;
      totalValue: number;
      remainingValue: number;
    }> = [];

    // Build price trend from purchase dates (average price per day)
    const sortedPurchaseDates = Array.from(purchaseDateMap.keys()).sort();
    for (const dateStr of sortedPurchaseDates) {
      const date = new Date(dateStr);
      if (date >= ninetyDaysAgo) {
        const dayData = purchaseDateMap.get(dateStr);
        if (dayData && dayData.prices.length > 0) {
          priceTrend.push({
            date: dateStr,
            averagePrice:
              dayData.prices.reduce((a, b) => a + b, 0) / dayData.prices.length,
          });
        }
      }
    }

    // Build cumulative stock value trend
    // Show value progression: start from first purchase, then add each subsequent purchase
    let cumulativeTotalValue = 0;
    let cumulativeRemainingValue = 0;
    const valueByDate = new Map<
      string,
      { totalValue: number; remainingValue: number }
    >();

    // Process purchases chronologically to build cumulative trend
    for (const event of purchaseEvents) {
      const eventDate = new Date(event.date);
      if (eventDate >= ninetyDaysAgo) {
        cumulativeTotalValue += event.purchaseValue;
        cumulativeRemainingValue += event.remainingValue;

        const dateStr = eventDate.toISOString().split("T")[0];
        // Store the cumulative value at this date
        valueByDate.set(dateStr, {
          totalValue: cumulativeTotalValue,
          remainingValue: cumulativeRemainingValue,
        });
      }
    }

    // Convert to array and fill gaps for better visualization
    // If we have purchases, show at least those dates
    const valueDates = Array.from(valueByDate.keys()).sort();

    if (valueDates.length > 0) {
      // Add data points for each purchase date
      for (const dateStr of valueDates) {
        const values = valueByDate.get(dateStr)!;
        stockValueTrend.push({
          date: dateStr,
          totalValue: values.totalValue,
          remainingValue: values.remainingValue,
        });
      }

      // If we only have one point, add a point 30 days before (if within range)
      // to show the trend better
      if (stockValueTrend.length === 1 && valueDates.length === 1) {
        const firstDate = new Date(valueDates[0]);
        const thirtyDaysBefore = new Date(firstDate);
        thirtyDaysBefore.setDate(thirtyDaysBefore.getDate() - 30);

        if (thirtyDaysBefore >= ninetyDaysAgo) {
          stockValueTrend.unshift({
            date: thirtyDaysBefore.toISOString().split("T")[0],
            totalValue: 0,
            remainingValue: 0,
          });
        }
      }
    }

    return {
      totalValue,
      remainingValue,
      averagePricePerUnit:
        purchaseCount > 0 ? totalPricePerUnit / purchaseCount : 0,
      totalPurchases: purchaseCount,
      priceTrend,
      stockValueTrend,
    };
  }

  /**
   * Calculate value trend over time from purchase/usage/spoilage data
   * Shows daily purchases and daily consumption
   */
  static async calculateValueTrend(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<Array<{ date: string; purchased: string; consumed: string }>> {
    // Get all stock entries with purchase dates within range
    const allStock = await db
      .select({
        id: ingredientStock.id,
        quantity: ingredientStock.quantity,
        purchasePrice: ingredientStock.purchasePrice,
        purchaseDate: ingredientStock.purchaseDate,
      })
      .from(ingredientStock)
      .where(
        and(
          eq(ingredientStock.userId, userId),
          gte(
            ingredientStock.purchaseDate,
            startDate.toISOString().split("T")[0]
          ),
          lte(ingredientStock.purchaseDate, endDate.toISOString().split("T")[0])
        )
      )
      .orderBy(ingredientStock.purchaseDate);

    // Get all usage records within date range
    const allUsage = await db
      .select({
        date: usageHistory.date,
        ingredientStockId: usageHistory.ingredientStockId,
        quantityUsed: usageHistory.quantityUsed,
        stockPurchasePrice: ingredientStock.purchasePrice,
        stockQuantity: ingredientStock.quantity,
      })
      .from(usageHistory)
      .innerJoin(
        ingredientStock,
        eq(usageHistory.ingredientStockId, ingredientStock.id)
      )
      .where(
        and(
          eq(ingredientStock.userId, userId),
          gte(usageHistory.date, startDate.toISOString().split("T")[0]),
          lte(usageHistory.date, endDate.toISOString().split("T")[0])
        )
      );

    // Get all spoilage records within date range
    const allSpoilage = await db
      .select({
        date: spoilageRecords.date,
        ingredientStockId: spoilageRecords.ingredientStockId,
        quantity: spoilageRecords.quantity,
        stockPurchasePrice: ingredientStock.purchasePrice,
        stockQuantity: ingredientStock.quantity,
      })
      .from(spoilageRecords)
      .innerJoin(
        ingredientStock,
        eq(spoilageRecords.ingredientStockId, ingredientStock.id)
      )
      .where(
        and(
          eq(ingredientStock.userId, userId),
          gte(spoilageRecords.date, startDate.toISOString().split("T")[0]),
          lte(spoilageRecords.date, endDate.toISOString().split("T")[0])
        )
      );

    // Group purchases by date
    const purchasesByDate = new Map<string, number>();
    for (const stock of allStock) {
      const quantity = parseFloat(stock.quantity);
      const pricePerUnit = parseFloat(stock.purchasePrice) / quantity;
      const purchaseValue = quantity * pricePerUnit;
      // purchaseDate is already a string (date type from DB)
      const dateStr = String(stock.purchaseDate).split("T")[0];

      purchasesByDate.set(
        dateStr,
        (purchasesByDate.get(dateStr) || 0) + purchaseValue
      );
    }

    // Group consumption (usage + spoilage) by date
    const consumptionByDate = new Map<string, number>();

    // Process usage
    for (const usage of allUsage) {
      const stockQuantity = parseFloat(usage.stockQuantity);
      const pricePerUnit = parseFloat(usage.stockPurchasePrice) / stockQuantity;
      const quantityUsed = parseFloat(usage.quantityUsed);
      const consumptionValue = quantityUsed * pricePerUnit;
      // date is already a string (date type from DB)
      const dateStr = String(usage.date).split("T")[0];

      consumptionByDate.set(
        dateStr,
        (consumptionByDate.get(dateStr) || 0) + consumptionValue
      );
    }

    // Process spoilage
    for (const spoilage of allSpoilage) {
      const stockQuantity = parseFloat(spoilage.stockQuantity);
      const pricePerUnit =
        parseFloat(spoilage.stockPurchasePrice) / stockQuantity;
      const quantitySpoiled = parseFloat(spoilage.quantity);
      const consumptionValue = quantitySpoiled * pricePerUnit;
      // date is already a string (date type from DB)
      const dateStr = String(spoilage.date).split("T")[0];

      consumptionByDate.set(
        dateStr,
        (consumptionByDate.get(dateStr) || 0) + consumptionValue
      );
    }

    // Combine all dates and build trend
    const allDates = new Set<string>();
    purchasesByDate.forEach((_, date) => allDates.add(date));
    consumptionByDate.forEach((_, date) => allDates.add(date));

    const trend: Array<{
      date: string;
      purchased: string;
      consumed: string;
    }> = [];

    const sortedDates = Array.from(allDates).sort();
    for (const dateStr of sortedDates) {
      trend.push({
        date: dateStr,
        purchased: (purchasesByDate.get(dateStr) || 0).toFixed(2),
        consumed: (consumptionByDate.get(dateStr) || 0).toFixed(2),
      });
    }

    return trend;
  }

  /**
   * Calculate purchase value trend over time (daily purchase amounts)
   */
  static async calculatePurchaseValueTrend(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<Array<{ date: string; purchases: string }>> {
    // Get all stock entries with purchase dates within range
    const allStock = await db
      .select({
        quantity: ingredientStock.quantity,
        purchasePrice: ingredientStock.purchasePrice,
        purchaseDate: ingredientStock.purchaseDate,
      })
      .from(ingredientStock)
      .where(
        and(
          eq(ingredientStock.userId, userId),
          gte(
            ingredientStock.purchaseDate,
            startDate.toISOString().split("T")[0]
          ),
          lte(ingredientStock.purchaseDate, endDate.toISOString().split("T")[0])
        )
      )
      .orderBy(ingredientStock.purchaseDate);

    // Group purchases by date and calculate total value per day
    const purchasesByDate = new Map<string, number>();
    for (const stock of allStock) {
      const quantity = parseFloat(stock.quantity);
      const pricePerUnit = parseFloat(stock.purchasePrice) / quantity;
      const purchaseValue = quantity * pricePerUnit;
      // purchaseDate is already a string (date type from DB)
      const dateStr = String(stock.purchaseDate).split("T")[0];

      purchasesByDate.set(
        dateStr,
        (purchasesByDate.get(dateStr) || 0) + purchaseValue
      );
    }

    // Convert to array
    const trend: Array<{ date: string; purchases: string }> = [];
    const sortedDates = Array.from(purchasesByDate.keys()).sort();

    for (const dateStr of sortedDates) {
      trend.push({
        date: dateStr,
        purchases: purchasesByDate.get(dateStr)!.toFixed(2),
      });
    }

    return trend;
  }

  /**
   * Save today's snapshot
   */
  static async saveDailySnapshot(userId: string) {
    const today = new Date().toISOString().split("T")[0];
    const stats = await this.calculateOverallStatistics(userId);

    await db
      .insert(dailyInventorySnapshots)
      .values({
        userId,
        snapshotDate: today,
        totalValue: stats.totalValue.toString(),
        remainingValue: stats.remainingValue.toString(),
        totalPurchases: stats.totalPurchases,
        totalIngredients: stats.totalIngredients,
        lowStockCount: stats.lowStockCount,
        ingredientStats: stats.ingredientStats as any,
        supplierStats: stats.supplierStats as any,
        categoryDistribution: stats.categoryDistribution as any,
        updatedAt: sql`now()`,
      })
      .onConflictDoUpdate({
        target: [
          dailyInventorySnapshots.userId,
          dailyInventorySnapshots.snapshotDate,
        ],
        set: {
          totalValue: stats.totalValue.toString(),
          remainingValue: stats.remainingValue.toString(),
          totalPurchases: stats.totalPurchases,
          totalIngredients: stats.totalIngredients,
          lowStockCount: stats.lowStockCount,
          ingredientStats: stats.ingredientStats as any,
          supplierStats: stats.supplierStats as any,
          categoryDistribution: stats.categoryDistribution as any,
          updatedAt: sql`now()`,
        },
      });
  }

  /**
   * Update ingredient analytics
   */
  static async updateIngredientAnalytics(ingredientId: string, userId: string) {
    const analytics = await this.calculateIngredientAnalytics(
      ingredientId,
      userId
    );

    await db
      .insert(ingredientAnalytics)
      .values({
        userId,
        ingredientId,
        totalValue: analytics.totalValue.toString(),
        remainingValue: analytics.remainingValue.toString(),
        averagePricePerUnit: analytics.averagePricePerUnit.toString(),
        totalPurchases: analytics.totalPurchases,
        priceTrend: analytics.priceTrend as any,
        stockValueTrend: analytics.stockValueTrend as any,
        updatedAt: sql`now()`,
      })
      .onConflictDoUpdate({
        target: [ingredientAnalytics.userId, ingredientAnalytics.ingredientId],
        set: {
          totalValue: analytics.totalValue.toString(),
          remainingValue: analytics.remainingValue.toString(),
          averagePricePerUnit: analytics.averagePricePerUnit.toString(),
          totalPurchases: analytics.totalPurchases,
          priceTrend: analytics.priceTrend as any,
          stockValueTrend: analytics.stockValueTrend as any,
          updatedAt: sql`now()`,
        },
      });
  }
}
