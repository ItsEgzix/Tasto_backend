import { db } from "../db";
import { storageLocations } from "../db/schema";
import { eq } from "drizzle-orm";

export class StorageLocationService {
  static async getAllStorageLocations() {
    return db.select().from(storageLocations).orderBy(storageLocations.name);
  }

  static async getStorageLocationById(id: string) {
    const [location] = await db
      .select()
      .from(storageLocations)
      .where(eq(storageLocations.id, id))
      .limit(1);

    return location || null;
  }

  static async createStorageLocation(data: {
    name: string;
    description?: string;
  }) {
    // Check if storage location name already exists
    const [existing] = await db
      .select()
      .from(storageLocations)
      .where(eq(storageLocations.name, data.name))
      .limit(1);

    if (existing) {
      throw new Error("Storage location with this name already exists");
    }

    const [newLocation] = await db
      .insert(storageLocations)
      .values({
        name: data.name,
        description: data.description || null,
      })
      .returning();

    return newLocation;
  }

  static async updateStorageLocation(
    id: string,
    data: {
      name?: string;
      description?: string;
    }
  ) {
    // Check if storage location exists
    const [existing] = await db
      .select()
      .from(storageLocations)
      .where(eq(storageLocations.id, id))
      .limit(1);

    if (!existing) {
      throw new Error("Storage location not found");
    }

    // Check if new name conflicts with existing location
    if (data.name && data.name !== existing.name) {
      const [nameConflict] = await db
        .select()
        .from(storageLocations)
        .where(eq(storageLocations.name, data.name))
        .limit(1);

      if (nameConflict) {
        throw new Error("Storage location with this name already exists");
      }
    }

    const updateData: {
      name?: string;
      description?: string | null;
      updatedAt?: Date;
    } = {
      updatedAt: new Date(),
    };

    if (data.name) updateData.name = data.name;
    if (data.description !== undefined)
      updateData.description = data.description || null;

    await db
      .update(storageLocations)
      .set(updateData)
      .where(eq(storageLocations.id, id));

    const [updated] = await db
      .select()
      .from(storageLocations)
      .where(eq(storageLocations.id, id))
      .limit(1);

    return updated!;
  }

  static async deleteStorageLocation(id: string) {
    // Check if storage location exists
    const [existing] = await db
      .select()
      .from(storageLocations)
      .where(eq(storageLocations.id, id))
      .limit(1);

    if (!existing) {
      throw new Error("Storage location not found");
    }

    // TODO: Check if storage location is used by any ingredient_stock records
    // If it is, prevent deletion or handle cascade
    // For now, allow deletion

    await db.delete(storageLocations).where(eq(storageLocations.id, id));
  }
}
