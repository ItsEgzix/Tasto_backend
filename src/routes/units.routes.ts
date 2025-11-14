import { Router } from "express";
import { body, param, query } from "express-validator";
import { UnitService } from "../services/unit.service";
import { validate } from "../middleware/validation";
import { authenticate } from "../middleware/auth.middleware";
import { AppError } from "../middleware/error-handler";

const router = Router();

router.use(authenticate);

// GET /api/units - List all units (optionally filter by type)
router.get(
  "/",
  validate([
    query("type")
      .optional()
      .isIn(["weight", "volume", "count", "other"])
      .withMessage("Type must be weight, volume, count, or other"),
  ]),
  async (req, res, next) => {
    try {
      const { type } = req.query;
      const userId = req.user!.userId;

      let units;
      if (type) {
        units = await UnitService.getUnitsByType(
          type as "weight" | "volume" | "count" | "other",
          userId
        );
      } else {
        units = await UnitService.getAllUnits(userId);
      }

      res.json({
        status: "success",
        data: units,
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/units/:id - Get unit details
router.get(
  "/:id",
  validate([param("id").isUUID().withMessage("Invalid unit ID")]),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.user!.userId;
      const unit = await UnitService.getUnitById(id, userId);

      if (!unit) {
        const error: AppError = new Error("Unit not found");
        error.statusCode = 404;
        return next(error);
      }

      res.json({
        status: "success",
        data: unit,
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/units - Create new unit
router.post(
  "/",
  validate([
    body("name").trim().notEmpty().withMessage("Unit name is required"),
    body("type")
      .isIn(["weight", "volume", "count", "other"])
      .withMessage("Type must be weight, volume, count, or other"),
    body("symbol").optional().trim(),
    body("description").optional().trim(),
  ]),
  async (req, res, next) => {
    try {
      const { name, type, symbol, description } = req.body;
      const userId = req.user!.userId;

      const unit = await UnitService.createUnit(
        {
          name,
          type: type as "weight" | "volume" | "count" | "other",
          symbol,
          description,
        },
        userId
      );

      res.status(201).json({
        status: "success",
        message: "Unit created successfully",
        data: unit,
      });
    } catch (error) {
      const err = error as Error;
      if (err.message === "Unit with this name already exists") {
        const appError: AppError = new Error(err.message);
        appError.statusCode = 400;
        return next(appError);
      }
      next(error);
    }
  }
);

// PUT /api/units/:id - Update unit
router.put(
  "/:id",
  validate([
    param("id").isUUID().withMessage("Invalid unit ID"),
    body("name")
      .optional()
      .trim()
      .notEmpty()
      .withMessage("Name cannot be empty"),
    body("type")
      .optional()
      .isIn(["weight", "volume", "count", "other"])
      .withMessage("Type must be weight, volume, count, or other"),
    body("symbol").optional().trim(),
    body("description").optional().trim(),
  ]),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { name, type, symbol, description } = req.body;
      const userId = req.user!.userId;

      const unit = await UnitService.updateUnit(
        id,
        {
          name,
          type: type as "weight" | "volume" | "count" | "other" | undefined,
          symbol,
          description,
        },
        userId
      );

      res.json({
        status: "success",
        message: "Unit updated successfully",
        data: unit,
      });
    } catch (error) {
      const err = error as Error;
      if (
        err.message === "Unit not found" ||
        err.message === "Unit with this name already exists"
      ) {
        const appError: AppError = new Error(err.message);
        appError.statusCode = err.message === "Unit not found" ? 404 : 400;
        return next(appError);
      }
      next(error);
    }
  }
);

// DELETE /api/units/:id - Delete unit
router.delete(
  "/:id",
  validate([param("id").isUUID().withMessage("Invalid unit ID")]),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.user!.userId;
      await UnitService.deleteUnit(id, userId);

      res.json({
        status: "success",
        message: "Unit deleted successfully",
      });
    } catch (error) {
      const err = error as Error;
      if (err.message === "Unit not found") {
        const appError: AppError = new Error(err.message);
        appError.statusCode = 404;
        return next(appError);
      }
      next(error);
    }
  }
);

export default router;
