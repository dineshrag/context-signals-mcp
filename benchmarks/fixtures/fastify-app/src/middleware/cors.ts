import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify"

export async function corsMiddleware(
  app: FastifyInstance
): Promise<void> {
  app.addHook("onRequest", async (req: FastifyRequest, reply: FastifyReply) => {
    reply.header("Access-Control-Allow-Origin", "*")
    reply.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
    reply.header("Access-Control-Allow-Headers", "Content-Type, Authorization")
  })

  app.options("*", async (req: FastifyRequest, reply: FastifyReply) => {
    return reply.status(200).send()
  })
}