import { db } from "../db";
import {
  menuPlans,
  menuItems,
  recipes,
  recipeCategories,
  recipeIngredients,
  ingredients,
  units,
  ingredientStock,
} from "../db/schema";
import { eq, desc, and, inArray, sql, count } from "drizzle-orm";
import { RecipeService } from "./recipe.service";

export interface MenuItemDetail {
  id: string;
  recipe: {
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
  };
  servings: string;
  notes: string | null;
  order: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface MenuPlanWithDetails {
  id: string;
  name: string;
  description: string | null;
  isTemplate: boolean;
  items: MenuItemDetail[];
  createdAt: Date;
  updatedAt: Date;
}

export interface MenuPlanListItem {
  id: string;
  name: string;
  description: string | null;
  isTemplate: boolean;
  itemCount: number;
  totalCost: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface MenuCost {
  totalCost: number;
  costPerServing: number;
  totalServings: number;
  breakdown: Array<{
    recipeId: string;
    recipeName: string;
    servings: number;
    cost: number;
    costPerServing: number;
  }>;
}

export interface ShoppingListItem {
  ingredientId: string;
  ingredientName: string;
  unit: string;
  totalQuantity: number;
  currentStock: number;
  needed: number;
  unitPrice: number;
  subtotal: number;
  isLowStock: boolean;
}

export class MenuService {
  // Get all menu plans (list view) - OPTIMIZED: Single query with aggregation
  static async getAllMenuPlans(
    userId: string,
    includeTemplates: boolean = true
  ): Promise<MenuPlanListItem[]> {
    const whereClause = includeTemplates
      ? eq(menuPlans.userId, userId)
      : and(eq(menuPlans.userId, userId), eq(menuPlans.isTemplate, false));

    // OPTIMIZED: Get all plans in one query
    const plans = await db
      .select({
        id: menuPlans.id,
        name: menuPlans.name,
        description: menuPlans.description,
        isTemplate: menuPlans.isTemplate,
        createdAt: menuPlans.createdAt,
        updatedAt: menuPlans.updatedAt,
      })
      .from(menuPlans)
      .where(whereClause)
      .orderBy(desc(menuPlans.createdAt));

    // OPTIMIZED: Get all item counts in a single query using aggregation
    const planIds = plans.map((p) => p.id);
    let itemCountsMap = new Map<string, number>();
    
    if (planIds.length > 0) {
      // Single query to get counts for all menus at once
      const counts = await db
        .select({
          menuPlanId: menuItems.menuPlanId,
          count: sql<number>`COUNT(*)::int`.as('count'),
        })
        .from(menuItems)
        .where(inArray(menuItems.menuPlanId, planIds))
        .groupBy(menuItems.menuPlanId);

      // Build a map for O(1) lookup
      counts.forEach((c) => {
        if (c.menuPlanId) {
          itemCountsMap.set(c.menuPlanId, Number(c.count) || 0);
        }
      });
    }

    // Convert to the expected format
    // Note: We skip cost calculation here for performance - it can be lazy-loaded when needed
    // Cost calculation is expensive and not always needed in list view
    const plansWithDetails: MenuPlanListItem[] = plans.map((plan) => ({
      id: plan.id,
      name: plan.name,
      description: plan.description,
      isTemplate: plan.isTemplate,
      itemCount: itemCountsMap.get(plan.id) || 0,
      totalCost: null, // Lazy-load cost when needed (e.g., when viewing menu details)
      createdAt: plan.createdAt,
      updatedAt: plan.updatedAt,
    }));

    return plansWithDetails;
  }

