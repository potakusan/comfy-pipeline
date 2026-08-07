import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getCheckpointDir, getRemoteProcessUrl } from '@/lib/setup/config';
import { proxyJson } from '@/lib/server/remote-proxy';

const MODEL_EXTS = ['.safetensors', '.ckpt', '.pt'];
const THUMB_EXTS = ['.jpg', '.jpeg', '.png', '.webp'];

function findThumbnail(dir: string, baseName: string): string | null {
  for (const ext of THUMB_EXTS) {
    if (fs.existsSync(path.join(dir, baseName + ext))) return baseName + ext;
  }
  return null;
}

function readCivitaiMeta(dir: string, baseName: string): { modelId?: number } {
  const metaPath = path.join(dir, `${baseName}.civitai.json`);
  if (!fs.existsSync(metaPath)) return {};
  try {
    const data = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
    return { modelId: typeof data.modelId === 'number' ? data.modelId : undefined };
  } catch {
    return {};
  }
}

export async function GET() {
  const remoteUrl = getRemoteProcessUrl();
  if (remoteUrl) {
    return proxyJson(remoteUrl, '/api/models/checkpoints');
  }
  const CHECKPOINT_DIR = getCheckpointDir();
  if (!CHECKPOINT_DIR) {
    return NextResponse.json({ error: 'COMFYUI_CHECKPOINT_DIR not configured' }, { status: 500 });
  }
  try {
    const files = fs.readdirSync(CHECKPOINT_DIR);
    const items = files
      .filter((f) => MODEL_EXTS.some((e) => f.endsWith(e)))
      .map((f) => {
        const baseName = f.replace(/\.(safetensors|ckpt|pt)$/, '');
        const stat = fs.statSync(path.join(CHECKPOINT_DIR, f));
        const thumb = findThumbnail(CHECKPOINT_DIR, baseName);
        const { modelId } = readCivitaiMeta(CHECKPOINT_DIR, baseName);
        return {
          fileName: f,
          name: baseName,
          size: stat.size,
          mtime: stat.mtime.toISOString(),
          thumbnail: thumb
            ? `/api/models/thumbnail?type=checkpoint&name=${encodeURIComponent(thumb)}`
            : null,
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
    return proxyJson(remoteUrl, '/api/models/checkpoints', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }
  const CHECKPOINT_DIR = getCheckpointDir();
  if (!CHECKPOINT_DIR) {
    return NextResponse.json({ error: 'COMFYUI_CHECKPOINT_DIR not configured' }, { status: 500 });
  }
  const { fileName } = await req.json();
  if (!fileName || typeof fileName !== 'string') {
    return NextResponse.json({ error: 'fileName required' }, { status: 400 });
  }
  const safe = path.basename(fileName);
  const filePath = path.join(CHECKPOINT_DIR, safe);
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    const baseName = safe.replace(/\.(safetensors|ckpt|pt)$/, '');
    for (const ext of THUMB_EXTS) {
      const tp = path.join(CHECKPOINT_DIR, baseName + ext);
      if (fs.existsSync(tp)) fs.unlinkSync(tp);
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
