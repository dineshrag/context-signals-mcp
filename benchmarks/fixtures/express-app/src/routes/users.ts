import { Router, Request, Response } from "express"
import { UserService } from "../services/userService"

const router = Router()
const userService = new UserService()

router.get("/", async (req: Request, res: Response) => {
  const users = await userService.getAllUsers()
  res.json({ users })
})

router.get("/:id", async (req: Request, res: Response) => {
  const user = await userService.getUserById(req.params.id)
  if (!user) {
    return res.status(404).json({ error: "User not found" })
  }
  res.json({ user })
})

router.post("/", async (req: Request, res: Response) => {
  const { email, name, password } = req.body
  if (!email || !name || !password) {
    return res.status(400).json({ error: "Missing required fields" })
  }
  const user = await userService.createUser({ email, name, password })
  res.status(201).json({ user })
})

router.put("/:id", async (req: Request, res: Response) => {
  const user = await userService.updateUser(req.params.id, req.body)
  if (!user) {
    return res.status(404).json({ error: "User not found" })
  }
  res.json({ user })
})

router.delete("/:id", async (req: Request, res: Response) => {
  await userService.deleteUser(req.params.id)
  res.status(204).send()
})

export { router }