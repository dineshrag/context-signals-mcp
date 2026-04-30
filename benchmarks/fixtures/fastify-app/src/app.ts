import Fastify, { FastifyInstance } from "fastify"
import { userRoutes } from "./routes/users"
import { authRoutes } from "./routes/auth"
import { uploadRoutes } from "./routes/upload"
import { healthRoutes } from "./routes/health"
import { authPlugin } from "./plugins/auth"
import { corsMiddleware } from "./middleware/cors"
import { errorHandler } from "./middleware/errorHandler"
import { config } from "./config"

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: config.logging.level,
    },
  })

  app.register(corsMiddleware)

  app.register(authPlugin)

  app.register(userRoutes, { prefix: "/users" })
  app.register(authRoutes, { prefix: "/auth" })
  app.register(uploadRoutes, { prefix: "/upload" })
  app.register(healthRoutes, { prefix: "/health" })

  app.setErrorHandler(errorHandler)

  return app
}

export async function startServer(): Promise<void> {
  const app = await buildApp()

  try {
    await app.listen({ port: config.port, host: "0.0.0.0" })
    console.log(`Server running on port ${config.port}`)
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

if (require.main === module) {
  startServer()
}