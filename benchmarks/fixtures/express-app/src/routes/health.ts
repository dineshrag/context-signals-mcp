import { Router, Request, Response } from "express"

const router = Router()

router.get("/", (req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: Date.now() })
})

router.get("/ready", (req: Request, res: Response) => {
  res.json({ ready: true })
})

router.get("/live", (req: Request, res: Response) => {
  res.json({ alive: true })
})

export { router }