  // Get menu plan by ID with full details
  static async getMenuPlanById(
    id: string,
    userId: string
  ): Promise<MenuPlanWithDetails | null> {
    // Get menu plan
    const [plan] = await db
      .select()
      .from(menuPlans)
      .where(and(eq(menuPlans.id, id), eq(menuPlans.userId, userId)))
      .limit(1);

    if (!plan) {
      return null;
    }

    // Get menu items with recipe details
    const items = await db
      .select({
        id: menuItems.id,
        recipeId: menuItems.recipeId,
        servings: menuItems.servings,
        notes: menuItems.notes,
        order: menuItems.order,
        createdAt: menuItems.createdAt,
        updatedAt: menuItems.updatedAt,
        recipe: {
          id: recipes.id,
          name: recipes.name,
          categoryId: recipes.categoryId,
          description: recipes.description,
          instructions: recipes.instructions,
          serves: recipes.serves,
        },
        category: {
          id: recipeCategories.id,
          name: recipeCategories.name,
          description: recipeCategories.description,
          color: recipeCategories.color,
        },
      })
      .from(menuItems)
      .innerJoin(recipes, eq(menuItems.recipeId, recipes.id))
      .leftJoin(recipeCategories, eq(recipes.categoryId, recipeCategories.id))
      .where(eq(menuItems.menuPlanId, id))
      .orderBy(menuItems.order, menuItems.createdAt);

    const itemsWithDetails: MenuItemDetail[] = items.map((item) => ({
      id: item.id,
      recipe: {
        id: item.recipe.id,
        name: item.recipe.name,
        category: item.category
          ? {
              id: item.category.id,
              name: item.category.name,
              description: item.category.description,
              color: item.category.color,
            }
          : {
              id: "",
              name: "Uncategorized",
              description: null,
              color: null,
            },
        description: item.recipe.description,
        instructions: item.recipe.instructions,
        serves: item.recipe.serves,
      },
      servings: item.servings,
      notes: item.notes,
      order: item.order,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }));

    return {
      id: plan.id,
      name: plan.name,
      description: plan.description,
      isTemplate: plan.isTemplate,
      items: itemsWithDetails,
      createdAt: plan.createdAt,
      updatedAt: plan.updatedAt,
    };
  }

  // Create menu plan
  static async createMenuPlan(
    data: {
      name: string;
      description?: string;
      isTemplate?: boolean;
      items?: Array<{
        recipeId: string;
        servings: number;
        notes?: string;
        order?: number;
      }>;
    },
    userId: string
  ): Promise<MenuPlanWithDetails> {
    // Check if menu plan name already exists
    const [existing] = await db
      .select()
      .from(menuPlans)
      .where(and(eq(menuPlans.name, data.name), eq(menuPlans.userId, userId)))
      .limit(1);

    if (existing) {
      throw new Error("Menu plan with this name already exists");
    }

    // Create menu plan
    const [newPlan] = await db
      .insert(menuPlans)
      .values({
        name: data.name,
        description: data.description || null,
        isTemplate: data.isTemplate || false,
        userId,
      })
      .returning();

    // Add menu items if provided
    if (data.items && data.items.length > 0) {
      // Verify all recipes belong to the user
      const recipeIds = data.items.map((item) => item.recipeId);
      const userRecipes = await db
        .select({ id: recipes.id })
        .from(recipes)
        .where(and(eq(recipes.userId, userId), inArray(recipes.id, recipeIds)));

      if (userRecipes.length !== recipeIds.length) {
        throw new Error(
          "One or more recipes not found or don't belong to user"
        );
      }

      // Insert menu items
      await db.insert(menuItems).values(
        data.items.map((item, index) => ({
          menuPlanId: newPlan.id,
          recipeId: item.recipeId,
          servings: item.servings.toString(),
          notes: item.notes || null,
          order: item.order ?? index,
        }))
      );
    }

    // Fetch and return the complete menu plan
    const menuPlan = await this.getMenuPlanById(newPlan.id, userId);
    if (!menuPlan) {
      throw new Error("Failed to create menu plan");
    }

    return menuPlan;
  }

