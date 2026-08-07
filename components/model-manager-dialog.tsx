'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import {
  Download,
  Trash2,
  ImageOff,
  Plus,
  Check,
  Loader2,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import type { LoraEntry } from '@/lib/comfy';
import DeleteConfirmDialog from '@/components/delete-confirm-dialog';
import { apiFetch } from '@/lib/api-client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ModelItem {
  fileName: string;
  name: string;
  size: number;
  mtime: string;
  thumbnail: string | null;
  trainedWords?: string[];
  civitaiModelId?: number;
}

interface DownloadJobStatus {
  id: string;
  status: 'pending' | 'downloading' | 'done' | 'error';
  progress: number;
  totalBytes: number;
  downloadedBytes: number;
  fileName: string;
  modelName: string;
  error?: string;
}

type SortKey = 'mtime' | 'az' | 'za';

// ---------------------------------------------------------------------------
// Utils
// ---------------------------------------------------------------------------

function formatBytes(bytes: number): string {
  if (bytes === 0) return '—';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function sortItems(items: ModelItem[], key: SortKey): ModelItem[] {
  return [...items].sort((a, b) => {
    if (key === 'az') return a.name.localeCompare(b.name);
    if (key === 'za') return b.name.localeCompare(a.name);
    return b.mtime.localeCompare(a.mtime); // newest first
  });
}

// ---------------------------------------------------------------------------
// Add LoRA dialog (strength / trigger words before registering)
// ---------------------------------------------------------------------------

function AddLoraDialog({
  item,
  onAdd,
  onClose,
}: {
  item: ModelItem;
  onAdd: (entry: LoraEntry) => void;
  onClose: () => void;
}) {
  const [strength, setStrength] = useState(1.0);
  const [clipStrength, setClipStrength] = useState(1.0);
  const [triggerWords, setTriggerWords] = useState(
    (item.trainedWords ?? []).join(', '),
  );

  const appendWord = (word: string) => {
    setTriggerWords((prev) => {
      const clean = prev.trim();
      if (!clean) return word;
      const parts = clean.split(',').map((s) => s.trim());
      if (parts.includes(word)) return prev;
      return `${clean}, ${word}`;
    });
  };

  const handle = () => {
    onAdd({ name: item.name, strength, clipStrength, triggerWords });
    onClose();
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="flex max-h-[90vh] w-[min(95vw,480px)] max-w-none flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle className="text-sm">LoRAを追加</DialogTitle>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
          <p
            className="break-all rounded bg-muted/40 px-2 py-1 font-mono text-xs leading-relaxed"
            title={item.name}
          >
            {item.name}
          </p>

          {/* Strength */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs">強度</Label>
              <span className="font-mono text-xs text-muted-foreground">
                {strength.toFixed(2)}
              </span>
            </div>
            <Slider
              min={0}
              max={2}
              step={0.05}
              value={[strength]}
              onValueChange={([v]) => setStrength(v)}
            />
          </div>

          {/* CLIP strength */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs">CLIP強度</Label>
              <span className="font-mono text-xs text-muted-foreground">
                {clipStrength.toFixed(2)}
              </span>
            </div>
            <Slider
              min={0}
              max={2}
              step={0.05}
              value={[clipStrength]}
              onValueChange={([v]) => setClipStrength(v)}
            />
          </div>

          {/* Trigger words */}
          <div className="space-y-1.5">
            <Label className="text-xs">トリガーワード</Label>
            <Textarea
              value={triggerWords}
              onChange={(e) => setTriggerWords(e.target.value)}
              placeholder="例: my_character, blue hair, ..."
              className="min-h-16 text-xs"
            />

            {/* Civitai trained words chips */}
            {(item.trainedWords ?? []).length > 0 && (
              <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground">
                  Civitaiのワード（クリックで追加）:
                </p>
                <div className="flex flex-wrap gap-1">
                  {(item.trainedWords ?? []).map((word) => (
                    <button
                      key={word}
                      type="button"
                      onClick={() => appendWord(word)}
                      className="rounded border border-border bg-muted/30 px-1.5 py-0.5 text-[10px] hover:border-primary hover:bg-primary/10 hover:text-primary"
                    >
                      {word}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="shrink-0 border-t pt-3">
          <Button variant="outline" size="sm" onClick={onClose}>
            キャンセル
          </Button>
          <Button size="sm" onClick={handle}>
            登録
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Model card
// ---------------------------------------------------------------------------

function ModelCard({
  item,
  type,
  isActive,
  onAdd,
  onToggleOff,
  onDelete,
}: {
  item: ModelItem;
  type: 'lora' | 'checkpoint';
  isActive: boolean;
  onAdd: () => void;
  onToggleOff: () => void;
  onDelete: () => Promise<void>;
}) {
  const [imgError, setImgError] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    await onDelete();
    setDeleting(false);
    setConfirmDelete(false);
  };

  return (
    <div
      className={`group flex flex-col overflow-hidden rounded-lg border bg-card transition-colors hover:border-primary/40 ${
        isActive ? 'border-primary/60' : ''
      }`}
    >
      {/* Thumbnail */}
      <div className="relative aspect-3/4 w-full overflow-hidden bg-muted">
        {item.thumbnail && !imgError ? (
          <img
            src={item.thumbnail}
            alt={item.name}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <ImageOff className="h-8 w-8 text-muted-foreground/30" />
          </div>
        )}
        {isActive && (
          <div className="absolute top-1.5 right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary">
            <Check className="h-3 w-3 text-primary-foreground" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex flex-1 flex-col gap-1 p-2">
        <p
          className="line-clamp-2 text-[11px] font-medium leading-tight"
          title={item.name}
        >
          {item.name}
        </p>
        <p className="text-[10px] text-muted-foreground">{formatBytes(item.size)}</p>

        {/* Actions */}
        <div className="mt-auto flex gap-1 pt-1">
          {isActive ? (
            <Button
              size="sm"
              variant="secondary"
              className="h-6 flex-1 gap-1 text-[10px]"
              onClick={type === 'lora' ? onToggleOff : undefined}
              disabled={type === 'checkpoint'}
            >
              <Check className="h-3 w-3" />
              使用中
            </Button>
          ) : (
            <Button
              size="sm"
              variant="default"
              className="h-6 flex-1 gap-1 text-[10px]"
              onClick={onAdd}
            >
              <Plus className="h-3 w-3" />
              追加
            </Button>
          )}

          {item.civitaiModelId && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 shrink-0 p-0 text-muted-foreground hover:text-primary"
              asChild
              title="Civitaiで開く"
              aria-label="Civitaiで開く"
            >
              <a
                href={`https://civitai.com/models/${item.civitaiModelId}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-3 w-3" />
              </a>
            </Button>
          )}

          <Button
            size="sm"
            variant="ghost"
            className="h-6 w-6 shrink-0 p-0 text-muted-foreground hover:text-destructive"
            onClick={() => setConfirmDelete(true)}
            aria-label="削除"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      <DeleteConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`「${item.name}」を削除しますか?`}
        confirming={deleting}
        onConfirm={handleDelete}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Download section
// ---------------------------------------------------------------------------

function DownloadSection({
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

// ---------------------------------------------------------------------------
// Model list (with search + sort)
// ---------------------------------------------------------------------------

function ModelList({
  type,
  refreshSignal,
  onAddLora,
  onRemoveLora,
  onSelectCheckpoint,
  addedLoraNames,
  activeCheckpoint,
}: {
  type: 'lora' | 'checkpoint';
  refreshSignal: number;
  onAddLora?: (entry: LoraEntry) => void;
  onRemoveLora?: (name: string) => void;
  onSelectCheckpoint?: (fileName: string) => void;
  addedLoraNames: Set<string>;
  activeCheckpoint: string;
}) {
  const [items, setItems] = useState<ModelItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('mtime');
  const [addTarget, setAddTarget] = useState<ModelItem | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const endpoint =
        type === 'lora' ? '/api/models/loras' : '/api/models/checkpoints';
      const data = await apiFetch<{ items?: ModelItem[] }>(endpoint);
      setItems(data.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [type]);

  useEffect(() => {
    load();
  }, [load, refreshSignal]);

  const deleteItem = async (fileName: string) => {
    const endpoint =
      type === 'lora' ? '/api/models/loras' : '/api/models/checkpoints';
    try {
      await apiFetch(endpoint, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName }),
      });
      setItems((prev) => prev.filter((i) => i.fileName !== fileName));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const displayed = sortItems(
    search.trim()
      ? items.filter((i) =>
          i.name.toLowerCase().includes(search.toLowerCase()),
        )
      : items,
    sortKey,
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    const envVar = type === 'lora' ? 'COMFYUI_LORA_DIR' : 'COMFYUI_CHECKPOINT_DIR';
    return (
      <div className="flex flex-col items-center gap-2 py-12 text-center">
        <p className="text-sm text-destructive">{error}</p>
        <p className="text-xs text-muted-foreground">
          .env.local に <code className="font-mono">{envVar}</code> を設定してください
        </p>
        <Button variant="outline" size="sm" className="mt-2 gap-1.5" onClick={load}>
          <RefreshCw className="h-3.5 w-3.5" />
          再試行
        </Button>
      </div>
    );
  }

  return (
    <>
      {/* Search + Sort toolbar */}
      <div className="flex shrink-0 items-center gap-2">
        <Input
          placeholder="検索..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 flex-1 text-xs"
        />
        <div className="flex shrink-0 overflow-hidden rounded-md border text-xs">
          {([
            ['mtime', '追加日'],
            ['az', 'A→Z'],
            ['za', 'Z→A'],
          ] as [SortKey, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setSortKey(key)}
              className={`px-2 py-1 transition-colors ${
                sortKey === key
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={load} title="更新" aria-label="更新">
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </div>

      {displayed.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {search ? '検索結果なし' : `${type === 'lora' ? 'LoRA' : 'チェックポイント'}が見つかりません`}
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {displayed.map((item) => {
            const isActive =
              type === 'lora'
                ? addedLoraNames.has(item.name)
                : activeCheckpoint === item.fileName;

            return (
              <ModelCard
                key={item.fileName}
                item={item}
                type={type}
                isActive={isActive}
                onAdd={() => {
                  if (type === 'lora') {
                    setAddTarget(item);
                  } else {
                    onSelectCheckpoint?.(item.fileName);
                  }
                }}
                onToggleOff={() => onRemoveLora?.(item.name)}
                onDelete={() => deleteItem(item.fileName)}
              />
            );
          })}
        </div>
      )}

      {/* Add LoRA dialog */}
      {addTarget && (
        <AddLoraDialog
          item={addTarget}
          onAdd={(entry) => {
            onAddLora?.(entry);
            setAddTarget(null);
          }}
          onClose={() => setAddTarget(null)}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Main dialog
// ---------------------------------------------------------------------------

export interface ModelManagerDialogProps {
  open: boolean;
  onClose: () => void;
  onAddLora?: (entry: LoraEntry) => void;
  onRemoveLora?: (name: string) => void;
  onSelectCheckpoint?: (fileName: string) => void;
  addedLoraNames?: Set<string>;
  activeCheckpoint?: string;
}

export default function ModelManagerDialog({
  open,
  onClose,
  onAddLora,
  onRemoveLora,
  onSelectCheckpoint,
  addedLoraNames = new Set(),
  activeCheckpoint = '',
}: ModelManagerDialogProps) {
  const [tab, setTab] = useState<'lora' | 'checkpoint'>('lora');
  const [loraRefreshSignal, setLoraRefreshSignal] = useState(0);
  const [ckptRefreshSignal, setCkptRefreshSignal] = useState(0);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="flex h-[88vh] max-w-5xl! w-full! flex-col gap-3">
        <DialogHeader>
          <DialogTitle className="text-sm">モデル管理</DialogTitle>
        </DialogHeader>

        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as 'lora' | 'checkpoint')}
          className="flex min-h-0 flex-1 flex-col"
        >
          <TabsList className="shrink-0">
            <TabsTrigger value="lora" className="text-xs">
              LoRA
            </TabsTrigger>
            <TabsTrigger value="checkpoint" className="text-xs">
              チェックポイント
            </TabsTrigger>
          </TabsList>

          <TabsContent
            value="lora"
            className="flex min-h-0 flex-1 flex-col gap-3 mt-3 data-[state=inactive]:hidden"
            forceMount
          >
            <DownloadSection
              type="lora"
              onDownloadComplete={() => setLoraRefreshSignal((k) => k + 1)}
            />
            <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-1">
              <ModelList
                type="lora"
                refreshSignal={loraRefreshSignal}
                onAddLora={onAddLora}
                onRemoveLora={onRemoveLora}
                addedLoraNames={addedLoraNames}
                activeCheckpoint={activeCheckpoint}
              />
            </div>
          </TabsContent>

          <TabsContent
            value="checkpoint"
            className="flex min-h-0 flex-1 flex-col gap-3 mt-3 data-[state=inactive]:hidden"
            forceMount
          >
            <DownloadSection
              type="checkpoint"
              onDownloadComplete={() => setCkptRefreshSignal((k) => k + 1)}
            />
            <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-1">
              <ModelList
                type="checkpoint"
                refreshSignal={ckptRefreshSignal}
                onSelectCheckpoint={onSelectCheckpoint}
                addedLoraNames={addedLoraNames}
                activeCheckpoint={activeCheckpoint}
              />
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
