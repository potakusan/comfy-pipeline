'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ImageOff, Loader2 } from 'lucide-react'

const LM_BASE = 'http://127.0.0.1:8188'
const PAGE_SIZE = 50

export interface LmLoraItem {
  model_name: string
  file_name: string
  preview_url: string
  preview_nsfw_level: number
  base_model: string
  civitai?: {
    trainedWords?: string[]
  }
}

function LoraPickerItem({ item, onSelect }: { item: LmLoraItem; onSelect: () => void }) {
  const [imgError, setImgError] = useState(false)
  const isVideo = item.preview_url.endsWith('.mp4')
  const previewSrc = `${LM_BASE}${item.preview_url}`

  return (
    <button
      onClick={onSelect}
      className="group flex flex-col overflow-hidden rounded-md border border-border text-left transition-colors hover:border-blue-500 hover:bg-muted/50"
    >
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-muted">
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
  const [items, setItems] = useState<LmLoraItem[]>([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const sentinelRef = useRef<HTMLDivElement>(null)
  const fetchingRef = useRef(false)

  const fetchPage = useCallback(async (p: number) => {
    if (fetchingRef.current) return
    fetchingRef.current = true
    setLoading(true)
    try {
      const res = await fetch(
        `${LM_BASE}/api/lm/loras/list?page=${p}&page_size=${PAGE_SIZE}&sort_by=date%3Adesc&recursive=true&tag_logic=any`,
      )
      const data = await res.json()
      const newItems: LmLoraItem[] = data.items ?? []
      setItems((prev) => (p === 1 ? newItems : [...prev, ...newItems]))
      setHasMore(newItems.length === PAGE_SIZE)
    } catch {
      setHasMore(false)
    } finally {
      setLoading(false)
      fetchingRef.current = false
    }
  }, [])

  useEffect(() => {
    if (!open) return
    setItems([])
    setPage(1)
    setSearch('')
    setHasMore(true)
    fetchPage(1)
  }, [open, fetchPage])

  useEffect(() => {
    if (page === 1) return
    fetchPage(page)
  }, [page, fetchPage])

  useEffect(() => {
    const el = sentinelRef.current
    if (!el || !hasMore || loading) return
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setPage((p) => p + 1)
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [hasMore, loading, items.length])

  const filtered = search.trim()
    ? items.filter(
        (item) =>
          item.model_name.toLowerCase().includes(search.toLowerCase()) ||
          item.file_name.toLowerCase().includes(search.toLowerCase()),
      )
    : items

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
                key={i}
                item={item}
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
