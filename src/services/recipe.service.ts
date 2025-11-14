import { db } from "../db";
import {
  recipes,
  recipeCategories,
  recipeIngredients,
  ingredients,
  units,
  ingredientStock,
} from "../db/schema";
import { eq, desc, inArray, and } from "drizzle-orm";
import { InventoryService } from "./inventory.service";

export interface RecipeIngredientDetail {
  id: string;
  ingredient: {
    id: string;
    name: string;
    unit: {
      id: string;
      name: string;
      type: string;
      symbol: string | null;
      description: string | null;
    };
  };
  quantity: string;
}

export interface RecipeWithDetails {
  id: string;
  name: string;
  category: {
    id: string;
    name: string;
    description: string | null;
    color: string | null;
  };
  description: string | null;
  instructions: string;
  serves: string;
  ingredients: RecipeIngredientDetail[];
  createdAt: Date;
  updatedAt: Date;
}

export interface RecipeCostBreakdown {
  ingredient: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  subtotal: number;
}

export interface RecipeCost {
  totalCost: number;
  breakdown: RecipeCostBreakdown[];
  serves: number;
  costPerServing: number;
}

export class RecipeService {
  // Get all recipes with basic info - OPTIMIZED VERSION
  static async getAllRecipes(userId: string): Promise<
    (Omit<RecipeWithDetails, "ingredients"> & {
      estimatedCost: number | null;
    })[]
  > {
    // Step 1: Get all recipes with categories (1 query)
    const result = await db
      .select({
        id: recipes.id,
        name: recipes.name,
        categoryId: recipes.categoryId,
        description: recipes.description,
        instructions: recipes.instructions,
        serves: recipes.serves,
        createdAt: recipes.createdAt,
        updatedAt: recipes.updatedAt,
        category: {
          id: recipeCategories.id,
          name: recipeCategories.name,
          description: recipeCategories.description,
          color: recipeCategories.color,
        },
      })
      .from(recipes)
      .leftJoin(recipeCategories, eq(recipes.categoryId, recipeCategories.id))
      .where(eq(recipes.userId, userId))
      .orderBy(desc(recipes.createdAt));

    if (result.length === 0) {
      return [];
    }

    // Step 2: Get ALL recipe ingredients for ALL recipes in one query
    const recipeIds = result.map((r) => r.id);
    const allRecipeIngredients = await db
      .select({
        recipeId: recipeIngredients.recipeId,
        quantity: recipeIngredients.quantity,
        ingredientId: recipeIngredients.ingredientId,
      })
      .from(recipeIngredients)
      .where(inArray(recipeIngredients.recipeId, recipeIds));

    // Step 3: Get unique ingredient IDs and fetch their last purchases in batch
    const uniqueIngredientIds = [
      ...new Set(allRecipeIngredients.map((ri) => ri.ingredientId)),
    ];

    if (uniqueIngredientIds.length === 0) {
      // No ingredients, return recipes without costs
      return result.map((item) => ({
        id: item.id,
        name: item.name,
        category: item.category!,
        description: item.description,
        instructions: item.instructions,
        serves: item.serves,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        estimatedCost: null,
      }));
    }

    // Get all purchases for these ingredients, then filter to most recent per ingredient in memory
    // This is more efficient than N queries
    const allPurchases = await db
      .select({
        ingredientId: ingredientStock.ingredientId,
        purchasePrice: ingredientStock.purchasePrice,
        quantity: ingredientStock.quantity,
        purchaseDate: ingredientStock.purchaseDate,
      })
      .from(ingredientStock)
      .where(
        and(
          inArray(ingredientStock.ingredientId, uniqueIngredientIds),
          eq(ingredientStock.userId, userId)
        )
      )
      .orderBy(desc(ingredientStock.purchaseDate));

    // Group by ingredient ID and take the first (most recent) for each
    const lastPurchaseMap = new Map<string, (typeof allPurchases)[0]>();
    for (const purchase of allPurchases) {
      if (!lastPurchaseMap.has(purchase.ingredientId)) {
        lastPurchaseMap.set(purchase.ingredientId, purchase);
      }
    }

    // Step 4: Group recipe ingredients by recipe ID
    const ingredientsByRecipe = new Map<
      string,
      Array<{ ingredientId: string; quantity: string }>
    >();
    for (const ri of allRecipeIngredients) {
      if (!ingredientsByRecipe.has(ri.recipeId)) {
        ingredientsByRecipe.set(ri.recipeId, []);
      }
      ingredientsByRecipe.get(ri.recipeId)!.push({
        ingredientId: ri.ingredientId,
        quantity: ri.quantity,
      });
    }

    // Step 5: Calculate costs in memory (no more database queries!)
    const recipesWithCost = result.map((item) => {
      let estimatedCost: number | null = null;

      try {
        const recipeIngredientsData = ingredientsByRecipe.get(item.id) || [];

        let totalCost = 0;
        let hasPrice = false;

        for (const recipeIngredient of recipeIngredientsData) {
          const lastPurchase = lastPurchaseMap.get(
            recipeIngredient.ingredientId
          );

          if (lastPurchase && parseFloat(lastPurchase.quantity) > 0) {
            hasPrice = true;
            // Calculate price per unit: total purchase price / quantity purchased
            const unitPrice =
              parseFloat(lastPurchase.purchasePrice) /
              parseFloat(lastPurchase.quantity);
            const ingredientQuantity = parseFloat(recipeIngredient.quantity);
            totalCost += ingredientQuantity * unitPrice;
          }
        }

        estimatedCost = hasPrice ? totalCost : null;
      } catch (error) {
        console.error(`Error calculating cost for recipe ${item.id}:`, error);
        estimatedCost = null;
      }

      return {
        id: item.id,
        name: item.name,
        category: item.category!,
        description: item.description,
        instructions: item.instructions,
        serves: item.serves,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        estimatedCost,
      };
    });

    return recipesWithCost;
  }

