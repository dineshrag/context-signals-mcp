import crypto from "crypto"

export class TokenService {
  private tokens: Map<string, any> = new Map()

  generateToken(userId: string): string {
    return crypto.randomBytes(32).toString("hex")
  }

  validateToken(token: string): boolean {
    return this.tokens.has(token)
  }

  storeToken(token: string, payload: any): void {
    this.tokens.set(token, payload)
  }

  removeToken(token: string): void {
    this.tokens.delete(token)
  }
}

export class PasswordService {
  hash(password: string): string {
    return crypto.createHash("sha256").update(password).digest("hex")
  }

  verify(password: string, hash: string): boolean {
    return this.hash(password) === hash
  }
}

export function generateId(): string {
  return crypto.randomBytes(16).toString("hex")
}