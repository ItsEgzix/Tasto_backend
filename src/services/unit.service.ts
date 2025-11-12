import { db } from "../db";
import { units } from "../db/schema";
import { eq } from "drizzle-orm";

export class UnitService {
  // List all units
  static async getAllUnits() {
    return await db.select().from(units).orderBy(units.name);
  }

  // Get units by type (weight, volume, count, other)
  static async getUnitsByType(type: "weight" | "volume" | "count" | "other") {
    return await db
      .select()
      .from(units)
      .where(eq(units.type, type))
      .orderBy(units.name);
  }

  // Get unit by ID
  static async getUnitById(id: string) {
    const [unit] = await db
      .select()
      .from(units)
      .where(eq(units.id, id))
      .limit(1);

    return unit || null;
  }

  // Create new unit
  static async createUnit(data: {
    name: string;
    type: "weight" | "volume" | "count" | "other";
    symbol?: string;
    description?: string;
  }) {
    // Check if unit name already exists
    const [existing] = await db
      .select()
      .from(units)
      .where(eq(units.name, data.name))
      .limit(1);

    if (existing) {
      throw new Error("Unit with this name already exists");
    }

    const [newUnit] = await db
      .insert(units)
      .values({
        name: data.name,
        type: data.type,
        symbol: data.symbol || null,
        description: data.description || null,
      })
      .returning();

    return newUnit;
  }

  // Update unit
  static async updateUnit(
    id: string,
    data: {
      name?: string;
      type?: "weight" | "volume" | "count" | "other";
      symbol?: string;
      description?: string;
    }
  ) {
    // Check if unit exists
    const [existing] = await db
      .select()
      .from(units)
      .where(eq(units.id, id))
      .limit(1);

    if (!existing) {
      throw new Error("Unit not found");
    }

    // Check if new name conflicts with existing unit
    if (data.name && data.name !== existing.name) {
      const [nameConflict] = await db
        .select()
        .from(units)
        .where(eq(units.name, data.name))
        .limit(1);

      if (nameConflict) {
        throw new Error("Unit with this name already exists");
      }
    }

    const updateData: {
      name?: string;
      type?: "weight" | "volume" | "count" | "other";
      symbol?: string | null;
      description?: string | null;
      updatedAt?: Date;
    } = {
      updatedAt: new Date(),
    };

    if (data.name) updateData.name = data.name;
    if (data.type) updateData.type = data.type;
    if (data.symbol !== undefined) updateData.symbol = data.symbol || null;
    if (data.description !== undefined)
      updateData.description = data.description || null;

    await db.update(units).set(updateData).where(eq(units.id, id));

    const [updated] = await db
      .select()
      .from(units)
      .where(eq(units.id, id))
      .limit(1);

    return updated!;
  }

  // Delete unit
  static async deleteUnit(id: string) {
    // Check if unit exists
    const [existing] = await db
      .select()
      .from(units)
      .where(eq(units.id, id))
      .limit(1);

    if (!existing) {
      throw new Error("Unit not found");
    }

    // TODO: Check if unit is used by any ingredients
    // If it is, prevent deletion or handle cascade
    // For now, allow deletion

    await db.delete(units).where(eq(units.id, id));
  }
}