  // Get recipe by ID with full details including ingredients - OPTIMIZED VERSION
  static async getRecipeById(
    id: string,
    userId: string
  ): Promise<RecipeWithDetails | null> {
    // OPTIMIZED: Get recipe and ingredients in parallel (2 queries instead of sequential)
    const [recipeResult, recipeIngredientsData] = await Promise.all([
      // Query 1: Get recipe basic info with category
      db
        .select({
          id: recipes.id,
          name: recipes.name,
          categoryId: recipes.categoryId,
          description: recipes.description,
          instructions: recipes.instructions,
          serves: recipes.serves,
          createdAt: recipes.createdAt,
          updatedAt: recipes.updatedAt,
          category: {
            id: recipeCategories.id,
            name: recipeCategories.name,
            description: recipeCategories.description,
            color: recipeCategories.color,
          },
        })
        .from(recipes)
        .leftJoin(recipeCategories, eq(recipes.categoryId, recipeCategories.id))
        .where(and(eq(recipes.id, id), eq(recipes.userId, userId)))
        .limit(1),
      // Query 2: Get recipe ingredients with ingredient and unit details
      db
        .select({
          id: recipeIngredients.id,
          ingredientId: recipeIngredients.ingredientId,
          quantity: recipeIngredients.quantity,
          ingredient: {
            id: ingredients.id,
            name: ingredients.name,
            unitId: ingredients.unitId,
          },
          unit: {
            id: units.id,
            name: units.name,
            type: units.type,
            symbol: units.symbol,
            description: units.description,
          },
        })
        .from(recipeIngredients)
        .leftJoin(
          ingredients,
          eq(recipeIngredients.ingredientId, ingredients.id)
        )
        .leftJoin(units, eq(ingredients.unitId, units.id))
        .where(
          and(
            eq(recipeIngredients.recipeId, id),
            eq(ingredients.userId, userId)
          )
        ),
    ]);

    const [recipe] = recipeResult;
    if (!recipe) {
      return null;
    }

    const ingredientsList: RecipeIngredientDetail[] = recipeIngredientsData.map(
      (ri) => ({
        id: ri.id,
        ingredient: {
          id: ri.ingredient!.id,
          name: ri.ingredient!.name,
          unit: {
            id: ri.unit!.id,
            name: ri.unit!.name,
            type: ri.unit!.type,
            symbol: ri.unit!.symbol,
            description: ri.unit!.description,
          },
        },
        quantity: ri.quantity,
      })
    );

    return {
      id: recipe.id,
      name: recipe.name,
      category: recipe.category!,
      description: recipe.description,
      instructions: recipe.instructions,
      serves: recipe.serves,
      ingredients: ingredientsList,
      createdAt: recipe.createdAt,
      updatedAt: recipe.updatedAt,
    };
  }

