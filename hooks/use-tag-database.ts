'use client'
import { useState, useEffect, useCallback } from 'react'

const CSV_URL =
  'https://raw.githubusercontent.com/boorutan/booru-japanese-tag/refs/heads/main/danbooru-machine-jp.csv'
const LS_JSON_KEY = 'cp_danbooru_tags_v1'
const LS_DATE_KEY = 'cp_danbooru_tags_date'

export interface TagEntry {
  en: string
  ja: string
}

// Module-level memory cache: shared across all hook instances in one session
let _cachedTags: TagEntry[] | null = null

function parseCSV(text: string): TagEntry[] {
  const lines = text.split('\n')
  const result: TagEntry[] = []
  for (const line of lines) {
    const ci = line.indexOf(',')
    if (ci === -1) continue
    const en = line.substring(0, ci).trim()
    const ja = line.substring(ci + 1).trim()
    if (en) result.push({ en, ja })
  }
  return result
}

async function doFetch(): Promise<{ tags: TagEntry[]; date: string }> {
  const res = await fetch(CSV_URL)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const text = await res.text()
  const tags = parseCSV(text)
  _cachedTags = tags

  const now = new Date().toISOString()
  try {
    localStorage.setItem(LS_JSON_KEY, JSON.stringify(tags))
    localStorage.setItem(LS_DATE_KEY, now)
  } catch {
    // Quota exceeded — keep memory cache only
  }

  return { tags, date: now }
}

export function useTagDatabase() {
  const [tags, setTags] = useState<TagEntry[]>(_cachedTags ?? [])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)

  useEffect(() => {
    // Already in memory
    if (_cachedTags) {
      setTags(_cachedTags)
      setLastUpdated(localStorage.getItem(LS_DATE_KEY))
      return
    }

    // Try localStorage first
    try {
      const cached = localStorage.getItem(LS_JSON_KEY)
      if (cached) {
        const parsed = JSON.parse(cached) as TagEntry[]
        _cachedTags = parsed
        setTags(parsed)
        setLastUpdated(localStorage.getItem(LS_DATE_KEY))
        return
      }
    } catch {}

    // No cache → auto-fetch on first load
    setLoading(true)
    doFetch()
      .then(({ tags, date }) => {
        setTags(tags)
        setLastUpdated(date)
        setError(null)
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { tags, date } = await doFetch()
      setTags(tags)
      setLastUpdated(date)
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  const search = useCallback(
    (query: string, limit = 6): TagEntry[] => {
      const q = query.trim()
      if (!q || _cachedTags === null) return []
      const lower = q.toLowerCase()
      return _cachedTags
        .filter((t) => t.en.includes(lower) || t.ja.includes(q))
        .slice(0, limit)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tags]
  )

  return { tags, loading, error, lastUpdated, refresh, search, count: tags.length }
}
