import { db } from "../src/db";
import { users, recipes, menuPlans, menuItems } from "../src/db/schema";
import { eq } from "drizzle-orm";

// Helper to get random element from array
const randomElement = <T>(arr: T[]): T =>
  arr[Math.floor(Math.random() * arr.length)];

// Helper to get random number in range
const randomInt = (min: number, max: number): number =>
  Math.floor(Math.random() * (max - min + 1)) + min;

const randomFloat = (min: number, max: number, decimals: number = 2): string =>
  (Math.random() * (max - min) + min).toFixed(decimals);

async function seedMenuData() {
  try {
    console.log("🌱 Starting menu data seeding...\n");

    // 1. Get test user
    console.log("👤 Finding test user...");
    const [testUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, "test@foodcost.com"))
      .limit(1);

    if (!testUser) {
      throw new Error(
        "Test user not found. Please run seed-mock-data.ts first to create the test user."
      );
    }
    console.log(`✅ Found user: ${testUser.email} (${testUser.id})\n`);

    // 2. Get all recipes
    console.log("📖 Fetching recipes...");
    const allRecipes = await db
      .select()
      .from(recipes)
      .where(eq(recipes.userId, testUser.id));

    if (allRecipes.length === 0) {
      throw new Error(
        "No recipes found. Please run seed-mock-data.ts first to create recipes."
      );
    }
    console.log(`✅ Found ${allRecipes.length} recipes\n`);

    // 3. Create menu plans (regular menus)
    console.log("📋 Creating menu plans...");
    const menuPlanData = [
      {
        name: "Week 1 Menu",
        description: "Weekly menu plan for the first week",
        isTemplate: false,
      },
      {
        name: "Week 2 Menu",
        description: "Weekly menu plan for the second week",
        isTemplate: false,
      },
      {
        name: "Holiday Menu",
        description: "Special holiday menu with festive recipes",
        isTemplate: false,
      },
      {
        name: "Summer Menu",
        description: "Light and fresh summer recipes",
        isTemplate: false,
      },
      {
        name: "Today's Special",
        description: "Today's featured menu",
        isTemplate: false,
      },
    ];

    const createdMenuPlans = await db
      .insert(menuPlans)
      .values(
        menuPlanData.map((plan) => ({
          ...plan,
          userId: testUser.id,
        }))
      )
      .returning();
    console.log(`✅ Created ${createdMenuPlans.length} menu plans\n`);

    // 4. Create menu templates
    console.log("📝 Creating menu templates...");
    const templateData = [
      {
        name: "Weekly Dinner Template",
        description: "Standard weekly dinner menu template",
        isTemplate: true,
      },
      {
        name: "Holiday Feast Template",
        description: "Template for holiday celebrations",
        isTemplate: true,
      },
      {
        name: "Quick Lunch Template",
        description: "Fast and easy lunch options",
        isTemplate: true,
      },
      {
        name: "Healthy Week Template",
        description: "Nutritious and balanced weekly menu",
        isTemplate: true,
      },
    ];

    const createdTemplates = await db
      .insert(menuPlans)
      .values(
        templateData.map((template) => ({
          ...template,
          userId: testUser.id,
        }))
      )
      .returning();
    console.log(`✅ Created ${createdTemplates.length} menu templates\n`);

    // 5. Add recipes to menu plans
    console.log("🔗 Linking recipes to menu plans...");
    const menuItemData: (typeof menuItems.$inferInsert)[] = [];

    // Helper function to add recipes to a menu plan
    const addRecipesToMenu = (
      menuPlanId: string,
      recipeCount: number,
      servingRange: { min: number; max: number } = { min: 2, max: 8 }
    ) => {
      const selectedRecipes = allRecipes
        .sort(() => Math.random() - 0.5)
        .slice(0, recipeCount);

      selectedRecipes.forEach((recipe, index) => {
        menuItemData.push({
          menuPlanId,
          recipeId: recipe.id,
          servings: randomFloat(servingRange.min, servingRange.max),
          notes: index === 0 ? "Main dish" : index === 1 ? "Side dish" : null,
          order: index,
        });
      });
    };

    // Add recipes to regular menu plans
    addRecipesToMenu(createdMenuPlans[0].id, 5, { min: 4, max: 6 }); // Week 1 Menu
    addRecipesToMenu(createdMenuPlans[1].id, 6, { min: 4, max: 8 }); // Week 2 Menu
    addRecipesToMenu(createdMenuPlans[2].id, 8, { min: 6, max: 12 }); // Holiday Menu
    addRecipesToMenu(createdMenuPlans[3].id, 4, { min: 2, max: 4 }); // Summer Menu
    addRecipesToMenu(createdMenuPlans[4].id, 3, { min: 2, max: 4 }); // Today's Special

    // Add recipes to templates
    addRecipesToMenu(createdTemplates[0].id, 7, { min: 4, max: 6 }); // Weekly Dinner Template
    addRecipesToMenu(createdTemplates[1].id, 10, { min: 8, max: 12 }); // Holiday Feast Template
    addRecipesToMenu(createdTemplates[2].id, 5, { min: 2, max: 4 }); // Quick Lunch Template
    addRecipesToMenu(createdTemplates[3].id, 6, { min: 4, max: 6 }); // Healthy Week Template

    await db.insert(menuItems).values(menuItemData);
    console.log(`✅ Created ${menuItemData.length} menu items\n`);

    // 6. Summary
    console.log("\n✨ Menu data seeding completed successfully!");
    console.log("\n📋 Summary:");
    console.log(`   - Menu Plans: ${createdMenuPlans.length}`);
    console.log(`   - Templates: ${createdTemplates.length}`);
    console.log(`   - Menu Items: ${menuItemData.length}`);
    console.log("\n📝 Created Menu Plans:");
    createdMenuPlans.forEach((plan) => {
      const itemCount = menuItemData.filter(
        (item) => item.menuPlanId === plan.id
      ).length;
      console.log(`   - ${plan.name} (${itemCount} recipes)`);
    });
    console.log("\n📋 Created Templates:");
    createdTemplates.forEach((template) => {
      const itemCount = menuItemData.filter(
        (item) => item.menuPlanId === template.id
      ).length;
      console.log(`   - ${template.name} (${itemCount} recipes)`);
    });
  } catch (error: any) {
    console.error("❌ Error seeding menu data:", error);
    throw error;
  }
}

// Run the seed function
seedMenuData()
  .then(() => {
    console.log("\n✅ Menu seeding complete!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Menu seeding failed:", error);
    process.exit(1);
  });
