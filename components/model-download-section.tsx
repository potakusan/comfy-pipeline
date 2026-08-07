'use client';
import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Download, Loader2 } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { type DownloadJobStatus, formatBytes } from '@/lib/model-manager';

export default function DownloadSection({
  type,
  onDownloadComplete,
}: {
  type: 'lora' | 'checkpoint';
  onDownloadComplete: () => void;
}) {
  const [url, setUrl] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [jobStatus, setJobStatus] = useState<DownloadJobStatus | null>(null);
  const [error, setError] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearPoll = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  useEffect(() => clearPoll, []);

  const startDownload = async () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    setError('');
    setJobStatus(null);
    setDownloading(true);

    try {
      const data = await apiFetch<{ jobId: string }>('/api/models/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, civitaiUrl: trimmed }),
      });

      const { jobId } = data;
      pollRef.current = setInterval(async () => {
        try {
          const status = await apiFetch<DownloadJobStatus>(`/api/models/download/${jobId}`);
          setJobStatus(status);
          if (status.status === 'done') {
            clearPoll();
            setDownloading(false);
            setUrl('');
            onDownloadComplete();
          } else if (status.status === 'error') {
            clearPoll();
            setDownloading(false);
            setError(status.error ?? 'ダウンロードエラー');
          }
        } catch {
          // network blip — keep polling
        }
      }, 1000);
    } catch (e) {
      setDownloading(false);
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Civitaiからダウンロード
      </p>

      <div className="flex gap-2">
        <Input
          placeholder="https://civitai.com/models/12345"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !downloading && startDownload()}
          className="h-8 flex-1 font-mono text-xs"
          disabled={downloading}
        />
        <Button
          size="sm"
          className="h-8 shrink-0 gap-1.5 text-xs"
          onClick={startDownload}
          disabled={downloading || !url.trim()}
        >
          {downloading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Download className="h-3.5 w-3.5" />
          )}
          {downloading ? 'ダウンロード中...' : 'ダウンロード'}
        </Button>
      </div>

      {jobStatus && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span className="truncate">{jobStatus.modelName || jobStatus.fileName}</span>
            <span className="ml-2 shrink-0">
              {formatBytes(jobStatus.downloadedBytes)}
              {jobStatus.totalBytes > 0 ? ` / ${formatBytes(jobStatus.totalBytes)}` : ''}
            </span>
          </div>
          <Progress value={jobStatus.progress} className="h-1.5" />
          {jobStatus.status === 'done' && (
            <p className="text-[10px] font-medium text-green-500">✓ ダウンロード完了</p>
          )}
        </div>
      )}

      {error && <p className="text-[10px] text-destructive">{error}</p>}
    </div>
  );
}
