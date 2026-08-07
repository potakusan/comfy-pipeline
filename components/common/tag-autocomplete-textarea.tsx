'use client'
import { useState, useRef, useCallback } from 'react'
import { useTagDatabase, type TagEntry } from '@/hooks/use-tag-database'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

interface Props {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
  style?: React.CSSProperties
}

function getTokenAtCursor(text: string, cursor: number): { token: string; tokenStart: number } {
  const before = text.substring(0, cursor)
  const sepIdx = Math.max(before.lastIndexOf(','), before.lastIndexOf('\n'))
  const rawToken = before.substring(sepIdx + 1)
  const leading = rawToken.length - rawToken.trimStart().length
  return { token: rawToken.trimStart(), tokenStart: sepIdx + 1 + leading }
}

export default function TagAutocompleteTextarea({
  value,
  onChange,
  placeholder,
  className,
  style,
}: Props) {
  const { search } = useTagDatabase()
  const [suggestions, setSuggestions] = useState<TagEntry[]>([])
  const [activeIndex, setActiveIndex] = useState(-1)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const tokenStartRef = useRef(0)

  const updateSuggestions = useCallback(
    (text: string, cursor: number) => {
      const { token, tokenStart } = getTokenAtCursor(text, cursor)
      tokenStartRef.current = tokenStart
      if (token.length < 1) {
        setSuggestions([])
        return
      }
      const results = search(token, 6)
      setSuggestions(results)
      setActiveIndex(-1)
    },
    [search]
  )

  const insertTag = useCallback(
    (tag: TagEntry) => {
      const el = textareaRef.current
      if (!el) return
      const cursor = el.selectionStart ?? el.value.length
      const before = el.value.substring(0, tokenStartRef.current)
      const after = el.value.substring(cursor).trimStart()
      const insertion = tag.en + ', '
      const newVal = before + insertion + after
      const newPos = before.length + insertion.length
      onChange(newVal)
      setSuggestions([])
      requestAnimationFrame(() => {
        el.focus()
        el.selectionStart = newPos
        el.selectionEnd = newPos
      })
    },
    [onChange]
  )

  return (
    <div className="relative">
      <Textarea
        ref={textareaRef}
        value={value}
        placeholder={placeholder}
        className={cn('text-xs', className)}
        style={style}
        onChange={(e) => {
          onChange(e.target.value)
          updateSuggestions(e.target.value, e.target.selectionStart ?? e.target.value.length)
        }}
        onKeyUp={(e) => {
          // Track cursor moves (arrow keys etc.)
          if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
            const el = e.currentTarget
            updateSuggestions(el.value, el.selectionStart ?? el.value.length)
          }
        }}
        onKeyDown={(e) => {
          if (suggestions.length === 0) return
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setActiveIndex((i) => Math.max(i - 1, 0))
          } else if ((e.key === 'Enter' || e.key === 'Tab') && activeIndex >= 0) {
            e.preventDefault()
            insertTag(suggestions[activeIndex])
          } else if (e.key === 'Tab' && activeIndex < 0 && suggestions.length > 0) {
            e.preventDefault()
            insertTag(suggestions[0])
          } else if (e.key === 'Escape') {
            setSuggestions([])
          }
        }}
        onBlur={() => setTimeout(() => setSuggestions([]), 150)}
      />

      {suggestions.length > 0 && (
        <div className="z-50 mt-0.5 rounded-md border bg-popover text-popover-foreground shadow-md">
          {suggestions.map((tag, i) => (
            <button
              key={tag.en}
              className={cn(
                'flex w-full items-baseline gap-2 px-2.5 py-1.5 text-left text-xs hover:bg-accent',
                i === activeIndex && 'bg-accent'
              )}
              onMouseDown={(e) => {
                e.preventDefault()
                insertTag(tag)
              }}
            >
              <span className="font-mono text-foreground">{tag.en}</span>
              <span className="truncate text-[10px] text-muted-foreground">{tag.ja}</span>
            </button>
          ))}
          <p className="border-t px-2.5 py-1 text-[10px] text-muted-foreground">
            ↑↓ で移動 · Enter/Tab で入力 · Esc で閉じる
          </p>
        </div>
      )}
    </div>
  )
}
