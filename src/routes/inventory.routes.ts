import { Router } from "express";
import { body, query } from "express-validator";
import { InventoryService } from "../services/inventory.service";
import { validate } from "../middleware/validation";
import { authenticate } from "../middleware/auth.middleware";
import { AppError } from "../middleware/error-handler";

const router = Router();

router.use(authenticate);

// POST /api/inventory/purchase - Record a purchase
router.post(
  "/purchase",
  validate([
    body("ingredientId")
      .isUUID()
      .withMessage("Valid ingredient ID is required"),
    body("storageLocationId")
      .isUUID()
      .withMessage("Valid storage location ID is required"),
    body("quantity")
      .isNumeric()
      .toFloat()
      .isFloat({ gt: 0 })
      .withMessage("Quantity must be a positive number"),
    body("purchaseDate")
      .isISO8601()
      .withMessage("Valid purchase date is required"),
    body("purchasePrice")
      .isNumeric()
      .toFloat()
      .isFloat({ gt: 0 })
      .withMessage("Purchase price must be a positive number"),
    body("supplierId").isUUID().withMessage("Valid supplier ID is required"),
    body("batchNumber").optional().trim(),
    body("expirationDate")
      .optional()
      .isISO8601()
      .withMessage("Expiration date must be a valid date"),
  ]),
  async (req, res, next) => {
    try {
      const {
        ingredientId,
        storageLocationId,
        quantity,
        batchNumber,
        expirationDate,
        purchaseDate,
        purchasePrice,
        supplierId,
      } = req.body;

      const userId = req.user!.userId;

      const stock = await InventoryService.recordPurchase(
        {
          ingredientId,
          storageLocationId,
          quantity,
          batchNumber,
          expirationDate,
          purchaseDate,
          purchasePrice,
          supplierId,
        },
        userId
      );

      res.status(201).json({
        status: "success",
        message: "Purchase recorded successfully",
        data: stock,
      });
    } catch (error) {
      const err = error as Error;
      if (
        err.message === "Ingredient not found" ||
        err.message === "Storage location not found" ||
        err.message === "Supplier not found"
      ) {
        const appError: AppError = new Error(err.message);
        appError.statusCode = 404;
        return next(appError);
      }
      next(error);
    }
  }
);

// POST /api/inventory/use - Record ingredient usage
router.post(
  "/use",
  validate([
    body("ingredientStockId")
      .isUUID()
      .withMessage("Valid ingredient stock ID is required"),
    body("quantityUsed")
      .isNumeric()
      .toFloat()
      .isFloat({ gt: 0 })
      .withMessage("Quantity used must be a positive number"),
    body("date").isISO8601().withMessage("Valid date is required"),
    body("reason").optional().trim(),
    body("notes").optional().trim(),
  ]),
  async (req, res, next) => {
    try {
      const { ingredientStockId, quantityUsed, date, reason, notes } = req.body;
      const userId = req.user!.userId;

      const usage = await InventoryService.recordUsage(
        {
          ingredientStockId,
          quantityUsed,
          date,
          reason,
          notes,
        },
        userId
      );

      res.status(201).json({
        status: "success",
        message: "Usage recorded successfully",
        data: usage,
      });
    } catch (error) {
      const err = error as Error;
      if (
        err.message === "Ingredient stock not found" ||
        err.message === "Insufficient stock available"
      ) {
        const appError: AppError = new Error(err.message);
        appError.statusCode =
          err.message === "Ingredient stock not found" ? 404 : 400;
        return next(appError);
      }
      next(error);
    }
  }
);

// POST /api/inventory/spoilage - Record spoilage/waste
router.post(
  "/spoilage",
  validate([
    body("ingredientStockId")
      .isUUID()
      .withMessage("Valid ingredient stock ID is required"),
    body("quantity")
      .isNumeric()
      .toFloat()
      .isFloat({ gt: 0 })
      .withMessage("Quantity must be a positive number"),
    body("reason").trim().notEmpty().withMessage("Reason is required"),
    body("date").isISO8601().withMessage("Valid date is required"),
    body("notes").optional().trim(),
  ]),
  async (req, res, next) => {
    try {
      const { ingredientStockId, quantity, reason, date, notes } = req.body;
      const userId = req.user!.userId;

      const spoilage = await InventoryService.recordSpoilage(
        {
          ingredientStockId,
          quantity,
          reason,
          date,
          notes,
        },
        userId
      );

      res.status(201).json({
        status: "success",
        message: "Spoilage recorded successfully",
        data: spoilage,
      });
    } catch (error) {
      const err = error as Error;
      if (
        err.message === "Ingredient stock not found" ||
        err.message === "Insufficient stock available"
      ) {
        const appError: AppError = new Error(err.message);
        appError.statusCode =
          err.message === "Ingredient stock not found" ? 404 : 400;
        return next(appError);
      }
      next(error);
    }
  }
);

// GET /api/inventory/stock - Get all stock levels
router.get("/stock", async (req, res, next) => {
  try {
    const userId = req.user!.userId;
    const stock = await InventoryService.getAllStock(userId);
    res.json({
      status: "success",
      data: stock,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/inventory/history - Get usage history
router.get(
  "/history",
  validate([
    query("startDate")
      .optional()
      .isISO8601()
      .withMessage("Start date must be a valid date"),
    query("endDate")
      .optional()
      .isISO8601()
      .withMessage("End date must be a valid date"),
    query("ingredientId")
      .optional()
      .isUUID()
      .withMessage("Ingredient ID must be a valid UUID"),
  ]),
  async (req, res, next) => {
    try {
      const { startDate, endDate, ingredientId } = req.query;
      const userId = req.user!.userId;
      const history = await InventoryService.getUsageHistory(userId, {
        startDate: startDate as string | undefined,
        endDate: endDate as string | undefined,
        ingredientId: ingredientId as string | undefined,
      });
      res.json({
        status: "success",
        data: history,
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/inventory/expiring - Get items expiring soon
router.get(
  "/expiring",
  validate([
    query("days")
      .optional()
      .isNumeric()
      .toInt()
      .isInt({ min: 1 })
      .withMessage("Days must be a positive integer"),
  ]),
  async (req, res, next) => {
    try {
      const days = req.query.days
        ? parseInt(req.query.days as string)
        : undefined;
      const userId = req.user!.userId;
      const items = await InventoryService.getExpiringItems(userId, days);
      res.json({
        status: "success",
        data: items,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
