import { Router } from "express";
import { body, param, query } from "express-validator";
import { MenuService } from "../services/menu.service";
import { validate } from "../middleware/validation";
import { authenticate } from "../middleware/auth.middleware";
import { AppError } from "../middleware/error-handler";

const router = Router();

// All routes require authentication
router.use(authenticate);

// GET /api/menu/plans - List all menu plans
router.get(
  "/plans",
  validate([
    query("includeTemplates")
      .optional()
      .isBoolean()
      .withMessage("includeTemplates must be a boolean"),
  ]),
  async (req, res, next) => {
    try {
      if (!req.user || !req.user.userId) {
        const error: AppError = new Error("User not authenticated");
        error.statusCode = 401;
        return next(error);
      }

      const userId = req.user.userId;
      const includeTemplates =
        req.query.includeTemplates === "true" ||
        req.query.includeTemplates === undefined;

      const menuPlans = await MenuService.getAllMenuPlans(
        userId,
        includeTemplates
      );

      res.json({
        status: "success",
        data: menuPlans,
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/menu/plans/:id - Get menu plan details
router.get(
  "/plans/:id",
  validate([param("id").isUUID().withMessage("Invalid menu plan ID")]),
  async (req, res, next) => {
    try {
      if (!req.user || !req.user.userId) {
        const error: AppError = new Error("User not authenticated");
        error.statusCode = 401;
        return next(error);
      }

      const { id } = req.params;
      const userId = req.user.userId;
      const menuPlan = await MenuService.getMenuPlanById(id, userId);

      if (!menuPlan) {
        const error: AppError = new Error("Menu plan not found");
        error.statusCode = 404;
        return next(error);
      }

      res.json({
        status: "success",
        data: menuPlan,
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/menu/plans - Create menu plan
router.post(
  "/plans",
  validate([
    body("name").trim().notEmpty().withMessage("Menu plan name is required"),
    body("description").optional().trim(),
    body("isTemplate")
      .optional()
      .isBoolean()
      .withMessage("isTemplate must be a boolean"),
    body("items").optional().isArray().withMessage("Items must be an array"),
    body("items.*.recipeId")
      .optional()
      .isUUID()
      .withMessage("Invalid recipe ID"),
    body("items.*.servings")
      .optional()
      .isNumeric()
      .withMessage("Servings must be a number"),
    body("items.*.notes").optional().trim(),
    body("items.*.order")
      .optional()
      .isInt()
      .withMessage("Order must be an integer"),
  ]),
  async (req, res, next) => {
    try {
      if (!req.user || !req.user.userId) {
        const error: AppError = new Error("User not authenticated");
        error.statusCode = 401;
        return next(error);
      }

      const { name, description, isTemplate, items } = req.body;
      const userId = req.user.userId;

      const menuPlan = await MenuService.createMenuPlan(
        {
          name,
          description,
          isTemplate,
          items,
        },
        userId
      );

      res.status(201).json({
        status: "success",
        message: "Menu plan created successfully",
        data: menuPlan,
      });
    } catch (error) {
      const err = error as Error;
      if (
        err.message === "Menu plan with this name already exists" ||
        err.message === "One or more recipes not found or don't belong to user"
      ) {
        const appError: AppError = new Error(err.message);
        appError.statusCode = 400;
        return next(appError);
      }
      next(error);
    }
  }
);

// PUT /api/menu/plans/:id - Update menu plan
router.put(
  "/plans/:id",
  validate([
    param("id").isUUID().withMessage("Invalid menu plan ID"),
    body("name")
      .optional()
      .trim()
      .notEmpty()
      .withMessage("Name cannot be empty"),
    body("description").optional().trim(),
    body("isTemplate")
      .optional()
      .isBoolean()
      .withMessage("isTemplate must be a boolean"),
    body("items").optional().isArray().withMessage("Items must be an array"),
    body("items.*.recipeId")
      .optional()
      .isUUID()
      .withMessage("Invalid recipe ID"),
    body("items.*.servings")
      .optional()
      .isNumeric()
      .withMessage("Servings must be a number"),
    body("items.*.notes").optional().trim(),
    body("items.*.order")
      .optional()
      .isInt()
      .withMessage("Order must be an integer"),
  ]),
  async (req, res, next) => {
    try {
      if (!req.user || !req.user.userId) {
        const error: AppError = new Error("User not authenticated");
        error.statusCode = 401;
        return next(error);
      }

      const { id } = req.params;
      const { name, description, isTemplate, items } = req.body;
      const userId = req.user.userId;

      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      if (isTemplate !== undefined) updateData.isTemplate = isTemplate;
      if (items !== undefined) updateData.items = items;

      const menuPlan = await MenuService.updateMenuPlan(id, updateData, userId);

      res.json({
        status: "success",
        message: "Menu plan updated successfully",
        data: menuPlan,
      });
    } catch (error) {
      const err = error as Error;
      if (
        err.message === "Menu plan not found" ||
        err.message === "Menu plan with this name already exists" ||
        err.message === "One or more recipes not found or don't belong to user"
      ) {
        const appError: AppError = new Error(err.message);
        appError.statusCode = err.message === "Menu plan not found" ? 404 : 400;
        return next(appError);
      }
      next(error);
    }
  }
);

// DELETE /api/menu/plans/:id - Delete menu plan
router.delete(
  "/plans/:id",
  validate([param("id").isUUID().withMessage("Invalid menu plan ID")]),
  async (req, res, next) => {
    try {
      if (!req.user || !req.user.userId) {
        const error: AppError = new Error("User not authenticated");
        error.statusCode = 401;
        return next(error);
      }

      const { id } = req.params;
      const userId = req.user.userId;
      await MenuService.deleteMenuPlan(id, userId);

      res.json({
        status: "success",
        message: "Menu plan deleted successfully",
      });
    } catch (error) {
      const err = error as Error;
      if (err.message === "Menu plan not found") {
        const appError: AppError = new Error(err.message);
        appError.statusCode = 404;
        return next(appError);
      }
      next(error);
    }
  }
);

// GET /api/menu/plans/:id/cost - Calculate menu cost
router.get(
  "/plans/:id/cost",
  validate([param("id").isUUID().withMessage("Invalid menu plan ID")]),
  async (req, res, next) => {
    try {
      if (!req.user || !req.user.userId) {
        const error: AppError = new Error("User not authenticated");
        error.statusCode = 401;
        return next(error);
      }

      const { id } = req.params;
      const userId = req.user.userId;
      const cost = await MenuService.calculateMenuCost(id, userId);

      res.json({
        status: "success",
        data: cost,
      });
    } catch (error) {
      const err = error as Error;
      if (err.message === "Menu plan not found") {
        const appError: AppError = new Error(err.message);
        appError.statusCode = 404;
        return next(appError);
      }
      next(error);
    }
  }
);

// GET /api/menu/plans/:id/shopping-list - Generate shopping list
router.get(
  "/plans/:id/shopping-list",
  validate([param("id").isUUID().withMessage("Invalid menu plan ID")]),
  async (req, res, next) => {
    try {
      if (!req.user || !req.user.userId) {
        const error: AppError = new Error("User not authenticated");
        error.statusCode = 401;
        return next(error);
      }

      const { id } = req.params;
      const userId = req.user.userId;
      const shoppingList = await MenuService.generateShoppingList(id, userId);

      res.json({
        status: "success",
        data: shoppingList,
      });
    } catch (error) {
      const err = error as Error;
      if (err.message === "Menu plan not found") {
        const appError: AppError = new Error(err.message);
        appError.statusCode = 404;
        return next(appError);
      }
      next(error);
    }
  }
);

// GET /api/menu/templates - List menu templates
router.get("/templates", async (req, res, next) => {
  try {
    if (!req.user || !req.user.userId) {
      const error: AppError = new Error("User not authenticated");
      error.statusCode = 401;
      return next(error);
    }

    const userId = req.user.userId;
    const templates = await MenuService.getAllMenuPlans(userId, true);

    // Filter to only templates
    const menuTemplates = templates.filter((t) => t.isTemplate);

    res.json({
      status: "success",
      data: menuTemplates,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
