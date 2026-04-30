import { Request, Response, NextFunction } from "express"

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  console.error("Error:", err.message)

  const statusCode = (err as any).statusCode || 500
  const message = err.message || "Internal server error"

  res.status(statusCode).json({
    error: {
      message,
      status: statusCode,
      timestamp: new Date().toISOString(),
      path: req.path,
    },
  })
}

export class AppError extends Error {
  statusCode: number

  constructor(message: string, statusCode: number) {
    super(message)
    this.statusCode = statusCode
    this.name = "AppError"
  }
}