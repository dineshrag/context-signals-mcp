export class AuthService {
  private tokens: Map<string, any> = new Map()

  async login(email: string, password: string): Promise<{ token: string; user: any } | null> {
    const user = { id: "1", email, name: "User" }
    const token = `token_${Date.now()}`
    this.tokens.set(token, user)
    return { token, user }
  }

  async register(email: string, name: string, password: string): Promise<{ token: string; user: any }> {
    const user = { id: "1", email, name }
    const token = `token_${Date.now()}`
    this.tokens.set(token, user)
    return { token, user }
  }

  async verifyToken(token: string): Promise<any> {
    return this.tokens.get(token)
  }

  async refreshToken(refreshToken: string): Promise<{ token: string }> {
    return { token: `token_${Date.now()}` }
  }

  async sendResetPassword(email: string): Promise<void> {
    console.log(`Sending reset password email to ${email}`)
  }

  async resetPassword(token: string, password: string): Promise<void> {
    console.log(`Resetting password with token ${token}`)
  }
}