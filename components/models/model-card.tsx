'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ImageOff, Plus, Check, Trash2, ExternalLink } from 'lucide-react';
import DeleteConfirmDialog from '@/components/common/delete-confirm-dialog';
import { type ModelItem, formatBytes } from '@/lib/model-manager';

export default function ModelCard({
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
