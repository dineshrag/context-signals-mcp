import { NextRequest, NextResponse } from "next/server"
import { UploadService } from "@/lib/uploadService"

const uploadService = new UploadService()

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { filename, data } = body

  if (!filename || !data) {
    return NextResponse.json({ error: "Filename and data required" }, { status: 400 })
  }

  const result = await uploadService.uploadPhoto(filename, data)
  return NextResponse.json(result, { status: 201 })
}