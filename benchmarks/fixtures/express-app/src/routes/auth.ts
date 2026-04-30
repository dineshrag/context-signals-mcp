import { Router, Request, Response } from "express"
import { AuthService } from "../services/authService"
import { validateLogin, validateRegister } from "../middleware/validation"

const router = Router()
const authService = new AuthService()

router.post("/login", validateLogin, async (req: Request, res: Response) => {
  const { email, password } = req.body
  const result = await authService.login(email, password)
  if (!result) {
    return res.status(401).json({ error: "Invalid credentials" })
  }
  res.json(result)
})

router.post("/register", validateRegister, async (req: Request, res: Response) => {
  const { email, name, password } = req.body
  const result = await authService.register(email, name, password)
  res.status(201).json(result)
})

router.post("/logout", async (req: Request, res: Response) => {
  res.json({ message: "Logged out successfully" })
})

router.post("/refresh", async (req: Request, res: Response) => {
  const { refreshToken } = req.body
  const result = await authService.refreshToken(refreshToken)
  res.json(result)
})

router.post("/forgot-password", async (req: Request, res: Response) => {
  const { email } = req.body
  await authService.sendResetPassword(email)
  res.json({ message: "Reset password email sent" })
})

router.post("/reset-password", async (req: Request, res: Response) => {
  const { token, password } = req.body
  await authService.resetPassword(token, password)
  res.json({ message: "Password reset successfully" })
})

export { router }