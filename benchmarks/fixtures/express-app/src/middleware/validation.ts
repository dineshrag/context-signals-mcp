import { Request, Response, NextFunction } from "express"

export function validateLogin(req: Request, res: Response, next: NextFunction): void {
  const { email, password } = req.body

  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required" })
    return
  }

  if (!isValidEmail(email)) {
    res.status(400).json({ error: "Invalid email format" })
    return
  }

  next()
}

export function validateRegister(req: Request, res: Response, next: NextFunction): void {
  const { email, name, password } = req.body

  if (!email || !name || !password) {
    res.status(400).json({ error: "Email, name, and password are required" })
    return
  }

  if (!isValidEmail(email)) {
    res.status(400).json({ error: "Invalid email format" })
    return
  }

  if (password.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters" })
    return
  }

  next()
}

export function validateUpload(req: Request, res: Response, next: NextFunction): void {
  const { filename, data } = req.body

  if (!filename) {
    res.status(400).json({ error: "Filename is required" })
    return
  }

  if (!data) {
    res.status(400).json({ error: "Data is required" })
    return
  }

  next()
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}