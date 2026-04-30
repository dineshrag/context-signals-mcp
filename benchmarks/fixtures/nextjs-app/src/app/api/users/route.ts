import { NextRequest, NextResponse } from "next/server"
import { UserService } from "@/lib/userService"

const userService = new UserService()

export async function GET() {
  const users = await userService.getAllUsers()
  return NextResponse.json({ users })
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { email, name, password } = body

  if (!email || !name || !password) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
  }

  const user = await userService.createUser({ email, name, password })
  return NextResponse.json({ user }, { status: 201 })
}