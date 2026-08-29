import { NextRequest, NextResponse } from "next/server";
import { readArchivedThumbnail } from "@/lib/server/gallery-seed-archive";

/** GET /api/gallery/seed-archive/thumbnail?id=<archiveId> */
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id") ?? "";
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const buffer = readArchivedThumbnail(id);
  if (!buffer) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "public, max-age=3600, immutable",
    },
  });
}
