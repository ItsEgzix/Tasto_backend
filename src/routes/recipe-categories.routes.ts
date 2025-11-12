import { Router } from "express";
import { body, param } from "express-validator";
import { RecipeCategoryService } from "../services/recipe-category.service";
import { validate } from "../middleware/validation";
import { authenticate } from "../middleware/auth.middleware";
import { AppError } from "../middleware/error-handler";

const router = Router();

router.use(authenticate);

// GET /api/recipe-categories - List all recipe categories
router.get("/", async (_req, res, next) => {
  try {
    const categories = await RecipeCategoryService.getAllCategories();

    res.json({
      status: "success",
      data: categories,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/recipe-categories/:id - Get category details
router.get(
  "/:id",
  validate([param("id").isUUID().withMessage("Invalid category ID")]),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const category = await RecipeCategoryService.getCategoryById(id);

      if (!category) {
        const error: AppError = new Error("Recipe category not found");
        error.statusCode = 404;
        return next(error);
      }

      res.json({
        status: "success",
        data: category,
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/recipe-categories - Create new category
router.post(
  "/",
  validate([
    body("name").trim().notEmpty().withMessage("Category name is required"),
    body("description").optional().trim(),
    body("color").optional().trim(),
  ]),
  async (req, res, next) => {
    try {
      const { name, description, color } = req.body;

      const category = await RecipeCategoryService.createCategory({
        name,
        description,
        color,
      });

      res.status(201).json({
        status: "success",
        message: "Recipe category created successfully",
        data: category,
      });
    } catch (error) {
      const err = error as Error;
      if (err.message === "Recipe category with this name already exists") {
        const appError: AppError = new Error(err.message);
        appError.statusCode = 400;
        return next(appError);
      }
      next(error);
    }
  }
);

// PUT /api/recipe-categories/:id - Update category
router.put(
  "/:id",
  validate([
    param("id").isUUID().withMessage("Invalid category ID"),
    body("name")
      .optional()
      .trim()
      .notEmpty()
      .withMessage("Name cannot be empty"),
    body("description").optional().trim(),
    body("color").optional().trim(),
  ]),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { name, description, color } = req.body;

      const category = await RecipeCategoryService.updateCategory(id, {
        name,
        description,
        color,
      });

      res.json({
        status: "success",
        message: "Recipe category updated successfully",
        data: category,
      });
    } catch (error) {
      const err = error as Error;
      if (
        err.message === "Recipe category not found" ||
        err.message === "Recipe category with this name already exists"
      ) {
        const appError: AppError = new Error(err.message);
        appError.statusCode =
          err.message === "Recipe category not found" ? 404 : 400;
        return next(appError);
      }
      next(error);
    }
  }
);

// DELETE /api/recipe-categories/:id - Delete category
router.delete(
  "/:id",
  validate([param("id").isUUID().withMessage("Invalid category ID")]),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      await RecipeCategoryService.deleteCategory(id);

      res.json({
        status: "success",
        message: "Recipe category deleted successfully",
      });
    } catch (error) {
      const err = error as Error;
      if (err.message === "Recipe category not found") {
        const appError: AppError = new Error(err.message);
        appError.statusCode = 404;
        return next(appError);
      }
      next(error);
    }
  }
);

export default router;
