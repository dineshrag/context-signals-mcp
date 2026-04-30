import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify"

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get("/", async (req: FastifyRequest, reply: FastifyReply) => {
    return { status: "ok", timestamp: Date.now() }
  })

  app.get("/ready", async (req: FastifyRequest, reply: FastifyReply) => {
    return { ready: true }
  })

  app.get("/live", async (req: FastifyRequest, reply: FastifyReply) => {
    return { alive: true }
  })
}