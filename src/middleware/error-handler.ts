import { Request, Response, NextFunction } from "express";

export interface AppError extends Error {
  statusCode?: number;
  status?: string;
}

export const errorHandler = (
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  const statusCode = err.statusCode || 500;
  const status = err.status || "error";

  // Log error details in development
  if (process.env.NODE_ENV === "development") {
    console.error("Error details:", {
      message: err.message,
      statusCode,
      stack: err.stack,
      ...((err as any).code && { code: (err as any).code }),
      ...((err as any).detail && { detail: (err as any).detail }),
    });
  }

  res.status(statusCode).json({
    status,
    message: err.message || "Internal Server Error",
    ...(process.env.NODE_ENV === "development" && {
      stack: err.stack,
      ...((err as any).code && { code: (err as any).code }),
      ...((err as any).detail && { detail: (err as any).detail }),
    }),
  });
};

export const notFoundHandler = (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  const error: AppError = new Error(`Not Found - ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
};
