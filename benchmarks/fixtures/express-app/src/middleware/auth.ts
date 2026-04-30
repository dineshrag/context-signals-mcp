import { Request, Response, NextFunction } from "express"
import { AuthService } from "../services/authService"

const authService = new AuthService()

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization

  if (!authHeader) {
    res.status(401).json({ error: "No authorization header" })
    return
  }

  const token = authHeader.replace("Bearer ", "")

  try {
    const decoded = await authService.verifyToken(token)
    ;(req as any).user = decoded
    next()
  } catch (error) {
    res.status(401).json({ error: "Invalid token" })
  }
}