  // Create new recipe
  static async createRecipe(
    data: {
      name: string;
      categoryId: string;
      description?: string;
      instructions: string;
      serves: number;
      ingredients: Array<{ ingredientId: string; quantity: number }>;
    },
    userId: string
  ): Promise<RecipeWithDetails> {
    // Check if recipe name already exists
    const [existing] = await db
      .select()
      .from(recipes)
      .where(and(eq(recipes.name, data.name), eq(recipes.userId, userId)))
      .limit(1);

    if (existing) {
      throw new Error("Recipe with this name already exists");
    }

    // Verify category exists
    const [category] = await db
      .select()
      .from(recipeCategories)
      .where(
        and(
          eq(recipeCategories.id, data.categoryId),
          eq(recipeCategories.userId, userId)
        )
      )
      .limit(1);

    if (!category) {
      throw new Error("Recipe category not found");
    }

    // Verify all ingredients exist
    for (const ing of data.ingredients) {
      const [ingredient] = await db
        .select()
        .from(ingredients)
        .where(
          and(
            eq(ingredients.id, ing.ingredientId),
            eq(ingredients.userId, userId)
          )
        )
        .limit(1);

      if (!ingredient) {
        throw new Error(`Ingredient with ID ${ing.ingredientId} not found`);
      }
    }

    // Create recipe
    const [newRecipe] = await db
      .insert(recipes)
      .values({
        name: data.name,
        categoryId: data.categoryId,
        description: data.description || null,
        instructions: data.instructions,
        serves: data.serves.toString(),
        userId,
      })
      .returning();

    // Create recipe ingredients
    if (data.ingredients.length > 0) {
      await db.insert(recipeIngredients).values(
        data.ingredients.map((ing) => ({
          recipeId: newRecipe.id,
          ingredientId: ing.ingredientId,
          quantity: ing.quantity.toString(),
        }))
      );
    }

    // Fetch and return complete recipe
    const recipe = await this.getRecipeById(newRecipe.id, userId);
    if (!recipe) {
      throw new Error("Failed to create recipe");
    }

    return recipe;
  }

  // Update recipe
  static async updateRecipe(
    id: string,
    data: {
      name?: string;
      categoryId?: string;
      description?: string;
      instructions?: string;
      serves?: number;
      ingredients?: Array<{ ingredientId: string; quantity: number }>;
    },
    userId: string
  ): Promise<RecipeWithDetails> {
    // Check if recipe exists
    const [existing] = await db
      .select()
      .from(recipes)
      .where(and(eq(recipes.id, id), eq(recipes.userId, userId)))
      .limit(1);

    if (!existing) {
      throw new Error("Recipe not found");
    }

    // Check if new name conflicts with existing recipe
    if (data.name && data.name !== existing.name) {
      const [nameConflict] = await db
        .select()
        .from(recipes)
        .where(and(eq(recipes.name, data.name), eq(recipes.userId, userId)))
        .limit(1);

      if (nameConflict) {
        throw new Error("Recipe with this name already exists");
      }
    }

    // Verify category if provided
    if (data.categoryId) {
      const [category] = await db
        .select()
        .from(recipeCategories)
        .where(
          and(
            eq(recipeCategories.id, data.categoryId),
            eq(recipeCategories.userId, userId)
          )
        )
        .limit(1);

      if (!category) {
        throw new Error("Recipe category not found");
      }
    }

    // Verify ingredients if provided
    if (data.ingredients) {
      for (const ing of data.ingredients) {
        const [ingredient] = await db
          .select()
          .from(ingredients)
          .where(
            and(
              eq(ingredients.id, ing.ingredientId),
              eq(ingredients.userId, userId)
            )
          )
          .limit(1);

        if (!ingredient) {
          throw new Error(`Ingredient with ID ${ing.ingredientId} not found`);
        }
      }
    }

    // Update recipe
    const updateData: {
      name?: string;
      categoryId?: string;
      description?: string | null;
      instructions?: string;
      serves?: string;
      updatedAt?: Date;
    } = {
      updatedAt: new Date(),
    };

    if (data.name) updateData.name = data.name;
    if (data.categoryId) updateData.categoryId = data.categoryId;
    if (data.description !== undefined)
      updateData.description = data.description || null;
    if (data.instructions) updateData.instructions = data.instructions;
    if (data.serves !== undefined) updateData.serves = data.serves.toString();

    await db
      .update(recipes)
      .set(updateData)
      .where(and(eq(recipes.id, id), eq(recipes.userId, userId)));

    // Update ingredients if provided
    if (data.ingredients) {
      // Delete existing ingredients
      await db
        .delete(recipeIngredients)
        .where(eq(recipeIngredients.recipeId, id));

      // Insert new ingredients
      if (data.ingredients.length > 0) {
        await db.insert(recipeIngredients).values(
          data.ingredients.map((ing) => ({
            recipeId: id,
            ingredientId: ing.ingredientId,
            quantity: ing.quantity.toString(),
          }))
        );
      }
    }

    // Fetch updated recipe
    const recipe = await this.getRecipeById(id, userId);
    if (!recipe) {
      throw new Error("Failed to update recipe");
    }

    return recipe;
  }

