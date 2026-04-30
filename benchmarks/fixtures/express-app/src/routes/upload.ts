import { Router, Request, Response } from "express"
import { UploadService } from "../services/uploadService"
import { validateUpload } from "../middleware/validation"

const router = Router()
const uploadService = new UploadService()

router.post("/photo", validateUpload, async (req: Request, res: Response) => {
  const { filename, data } = req.body
  const result = await uploadService.uploadPhoto(filename, data)
  res.status(201).json(result)
})

router.post("/avatar", async (req: Request, res: Response) => {
  const { filename, data } = req.body
  const result = await uploadService.uploadAvatar(filename, data)
  res.status(201).json(result)
})

router.get("/:id", async (req: Request, res: Response) => {
  const file = await uploadService.getFile(req.params.id)
  if (!file) {
    return res.status(404).json({ error: "File not found" })
  }
  res.json({ file })
})

router.delete("/:id", async (req: Request, res: Response) => {
  await uploadService.deleteFile(req.params.id)
  res.status(204).send()
})

export { router }