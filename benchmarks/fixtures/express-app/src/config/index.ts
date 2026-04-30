export const config = {
  port: parseInt(process.env.PORT || "3000"),
  env: process.env.NODE_ENV || "development",
  database: {
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "5432"),
    name: process.env.DB_NAME || "app_db",
    user: process.env.DB_USER || "postgres",
    password: process.env.DB_PASSWORD || "postgres",
  },
  jwt: {
    secret: process.env.JWT_SECRET || "your-secret-key",
    expiresIn: "1h",
    refreshExpiresIn: "7d",
  },
  upload: {
    maxSize: 10 * 1024 * 1024,
    allowedTypes: ["image/jpeg", "image/png", "image/gif"],
    directory: "./uploads",
  },
  logging: {
    level: process.env.LOG_LEVEL || "info",
  },
}