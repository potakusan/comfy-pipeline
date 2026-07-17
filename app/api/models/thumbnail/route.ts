import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getLoraDir, getCheckpointDir } from '@/lib/setup/config';

const MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get('type');
  const name = req.nextUrl.searchParams.get('name');

  if (!name || !type) {
    return new NextResponse('Missing params', { status: 400 });
  }

  const dir = type === 'lora' ? getLoraDir() : getCheckpointDir();
  if (!dir) {
    return new NextResponse('Directory not configured', { status: 500 });
  }

  const safeName = path.basename(name);
  const filePath = path.join(dir, safeName);

  if (!fs.existsSync(filePath)) {
    return new NextResponse('Not found', { status: 404 });
  }

  const ext = path.extname(safeName).toLowerCase();
  const contentType = MIME[ext] ?? 'image/jpeg';
  const data = fs.readFileSync(filePath);

  return new NextResponse(data, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
