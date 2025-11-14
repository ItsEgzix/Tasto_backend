import { db } from "../db";
import { users } from "../db/schema";
import { eq } from "drizzle-orm";

export interface UserPreferences {
  currency: string;
}

export class UserPreferencesService {
  // Get user preferences
  static async getPreferences(userId: string): Promise<UserPreferences> {
    const [user] = await db
      .select({
        currency: users.currency,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      throw new Error("User not found");
    }

    return {
      currency: user.currency || "USD",
    };
  }

  // Update user preferences
  static async updatePreferences(
    userId: string,
    preferences: Partial<UserPreferences>
  ): Promise<UserPreferences> {
    // Validate currency code (ISO 4217 format)
    if (preferences.currency) {
      const validCurrencies = [
        "USD",
        "EUR",
        "GBP",
        "JPY",
        "AUD",
        "CAD",
        "CHF",
        "CNY",
        "INR",
        "BRL",
        "MXN",
        "ZAR",
        "SGD",
        "HKD",
        "NZD",
        "SEK",
        "NOK",
        "DKK",
        "PLN",
        "RUB",
        "TRY",
        "KRW",
        "THB",
        "MYR",
        "PHP",
        "IDR",
        "VND",
      ];
      if (!validCurrencies.includes(preferences.currency.toUpperCase())) {
        throw new Error("Invalid currency code");
      }
    }

    const updateData: { currency?: string; updatedAt?: Date } = {};
    if (preferences.currency) {
      updateData.currency = preferences.currency.toUpperCase();
    }
    updateData.updatedAt = new Date();

    const [updatedUser] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, userId))
      .returning({
        currency: users.currency,
      });

    if (!updatedUser) {
      throw new Error("User not found");
    }

    return {
      currency: updatedUser.currency || "USD",
    };
  }
}




