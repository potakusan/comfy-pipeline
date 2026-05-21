import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

function getOutputDir(): string {
  return (
    process.env.COMFYUI_OUTPUT_DIR ||
    path.join(process.cwd(), "..", "ComfyUI", "output")
  );
}

const IMAGE_EXTS = /\.(png|jpe?g|webp|avif|bmp)$/i;

// ---------------------------------------------------------------------------
// Minimal ZIP writer (no external deps, stored/uncompressed)
// ---------------------------------------------------------------------------

function buildCrcTable(): Uint32Array {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c;
  }
  return table;
}
const CRC_TABLE = buildCrcTable();

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++)
    crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function createZip(files: Array<{ name: string; data: Buffer }>): Buffer {
  const parts: Buffer[] = [];
  const centralDirs: Buffer[] = [];
  let offset = 0;
  const now = new Date();
  const dosTime =
    (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
  const dosDate =
    ((now.getFullYear() - 1980) << 9) |
    ((now.getMonth() + 1) << 5) |
    now.getDate();

  for (const file of files) {
    const nameBytes = Buffer.from(file.name, "utf8");
    const crc = crc32(file.data);
    const size = file.data.length;

    const local = Buffer.alloc(30 + nameBytes.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8); // no compression (stored)
    local.writeUInt16LE(dosTime, 10);
    local.writeUInt16LE(dosDate, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(size, 18);
    local.writeUInt32LE(size, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    local.writeUInt16LE(0, 28);
    nameBytes.copy(local, 30);

    const central = Buffer.alloc(46 + nameBytes.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(dosTime, 12);
    central.writeUInt16LE(dosDate, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(size, 20);
    central.writeUInt32LE(size, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    nameBytes.copy(central, 46);

    parts.push(local, file.data);
    centralDirs.push(central);
    offset += local.length + file.data.length;
  }

  const centralBuf = Buffer.concat(centralDirs);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(centralBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...parts, centralBuf, eocd]);
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

/**
 * GET /api/process/download?folder=FOLDER&sub=mosaic
 * Returns a ZIP of all images in COMFYUI_OUTPUT_DIR/FOLDER/SUB/.
 * When REMOTE_PROCESS_URL is set, proxies the request to the remote machine.
 */
export async function GET(req: NextRequest) {
  const folder = req.nextUrl.searchParams.get("folder") ?? "";
  const sub = req.nextUrl.searchParams.get("sub") ?? "mosaic";

  if (!folder)
    return NextResponse.json({ error: "folder required" }, { status: 400 });

  const remoteUrl = process.env.REMOTE_PROCESS_URL;
  if (remoteUrl) {
    const upstream = await fetch(
      `${remoteUrl}/api/process/download?folder=${encodeURIComponent(folder)}&sub=${encodeURIComponent(sub)}`,
    );
    if (!upstream.ok) {
      return NextResponse.json(
        { error: "Remote download failed" },
        { status: 502 },
      );
    }
    const buf = await upstream.arrayBuffer();
    return new NextResponse(buf, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${folder}_${sub}.zip"`,
      },
    });
  }

  // Local: read images from COMFYUI_OUTPUT_DIR/folder/sub/
  const outputDir = getOutputDir();
  const targetDir = path.resolve(outputDir, folder, sub);
  if (!targetDir.startsWith(path.resolve(outputDir)))
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });

  let names: string[];
  try {
    names = fs
      .readdirSync(targetDir)
      .filter((f) => IMAGE_EXTS.test(f))
      .sort();
  } catch {
    return NextResponse.json({ error: "Directory not found" }, { status: 404 });
  }

  if (names.length === 0)
    return NextResponse.json({ error: "No images found" }, { status: 404 });

  const fileEntries = names.map((name) => ({
    name,
    data: fs.readFileSync(path.join(targetDir, name)),
  }));

  const zip = createZip(fileEntries);

  return new NextResponse(zip as any, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${folder}_${sub}.zip"`,
      "Content-Length": String(zip.length),
    },
  });
}
