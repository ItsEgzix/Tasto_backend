import { Router } from "express";
import { query, param } from "express-validator";
import { InventoryAnalyticsService } from "../services/inventory-analytics.service";
import { validate } from "../middleware/validation";
import { authenticate } from "../middleware/auth.middleware";
import { db } from "../db";
import {
  dailyInventorySnapshots,
  ingredientAnalytics,
  ingredients,
} from "../db/schema";
import { eq, desc } from "drizzle-orm";

const router = Router();
router.use(authenticate);

/**
 * GET /api/inventory/analytics/overview
 * Get current overall statistics
 */
router.get("/overview", async (_req, res, next) => {
  try {
    // Get latest snapshot
    const [latest] = await db
      .select()
      .from(dailyInventorySnapshots)
      .orderBy(desc(dailyInventorySnapshots.snapshotDate))
      .limit(1);

    if (!latest) {
      // First time - calculate and save
      await InventoryAnalyticsService.saveDailySnapshot();
      const [newSnapshot] = await db
        .select()
        .from(dailyInventorySnapshots)
        .orderBy(desc(dailyInventorySnapshots.snapshotDate))
        .limit(1);
      return res.json({ status: "success", data: newSnapshot });
    }

    return res.json({ status: "success", data: latest });
  } catch (error) {
    return next(error);
  }
});

/**
 * GET /api/inventory/analytics/value-trend
 * Get value trend over time
 * Query params: timeRange (7d|30d|90d), startDate, endDate
 * OPTIMIZED: Calculates trend from actual purchase/usage/spoilage data
 */
