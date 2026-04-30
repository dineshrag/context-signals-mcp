import { User, CreateUserInput, UpdateUserInput } from "../types/user"

export class UserService {
  private users: Map<string, User> = new Map()

  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values())
  }

  async getUserById(id: string): Promise<User | undefined> {
    return this.users.get(id)
  }

  async createUser(input: CreateUserInput): Promise<User> {
    const id = `user_${Date.now()}`
    const user: User = {
      id,
      email: input.email,
      name: input.name,
      password: input.password,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    this.users.set(id, user)
    return user
  }

  async updateUser(id: string, input: UpdateUserInput): Promise<User | undefined> {
    const user = this.users.get(id)
    if (!user) return undefined

    const updated: User = { ...user, ...input, updatedAt: new Date() }
    this.users.set(id, updated)
    return updated
  }

  async deleteUser(id: string): Promise<void> {
    this.users.delete(id)
  }
}