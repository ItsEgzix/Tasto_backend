import { Request, Response, NextFunction } from "express";
import { AuthService } from "../services/auth.service";
import { AppError } from "./error-handler";

// Extend Express Request to include user
declare module "express-serve-static-core" {
  interface Request {
    user?: {
      userId: string;
      email: string;
    };
  }
}

export const authenticate = (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      const error: AppError = new Error("No token provided");
      error.statusCode = 401;
      return next(error);
    }

    // Remove "Bearer " prefix
    const token = authHeader.substring(7);

    const payload = AuthService.verifyAccessToken(token);
    req.user = payload;

    next();
  } catch (error) {
    const err: AppError = new Error("Invalid or expired token");
    err.statusCode = 401;
    next(err);
  }
};
