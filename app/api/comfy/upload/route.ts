import { NextRequest, NextResponse } from "next/server";

const COMFYUI_URL = process.env.COMFYUI_URL || "http://localhost:8188";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const res = await fetch(`${COMFYUI_URL}/upload/image`, {
      method: "POST",
      body: formData,
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: "Failed to upload to ComfyUI" }, { status: 503 });
  }
}
