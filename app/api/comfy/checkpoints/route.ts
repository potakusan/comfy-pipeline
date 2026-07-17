import { NextResponse } from "next/server";
import { getComfyUIUrl } from "@/lib/setup/config";

export async function GET() {
  try {
    const res = await fetch(
      getComfyUIUrl() + "/api/lm/checkpoints/list?page=1&page_size=100&sort_by=name%3Aasc&recursive=true&tag_logic=any",
      { cache: "no-store" },
    );
    if (!res.ok) {
      return NextResponse.json({ error: "upstream error" }, { status: res.status });
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "failed to fetch checkpoints" }, { status: 502 });
  }
}
