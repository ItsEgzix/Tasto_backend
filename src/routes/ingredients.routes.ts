import { Router } from "express";
import { body, param } from "express-validator";
import { IngredientService } from "../services/ingredient.service";
import { validate } from "../middleware/validation";
import { authenticate } from "../middleware/auth.middleware";
import { AppError } from "../middleware/error-handler";

const router = Router();

router.use(authenticate);

router.get("/", async (req, res, next) => {
  try {
    const userId = req.user!.userId;
    const ingredients = await IngredientService.getAllIngredients(userId);
    res.json({
      status: "success",
      data: ingredients,
    });
  } catch (error) {
    next(error);
  }
});

router.get(
  "/:id",
  validate([param("id").isUUID().withMessage("Invalid ingredient ID")]),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.user!.userId;
      const ingredient = await IngredientService.getIngredientById(id, userId);

      if (!ingredient) {
        const error: AppError = new Error("Ingredient not found");
        error.statusCode = 404;
        return next(error);
      }

      res.json({
        status: "success",
        data: ingredient,
      });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  "/",
  validate([
    body("name").trim().notEmpty().withMessage("Ingredient name is required"),
    body("categoryId").isUUID().withMessage("Valid category ID is required"),
    body("unitId").isUUID().withMessage("Valid unit ID is required"),
    body("restockThreshold")
      .optional()
      .isNumeric()
      .withMessage("Restock threshold must be a number"),
  ]),
  async (req, res, next) => {
    try {
      const { name, categoryId, unitId, restockThreshold } = req.body;
      const userId = req.user!.userId;

      const ingredient = await IngredientService.createIngredient(
        {
          name,
          categoryId,
          unitId,
          restockThreshold: restockThreshold
            ? parseFloat(restockThreshold)
            : undefined,
        },
        userId
      );

      res.status(201).json({
        status: "success",
        message: "Ingredient created successfully",
        data: ingredient,
      });
    } catch (error) {
      const err = error as Error;
      if (
        err.message === "Ingredient with this name already exists" ||
        err.message === "Category not found" ||
        err.message === "Unit not found"
      ) {
        const appError: AppError = new Error(err.message);
        appError.statusCode = 400;
        return next(appError);
      }
      next(error);
    }
  }
);

router.put(
  "/:id",
  validate([
    param("id").isUUID().withMessage("Invalid ingredient ID"),
    body("name")
      .optional()
      .trim()
      .notEmpty()
      .withMessage("Name cannot be empty"),
    body("categoryId")
      .optional()
      .isUUID()
      .withMessage("Valid category ID is required"),
    body("unitId").optional().isUUID().withMessage("Valid unit ID is required"),
    body("restockThreshold")
      .optional()
      .isNumeric()
      .withMessage("Restock threshold must be a number"),
  ]),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { name, categoryId, unitId, restockThreshold } = req.body;
      const userId = req.user!.userId;

      const ingredient = await IngredientService.updateIngredient(
        id,
        {
          name,
          categoryId,
          unitId,
          restockThreshold: restockThreshold
            ? parseFloat(restockThreshold)
            : undefined,
        },
        userId
      );

      res.json({
        status: "success",
        message: "Ingredient updated successfully",
        data: ingredient,
      });
    } catch (error) {
      const err = error as Error;
      if (
        err.message === "Ingredient not found" ||
        err.message === "Ingredient with this name already exists" ||
        err.message === "Category not found" ||
        err.message === "Unit not found"
      ) {
        const appError: AppError = new Error(err.message);
        appError.statusCode =
          err.message === "Ingredient not found" ? 404 : 400;
        return next(appError);
      }
      next(error);
    }
  }
);

router.delete(
  "/:id",
  validate([param("id").isUUID().withMessage("Invalid ingredient ID")]),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.user!.userId;
      await IngredientService.deleteIngredient(id, userId);

      res.json({
        status: "success",
        message: "Ingredient deleted successfully",
      });
    } catch (error) {
      const err = error as Error;
      if (err.message === "Ingredient not found") {
        const appError: AppError = new Error(err.message);
        appError.statusCode = 404;
        return next(appError);
      }
      next(error);
    }
  }
);

router.get(
  "/:id/stock",
  validate([param("id").isUUID().withMessage("Invalid ingredient ID")]),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.user!.userId;
      const stock = await IngredientService.getIngredientStock(id, userId);

      res.json({
        status: "success",
        data: stock,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