  // Delete recipe
  static async deleteRecipe(id: string, userId: string): Promise<void> {
    // Check if recipe exists
    const [existing] = await db
      .select()
      .from(recipes)
      .where(and(eq(recipes.id, id), eq(recipes.userId, userId)))
      .limit(1);

    if (!existing) {
      throw new Error("Recipe not found");
    }

    // TODO: Check if recipe is used in production plans or menu plans
    // If it is, prevent deletion or handle cascade

    await db
      .delete(recipes)
      .where(and(eq(recipes.id, id), eq(recipes.userId, userId)));
  }

  // Calculate recipe cost
  static async calculateRecipeCost(
    recipeId: string,
    userId: string,
    desiredServings?: number
  ): Promise<RecipeCost> {
    const recipe = await this.getRecipeById(recipeId, userId);

    if (!recipe) {
      throw new Error("Recipe not found");
    }

    const baseServes = parseFloat(recipe.serves);
    const servings = desiredServings || baseServes;
    const multiplier = servings / baseServes;

    const breakdown: RecipeCostBreakdown[] = [];

    // Get cost for each ingredient
    for (const recipeIngredient of recipe.ingredients) {
      const baseQuantity = parseFloat(recipeIngredient.quantity);
      const adjustedQuantity = baseQuantity * multiplier;

      // Get last purchase price and quantity for this ingredient to calculate unit price
      const [lastPurchase] = await db
        .select({
          purchasePrice: ingredientStock.purchasePrice,
          quantity: ingredientStock.quantity,
        })
        .from(ingredientStock)
        .where(
          and(
            eq(ingredientStock.ingredientId, recipeIngredient.ingredient.id),
            eq(ingredientStock.userId, userId)
          )
        )
        .orderBy(desc(ingredientStock.purchaseDate))
        .limit(1);

      // Calculate price per unit: total purchase price / quantity purchased
      const unitPrice =
        lastPurchase && parseFloat(lastPurchase.quantity) > 0
          ? parseFloat(lastPurchase.purchasePrice) /
            parseFloat(lastPurchase.quantity)
          : 0;

      const subtotal = adjustedQuantity * unitPrice;

      breakdown.push({
        ingredient: recipeIngredient.ingredient.name,
        quantity: adjustedQuantity,
        unit: recipeIngredient.ingredient.unit.name,
        unitPrice,
        subtotal,
      });
    }

    const totalCost = breakdown.reduce((sum, item) => sum + item.subtotal, 0);
    const costPerServing = totalCost / servings;

    return {
      totalCost,
      breakdown,
      serves: servings,
      costPerServing,
    };
  }

