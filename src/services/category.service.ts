import { db } from "../db";
import { categories } from "../db/schema";
import { eq } from "drizzle-orm";

export class CategoryService {
  // List all categories
  static async getAllCategories() {
    return await db.select().from(categories).orderBy(categories.name);
  }

  // Get category by ID
  static async getCategoryById(id: string) {
    const [category] = await db
      .select()
      .from(categories)
      .where(eq(categories.id, id))
      .limit(1);

    return category || null;
  }

  // Create new category
  static async createCategory(data: {
    name: string;
    description?: string;
    color?: string;
  }) {
    // Check if category name already exists
    const [existing] = await db
      .select()
      .from(categories)
      .where(eq(categories.name, data.name))
      .limit(1);

    if (existing) {
      throw new Error("Category with this name already exists");
    }

    const [newCategory] = await db
      .insert(categories)
      .values({
        name: data.name,
        description: data.description || null,
        color: data.color || null,
      })
      .returning();

    return newCategory;
  }

  // Update category
  static async updateCategory(
    id: string,
    data: {
      name?: string;
      description?: string;
      color?: string;
    }
  ) {
    // Check if category exists
    const [existing] = await db
      .select()
      .from(categories)
      .where(eq(categories.id, id))
      .limit(1);

    if (!existing) {
      throw new Error("Category not found");
    }

    // Check if new name conflicts with existing category
    if (data.name && data.name !== existing.name) {
      const [nameConflict] = await db
        .select()
        .from(categories)
        .where(eq(categories.name, data.name))
        .limit(1);

      if (nameConflict) {
        throw new Error("Category with this name already exists");
      }
    }

    const updateData: {
      name?: string;
      description?: string | null;
      color?: string | null;
      updatedAt?: Date;
    } = {
      updatedAt: new Date(),
    };

    if (data.name) updateData.name = data.name;
    if (data.description !== undefined)
      updateData.description = data.description || null;
    if (data.color !== undefined) updateData.color = data.color || null;

    await db.update(categories).set(updateData).where(eq(categories.id, id));

    const [updated] = await db
      .select()
      .from(categories)
      .where(eq(categories.id, id))
      .limit(1);

    return updated!;
  }

  // Delete category
  static async deleteCategory(id: string) {
    // Check if category exists
    const [existing] = await db
      .select()
      .from(categories)
      .where(eq(categories.id, id))
      .limit(1);

    if (!existing) {
      throw new Error("Category not found");
    }

    // TODO: Check if category is used by any ingredients
    // If it is, prevent deletion or handle cascade
    // For now, allow deletion

    await db.delete(categories).where(eq(categories.id, id));
  }
}
