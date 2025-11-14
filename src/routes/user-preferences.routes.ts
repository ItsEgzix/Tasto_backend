import { Router } from "express";
import { body } from "express-validator";
import { UserPreferencesService } from "../services/user-preferences.service";
import { validate } from "../middleware/validation";
import { authenticate } from "../middleware/auth.middleware";

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get user preferences
router.get("/", async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        status: "error",
        message: "Unauthorized",
      });
    }

    const preferences = await UserPreferencesService.getPreferences(
      req.user.userId
    );

    res.json({
      status: "success",
      data: preferences,
    });
  } catch (error) {
    next(error);
  }
});

// Update user preferences
router.put(
  "/",
  validate([
    body("currency")
      .optional()
      .isString()
      .isLength({ min: 3, max: 3 })
      .withMessage("Currency must be a 3-letter ISO code"),
  ]),
  async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          status: "error",
          message: "Unauthorized",
        });
      }

      const preferences = await UserPreferencesService.updatePreferences(
        req.user.userId,
        req.body
      );

      res.json({
        status: "success",
        message: "Preferences updated successfully",
        data: preferences,
      });
    } catch (error) {
      const err = error as Error;
      if (err.message === "Invalid currency code") {
        return res.status(400).json({
          status: "error",
          message: err.message,
        });
      }
      next(error);
    }
  }
);

export default router;




