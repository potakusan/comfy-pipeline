import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getLoraDir, getRemoteProcessUrl } from '@/lib/setup/config';

const MODEL_EXTS = ['.safetensors', '.ckpt', '.pt'];
const THUMB_EXTS = ['.jpg', '.jpeg', '.png', '.webp'];

function findThumbnail(dir: string, baseName: string): string | null {
  for (const ext of THUMB_EXTS) {
    if (fs.existsSync(path.join(dir, baseName + ext))) return baseName + ext;
  }
  return null;
}

function readCivitaiMeta(
  dir: string,
  baseName: string,
): { trainedWords: string[]; modelId?: number } {
  const metaPath = path.join(dir, `${baseName}.civitai.json`);
  if (!fs.existsSync(metaPath)) return { trainedWords: [] };
  try {
    const data = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
    return {
      trainedWords: Array.isArray(data.trainedWords) ? data.trainedWords : [],
      modelId: typeof data.modelId === 'number' ? data.modelId : undefined,
    };
  } catch {
    return { trainedWords: [] };
  }
}

export async function GET() {
  const remoteUrl = getRemoteProcessUrl();
  if (remoteUrl) {
    const res = await fetch(`${remoteUrl}/api/models/loras`);
    return NextResponse.json(await res.json(), { status: res.status });
  }
  const LORA_DIR = getLoraDir();
  if (!LORA_DIR) {
    return NextResponse.json({ error: 'COMFYUI_LORA_DIR not configured' }, { status: 500 });
  }
  try {
    const files = fs.readdirSync(LORA_DIR);
    const items = files
      .filter((f) => MODEL_EXTS.some((e) => f.endsWith(e)))
      .map((f) => {
        const baseName = f.replace(/\.(safetensors|ckpt|pt)$/, '');
        const stat = fs.statSync(path.join(LORA_DIR, f));
        const thumb = findThumbnail(LORA_DIR, baseName);
        const { trainedWords, modelId } = readCivitaiMeta(LORA_DIR, baseName);
        return {
          fileName: f,
          name: baseName,
          size: stat.size,
          mtime: stat.mtime.toISOString(),
          thumbnail: thumb
            ? `/api/models/thumbnail?type=lora&name=${encodeURIComponent(thumb)}`
            : null,
          trainedWords,
          civitaiModelId: modelId,
        };
      })
      .sort((a, b) => b.mtime.localeCompare(a.mtime));
    return NextResponse.json({ items });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const remoteUrl = getRemoteProcessUrl();
  if (remoteUrl) {
    const body = await req.json();
    const res = await fetch(`${remoteUrl}/api/models/loras`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return NextResponse.json(await res.json(), { status: res.status });
  }
  const LORA_DIR = getLoraDir();
  if (!LORA_DIR) {
    return NextResponse.json({ error: 'COMFYUI_LORA_DIR not configured' }, { status: 500 });
  }
  const { fileName } = await req.json();
  if (!fileName || typeof fileName !== 'string') {
    return NextResponse.json({ error: 'fileName required' }, { status: 400 });
  }
  const safe = path.basename(fileName);
  const filePath = path.join(LORA_DIR, safe);
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    const baseName = safe.replace(/\.(safetensors|ckpt|pt)$/, '');
    for (const ext of [...THUMB_EXTS, '.civitai.json']) {
      const tp = path.join(LORA_DIR, baseName + ext);
      if (fs.existsSync(tp)) fs.unlinkSync(tp);
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
