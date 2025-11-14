import { Router } from "express";
import { body, param } from "express-validator";
import { SupplierService } from "../services/supplier.service";
import { validate } from "../middleware/validation";
import { authenticate } from "../middleware/auth.middleware";
import { AppError } from "../middleware/error-handler";

const router = Router();

router.use(authenticate);

// GET /api/suppliers - List all suppliers
router.get("/", async (req, res, next) => {
  try {
    const userId = req.user!.userId;
    const suppliers = await SupplierService.getAllSuppliers(userId);

    res.json({
      status: "success",
      data: suppliers,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/suppliers/:id - Get supplier details
router.get(
  "/:id",
  validate([param("id").isUUID().withMessage("Invalid supplier ID")]),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.user!.userId;
      const supplier = await SupplierService.getSupplierById(id, userId);

      if (!supplier) {
        const error: AppError = new Error("Supplier not found");
        error.statusCode = 404;
        return next(error);
      }

      res.json({
        status: "success",
        data: supplier,
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/suppliers - Create new supplier
router.post(
  "/",
  validate([
    body("name").trim().notEmpty().withMessage("Supplier name is required"),
    body("contactInfo").optional().trim(),
    body("notes").optional().trim(),
  ]),
  async (req, res, next) => {
    try {
      const { name, contactInfo, notes } = req.body;
      const userId = req.user!.userId;

      const supplier = await SupplierService.createSupplier(
        {
          name,
          contactInfo,
          notes,
        },
        userId
      );

      res.status(201).json({
        status: "success",
        message: "Supplier created successfully",
        data: supplier,
      });
    } catch (error) {
      next(error);
    }
  }
);

// PUT /api/suppliers/:id - Update supplier
router.put(
  "/:id",
  validate([
    param("id").isUUID().withMessage("Invalid supplier ID"),
    body("name")
      .optional()
      .trim()
      .notEmpty()
      .withMessage("Name cannot be empty"),
    body("contactInfo").optional().trim(),
    body("notes").optional().trim(),
  ]),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { name, contactInfo, notes } = req.body;
      const userId = req.user!.userId;

      const supplier = await SupplierService.updateSupplier(
        id,
        {
          name,
          contactInfo,
          notes,
        },
        userId
      );

      res.json({
        status: "success",
        message: "Supplier updated successfully",
        data: supplier,
      });
    } catch (error) {
      const err = error as Error;
      if (err.message === "Supplier not found") {
        const appError: AppError = new Error(err.message);
        appError.statusCode = 404;
        return next(appError);
      }
      next(error);
    }
  }
);

// DELETE /api/suppliers/:id - Delete supplier
router.delete(
  "/:id",
  validate([param("id").isUUID().withMessage("Invalid supplier ID")]),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.user!.userId;
      await SupplierService.deleteSupplier(id, userId);

      res.json({
        status: "success",
        message: "Supplier deleted successfully",
      });
    } catch (error) {
      const err = error as Error;
      if (err.message === "Supplier not found") {
        const appError: AppError = new Error(err.message);
        appError.statusCode = 404;
        return next(appError);
      }
      next(error);
    }
  }
);

export default router;
