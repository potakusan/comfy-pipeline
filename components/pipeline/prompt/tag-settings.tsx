'use client'
import { useTagDatabase } from '@/hooks/use-tag-database'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { RefreshCw, Database, AlertCircle } from 'lucide-react'

export default function TagSettings() {
  const { count, loading, error, lastUpdated, refresh } = useTagDatabase()

  const formattedDate = lastUpdated
    ? new Date(lastUpdated).toLocaleString('ja-JP', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null

  return (
    <div className="space-y-2 text-xs">
      <div className="flex items-center gap-2">
        <Database className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-muted-foreground">danbooruタグDB</span>
        {loading ? (
          <Badge variant="secondary" className="text-[10px]">
            <RefreshCw className="mr-1 h-2.5 w-2.5 animate-spin" />
            ロード中...
          </Badge>
        ) : count > 0 ? (
          <Badge variant="outline" className="text-[10px]">
            {count.toLocaleString()}件
          </Badge>
        ) : null}
      </div>

      {error && (
        <div className="flex items-center gap-1.5 rounded-md bg-destructive/10 px-2 py-1.5 text-destructive">
          <AlertCircle className="h-3 w-3 shrink-0" />
          <span className="text-[10px]">{error}</span>
        </div>
      )}

      <div className="flex items-center justify-between">
        {formattedDate ? (
          <span className="text-[10px] text-muted-foreground">最終更新: {formattedDate}</span>
        ) : (
          <span className="text-[10px] text-muted-foreground">
            {count === 0 && !loading ? '未ロード' : ''}
          </span>
        )}
        <Button
          variant="outline"
          size="sm"
          className="h-6 gap-1 text-xs"
          onClick={refresh}
          disabled={loading}
        >
          <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
          {count === 0 ? 'ダウンロード' : '更新'}
        </Button>
      </div>

      {count === 0 && !loading && !error && (
        <p className="text-[10px] text-muted-foreground">
          タグDBをダウンロードするとプロンプト入力時にサジェストが使えます
        </p>
      )}
    </div>
  )
}
