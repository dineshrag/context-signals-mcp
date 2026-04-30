import { NextRequest, NextResponse } from "next/server"
import { AuthService } from "@/lib/authService"

const authService = new AuthService()

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { email, name, password } = body

  if (!email || !name || !password) {
    return NextResponse.json({ error: "Email, name, and password required" }, { status: 400 })
  }

  const result = await authService.register(email, name, password)
  return NextResponse.json(result, { status: 201 })
}