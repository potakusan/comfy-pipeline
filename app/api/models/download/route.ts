import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { createJob, updateJob } from '@/lib/download-jobs';
import { getLoraDir, getCheckpointDir, getCivitaiApiKey, getRemoteProcessUrl } from '@/lib/setup/config';
import { apiError } from '@/lib/server/api-error';

function parseCivitaiUrl(url: string): { modelId?: string; versionId?: string } {
  try {
    const u = new URL(url.trim());
    const dlMatch = u.pathname.match(/\/api\/download\/models\/(\d+)/);
    if (dlMatch) return { versionId: dlMatch[1] };
    const modelMatch = u.pathname.match(/\/models\/(\d+)/);
    const versionId = u.searchParams.get('modelVersionId') ?? undefined;
    return { modelId: modelMatch?.[1], versionId };
  } catch {
    return {};
  }
}

function civitaiHeaders(apiKey: string): HeadersInit {
  return apiKey ? { Authorization: `Bearer ${apiKey}` } : {};
}

async function fetchVersionInfo(versionId: string, apiKey: string) {
  const res = await fetch(`https://civitai.com/api/v1/model-versions/${versionId}`, {
    headers: civitaiHeaders(apiKey),
  });
  if (!res.ok) throw new Error(`Civitai API error: ${res.status} ${res.statusText}`);
  return res.json();
}

async function fetchModelInfo(modelId: string, apiKey: string) {
  const res = await fetch(`https://civitai.com/api/v1/models/${modelId}`, {
    headers: civitaiHeaders(apiKey),
  });
  if (!res.ok) throw new Error(`Civitai API error: ${res.status} ${res.statusText}`);
  return res.json();
}

async function runDownload(
  jobId: string,
  downloadUrl: string,
  previewUrl: string | null,
  destPath: string,
  apiKey: string,
  metadata: { modelName: string; trainedWords: string[]; modelId?: number },
) {
  updateJob(jobId, { status: 'downloading' });
  try {
    const res = await fetch(downloadUrl, { headers: civitaiHeaders(apiKey) });
    if (!res.ok) throw new Error(`Download HTTP ${res.status}`);
    if (!res.body) throw new Error('No response body');

    const total = parseInt(res.headers.get('content-length') ?? '0', 10);
    updateJob(jobId, { totalBytes: total });

    const writer = fs.createWriteStream(destPath);
    const reader = res.body.getReader();
    let downloaded = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      writer.write(Buffer.from(value));
      downloaded += value.length;
      const progress = total > 0 ? Math.round((downloaded / total) * 100) : 0;
      updateJob(jobId, { downloadedBytes: downloaded, progress });
    }

    await new Promise<void>((resolve, reject) =>
      writer.end((err: Error | null | undefined) => (err ? reject(err) : resolve())),
    );

    // Save Civitai metadata (trainedWords etc.)
    try {
      const metaPath = destPath.replace(/\.(safetensors|ckpt|pt)$/i, '.civitai.json');
      fs.writeFileSync(metaPath, JSON.stringify(metadata, null, 2));
    } catch {
      // non-fatal
    }

    // Download thumbnail (non-fatal)
    if (previewUrl) {
      try {
        const thumbRes = await fetch(previewUrl);
        if (thumbRes.ok) {
          const extMatch = previewUrl.match(/\.(jpg|jpeg|png|webp)/i);
          const thumbExt = extMatch ? extMatch[1].toLowerCase() : 'jpg';
          const thumbPath = destPath.replace(/\.(safetensors|ckpt|pt)$/i, `.${thumbExt}`);
          const buf = await thumbRes.arrayBuffer();
          fs.writeFileSync(thumbPath, Buffer.from(buf));
        }
      } catch {
        // thumbnail failure is acceptable
      }
    }

    updateJob(jobId, { status: 'done', progress: 100 });
  } catch (e) {
    try {
      if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
    } catch {
      // ignore cleanup errors
    }
    updateJob(jobId, { status: 'error', error: String(e) });
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  const remoteUrl = getRemoteProcessUrl();
  if (remoteUrl) {
    const res = await fetch(`${remoteUrl}/api/models/download`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (data.jobId) data.jobId = `remote:${data.jobId}`;
    return NextResponse.json(data, { status: res.status });
  }

  const type: string = body.type;
  const civitaiUrl: string = body.civitaiUrl;
  const apiKey: string = body.apiKey || getCivitaiApiKey() || '';

  if (!type || !civitaiUrl) {
    return NextResponse.json({ error: 'type and civitaiUrl are required' }, { status: 400 });
  }

  const dir = type === 'lora' ? getLoraDir() : getCheckpointDir();
  if (!dir) {
    const envVar = type === 'lora' ? 'COMFYUI_LORA_DIR' : 'COMFYUI_CHECKPOINT_DIR';
    return NextResponse.json({ error: `${envVar} is not configured` }, { status: 500 });
  }

  try {
    const { modelId, versionId } = parseCivitaiUrl(civitaiUrl);
    if (!modelId && !versionId) {
      return NextResponse.json({ error: 'Could not parse Civitai URL' }, { status: 400 });
    }

    let versionInfo: Record<string, unknown>;
    if (versionId) {
      versionInfo = await fetchVersionInfo(versionId, apiKey);
    } else {
      const modelInfo = await fetchModelInfo(modelId!, apiKey);
      versionInfo = (modelInfo.modelVersions as Record<string, unknown>[])?.[0];
      if (!versionInfo) throw new Error('No versions found for this model');
    }

    type CivitaiFile = { name: string; downloadUrl: string; primary?: boolean };
    const files = (versionInfo.files as CivitaiFile[]) ?? [];
    const primaryFile = files.find((f) => f.primary) ?? files[0];
    if (!primaryFile) throw new Error('No downloadable file found');

    const fileName = primaryFile.name;
    const downloadUrl = primaryFile.downloadUrl;
    const modelName =
      (versionInfo.model as { name: string } | undefined)?.name ??
      fileName.replace(/\.(safetensors|ckpt|pt)$/i, '');
    const trainedWords = (versionInfo.trainedWords as string[]) ?? [];

    type CivitaiImage = { url: string; type?: string };
    const images = (versionInfo.images as CivitaiImage[]) ?? [];
    const previewImage = images.find((i) => i.type === 'image') ?? images[0];
    const previewUrl = previewImage?.url ?? null;

    const destPath = path.join(dir, path.basename(fileName));
    const job = createJob({ type: type as 'lora' | 'checkpoint', fileName, modelName });

    const modelIdNum =
      (versionInfo.modelId as number | undefined) ??
      (versionId ? undefined : modelId ? parseInt(modelId, 10) : undefined);

    runDownload(job.id, downloadUrl, previewUrl, destPath, apiKey, {
      modelName,
      trainedWords,
      modelId: modelIdNum,
    }).catch(() => {});

    return NextResponse.json({ jobId: job.id, fileName, modelName });
  } catch (e) {
    return apiError('models/download POST', e);
  }
}
