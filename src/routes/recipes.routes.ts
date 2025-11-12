import { Router } from "express";
import { body, param, query } from "express-validator";
import { RecipeService } from "../services/recipe.service";
import { validate } from "../middleware/validation";
import { authenticate } from "../middleware/auth.middleware";
import { AppError } from "../middleware/error-handler";

const router = Router();

// All routes require authentication
router.use(authenticate);

// GET /api/recipes - List all recipes
// OPTIMIZED: Uses batch queries and caching
router.get("/", async (_req, res, next) => {
  try {
    const recipes = await RecipeService.getAllRecipes();

    // Add cache header for 5 minutes
    res.setHeader("Cache-Control", "private, max-age=300");
    res.json({
      status: "success",
      data: recipes,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/recipes/:id - Get recipe details
// OPTIMIZED: Uses parallel queries and caching
router.get(
  "/:id",
  validate([param("id").isUUID().withMessage("Invalid recipe ID")]),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const recipe = await RecipeService.getRecipeById(id);

      if (!recipe) {
        const error: AppError = new Error("Recipe not found");
        error.statusCode = 404;
        return next(error);
      }

      // Add cache header for 5 minutes
      res.setHeader("Cache-Control", "private, max-age=300");
      res.json({
        status: "success",
        data: recipe,
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/recipes/:id/cost - Calculate recipe cost
router.get(
  "/:id/cost",
  validate([
    param("id").isUUID().withMessage("Invalid recipe ID"),
    query("servings")
      .optional()
      .isNumeric()
      .withMessage("Servings must be a number"),
  ]),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { servings } = req.query;

      const desiredServings = servings
        ? parseFloat(servings as string)
        : undefined;

      const cost = await RecipeService.calculateRecipeCost(id, desiredServings);

      res.json({
        status: "success",
        data: cost,
      });
    } catch (error) {
      const err = error as Error;
      if (err.message === "Recipe not found") {
        const appError: AppError = new Error(err.message);
        appError.statusCode = 404;
        return next(appError);
      }
      next(error);
    }
  }
);

// POST /api/recipes - Create new recipe
router.post(
  "/",
  validate([
    body("name").trim().notEmpty().withMessage("Recipe name is required"),
    body("categoryId")
      .isUUID()
      .withMessage("Valid recipe category ID is required"),
    body("instructions")
      .trim()
      .notEmpty()
      .withMessage("Instructions are required"),
    body("serves")
      .isNumeric()
      .withMessage("Serves must be a number")
      .custom((value) => {
        if (parseFloat(value) <= 0) {
          throw new Error("Serves must be greater than 0");
        }
        return true;
      }),
    body("description").optional().trim(),
    body("ingredients")
      .isArray()
      .withMessage("Ingredients must be an array")
      .custom((ingredients) => {
        if (ingredients.length === 0) {
          throw new Error("Recipe must have at least one ingredient");
        }
        return true;
      }),
    body("ingredients.*.ingredientId")
      .isUUID()
      .withMessage("Valid ingredient ID is required"),
    body("ingredients.*.quantity")
      .isNumeric()
      .withMessage("Quantity must be a number")
      .custom((value) => {
        if (parseFloat(value) <= 0) {
          throw new Error("Quantity must be greater than 0");
        }
        return true;
      }),
  ]),
  async (req, res, next) => {
    try {
      const {
        name,
        categoryId,
        description,
        instructions,
        serves,
        ingredients,
      } = req.body;

      const recipe = await RecipeService.createRecipe({
        name,
        categoryId,
        description,
        instructions,
        serves: parseFloat(serves),
        ingredients: ingredients.map((ing: any) => ({
          ingredientId: ing.ingredientId,
          quantity: parseFloat(ing.quantity),
        })),
      });

      res.status(201).json({
        status: "success",
        message: "Recipe created successfully",
        data: recipe,
      });
    } catch (error) {
      const err = error as Error;
      if (
        err.message === "Recipe with this name already exists" ||
        err.message === "Recipe category not found" ||
        err.message.includes("Ingredient with ID")
      ) {
        const appError: AppError = new Error(err.message);
        appError.statusCode = 400;
        return next(appError);
      }
      next(error);
    }
  }
);

// PUT /api/recipes/:id - Update recipe
router.put(
  "/:id",
  validate([
    param("id").isUUID().withMessage("Invalid recipe ID"),
    body("name")
      .optional()
      .trim()
      .notEmpty()
      .withMessage("Name cannot be empty"),
    body("categoryId")
      .optional()
      .isUUID()
      .withMessage("Valid recipe category ID is required"),
    body("instructions")
      .optional()
      .trim()
      .notEmpty()
      .withMessage("Instructions cannot be empty"),
    body("serves")
      .optional()
      .isNumeric()
      .withMessage("Serves must be a number")
      .custom((value) => {
        if (parseFloat(value) <= 0) {
          throw new Error("Serves must be greater than 0");
        }
        return true;
      }),
    body("description").optional().trim(),
    body("ingredients")
      .optional()
      .isArray()
      .withMessage("Ingredients must be an array")
      .custom((ingredients) => {
        if (ingredients && ingredients.length === 0) {
          throw new Error("Recipe must have at least one ingredient");
        }
        return true;
      }),
    body("ingredients.*.ingredientId")
      .optional()
      .isUUID()
      .withMessage("Valid ingredient ID is required"),
    body("ingredients.*.quantity")
      .optional()
      .isNumeric()
      .withMessage("Quantity must be a number")
      .custom((value) => {
        if (value && parseFloat(value) <= 0) {
          throw new Error("Quantity must be greater than 0");
        }
        return true;
      }),
  ]),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const {
        name,
        categoryId,
        description,
        instructions,
        serves,
        ingredients,
      } = req.body;

      const updateData: any = {};
      if (name) updateData.name = name;
      if (categoryId) updateData.categoryId = categoryId;
      if (description !== undefined) updateData.description = description;
      if (instructions) updateData.instructions = instructions;
      if (serves) updateData.serves = parseFloat(serves);
      if (ingredients) {
        updateData.ingredients = ingredients.map((ing: any) => ({
          ingredientId: ing.ingredientId,
          quantity: parseFloat(ing.quantity),
        }));
      }

      const recipe = await RecipeService.updateRecipe(id, updateData);

      res.json({
        status: "success",
        message: "Recipe updated successfully",
        data: recipe,
      });
    } catch (error) {
      const err = error as Error;
      if (
        err.message === "Recipe not found" ||
        err.message === "Recipe with this name already exists" ||
        err.message === "Recipe category not found" ||
        err.message.includes("Ingredient with ID")
      ) {
        const appError: AppError = new Error(err.message);
        appError.statusCode = err.message === "Recipe not found" ? 404 : 400;
        return next(appError);
      }
      next(error);
    }
  }
);

// DELETE /api/recipes/:id - Delete recipe
router.delete(
  "/:id",
  validate([param("id").isUUID().withMessage("Invalid recipe ID")]),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      await RecipeService.deleteRecipe(id);

      res.json({
        status: "success",
        message: "Recipe deleted successfully",
      });
    } catch (error) {
      const err = error as Error;
      if (err.message === "Recipe not found") {
        const appError: AppError = new Error(err.message);
        appError.statusCode = 404;
        return next(appError);
      }
      next(error);
    }
  }
);

export default router;
