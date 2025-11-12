import { db } from "../db";
import { suppliers } from "../db/schema";
import { eq } from "drizzle-orm";

export class SupplierService {
  static async getAllSuppliers() {
    return db.select().from(suppliers).orderBy(suppliers.name);
  }

  static async getSupplierById(id: string) {
    const [supplier] = await db
      .select()
      .from(suppliers)
      .where(eq(suppliers.id, id))
      .limit(1);

    return supplier || null;
  }

  static async createSupplier(data: {
    name: string;
    contactInfo?: string;
    notes?: string;
  }) {
    const [newSupplier] = await db
      .insert(suppliers)
      .values({
        name: data.name,
        contactInfo: data.contactInfo || null,
        notes: data.notes || null,
      })
      .returning();

    return newSupplier;
  }

  static async updateSupplier(
    id: string,
    data: {
      name?: string;
      contactInfo?: string;
      notes?: string;
    }
  ) {
    // Check if supplier exists
    const [existing] = await db
      .select()
      .from(suppliers)
      .where(eq(suppliers.id, id))
      .limit(1);

    if (!existing) {
      throw new Error("Supplier not found");
    }

    const updateData: {
      name?: string;
      contactInfo?: string | null;
      notes?: string | null;
      updatedAt?: Date;
    } = {
      updatedAt: new Date(),
    };

    if (data.name) updateData.name = data.name;
    if (data.contactInfo !== undefined)
      updateData.contactInfo = data.contactInfo || null;
    if (data.notes !== undefined) updateData.notes = data.notes || null;

    await db.update(suppliers).set(updateData).where(eq(suppliers.id, id));

    const [updated] = await db
      .select()
      .from(suppliers)
      .where(eq(suppliers.id, id))
      .limit(1);

    return updated!;
  }

  static async deleteSupplier(id: string) {
    // Check if supplier exists
    const [existing] = await db
      .select()
      .from(suppliers)
      .where(eq(suppliers.id, id))
      .limit(1);

    if (!existing) {
      throw new Error("Supplier not found");
    }

    // TODO: Check if supplier is used by any ingredient_stock records
    // If it is, prevent deletion or handle cascade
    // For now, allow deletion

    await db.delete(suppliers).where(eq(suppliers.id, id));
  }
}
