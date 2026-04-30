export interface User {
  id: string
  email: string
  name: string
  password: string
  createdAt: Date
  updatedAt: Date
}

export interface CreateUserInput {
  email: string
  name: string
  password: string
}

export interface UpdateUserInput {
  email?: string
  name?: string
  password?: string
}