  // Complete a recipe - OPTIMIZED: Single API call with batch operations
  static async completeRecipe(
    recipeId: string,
    userId: string,
    options?: {
      date?: string;
      allowPartialStock?: boolean;
      actualQuantities?: Array<{
        ingredientId: string;
        quantity: number;
      }>;
    }
  ): Promise<{
    success: boolean;
    shortages?: Array<{
      ingredientId: string;
      ingredientName: string;
      requiredQuantity: number;
      availableQuantity: number;
      shortageQuantity: number;
      unit: string;
    }>;
  }> {
    // Get recipe with ingredients (1 query)
    const recipe = await this.getRecipeById(recipeId, userId);
    if (!recipe) {
      throw new Error("Recipe not found");
    }

    // Determine quantities to use (actualQuantities override or use recipe quantities)
    const quantitiesToUse = new Map<string, number>();
    if (options?.actualQuantities) {
      for (const item of options.actualQuantities) {
        quantitiesToUse.set(item.ingredientId, item.quantity);
      }
    } else {
      for (const ingredient of recipe.ingredients) {
        quantitiesToUse.set(ingredient.ingredient.id, parseFloat(ingredient.quantity));
      }
    }

    // Get all ingredient IDs
    const ingredientIds = Array.from(quantitiesToUse.keys());

    // Create a map of ingredient info for quick lookup (including names and units)
    const ingredientInfoMap = new Map<
      string,
      { name: string; unit: string }
    >();
    for (const ingredient of recipe.ingredients) {
      // Defensive check: ensure ingredient data exists
      if (
        ingredient?.ingredient?.id &&
        ingredient?.ingredient?.name &&
        ingredient?.ingredient?.unit?.name
      ) {
        ingredientInfoMap.set(ingredient.ingredient.id, {
          name: ingredient.ingredient.name,
          unit: ingredient.ingredient.unit.name,
        });
      } else {
        console.error(
          `Invalid ingredient data in recipe ${recipeId}:`,
          ingredient
        );
      }
    }

    // If actualQuantities is provided, we need to fetch ingredient names for any missing ones
    if (options?.actualQuantities) {
      const missingIngredientIds = ingredientIds.filter(
        (id) => !ingredientInfoMap.has(id)
      );
      if (missingIngredientIds.length > 0) {
        const missingIngredients = await db
          .select({
            id: ingredients.id,
            name: ingredients.name,
            unitName: units.name,
          })
          .from(ingredients)
          .leftJoin(units, eq(ingredients.unitId, units.id))
          .where(
            and(
              inArray(ingredients.id, missingIngredientIds),
              eq(ingredients.userId, userId)
            )
          );

        for (const ing of missingIngredients) {
          if (ing.id && ing.name && ing.unitName) {
            ingredientInfoMap.set(ing.id, {
              name: ing.name,
              unit: ing.unitName,
            });
          }
        }
      }
    }

    // Batch get stock for all ingredients (1-2 queries total)
    const stockByIngredient = await InventoryService.batchGetIngredientStock(
      ingredientIds,
      userId
    );

    // Build usage plan with FIFO logic
    const usageOperations: Array<{
      ingredientStockId: string;
      quantityUsed: number;
      date: string;
      reason: string;
      notes: string;
    }> = [];

    const shortages: Array<{
      ingredientId: string;
      ingredientName: string;
      requiredQuantity: number;
      availableQuantity: number;
      shortageQuantity: number;
      unit: string;
    }> = [];

    const today = options?.date || new Date().toISOString().split("T")[0];

    // Process all ingredients in quantitiesToUse (not just recipe.ingredients)
    for (const ingredientId of ingredientIds) {
      const requiredQuantity = quantitiesToUse.get(ingredientId) || 0;

      if (requiredQuantity <= 0) {
        continue;
      }

      // Get ingredient info (name and unit)
      const ingredientInfo = ingredientInfoMap.get(ingredientId);
      if (!ingredientInfo) {
        // Skip if we can't find ingredient info (shouldn't happen, but handle gracefully)
        console.error(
          `Ingredient info not found for ID: ${ingredientId} in recipe ${recipeId}`
        );
        continue;
      }

      const stockEntries = stockByIngredient.get(ingredientId) || [];

      if (stockEntries.length === 0) {
        shortages.push({
          ingredientId,
          ingredientName: ingredientInfo.name,
          requiredQuantity,
          availableQuantity: 0,
          shortageQuantity: requiredQuantity,
          unit: ingredientInfo.unit,
        });
        continue;
      }

      // Sort by purchase date (oldest first) for FIFO
      const sortedStock = [...stockEntries].sort(
        (a, b) =>
          new Date(a.purchaseDate).getTime() - new Date(b.purchaseDate).getTime()
      );

      let remainingQuantity = requiredQuantity;
      let totalAvailable = 0;

      // Distribute usage across stock entries (FIFO)
      for (const stock of sortedStock) {
        if (remainingQuantity <= 0) break;

        const available = parseFloat(stock.remainingQuantity);
        if (available <= 0) continue;

        totalAvailable += available;
        const quantityToUse = Math.min(remainingQuantity, available);

        usageOperations.push({
          ingredientStockId: stock.id,
          quantityUsed: quantityToUse,
          date: today,
          reason: `Recipe: ${recipe.name}`,
          notes: `Production completion for recipe: ${recipe.name}`,
        });

        remainingQuantity -= quantityToUse;
      }

      // Check if we couldn't fulfill the full quantity
      if (remainingQuantity > 0) {
        shortages.push({
          ingredientId,
          ingredientName: ingredientInfo.name,
          requiredQuantity,
          availableQuantity: totalAvailable,
          shortageQuantity: remainingQuantity,
          unit: ingredientInfo.unit,
        });
      }
    }

    // If there are shortages and partial stock is not allowed, return error
    if (shortages.length > 0 && !options?.allowPartialStock) {
      return {
        success: false,
        shortages,
      };
    }

    // Record all usage in one batch transaction
    if (usageOperations.length > 0) {
      await InventoryService.batchRecordUsage(usageOperations, userId);
    }

    return {
      success: true,
      shortages: shortages.length > 0 ? shortages : undefined,
    };
  }
}
