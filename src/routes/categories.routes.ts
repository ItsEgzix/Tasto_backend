import { Router } from "express";
import { body, param } from "express-validator";
import { CategoryService } from "../services/category.service";
import { validate } from "../middleware/validation";
import { authenticate } from "../middleware/auth.middleware";
import { AppError } from "../middleware/error-handler";

const router = Router();

router.use(authenticate);

// GET /api/categories - List all categories
router.get("/", async (_req, res, next) => {
  try {
    const categories = await CategoryService.getAllCategories();

    res.json({
      status: "success",
      data: categories,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/categories/:id - Get category details
router.get(
  "/:id",
  validate([param("id").isUUID().withMessage("Invalid category ID")]),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const category = await CategoryService.getCategoryById(id);

      if (!category) {
        const error: AppError = new Error("Category not found");
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

// POST /api/categories - Create new category
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

      const category = await CategoryService.createCategory({
        name,
        description,
        color,
      });

      res.status(201).json({
        status: "success",
        message: "Category created successfully",
        data: category,
      });
    } catch (error) {
      const err = error as Error;
      if (err.message === "Category with this name already exists") {
        const appError: AppError = new Error(err.message);
        appError.statusCode = 400;
        return next(appError);
      }
      next(error);
    }
  }
);

// PUT /api/categories/:id - Update category
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

      const category = await CategoryService.updateCategory(id, {
        name,
        description,
        color,
      });

      res.json({
        status: "success",
        message: "Category updated successfully",
        data: category,
      });
    } catch (error) {
      const err = error as Error;
      if (
        err.message === "Category not found" ||
        err.message === "Category with this name already exists"
      ) {
        const appError: AppError = new Error(err.message);
        appError.statusCode = err.message === "Category not found" ? 404 : 400;
        return next(appError);
      }
      next(error);
    }
  }
);

// DELETE /api/categories/:id - Delete category
router.delete(
  "/:id",
  validate([param("id").isUUID().withMessage("Invalid category ID")]),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      await CategoryService.deleteCategory(id);

      res.json({
        status: "success",
        message: "Category deleted successfully",
      });
    } catch (error) {
      const err = error as Error;
      if (err.message === "Category not found") {
        const appError: AppError = new Error(err.message);
        appError.statusCode = 404;
        return next(appError);
      }
      next(error);
    }
  }
);

export default router;
