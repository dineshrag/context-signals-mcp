import { NextRequest, NextResponse } from "next/server"
import { UserService } from "@/lib/userService"

const userService = new UserService()

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await userService.getUserById(params.id)
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }
  return NextResponse.json({ user })
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await request.json()
  const user = await userService.updateUser(params.id, body)
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }
  return NextResponse.json({ user })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  await userService.deleteUser(params.id)
  return NextResponse.json({}, { status: 204 })
}