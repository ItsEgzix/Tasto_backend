import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { errorHandler, notFoundHandler } from "./middleware/error-handler";
import authRoutes from "./routes/auth.routes";
import ingredientsRoutes from "./routes/ingredients.routes";
import categoriesRoutes from "./routes/categories.routes";
import unitsRoutes from "./routes/units.routes";
import recipesRoutes from "./routes/recipes.routes";
import recipeCategoriesRoutes from "./routes/recipe-categories.routes";
import suppliersRoutes from "./routes/suppliers.routes";
import storageLocationsRoutes from "./routes/storage-locations.routes";
import inventoryRoutes from "./routes/inventory.routes";
import inventoryAnalyticsRoutes from "./routes/inventory-analytics.routes";

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const CORS_ORIGIN = process.env.CORS_ORIGIN;

// Middleware
app.use(
  cors({
    origin: CORS_ORIGIN,
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get("/health", (_req, res) => {
  res.json({ status: "ok", message: "Server is running" });
});

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/ingredients", ingredientsRoutes);
app.use("/api/categories", categoriesRoutes);
app.use("/api/units", unitsRoutes);
app.use("/api/recipes", recipesRoutes);
app.use("/api/recipe-categories", recipeCategoriesRoutes);
app.use("/api/suppliers", suppliersRoutes);
app.use("/api/storage-locations", storageLocationsRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/inventory/analytics", inventoryAnalyticsRoutes);
// etc.

// Error handling middleware (must be last)
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
});

export default app;