  // Update menu plan
  static async updateMenuPlan(
    id: string,
    data: {
      name?: string;
      description?: string;
      isTemplate?: boolean;
      items?: Array<{
        recipeId: string;
        servings: number;
        notes?: string;
        order?: number;
      }>;
    },
    userId: string
  ): Promise<MenuPlanWithDetails> {
    // Check if menu plan exists
    const [existing] = await db
      .select()
      .from(menuPlans)
      .where(and(eq(menuPlans.id, id), eq(menuPlans.userId, userId)))
      .limit(1);

    if (!existing) {
      throw new Error("Menu plan not found");
    }

    // Check if new name conflicts with existing menu plan
    if (data.name && data.name !== existing.name) {
      const [nameConflict] = await db
        .select()
        .from(menuPlans)
        .where(
          and(
            eq(menuPlans.name, data.name),
            eq(menuPlans.userId, userId),
            eq(menuPlans.id, id)
          )
        )
        .limit(1);

      if (nameConflict) {
        throw new Error("Menu plan with this name already exists");
      }
    }

    // Update menu plan
    const updateData: {
      name?: string;
      description?: string | null;
      isTemplate?: boolean;
      updatedAt?: Date;
    } = {
      updatedAt: new Date(),
    };

    if (data.name) updateData.name = data.name;
    if (data.description !== undefined)
      updateData.description = data.description || null;
    if (data.isTemplate !== undefined) updateData.isTemplate = data.isTemplate;

    await db
      .update(menuPlans)
      .set(updateData)
      .where(and(eq(menuPlans.id, id), eq(menuPlans.userId, userId)));

    // Update menu items if provided
    if (data.items !== undefined) {
      // Delete existing items
      await db.delete(menuItems).where(eq(menuItems.menuPlanId, id));

      // Insert new items
      if (data.items.length > 0) {
        // Verify all recipes belong to the user
        const recipeIds = data.items.map((item) => item.recipeId);
        const userRecipes = await db
          .select({ id: recipes.id })
          .from(recipes)
          .where(
            and(eq(recipes.userId, userId), inArray(recipes.id, recipeIds))
          );

        if (userRecipes.length !== recipeIds.length) {
          throw new Error(
            "One or more recipes not found or don't belong to user"
          );
        }

        await db.insert(menuItems).values(
          data.items.map((item, index) => ({
            menuPlanId: id,
            recipeId: item.recipeId,
            servings: item.servings.toString(),
            notes: item.notes || null,
            order: item.order ?? index,
          }))
        );
      }
    }

    // Fetch and return updated menu plan
    const menuPlan = await this.getMenuPlanById(id, userId);
    if (!menuPlan) {
      throw new Error("Failed to update menu plan");
    }

    return menuPlan;
  }

  // Delete menu plan
  static async deleteMenuPlan(id: string, userId: string): Promise<void> {
    // Check if menu plan exists
    const [existing] = await db
      .select()
      .from(menuPlans)
      .where(and(eq(menuPlans.id, id), eq(menuPlans.userId, userId)))
      .limit(1);

    if (!existing) {
      throw new Error("Menu plan not found");
    }

    // Delete menu plan (cascade will delete menu items)
    await db
      .delete(menuPlans)
      .where(and(eq(menuPlans.id, id), eq(menuPlans.userId, userId)));
  }

  // Calculate menu cost
  static async calculateMenuCost(
    menuPlanId: string,
    userId: string
  ): Promise<MenuCost> {
    const menuPlan = await this.getMenuPlanById(menuPlanId, userId);
    if (!menuPlan) {
      throw new Error("Menu plan not found");
    }

    if (menuPlan.items.length === 0) {
      return {
        totalCost: 0,
        costPerServing: 0,
        totalServings: 0,
        breakdown: [],
      };
    }

    const breakdown: MenuCost["breakdown"] = [];
    let totalCost = 0;
    let totalServings = 0;

    // Calculate cost for each recipe in the menu
    for (const item of menuPlan.items) {
      const servings = parseFloat(item.servings);
      totalServings += servings;

      try {
        const recipeCost = await RecipeService.calculateRecipeCost(
          item.recipe.id,
          userId,
          servings
        );

        breakdown.push({
          recipeId: item.recipe.id,
          recipeName: item.recipe.name,
          servings,
          cost: recipeCost.totalCost,
          costPerServing: recipeCost.costPerServing,
        });

        totalCost += recipeCost.totalCost;
      } catch (error) {
        console.error(
          `Error calculating cost for recipe ${item.recipe.id}:`,
          error
        );
        // Continue with other recipes even if one fails
        breakdown.push({
          recipeId: item.recipe.id,
          recipeName: item.recipe.name,
          servings,
          cost: 0,
          costPerServing: 0,
        });
      }
    }

    const costPerServing = totalServings > 0 ? totalCost / totalServings : 0;

    return {
      totalCost,
      costPerServing,
      totalServings,
      breakdown,
    };
  }

