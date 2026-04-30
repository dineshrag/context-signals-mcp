import { NextRequest, NextResponse } from "next/server"
import { UploadService } from "@/lib/uploadService"

const uploadService = new UploadService()

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const file = await uploadService.getFile(params.id)
  if (!file) {
    return NextResponse.json({ error: "File not found" }, { status: 404 })
  }
  return NextResponse.json({ file })
}