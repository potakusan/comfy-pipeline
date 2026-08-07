'use client';
import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, RefreshCw } from 'lucide-react';
import type { LoraEntry } from '@/lib/comfy';
import { apiFetch } from '@/lib/api-client';
import { type ModelItem, type SortKey, sortItems } from '@/lib/model-manager';
import ModelCard from '@/components/model-card';
import AddLoraDialog from '@/components/add-lora-dialog';

export default function ModelList({
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