router.get(
  "/value-trend",
  validate([
    query("timeRange")
      .optional()
      .isIn(["7d", "30d", "90d"])
      .withMessage("Time range must be 7d, 30d, or 90d"),
    query("startDate").optional().isISO8601(),
    query("endDate").optional().isISO8601(),
  ]),
  async (req, res, next) => {
    try {
      let startDate: Date;
      let endDate = new Date();

      if (req.query.startDate && req.query.endDate) {
        startDate = new Date(req.query.startDate as string);
        endDate = new Date(req.query.endDate as string);
      } else {
        const timeRange =
          (req.query.timeRange as "7d" | "30d" | "90d") || "30d";
        const days = timeRange === "7d" ? 7 : timeRange === "30d" ? 30 : 90;
        startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
      }

      // Calculate trend from actual purchase data (not just snapshots)
      const trend = await InventoryAnalyticsService.calculateValueTrend(
        startDate,
        endDate
      );

      res.setHeader("Cache-Control", "private, max-age=300"); // 5 minutes
      res.json({ status: "success", data: trend });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/inventory/analytics/best-suppliers
 * Get top suppliers by price
 * Query params: limit (default 5)
 */
router.get(
  "/best-suppliers",
  validate([query("limit").optional().isInt({ min: 1, max: 20 }).toInt()]),
  async (req, res, next) => {
    try {
      const limit = parseInt((req.query.limit as string) || "5");

      // Get latest snapshot
      const [latest] = await db
        .select()
        .from(dailyInventorySnapshots)
        .orderBy(desc(dailyInventorySnapshots.snapshotDate))
        .limit(1);

      if (!latest) {
        return res.json({ status: "success", data: [] });
      }

      // Extract and sort supplier stats
      const suppliers = ((latest.supplierStats as any) || [])
        .map((s: any) => ({
          supplierId: s.supplierId,
          name: s.name,
          averagePricePerUnit: parseFloat(s.averagePricePerUnit) || 0,
          totalPurchases: s.totalPurchases || 0,
          totalSpent: parseFloat(s.totalSpent) || 0,
        }))
        .filter((s: any) => s.averagePricePerUnit > 0)
        .sort((a: any, b: any) => a.averagePricePerUnit - b.averagePricePerUnit)
        .slice(0, limit);

      return res.json({ status: "success", data: suppliers });
    } catch (error) {
      return next(error);
    }
  }
);

/**
 * GET /api/inventory/analytics/most-bought-ingredients
 * Get top ingredients by purchase frequency
 * Query params: limit (default 5)
 */
router.get(
  "/most-bought-ingredients",
  validate([query("limit").optional().isInt({ min: 1, max: 20 }).toInt()]),
  async (req, res, next) => {
    try {
      const limit = parseInt((req.query.limit as string) || "5");

      const [latest] = await db
        .select()
        .from(dailyInventorySnapshots)
        .orderBy(desc(dailyInventorySnapshots.snapshotDate))
        .limit(1);

      if (!latest) {
        return res.json({ status: "success", data: [] });
      }

      const ingredients = ((latest.ingredientStats as any) || [])
        .map((ing: any) => ({
          ingredientId: ing.ingredientId,
          name: ing.name,
          purchaseCount: ing.purchaseCount || 0,
          totalQuantity: parseFloat(ing.totalQuantity || "0"),
          totalValue: parseFloat(ing.totalValue || "0"),
        }))
        .sort((a: any, b: any) => b.purchaseCount - a.purchaseCount)
        .slice(0, limit);

      return res.json({ status: "success", data: ingredients });
    } catch (error) {
      return next(error);
    }
  }
);

/**
 * GET /api/inventory/analytics/category-distribution
 * Get stock distribution by category
 */
router.get("/category-distribution", async (_req, res, next) => {
  try {
    const [latest] = await db
      .select()
      .from(dailyInventorySnapshots)
      .orderBy(desc(dailyInventorySnapshots.snapshotDate))
      .limit(1);

    if (!latest) {
      return res.json({ status: "success", data: [] });
    }

    const distribution = ((latest.categoryDistribution as any) || []).map(
      (cat: any) => ({
        categoryName: cat.categoryName,
        categoryColor: cat.categoryColor,
        totalStock: parseFloat(cat.totalStock || "0"),
      })
    );

    return res.json({ status: "success", data: distribution });
  } catch (error) {
    return next(error);
  }
});

/**
 * GET /api/inventory/analytics/top-ingredients-by-value
 * Get top ingredients by total value
 * Query params: limit (default 10)
 */
router.get(
  "/top-ingredients-by-value",
  validate([query("limit").optional().isInt({ min: 1, max: 50 }).toInt()]),
  async (req, res, next) => {
    try {
      const limit = parseInt((req.query.limit as string) || "10");

      const [latest] = await db
        .select()
        .from(dailyInventorySnapshots)
        .orderBy(desc(dailyInventorySnapshots.snapshotDate))
        .limit(1);

      if (!latest) {
        return res.json({ status: "success", data: [] });
      }

      const ingredients = ((latest.ingredientStats as any) || [])
        .map((ing: any) => ({
          ingredientId: ing.ingredientId,
          name: ing.name,
          value: parseFloat(ing.remainingValue || "0"),
        }))
        .sort((a: any, b: any) => b.value - a.value)
        .slice(0, limit);

      return res.json({ status: "success", data: ingredients });
    } catch (error) {
      return next(error);
    }
  }
);

/**
 * GET /api/inventory/analytics/purchases-over-time
 * Get purchase value over time (daily purchase amounts)
 * Query params: timeRange (7d|30d|90d)
 */
router.get(
  "/purchases-over-time",
  validate([
    query("timeRange")
      .optional()
      .isIn(["7d", "30d", "90d"])
      .withMessage("Time range must be 7d, 30d, or 90d"),
  ]),
  async (req, res, next) => {
    try {
      const timeRange = (req.query.timeRange as "7d" | "30d" | "90d") || "30d";
      const days = timeRange === "7d" ? 7 : timeRange === "30d" ? 30 : 90;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      const endDate = new Date();

      // Calculate purchase values from actual purchase data
      const trend = await InventoryAnalyticsService.calculatePurchaseValueTrend(
        startDate,
        endDate
      );

      res.setHeader("Cache-Control", "private, max-age=300"); // 5 minutes
      res.json({ status: "success", data: trend });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/inventory/analytics/ingredient/:ingredientId
 * Get analytics for a specific ingredient
 * OPTIMIZED: Returns cached data immediately, recalculates in background if stale
 */
router.get(
  "/ingredient/:ingredientId",
  validate([
    param("ingredientId")
      .isUUID()
      .withMessage("Valid ingredient ID is required"),
  ]),
  async (req, res, next) => {
    try {
      const { ingredientId } = req.params;

      const [analytics] = await db
        .select()
        .from(ingredientAnalytics)
        .where(eq(ingredientAnalytics.ingredientId, ingredientId))
        .limit(1);

      if (!analytics) {
        // Analytics don't exist - calculate them (first time)
        // This is necessary to show data, but calculation is optimized
        try {
          await InventoryAnalyticsService.updateIngredientAnalytics(
            ingredientId
          );
          const [newAnalytics] = await db
            .select()
            .from(ingredientAnalytics)
            .where(eq(ingredientAnalytics.ingredientId, ingredientId))
            .limit(1);

          if (newAnalytics) {
            res.setHeader("Cache-Control", "private, max-age=300"); // 5 minutes
            return res.json({ status: "success", data: newAnalytics });
          }
        } catch (error) {
          console.error("Error calculating ingredient analytics:", error);
          // Return empty structure if calculation fails
          return res.json({
            status: "success",
            data: {
              id: "",
              ingredientId,
              totalValue: "0",
              remainingValue: "0",
              averagePricePerUnit: "0",
              totalPurchases: 0,
              priceTrend: [],
              stockValueTrend: [],
              updatedAt: new Date().toISOString(),
            },
          });
        }
      }

      // Check if data is stale (older than 1 hour) - refresh in background if needed
      const updatedAt = new Date(analytics.updatedAt);
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

      if (updatedAt < oneHourAgo) {
        // Data is stale - refresh in background (non-blocking)
        setImmediate(async () => {
          try {
            await InventoryAnalyticsService.updateIngredientAnalytics(
              ingredientId
            );
          } catch (error) {
            console.error(
              "Error refreshing stale analytics in background:",
              error
            );
          }
        });
      }

      // Return existing data immediately (with cache header)
      res.setHeader("Cache-Control", "private, max-age=300"); // 5 minutes
      return res.json({ status: "success", data: analytics });
    } catch (error) {
      return next(error);
    }
  }
);

/**
 * GET /api/inventory/analytics/ingredient/:ingredientId/price-trend
 * Get price trend for ingredient
 * Query params: timeRange (7d|30d|90d)
 */
router.get(
  "/ingredient/:ingredientId/price-trend",
  validate([
    param("ingredientId")
      .isUUID()
      .withMessage("Valid ingredient ID is required"),
    query("timeRange")
      .optional()
      .isIn(["7d", "30d", "90d"])
      .withMessage("Time range must be 7d, 30d, or 90d"),
  ]),
  async (req, res, next) => {
    try {
      const { ingredientId } = req.params;
      const timeRange = (req.query.timeRange as "7d" | "30d" | "90d") || "30d";
      const days = timeRange === "7d" ? 7 : timeRange === "30d" ? 30 : 90;

      const [analytics] = await db
        .select()
        .from(ingredientAnalytics)
        .where(eq(ingredientAnalytics.ingredientId, ingredientId))
        .limit(1);

      if (!analytics) {
        await InventoryAnalyticsService.updateIngredientAnalytics(ingredientId);
        const [newAnalytics] = await db
          .select()
          .from(ingredientAnalytics)
          .where(eq(ingredientAnalytics.ingredientId, ingredientId))
          .limit(1);
        const priceTrend = ((newAnalytics?.priceTrend as any) || []).slice(
          -days
        );
        return res.json({ status: "success", data: priceTrend });
      }

      const priceTrend = ((analytics.priceTrend as any) || []).slice(-days);
      return res.json({ status: "success", data: priceTrend });
    } catch (error) {
      return next(error);
    }
  }
);

/**
 * GET /api/inventory/analytics/ingredient/:ingredientId/stock-value
 * Get stock value trend for ingredient
 * Query params: timeRange (7d|30d|90d)
 */
router.get(
  "/ingredient/:ingredientId/stock-value",
  validate([
    param("ingredientId")
      .isUUID()
      .withMessage("Valid ingredient ID is required"),
    query("timeRange")
      .optional()
      .isIn(["7d", "30d", "90d"])
      .withMessage("Time range must be 7d, 30d, or 90d"),
  ]),
  async (req, res, next) => {
    try {
      const { ingredientId } = req.params;
      const timeRange = (req.query.timeRange as "7d" | "30d" | "90d") || "30d";
      const days = timeRange === "7d" ? 7 : timeRange === "30d" ? 30 : 90;

      const [analytics] = await db
        .select()
        .from(ingredientAnalytics)
        .where(eq(ingredientAnalytics.ingredientId, ingredientId))
        .limit(1);

      if (!analytics) {
        await InventoryAnalyticsService.updateIngredientAnalytics(ingredientId);
        const [newAnalytics] = await db
          .select()
          .from(ingredientAnalytics)
          .where(eq(ingredientAnalytics.ingredientId, ingredientId))
          .limit(1);
        const stockValueTrend = (
          (newAnalytics?.stockValueTrend as any) || []
        ).slice(-days);
        return res.json({ status: "success", data: stockValueTrend });
      }

      const stockValueTrend = ((analytics.stockValueTrend as any) || []).slice(
        -days
      );
      return res.json({ status: "success", data: stockValueTrend });
    } catch (error) {
      return next(error);
    }
  }
);

/**
 * POST /api/inventory/analytics/refresh
 * Manually refresh all analytics (admin only)
 */
router.post("/refresh", authenticate, async (_req, res, next) => {
  try {
    await InventoryAnalyticsService.saveDailySnapshot();

    // Refresh all ingredient analytics
    const allIngredients = await db
      .select({ id: ingredients.id })
      .from(ingredients);
    for (const ing of allIngredients) {
      await InventoryAnalyticsService.updateIngredientAnalytics(ing.id);
    }

    return res.json({
      status: "success",
      message: "Analytics refreshed successfully",
    });
  } catch (error) {
    return next(error);
  }
});

export default router;
