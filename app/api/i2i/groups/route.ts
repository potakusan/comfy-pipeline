import { NextResponse } from "next/server";
import { listI2iGroups } from "@/lib/server/i2i-pool";

/** GET /api/i2i/groups  .i2i 以下の構図プールグループ一覧(再帰・件数付き)。 */
export async function GET() {
  return NextResponse.json({ groups: listI2iGroups() });
}
