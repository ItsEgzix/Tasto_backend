import { db } from "../src/db";
import {
  users,
  categories,
  units,
  suppliers,
  storageLocations,
  ingredients,
  ingredientStock,
  usageHistory,
  spoilageRecords,
  recipeCategories,
  recipes,
  recipeIngredients,
} from "../src/db/schema";
import { sql } from "drizzle-orm";
import bcrypt from "bcryptjs";

// Helper function to get a random date in the past N days
const getRandomPastDate = (daysAgo: number): string => {
  const date = new Date();
  date.setDate(date.getDate() - Math.floor(Math.random() * daysAgo));
  return date.toISOString().split("T")[0];
};

// Helper function to get a future expiration date
const getExpirationDate = (daysFromNow: number): string => {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date.toISOString().split("T")[0];
};

// Helper to get random element from array
const randomElement = <T>(arr: T[]): T =>
  arr[Math.floor(Math.random() * arr.length)];

// Helper to get random number in range
const randomInt = (min: number, max: number): number =>
  Math.floor(Math.random() * (max - min + 1)) + min;

const randomFloat = (min: number, max: number, decimals: number = 2): string =>
  (Math.random() * (max - min) + min).toFixed(decimals);

async function seedMockData() {
  try {
    console.log("🌱 Starting database seeding...\n");

    // 1. Create test user
    console.log("📝 Creating test user...");
    const hashedPassword = await bcrypt.hash("test123", 10);
    const [testUser] = await db
      .insert(users)
      .values({
        email: "test@foodcost.com",
        name: "Test User",
        password: hashedPassword,
        isActive: true,
      })
      .returning();
    console.log(`✅ Created user: ${testUser.email} (password: test123)\n`);

    // 2. Create categories
    console.log("📦 Creating categories...");
    const categoryData = [
      { name: "Vegetables", description: "Fresh vegetables", color: "#10B981" },
      { name: "Fruits", description: "Fresh fruits", color: "#F59E0B" },
      { name: "Meat", description: "Meat and poultry", color: "#EF4444" },
      { name: "Seafood", description: "Fish and seafood", color: "#3B82F6" },
      { name: "Dairy", description: "Dairy products", color: "#F3F4F6" },
      { name: "Grains", description: "Grains and cereals", color: "#D97706" },
      {
        name: "Spices",
        description: "Spices and seasonings",
        color: "#8B5CF6",
      },
      { name: "Oils", description: "Cooking oils", color: "#FCD34D" },
      {
        name: "Beverages",
        description: "Drinks and beverages",
        color: "#06B6D4",
      },
      {
        name: "Canned Goods",
        description: "Canned and preserved",
        color: "#6B7280",
      },
    ];
    const createdCategories = await db
      .insert(categories)
      .values(categoryData)
      .returning();
    console.log(`✅ Created ${createdCategories.length} categories\n`);

    // 3. Create units
    console.log("📏 Creating units...");
    const unitData = [
      { name: "Kilogram", type: "weight" as const, symbol: "kg" },
      { name: "Gram", type: "weight" as const, symbol: "g" },
      { name: "Pound", type: "weight" as const, symbol: "lb" },
      { name: "Ounce", type: "weight" as const, symbol: "oz" },
      { name: "Liter", type: "volume" as const, symbol: "L" },
      { name: "Milliliter", type: "volume" as const, symbol: "mL" },
      { name: "Gallon", type: "volume" as const, symbol: "gal" },
      { name: "Cup", type: "volume" as const, symbol: "cup" },
      { name: "Piece", type: "count" as const, symbol: "pcs" },
      { name: "Bunch", type: "count" as const, symbol: "bunch" },
      { name: "Can", type: "count" as const, symbol: "can" },
      { name: "Bottle", type: "count" as const, symbol: "bottle" },
    ];
    const createdUnits = await db.insert(units).values(unitData).returning();
    console.log(`✅ Created ${createdUnits.length} units\n`);

    // 4. Create suppliers
    console.log("🏪 Creating suppliers...");
    const supplierData = [
      {
        name: "Fresh Market Co.",
        contactInfo: "contact@freshmarket.com",
        notes: "Premium quality",
      },
      {
        name: "Quality Foods Inc.",
        contactInfo: "sales@qualityfoods.com",
        notes: "Bulk orders",
      },
      {
        name: "Local Farm Direct",
        contactInfo: "info@localfarm.com",
        notes: "Organic produce",
      },
      {
        name: "Bulk Wholesale",
        contactInfo: "orders@bulkwholesale.com",
        notes: "Best prices",
      },
      {
        name: "Organic Suppliers",
        contactInfo: "hello@organic.com",
        notes: "Certified organic",
      },
      {
        name: "Seafood Express",
        contactInfo: "fish@seafood.com",
        notes: "Fresh daily",
      },
      {
        name: "Spice World",
        contactInfo: "spices@spiceworld.com",
        notes: "Exotic spices",
      },
      {
        name: "Dairy Delights",
        contactInfo: "dairy@delights.com",
        notes: "Farm fresh",
      },
    ];
    const createdSuppliers = await db
      .insert(suppliers)
      .values(supplierData)
      .returning();
    console.log(`✅ Created ${createdSuppliers.length} suppliers\n`);

    // 5. Create storage locations
    console.log("🏠 Creating storage locations...");
    const locationData = [
      { name: "Main Refrigerator", description: "Walk-in refrigerator" },
      { name: "Freezer A", description: "Deep freeze unit A" },
      { name: "Freezer B", description: "Deep freeze unit B" },
      { name: "Dry Storage", description: "Dry goods storage room" },
      { name: "Pantry", description: "Kitchen pantry" },
      {
        name: "Wine Cellar",
        description: "Temperature-controlled wine storage",
      },
      { name: "Spice Rack", description: "Spice storage area" },
    ];
    const createdLocations = await db
      .insert(storageLocations)
      .values(locationData)
      .returning();
    console.log(`✅ Created ${createdLocations.length} storage locations\n`);

    // 6. Create ingredients (50+ ingredients)
    console.log("🥕 Creating ingredients...");
    const ingredientNames = [
      // Vegetables
      "Tomatoes",
      "Onions",
      "Garlic",
      "Carrots",
      "Potatoes",
      "Bell Peppers",
      "Lettuce",
      "Spinach",
      "Broccoli",
      "Cauliflower",
      "Cucumber",
      "Zucchini",
      "Mushrooms",
      "Celery",
      "Cabbage",
      "Corn",
      "Peas",
      "Green Beans",
      // Fruits
      "Apples",
      "Bananas",
      "Oranges",
      "Lemons",
      "Limes",
      "Strawberries",
      "Blueberries",
      "Grapes",
      "Avocados",
      "Mangoes",
      "Pineapple",
      // Meat
      "Chicken Breast",
      "Ground Beef",
      "Pork Chops",
      "Bacon",
      "Sausage",
      "Turkey",
      "Lamb Chops",
      "Beef Steak",
      // Seafood
      "Salmon",
      "Tuna",
      "Shrimp",
      "Cod",
      "Tilapia",
      "Crab",
      "Lobster",
      // Dairy
      "Milk",
      "Cheese",
      "Butter",
      "Yogurt",
      "Cream",
      "Eggs",
      // Grains
      "Rice",
      "Pasta",
      "Flour",
      "Bread",
      "Quinoa",
      "Oats",
      // Spices & Oils
      "Olive Oil",
      "Salt",
      "Black Pepper",
      "Paprika",
      "Cumin",
      "Cinnamon",
      // Beverages
      "Coffee",
      "Tea",
      "Juice",
      "Wine",
      // Canned
      "Tomato Sauce",
      "Beans",
      "Corn Canned",
    ];

    const ingredientData = ingredientNames.map((name) => {
      let category, unit, restockThreshold;

      // Assign category and unit based on ingredient type
      if (
        name.includes("Vegetable") ||
        [
          "Tomatoes",
          "Onions",
          "Garlic",
          "Carrots",
          "Potatoes",
          "Bell Peppers",
          "Lettuce",
          "Spinach",
          "Broccoli",
          "Cauliflower",
          "Cucumber",
          "Zucchini",
          "Mushrooms",
          "Celery",
          "Cabbage",
          "Corn",
          "Peas",
          "Green Beans",
        ].includes(name)
      ) {
        category = createdCategories.find((c) => c.name === "Vegetables")!;
        unit = randomElement([
          createdUnits.find((u) => u.name === "Kilogram")!,
          createdUnits.find((u) => u.name === "Pound")!,
          createdUnits.find((u) => u.name === "Bunch")!,
        ]);
        restockThreshold = randomFloat(5, 20);
      } else if (
        [
          "Apples",
          "Bananas",
          "Oranges",
          "Lemons",
          "Limes",
          "Strawberries",
          "Blueberries",
          "Grapes",
          "Avocados",
          "Mangoes",
          "Pineapple",
        ].includes(name)
      ) {
        category = createdCategories.find((c) => c.name === "Fruits")!;
        unit = randomElement([
          createdUnits.find((u) => u.name === "Kilogram")!,
          createdUnits.find((u) => u.name === "Pound")!,
        ]);
        restockThreshold = randomFloat(3, 15);
      } else if (
        [
          "Chicken Breast",
          "Ground Beef",
          "Pork Chops",
          "Bacon",
          "Sausage",
          "Turkey",
          "Lamb Chops",
          "Beef Steak",
        ].includes(name)
      ) {
        category = createdCategories.find((c) => c.name === "Meat")!;
        unit = randomElement([
          createdUnits.find((u) => u.name === "Kilogram")!,
          createdUnits.find((u) => u.name === "Pound")!,
        ]);
        restockThreshold = randomFloat(2, 10);
      } else if (
        [
          "Salmon",
          "Tuna",
          "Shrimp",
          "Cod",
          "Tilapia",
          "Crab",
          "Lobster",
        ].includes(name)
      ) {
        category = createdCategories.find((c) => c.name === "Seafood")!;
        unit = randomElement([
          createdUnits.find((u) => u.name === "Kilogram")!,
          createdUnits.find((u) => u.name === "Pound")!,
        ]);
        restockThreshold = randomFloat(1, 8);
      } else if (
        ["Milk", "Cheese", "Butter", "Yogurt", "Cream", "Eggs"].includes(name)
      ) {
        category = createdCategories.find((c) => c.name === "Dairy")!;
        unit = randomElement([
          createdUnits.find((u) => u.name === "Liter")!,
          createdUnits.find((u) => u.name === "Pound")!,
          createdUnits.find((u) => u.name === "Piece")!,
        ]);
        restockThreshold = randomFloat(2, 12);
      } else if (
        ["Rice", "Pasta", "Flour", "Bread", "Quinoa", "Oats"].includes(name)
      ) {
        category = createdCategories.find((c) => c.name === "Grains")!;
        unit = randomElement([
          createdUnits.find((u) => u.name === "Kilogram")!,
          createdUnits.find((u) => u.name === "Pound")!,
        ]);
        restockThreshold = randomFloat(5, 25);
      } else if (
        [
          "Olive Oil",
          "Salt",
          "Black Pepper",
          "Paprika",
          "Cumin",
          "Cinnamon",
        ].includes(name)
      ) {
        if (name === "Olive Oil") {
          category = createdCategories.find((c) => c.name === "Oils")!;
          unit = createdUnits.find((u) => u.name === "Liter")!;
        } else {
          category = createdCategories.find((c) => c.name === "Spices")!;
          unit = randomElement([
            createdUnits.find((u) => u.name === "Gram")!,
            createdUnits.find((u) => u.name === "Ounce")!,
          ]);
        }
        restockThreshold = randomFloat(0.5, 5);
      } else if (["Coffee", "Tea", "Juice", "Wine"].includes(name)) {
        category = createdCategories.find((c) => c.name === "Beverages")!;
        unit = randomElement([
          createdUnits.find((u) => u.name === "Liter")!,
          createdUnits.find((u) => u.name === "Bottle")!,
        ]);
        restockThreshold = randomFloat(2, 10);
      } else {
        category = createdCategories.find((c) => c.name === "Canned Goods")!;
        unit = randomElement([
          createdUnits.find((u) => u.name === "Can")!,
          createdUnits.find((u) => u.name === "Piece")!,
        ]);
        restockThreshold = randomFloat(5, 20);
      }

      return {
        name,
        categoryId: category.id,
        unitId: unit.id,
        restockThreshold,
      };
    });

    const createdIngredients = await db
      .insert(ingredients)
      .values(ingredientData)
      .returning();
    console.log(`✅ Created ${createdIngredients.length} ingredients\n`);

    // 7. Create purchases (ingredient_stock) - 200+ purchases over last 90 days
    console.log("🛒 Creating purchases (this may take a while)...");
    const purchases: (typeof ingredientStock.$inferInsert)[] = [];
    const purchaseCount = 250; // Create 250 purchases

    for (let i = 0; i < purchaseCount; i++) {
      const ingredient = randomElement(createdIngredients);
      const supplier = randomElement(createdSuppliers);
      const location = randomElement(createdLocations);
      const daysAgo = randomInt(0, 90);
      const purchaseDate = getRandomPastDate(daysAgo);

      // Generate realistic quantities and prices
      let quantity: string, pricePerUnit: number;
      const unit = createdUnits.find((u) => u.id === ingredient.unitId)!;

      if (unit.type === "weight") {
        if (unit.name === "Kilogram") {
          quantity = randomFloat(1, 50);
          pricePerUnit = parseFloat(randomFloat(2, 25));
        } else if (unit.name === "Gram") {
          quantity = randomFloat(100, 5000);
          pricePerUnit = parseFloat(randomFloat(0.01, 0.5));
        } else if (unit.name === "Pound") {
          quantity = randomFloat(1, 30);
          pricePerUnit = parseFloat(randomFloat(3, 20));
        } else {
          quantity = randomFloat(1, 20);
          pricePerUnit = parseFloat(randomFloat(0.5, 5));
        }
      } else if (unit.type === "volume") {
        if (unit.name === "Liter") {
          quantity = randomFloat(0.5, 20);
          pricePerUnit = parseFloat(randomFloat(1, 15));
        } else {
          quantity = randomFloat(100, 5000);
          pricePerUnit = parseFloat(randomFloat(0.01, 0.1));
        }
      } else {
        // count
        quantity = randomFloat(1, 50);
        pricePerUnit = parseFloat(randomFloat(0.5, 10));
      }

      const totalPrice = parseFloat(quantity) * pricePerUnit;
      const expirationDays = randomInt(1, 30);
      const expirationDate = getExpirationDate(expirationDays);

      purchases.push({
        ingredientId: ingredient.id,
        storageLocationId: location.id,
        quantity,
        purchasePrice: totalPrice.toString(),
        purchaseDate,
        supplierId: supplier.id,
        batchNumber: `BATCH-${randomInt(1000, 9999)}`,
        expirationDate: Math.random() > 0.3 ? expirationDate : null, // 70% have expiration
      });

      if ((i + 1) % 50 === 0) {
        console.log(`  Created ${i + 1}/${purchaseCount} purchases...`);
      }
    }

    // Insert purchases in batches
    const batchSize = 50;
    for (let i = 0; i < purchases.length; i += batchSize) {
      const batch = purchases.slice(i, i + batchSize);
      await db.insert(ingredientStock).values(batch);
    }
    console.log(`✅ Created ${purchases.length} purchases\n`);

    // 8. Create usage records (50+ usage records)
    console.log("📊 Creating usage records...");
    const allStock = await db.select().from(ingredientStock);
    const usageRecords: (typeof usageHistory.$inferInsert)[] = [];
    const usageCount = 60;

    for (let i = 0; i < usageCount; i++) {
      const stock = randomElement(allStock);
      const quantity = parseFloat(stock.quantity);
      const maxUsage = quantity * 0.8; // Use up to 80% of stock
      const quantityUsed = parseFloat(randomFloat(0.1, maxUsage));
      const daysAgo = randomInt(0, 60);
      const usageDate = getRandomPastDate(daysAgo);

      usageRecords.push({
        ingredientStockId: stock.id,
        quantityUsed: quantityUsed.toString(),
        date: usageDate,
        reason: randomElement(["production", "recipe", "manual", "testing"]),
        notes: `Used for ${randomElement([
          "cooking",
          "preparation",
          "production",
          "testing",
        ])}`,
      });
    }

    await db.insert(usageHistory).values(usageRecords);
    console.log(`✅ Created ${usageRecords.length} usage records\n`);

    // 9. Create spoilage records (20+ spoilage records)
    console.log("⚠️  Creating spoilage records...");
    const spoilageRecordsData: (typeof spoilageRecords.$inferInsert)[] = [];
    const spoilageCount = 25;

    for (let i = 0; i < spoilageCount; i++) {
      const stock = randomElement(allStock);
      const quantity = parseFloat(stock.quantity);
      const maxSpoilage = quantity * 0.3; // Spoil up to 30% of stock
      const spoiledQuantity = parseFloat(randomFloat(0.1, maxSpoilage));
      const daysAgo = randomInt(0, 45);
      const spoilageDate = getRandomPastDate(daysAgo);

      spoilageRecordsData.push({
        ingredientStockId: stock.id,
        quantity: spoiledQuantity.toString(),
        reason: randomElement([
          "expired",
          "damaged",
          "spoiled",
          "contaminated",
        ]),
        date: spoilageDate,
        notes: `Spoiled due to ${randomElement([
          "expiration",
          "damage",
          "contamination",
          "improper storage",
        ])}`,
      });
    }

    await db.insert(spoilageRecords).values(spoilageRecordsData);
    console.log(`✅ Created ${spoilageRecordsData.length} spoilage records\n`);

    // 10. Create recipe categories
    console.log("🍽️  Creating recipe categories...");
    const recipeCategoryData = [
      {
        name: "Appetizers",
        description: "Starters and appetizers",
        color: "#F59E0B",
      },
      { name: "Main Courses", description: "Main dishes", color: "#EF4444" },
      { name: "Desserts", description: "Sweet treats", color: "#8B5CF6" },
      {
        name: "Beverages",
        description: "Drinks and beverages",
        color: "#06B6D4",
      },
      { name: "Salads", description: "Fresh salads", color: "#10B981" },
      { name: "Soups", description: "Soups and stews", color: "#3B82F6" },
    ];
    const createdRecipeCategories = await db
      .insert(recipeCategories)
      .values(recipeCategoryData)
      .returning();
    console.log(
      `✅ Created ${createdRecipeCategories.length} recipe categories\n`
    );

    // 11. Create recipes (30+ recipes)
    console.log("📖 Creating recipes...");
    const recipeNames = [
      "Caesar Salad",
      "Grilled Chicken",
      "Beef Steak",
      "Pasta Carbonara",
      "Fish Tacos",
      "Vegetable Stir Fry",
      "Chicken Curry",
      "Beef Burger",
      "Salmon Teriyaki",
      "Margherita Pizza",
      "Chocolate Cake",
      "Apple Pie",
      "Tomato Soup",
      "Chicken Noodle Soup",
      "French Onion Soup",
      "Minestrone",
      "Chocolate Chip Cookies",
      "Brownies",
      "Tiramisu",
      "Cheesecake",
      "Lemonade",
      "Iced Tea",
      "Smoothie",
      "Coffee Latte",
      "Greek Salad",
      "Caprese Salad",
      "Waldorf Salad",
      "Cobb Salad",
      "Shrimp Scampi",
      "Lobster Roll",
      "Fish and Chips",
      "Sushi Platter",
    ];

    const recipeData = recipeNames.map((name) => {
      let category, description, instructions, serves;

      if (name.includes("Salad")) {
        category = createdRecipeCategories.find((c) => c.name === "Salads")!;
        description = `Delicious ${name} recipe`;
        instructions =
          "1. Prepare ingredients\n2. Mix together\n3. Add dressing\n4. Serve fresh";
        serves = randomFloat(2, 6);
      } else if (name.includes("Soup")) {
        category = createdRecipeCategories.find((c) => c.name === "Soups")!;
        description = `Hearty ${name} recipe`;
        instructions =
          "1. Sauté vegetables\n2. Add broth\n3. Simmer for 30 minutes\n4. Season and serve";
        serves = randomFloat(4, 8);
      } else if (
        [
          "Chocolate Cake",
          "Apple Pie",
          "Chocolate Chip Cookies",
          "Brownies",
          "Tiramisu",
          "Cheesecake",
        ].includes(name)
      ) {
        category = createdRecipeCategories.find((c) => c.name === "Desserts")!;
        description = `Sweet ${name} recipe`;
        instructions =
          "1. Mix dry ingredients\n2. Add wet ingredients\n3. Bake at 350°F\n4. Cool and serve";
        serves = randomFloat(6, 12);
      } else if (
        ["Lemonade", "Iced Tea", "Smoothie", "Coffee Latte"].includes(name)
      ) {
        category = createdRecipeCategories.find((c) => c.name === "Beverages")!;
        description = `Refreshing ${name} recipe`;
        instructions =
          "1. Prepare base\n2. Add flavorings\n3. Mix well\n4. Serve chilled";
        serves = randomFloat(2, 4);
      } else {
        category = createdRecipeCategories.find(
          (c) => c.name === "Main Courses"
        )!;
        description = `Delicious ${name} recipe`;
        instructions =
          "1. Prepare ingredients\n2. Cook main component\n3. Add seasonings\n4. Plate and serve";
        serves = randomFloat(2, 6);
      }

      return {
        name,
        categoryId: category.id,
        description,
        instructions,
        serves,
      };
    });

    const createdRecipes = await db
      .insert(recipes)
      .values(recipeData)
      .returning();
    console.log(`✅ Created ${createdRecipes.length} recipes\n`);

    // 12. Create recipe ingredients (link recipes to ingredients)
    console.log("🔗 Linking ingredients to recipes...");
    const recipeIngredientData: (typeof recipeIngredients.$inferInsert)[] = [];

    for (const recipe of createdRecipes) {
      // Each recipe gets 3-8 ingredients
      const ingredientCount = randomInt(3, 8);
      const selectedIngredients = createdIngredients
        .sort(() => Math.random() - 0.5)
        .slice(0, ingredientCount);

      for (const ingredient of selectedIngredients) {
        const unit = createdUnits.find((u) => u.id === ingredient.unitId)!;
        let quantity: string;

        if (unit.type === "weight") {
          quantity = randomFloat(0.1, 2);
        } else if (unit.type === "volume") {
          quantity = randomFloat(0.1, 1);
        } else {
          quantity = randomFloat(1, 5);
        }

        recipeIngredientData.push({
          recipeId: recipe.id,
          ingredientId: ingredient.id,
          quantity,
        });
      }
    }

    await db.insert(recipeIngredients).values(recipeIngredientData);
    console.log(
      `✅ Created ${recipeIngredientData.length} recipe ingredient links\n`
    );

    console.log("\n✨ Database seeding completed successfully!");
    console.log("\n📋 Summary:");
    console.log(`   - User: test@foodcost.com (password: test123)`);
    console.log(`   - Categories: ${createdCategories.length}`);
    console.log(`   - Units: ${createdUnits.length}`);
    console.log(`   - Suppliers: ${createdSuppliers.length}`);
    console.log(`   - Storage Locations: ${createdLocations.length}`);
    console.log(`   - Ingredients: ${createdIngredients.length}`);
    console.log(`   - Purchases: ${purchases.length}`);
    console.log(`   - Usage Records: ${usageRecords.length}`);
    console.log(`   - Spoilage Records: ${spoilageRecordsData.length}`);
    console.log(`   - Recipe Categories: ${createdRecipeCategories.length}`);
    console.log(`   - Recipes: ${createdRecipes.length}`);
    console.log(`   - Recipe Ingredients: ${recipeIngredientData.length}`);
    console.log(
      "\n💡 Note: Analytics will be calculated automatically when you access the inventory page."
    );
  } catch (error: any) {
    console.error("❌ Error seeding database:", error);
    throw error;
  }
}

// Run the seed function
seedMockData()
  .then(() => {
    console.log("\n✅ Seeding complete!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Seeding failed:", error);
    process.exit(1);
  });
