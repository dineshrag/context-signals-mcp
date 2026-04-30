import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify"

export async function errorHandler(
  error: Error,
  req: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  req.log.error(error)

  const statusCode = (error as any).statusCode || 500
  const message = error.message || "Internal server error"

  reply.status(statusCode).send({
    error: {
      message,
      status: statusCode,
      timestamp: new Date().toISOString(),
      path: req.url,
    },
  })
}