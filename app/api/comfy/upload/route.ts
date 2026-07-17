import { NextRequest, NextResponse } from "next/server";
import { getComfyUIUrl } from "@/lib/setup/config";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const res = await fetch(`${getComfyUIUrl()}/upload/image`, {
      method: "POST",
      body: formData,
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: "Failed to upload to ComfyUI" }, { status: 503 });
  }
}
