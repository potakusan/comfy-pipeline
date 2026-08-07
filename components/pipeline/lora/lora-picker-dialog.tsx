'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ImageOff, Loader2 } from 'lucide-react'
import { usePublicSettings } from '@/hooks/use-public-settings'
import { apiFetch } from '@/lib/api-client'

const PAGE_SIZE = 50;

export interface LmLoraItem {
  model_name: string
  file_name: string
  preview_url: string
  preview_nsfw_level: number
  base_model: string
  civitai?: {
    trainedWords?: string[]
  }
  /** ローカルAPIから取得したサムネイルURL（フル絶対パス） */
  _thumbnailSrc?: string
}

// ---------------------------------------------------------------------------
// Local API item shape
// ---------------------------------------------------------------------------
interface LocalLoraItem {
  fileName: string
  name: string
  thumbnail: string | null
  trainedWords: string[]
}

function LoraPickerItem({
  item,
  lmBase,
  onSelect,
}: {
  item: LmLoraItem
  lmBase: string
  onSelect: () => void
}) {
  const [imgError, setImgError] = useState(false)
  const isVideo = !item._thumbnailSrc && item.preview_url.endsWith('.mp4')
  // Use local thumbnail URL if available, otherwise build from LM base
  const previewSrc = item._thumbnailSrc ?? `${lmBase}${item.preview_url}`

  return (
    <button
      onClick={onSelect}
      className="group flex flex-col overflow-hidden rounded-md border border-border text-left transition-colors hover:border-blue-500 hover:bg-muted/50"
    >
      <div className="relative aspect-3/4 w-full overflow-hidden bg-muted">
        {imgError || isVideo ? (
          <div className="flex h-full items-center justify-center">
            <ImageOff className="h-6 w-6 text-muted-foreground/40" />
          </div>
        ) : (
          <img
            src={previewSrc}
            alt={item.model_name}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
            onError={() => setImgError(true)}
          />
        )}
      </div>
      <div className="flex flex-col gap-0.5 p-1.5">
        <p className="line-clamp-2 text-[10px] font-medium leading-tight" title={item.model_name}>
          {item.model_name}
        </p>
        <p className="truncate font-mono text-[9px] text-muted-foreground" title={item.file_name}>
          {item.file_name}
        </p>
      </div>
    </button>
  )
}

interface LoraPickerDialogProps {
  open: boolean
  onClose: () => void
  onSelect: (item: LmLoraItem) => void
}

export function LoraPickerDialog({ open, onClose, onSelect }: LoraPickerDialogProps) {
  const publicSettings = usePublicSettings()
  const lmBase = publicSettings?.comfyuiUrl ?? ''
  const [lmItems, setLmItems] = useState<LmLoraItem[]>([])
  const [localItems, setLocalItems] = useState<LmLoraItem[]>([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const sentinelRef = useRef<HTMLDivElement>(null)
  const fetchingRef = useRef(false)

  // Fetch from LM API (paginated)
  const fetchLmPage = useCallback(async (p: number) => {
    if (fetchingRef.current || !lmBase) return
    fetchingRef.current = true
    setLoading(true)
    try {
      const res = await fetch(
        `${lmBase}/api/lm/loras/list?page=${p}&page_size=${PAGE_SIZE}&sort_by=date%3Adesc&recursive=true&tag_logic=any`,
      )
      const data = await res.json()
      const newItems: LmLoraItem[] = data.items ?? []
      setLmItems((prev) => (p === 1 ? newItems : [...prev, ...newItems]))
      setHasMore(newItems.length === PAGE_SIZE)
    } catch {
      setHasMore(false)
    } finally {
      setLoading(false)
      fetchingRef.current = false
    }
  }, [lmBase])

  // Fetch from local disk API (all at once, no pagination)
  const fetchLocalItems = useCallback(async () => {
    try {
      const data = await apiFetch<{ items?: LocalLoraItem[] }>('/api/models/loras')
      const items: LocalLoraItem[] = data.items ?? []
      const converted: LmLoraItem[] = items.map((item) => ({
        model_name: item.name,
        file_name: item.name,
        preview_url: '',
        preview_nsfw_level: 0,
        base_model: '',
        civitai: { trainedWords: item.trainedWords },
        _thumbnailSrc: item.thumbnail ?? undefined,
      }))
      setLocalItems(converted)
    } catch {
      // local API not configured — ignore
    }
  }, [])

  useEffect(() => {
    if (!open || !lmBase) return
    setLmItems([])
    setLocalItems([])
    setPage(1)
    setSearch('')
    setHasMore(true)
    fetchLmPage(1)
    fetchLocalItems()
  }, [open, lmBase, fetchLmPage, fetchLocalItems])

  useEffect(() => {
    if (page === 1) return
    fetchLmPage(page)
  }, [page, fetchLmPage])

  useEffect(() => {
    const el = sentinelRef.current
    if (!el || !hasMore || loading) return
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setPage((p) => p + 1)
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [hasMore, loading, lmItems.length])

  // Merge: local items not already present in LM list come first
  const lmFileNames = new Set(lmItems.map((i) => i.file_name))
  const localOnly = localItems.filter((i) => !lmFileNames.has(i.file_name))
  const merged = [...localOnly, ...lmItems]

  const filtered = search.trim()
    ? merged.filter(
        (item) =>
          item.model_name.toLowerCase().includes(search.toLowerCase()) ||
          item.file_name.toLowerCase().includes(search.toLowerCase()),
      )
    : merged

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="flex h-[80vh] max-w-4xl! w-full! flex-col gap-3">
        <DialogHeader>
          <DialogTitle className="text-sm">LoRA一覧から選択</DialogTitle>
        </DialogHeader>
        <Input
          placeholder="モデル名・ファイル名で検索..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="shrink-0"
        />
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {filtered.map((item, i) => (
              <LoraPickerItem
                key={`${item.file_name}-${i}`}
                item={item}
                lmBase={lmBase}
                onSelect={() => {
                  onSelect(item)
                  onClose()
                }}
              />
            ))}
          </div>
          {loading && (
            <div className="flex justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          )}
          {!loading && !hasMore && filtered.length === 0 && (
            <p className="py-8 text-center text-xs text-muted-foreground">
              {search ? '検索結果なし' : 'LoRAが見つかりません'}
            </p>
          )}
          <div ref={sentinelRef} className="h-1" />
        </div>
      </DialogContent>
    </Dialog>
  )
}
