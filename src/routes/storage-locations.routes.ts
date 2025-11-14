import { Router } from "express";
import { body, param } from "express-validator";
import { StorageLocationService } from "../services/storage-location.service";
import { validate } from "../middleware/validation";
import { authenticate } from "../middleware/auth.middleware";
import { AppError } from "../middleware/error-handler";

const router = Router();

router.use(authenticate);

// GET /api/storage-locations - List all storage locations
router.get("/", async (req, res, next) => {
  try {
    const userId = req.user!.userId;
    const locations = await StorageLocationService.getAllStorageLocations(
      userId
    );

    res.json({
      status: "success",
      data: locations,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/storage-locations/:id - Get storage location details
router.get(
  "/:id",
  validate([param("id").isUUID().withMessage("Invalid storage location ID")]),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.user!.userId;
      const location = await StorageLocationService.getStorageLocationById(
        id,
        userId
      );

      if (!location) {
        const error: AppError = new Error("Storage location not found");
        error.statusCode = 404;
        return next(error);
      }

      res.json({
        status: "success",
        data: location,
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/storage-locations - Create new storage location
router.post(
  "/",
  validate([
    body("name")
      .trim()
      .notEmpty()
      .withMessage("Storage location name is required"),
    body("description").optional().trim(),
  ]),
  async (req, res, next) => {
    try {
      const { name, description } = req.body;
      const userId = req.user!.userId;

      const location = await StorageLocationService.createStorageLocation(
        {
          name,
          description,
        },
        userId
      );

      res.status(201).json({
        status: "success",
        message: "Storage location created successfully",
        data: location,
      });
    } catch (error) {
      const err = error as Error;
      if (err.message === "Storage location with this name already exists") {
        const appError: AppError = new Error(err.message);
        appError.statusCode = 400;
        return next(appError);
      }
      next(error);
    }
  }
);

// PUT /api/storage-locations/:id - Update storage location
router.put(
  "/:id",
  validate([
    param("id").isUUID().withMessage("Invalid storage location ID"),
    body("name")
      .optional()
      .trim()
      .notEmpty()
      .withMessage("Name cannot be empty"),
    body("description").optional().trim(),
  ]),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { name, description } = req.body;
      const userId = req.user!.userId;

      const location = await StorageLocationService.updateStorageLocation(
        id,
        {
          name,
          description,
        },
        userId
      );

      res.json({
        status: "success",
        message: "Storage location updated successfully",
        data: location,
      });
    } catch (error) {
      const err = error as Error;
      if (
        err.message === "Storage location not found" ||
        err.message === "Storage location with this name already exists"
      ) {
        const appError: AppError = new Error(err.message);
        appError.statusCode =
          err.message === "Storage location not found" ? 404 : 400;
        return next(appError);
      }
      next(error);
    }
  }
);

// DELETE /api/storage-locations/:id - Delete storage location
router.delete(
  "/:id",
  validate([param("id").isUUID().withMessage("Invalid storage location ID")]),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.user!.userId;
      await StorageLocationService.deleteStorageLocation(id, userId);

      res.json({
        status: "success",
        message: "Storage location deleted successfully",
      });
    } catch (error) {
      const err = error as Error;
      if (err.message === "Storage location not found") {
        const appError: AppError = new Error(err.message);
        appError.statusCode = 404;
        return next(appError);
      }
      next(error);
    }
  }
);

export default router;