  // Generate shopping list for menu
  static async generateShoppingList(
    menuPlanId: string,
    userId: string
  ): Promise<ShoppingListItem[]> {
    const menuPlan = await this.getMenuPlanById(menuPlanId, userId);
    if (!menuPlan) {
      throw new Error("Menu plan not found");
    }

    if (menuPlan.items.length === 0) {
      return [];
    }

    // Aggregate ingredients from all recipes
    const ingredientMap = new Map<
      string,
      {
        ingredientId: string;
        ingredientName: string;
        unit: string;
        totalQuantity: number;
      }
    >();

    // Get all recipe IDs
    const recipeIds = menuPlan.items.map((item) => item.recipe.id);

    // Get all recipe ingredients
    const allRecipeIngredients = await db
      .select({
        recipeId: recipeIngredients.recipeId,
        ingredientId: recipeIngredients.ingredientId,
        quantity: recipeIngredients.quantity,
        ingredient: {
          id: ingredients.id,
          name: ingredients.name,
        },
        unit: {
          id: units.id,
          name: units.name,
        },
      })
      .from(recipeIngredients)
      .innerJoin(
        ingredients,
        eq(recipeIngredients.ingredientId, ingredients.id)
      )
      .innerJoin(units, eq(ingredients.unitId, units.id))
      .where(inArray(recipeIngredients.recipeId, recipeIds));

    // Calculate total quantities needed
    for (const menuItem of menuPlan.items) {
      const recipeServings = parseFloat(menuItem.servings);
      const baseServes = parseFloat(menuItem.recipe.serves);
      const multiplier = recipeServings / baseServes;

      const recipeIngs = allRecipeIngredients.filter(
        (ri) => ri.recipeId === menuItem.recipe.id
      );

      for (const ri of recipeIngs) {
        const baseQuantity = parseFloat(ri.quantity);
        const adjustedQuantity = baseQuantity * multiplier;

        const existing = ingredientMap.get(ri.ingredientId);
        if (existing) {
          existing.totalQuantity += adjustedQuantity;
        } else {
          ingredientMap.set(ri.ingredientId, {
            ingredientId: ri.ingredientId,
            ingredientName: ri.ingredient.name,
            unit: ri.unit.name,
            totalQuantity: adjustedQuantity,
          });
        }
      }
    }

    // Get current stock and prices for each ingredient
    const ingredientIds = Array.from(ingredientMap.keys());
    const stockData = await db
      .select({
        ingredientId: ingredientStock.ingredientId,
        quantity: ingredientStock.quantity,
        purchasePrice: ingredientStock.purchasePrice,
      })
      .from(ingredientStock)
      .where(
        and(
          eq(ingredientStock.userId, userId),
          inArray(ingredientStock.ingredientId, ingredientIds)
        )
      )
      .orderBy(desc(ingredientStock.purchaseDate));

    // Calculate current stock per ingredient
    const stockMap = new Map<string, { quantity: number; unitPrice: number }>();
    for (const stock of stockData) {
      const existing = stockMap.get(stock.ingredientId);
      if (!existing) {
        const quantity = parseFloat(stock.quantity);
        const price = parseFloat(stock.purchasePrice);
        const unitPrice = quantity > 0 ? price / quantity : 0;
        stockMap.set(stock.ingredientId, {
          quantity,
          unitPrice,
        });
      } else {
        // Sum up quantities from multiple stock entries
        existing.quantity += parseFloat(stock.quantity);
      }
    }

    // Build shopping list
    const shoppingList: ShoppingListItem[] = [];
    for (const [ingredientId, ingredient] of ingredientMap.entries()) {
      const stock = stockMap.get(ingredientId) || { quantity: 0, unitPrice: 0 };
      const needed = Math.max(0, ingredient.totalQuantity - stock.quantity);
      const subtotal = needed * stock.unitPrice;

      // Check if low stock (assuming threshold of 0 for now, can be enhanced)
      const isLowStock = stock.quantity < ingredient.totalQuantity;

      shoppingList.push({
        ingredientId,
        ingredientName: ingredient.ingredientName,
        unit: ingredient.unit,
        totalQuantity: ingredient.totalQuantity,
        currentStock: stock.quantity,
        needed,
        unitPrice: stock.unitPrice,
        subtotal,
        isLowStock,
      });
    }

    return shoppingList.sort((a, b) =>
      a.ingredientName.localeCompare(b.ingredientName)
    );
  }
}
