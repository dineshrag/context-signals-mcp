import { NextRequest, NextResponse } from "next/server"
import { AuthService } from "@/lib/authService"

const authService = new AuthService()

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { email, password } = body

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password required" }, { status: 400 })
  }

  const result = await authService.login(email, password)
  if (!result) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
  }

  return NextResponse.json(result)
}