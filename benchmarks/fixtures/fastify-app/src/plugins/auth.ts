import { FastifyInstance } from "fastify"
import { AuthService } from "../services/authService"

const authService = new AuthService()

export async function authPlugin(app: FastifyInstance): Promise<void> {
  app.decorateRequest("user", null)

  app.addHook("preHandler", async (req) => {
    const authHeader = req.headers.authorization
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "")
      try {
        const user = await authService.verifyToken(token)
        ;(req as any).user = user
      } catch {
        // Token verification failed
      }
    }
  })
}

declare module "fastify" {
  interface FastifyRequest {
    user?: any
  }
}