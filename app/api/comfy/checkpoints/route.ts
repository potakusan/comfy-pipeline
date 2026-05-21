import { NextResponse } from "next/server";

export async function GET() {
  try {
    const res = await fetch(
      "http://127.0.0.1:8188/api/lm/checkpoints/list?page=1&page_size=100&sort_by=name%3Aasc&recursive=true&tag_logic=any",
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
