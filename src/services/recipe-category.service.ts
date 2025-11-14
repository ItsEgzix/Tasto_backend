import { db } from "../db";
import { recipeCategories } from "../db/schema";
import { eq, and } from "drizzle-orm";

export class RecipeCategoryService {
  static async getAllCategories(userId: string) {
    return db
      .select()
      .from(recipeCategories)
      .where(eq(recipeCategories.userId, userId))
      .orderBy(recipeCategories.name);
  }

  static async getCategoryById(id: string, userId: string) {
    const [category] = await db
      .select()
      .from(recipeCategories)
      .where(
        and(eq(recipeCategories.id, id), eq(recipeCategories.userId, userId))
      )
      .limit(1);
    return category;
  }

  static async createCategory(
    data: {
      name: string;
      description?: string;
      color?: string;
    },
    userId: string
  ) {
    const [existing] = await db
      .select()
      .from(recipeCategories)
      .where(
        and(
          eq(recipeCategories.name, data.name),
          eq(recipeCategories.userId, userId)
        )
      )
      .limit(1);
    if (existing) {
      throw new Error("Recipe category with this name already exists");
    }
    const [newCategory] = await db
      .insert(recipeCategories)
      .values({ ...data, userId })
      .returning();
    return newCategory;
  }

  static async updateCategory(
    id: string,
    data: { name?: string; description?: string; color?: string },
    userId: string
  ) {
    const [existing] = await db
      .select()
      .from(recipeCategories)
      .where(
        and(eq(recipeCategories.id, id), eq(recipeCategories.userId, userId))
      )
      .limit(1);
    if (!existing) {
      throw new Error("Recipe category not found");
    }
    if (data.name && data.name !== existing.name) {
      const [nameConflict] = await db
        .select()
        .from(recipeCategories)
        .where(
          and(
            eq(recipeCategories.name, data.name),
            eq(recipeCategories.userId, userId)
          )
        )
        .limit(1);
      if (nameConflict) {
        throw new Error("Recipe category with this name already exists");
      }
    }
    const [updatedCategory] = await db
      .update(recipeCategories)
      .set({ ...data, updatedAt: new Date() })
      .where(
        and(eq(recipeCategories.id, id), eq(recipeCategories.userId, userId))
      )
      .returning();
    return updatedCategory;
  }

  static async deleteCategory(id: string, userId: string) {
    const [existing] = await db
      .select()
      .from(recipeCategories)
      .where(
        and(eq(recipeCategories.id, id), eq(recipeCategories.userId, userId))
      )
      .limit(1);
    if (!existing) {
      throw new Error("Recipe category not found");
    }
    // TODO: Add check for recipes linked to this category before deletion
    await db
      .delete(recipeCategories)
      .where(
        and(eq(recipeCategories.id, id), eq(recipeCategories.userId, userId))
      );
  }
}
