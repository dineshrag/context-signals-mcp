import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify"
import { UserService } from "../services/userService"

const userService = new UserService()

export async function userRoutes(app: FastifyInstance): Promise<void> {
  app.get("/", async (req: FastifyRequest, reply: FastifyReply) => {
    const users = await userService.getAllUsers()
    return { users }
  })

  app.get("/:id", async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const user = await userService.getUserById(req.params.id)
    if (!user) {
      return reply.status(404).send({ error: "User not found" })
    }
    return { user }
  })

  app.post("/", async (req: FastifyRequest<{ Body: { email: string; name: string; password: string } }>, reply: FastifyReply) => {
    const { email, name, password } = req.body
    if (!email || !name || !password) {
      return reply.status(400).send({ error: "Missing required fields" })
    }
    const user = await userService.createUser({ email, name, password })
    return reply.status(201).send({ user })
  })

  app.put("/:id", async (req: FastifyRequest<{ Params: { id: string }; Body: { email?: string; name?: string } }>, reply: FastifyReply) => {
    const user = await userService.updateUser(req.params.id, req.body)
    if (!user) {
      return reply.status(404).send({ error: "User not found" })
    }
    return { user }
  })

  app.delete("/:id", async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    await userService.deleteUser(req.params.id)
    return reply.status(204).send()
  })
}