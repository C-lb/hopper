'use client'

import { useEffect, useRef, useState } from 'react'
import { searchPlaces, type Place } from '@/lib/geocode'

type Props = {
  value: string
  onChange: (place: { name: string; lat: number | null; lng: number | null }) => void
  placeholder?: string
  disabled?: boolean
}

export function LocationField({ value, onChange, placeholder, disabled }: Props) {
  const [text, setText] = useState(value)
  const [suggestions, setSuggestions] = useState<Place[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setText(value)
  }, [value])

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  function handleTextChange(next: string) {
    setText(next)
    onChange({ name: next, lat: null, lng: null })

    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (next.trim().length < 3) {
      setSuggestions([])
      setLoading(false)
      setOpen(false)
      return
    }

    setLoading(true)
    debounceRef.current = setTimeout(async () => {
      const results = await searchPlaces(next)
      setSuggestions(results)
      setLoading(false)
      setOpen(true)
    }, 300)
  }

  function handleSelect(place: Place) {
    setText(place.name)
    setSuggestions([])
    setOpen(false)
    onChange(place)
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <input
          type="text"
          value={text}
          disabled={disabled}
          placeholder={placeholder ?? 'Search for a location'}
          onChange={e => handleTextChange(e.target.value)}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          className="w-full rounded-[10px] border border-black/10 bg-background px-4 py-2.5 text-[13px] text-foreground outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 max-[640px]:text-[17px]"
        />
        {loading && (
          <span
            aria-hidden
            className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin rounded-full border-2 border-foreground/20 border-t-accent"
          />
        )}
      </div>

      {open && suggestions.length > 0 && (
        <ul className="absolute z-10 mt-1.5 w-full overflow-hidden rounded-[10px] bg-surface py-1 shadow-[0_14px_34px_-18px_rgba(0,0,0,.35)]">
          {suggestions.map((s, i) => (
            <li key={`${s.name}-${i}`}>
              <button
                type="button"
                onClick={() => handleSelect(s)}
                className="block w-full px-4 py-2 text-left text-[13px] text-foreground hover:bg-accent/10 max-[640px]:text-[17px]"
              >
                {s.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
