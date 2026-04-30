import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify"
import { AuthService } from "../services/authService"
import { loginSchema, registerSchema } from "../schemas/auth"

const authService = new AuthService()

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post("/login", {
    schema: loginSchema,
    handler: async (req: FastifyRequest<{ Body: { email: string; password: string } }>, reply: FastifyReply) => {
      const { email, password } = req.body
      const result = await authService.login(email, password)
      if (!result) {
        return reply.status(401).send({ error: "Invalid credentials" })
      }
      return result
    },
  })

  app.post("/register", {
    schema: registerSchema,
    handler: async (req: FastifyRequest<{ Body: { email: string; name: string; password: string } }>, reply: FastifyReply) => {
      const { email, name, password } = req.body
      const result = await authService.register(email, name, password)
      return reply.status(201).send(result)
    },
  })

  app.post("/logout", async (req: FastifyRequest, reply: FastifyReply) => {
    return { message: "Logged out successfully" }
  })

  app.post("/refresh", async (req: FastifyRequest<{ Body: { refreshToken: string } }>, reply: FastifyReply) => {
    const { refreshToken } = req.body
    const result = await authService.refreshToken(refreshToken)
    return result
  })
}