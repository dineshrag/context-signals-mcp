import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify"
import { UploadService } from "../services/uploadService"

const uploadService = new UploadService()

export async function uploadRoutes(app: FastifyInstance): Promise<void> {
  app.post("/photo", async (req: FastifyRequest<{ Body: { filename: string; data: string } }>, reply: FastifyReply) => {
    const { filename, data } = req.body
    if (!filename || !data) {
      return reply.status(400).send({ error: "Filename and data required" })
    }
    const result = await uploadService.uploadPhoto(filename, data)
    return reply.status(201).send(result)
  })

  app.post("/avatar", async (req: FastifyRequest<{ Body: { filename: string; data: string } }>, reply: FastifyReply) => {
    const { filename, data } = req.body
    const result = await uploadService.uploadAvatar(filename, data)
    return reply.status(201).send(result)
  })

  app.get("/:id", async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const file = await uploadService.getFile(req.params.id)
    if (!file) {
      return reply.status(404).send({ error: "File not found" })
    }
    return { file }
  })

  app.delete("/:id", async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    await uploadService.deleteFile(req.params.id)
    return reply.status(204).send()
  })
}