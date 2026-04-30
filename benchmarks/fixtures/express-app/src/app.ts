import express, { Application, Request, Response, NextFunction } from "express"
import { router as usersRouter } from "./routes/users"
import { router as authRouter } from "./routes/auth"
import { router as uploadRouter } from "./routes/upload"
import { router as healthRouter } from "./routes/health"
import { errorHandler } from "./middleware/errorHandler"
import { authMiddleware } from "./middleware/auth"
import { requestLogger } from "./middleware/requestLogger"
import { config } from "./config"

export function createApp(): Application {
  const app = express()

  app.use(express.json())
  app.use(requestLogger)

  app.use("/health", healthRouter)

  app.use("/auth", authRouter)

  app.use("/users", authMiddleware, usersRouter)
  app.use("/upload", authMiddleware, uploadRouter)

  app.use(errorHandler)

  return app
}

export function startServer(): void {
  const app = createApp()
  const port = config.port || 3000

  app.listen(port, () => {
    console.log(`Server running on port ${port}`)
  })
}

if (require.main === module) {
  startServer()
}