import { Router } from "express";
import { body } from "express-validator";
import { AuthService } from "../services/auth.service";
import { validate } from "../middleware/validation";
import { AppError } from "../middleware/error-handler";

const router = Router();

// Register
router.post(
  "/register",
  validate([
    body("email").isEmail().withMessage("Valid email is required"),
    body("password")
      .isLength({ min: 6 })
      .withMessage("Password must be at least 6 characters"),
    body("name").trim().notEmpty().withMessage("Name is required"),
  ]),
  async (req, res, next) => {
    try {
      const { email, password, name } = req.body;

      const tokens = await AuthService.register(email, password, name);

      res.status(201).json({
        status: "success",
        message: "User registered successfully",
        data: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
        },
      });
    } catch (error) {
      const err = error as Error;
      if (err.message === "User with this email already exists") {
        const appError: AppError = new Error(err.message);
        appError.statusCode = 409;
        return next(appError);
      }
      next(error);
    }
  }
);

// Login
router.post(
  "/login",
  validate([
    body("email").isEmail().withMessage("Valid email is required"),
    body("password").notEmpty().withMessage("Password is required"),
  ]),
  async (req, res, next) => {
    try {
      const { email, password } = req.body;

      const tokens = await AuthService.login(email, password);

      res.json({
        status: "success",
        message: "Login successful",
        data: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
        },
      });
    } catch (error) {
      const err = error as Error;
      if (
        err.message === "Invalid email or password" ||
        err.message === "Account is deactivated"
      ) {
        const appError: AppError = new Error(err.message);
        appError.statusCode = 401;
        return next(appError);
      }
      next(error);
    }
  }
);

// Refresh token
router.post(
  "/refresh",
  validate([
    body("refreshToken").notEmpty().withMessage("Refresh token is required"),
  ]),
  async (req, res, next) => {
    try {
      const { refreshToken } = req.body;

      const tokens = await AuthService.refreshAccessToken(refreshToken);

      res.json({
        status: "success",
        message: "Token refreshed successfully",
        data: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
        },
      });
    } catch (error) {
      const err = error as Error;
      const appError: AppError = new Error(
        err.message || "Invalid refresh token"
      );
      appError.statusCode = 401;
      return next(appError);
    }
  }
);

// Logout
router.post(
  "/logout",
  validate([
    body("refreshToken").notEmpty().withMessage("Refresh token is required"),
  ]),
  async (req, res, next) => {
    try {
      const { refreshToken } = req.body;

      await AuthService.logout(refreshToken);

      res.json({
        status: "success",
        message: "Logout successful",
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
