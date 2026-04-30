export const loginSchema = {
  body: {
    type: "object",
    required: ["email", "password"],
    properties: {
      email: { type: "string", format: "email" },
      password: { type: "string", minLength: 1 },
    },
  },
}

export const registerSchema = {
  body: {
    type: "object",
    required: ["email", "name", "password"],
    properties: {
      email: { type: "string", format: "email" },
      name: { type: "string", minLength: 1 },
      password: { type: "string", minLength: 8 },
    },
  },
}

export const userSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    email: { type: "string" },
    name: { type: "string" },
    createdAt: { type: "string" },
  },
}