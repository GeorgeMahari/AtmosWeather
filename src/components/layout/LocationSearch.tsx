import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { History, LoaderCircle, MapPin, Search, Star, X } from 'lucide-react'
import { MIN_QUERY_LENGTH, useLocationSearch } from '../../hooks/useLocationSearch'
import type { GeoLocation } from '../../types/weatherTypes'
import { locationSubtitle } from '../../utils/weatherTransformers'
import { cx } from '../common/primitives'

interface Suggestion {
  location: GeoLocation
  kind: 'result' | 'favorite' | 'recent'
}

interface LocationSearchProps {
  onSelect: (location: GeoLocation) => void
  /** Shown before the user types anything. */
  favorites?: GeoLocation[]
  recents?: GeoLocation[]
  placeholder?: string
  label?: string
  className?: string
}

/** Accessible combobox backed by the debounced geocoding hook. */
export function LocationSearch({
  onSelect,
  favorites = [],
  recents = [],
  placeholder = 'Search city or place',
  label = 'Search for a location',
  className,
}: LocationSearchProps) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listId = useId()
  const search = useLocationSearch(query)
  const typing = query.trim().length >= MIN_QUERY_LENGTH

  const suggestions = useMemo<Suggestion[]>(() => {
    if (typing) return search.results.map((location) => ({ location, kind: 'result' as const }))
    const favoriteIds = new Set(favorites.map((f) => f.id))
    return [
      ...favorites.map((location) => ({ location, kind: 'favorite' as const })),
      ...recents.filter((r) => !favoriteIds.has(r.id)).map((location) => ({ location, kind: 'recent' as const })),
    ]
  }, [typing, search.results, favorites, recents])

  useEffect(() => setActive(0), [suggestions])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  const choose = (location: GeoLocation) => {
    onSelect(location)
    setQuery('')
    setOpen(false)
    inputRef.current?.blur()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      setOpen(true)
      if (suggestions.length === 0) return
      const step = event.key === 'ArrowDown' ? 1 : -1
      setActive((index) => (index + step + suggestions.length) % suggestions.length)
    } else if (event.key === 'Enter') {
      const pick = suggestions[active]
      if (open && pick) {
        event.preventDefault()
        choose(pick.location)
      }
    } else if (event.key === 'Escape') {
      if (open) {
        event.preventDefault()
        setOpen(false)
      } else if (query) {
        setQuery('')
      }
    }
  }

  const showPanel = open && (typing || suggestions.length > 0)
  const optionId = (index: number) => `${listId}-option-${index}`

  let status: string | null = null
  if (typing) {
    if (search.status === 'error') status = search.error
    else if (search.status === 'loading' && suggestions.length === 0) status = 'Searching…'
    else if (search.status === 'done' && suggestions.length === 0) status = `No places found for “${query.trim()}”. Check the spelling or try a nearby city.`
  }

  return (
    <div ref={rootRef} className={cx('relative', className)}>
      <div className="relative">
        <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-mute" />
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-label={label}
          aria-expanded={showPanel}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showPanel && suggestions[active] ? optionId(active) : undefined}
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="search"
          placeholder={placeholder}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className="h-10 w-full rounded-xl border border-line bg-white/5 pr-9 pl-9 text-sm text-ink placeholder:text-ink-mute focus:bg-white/10"
        />
        {typing && search.status === 'loading' ? (
          <LoaderCircle aria-hidden="true" className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-ink-mute" />
        ) : (
          query && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => {
                setQuery('')
                inputRef.current?.focus()
              }}
              className="absolute top-1/2 right-1.5 grid size-7 -translate-y-1/2 place-items-center rounded-lg text-ink-mute hover:text-ink"
            >
              <X aria-hidden="true" className="size-4" />
            </button>
          )
        )}
      </div>

      <div
        className={cx(
          'glass-strong absolute top-full right-0 left-0 z-50 mt-2 max-h-[min(24rem,60vh)] overflow-y-auto rounded-2xl p-1.5 shadow-2xl thin-scrollbar',
          !showPanel && 'hidden',
        )}
      >
        {!typing && suggestions.length > 0 && (
          <p className="px-3 pt-2 pb-1 text-[0.6875rem] font-medium tracking-wider text-ink-mute uppercase">Saved &amp; recent</p>
        )}
        <ul id={listId} role="listbox" aria-label="Location suggestions">
          {suggestions.map(({ location, kind }, index) => {
            const Icon = kind === 'favorite' ? Star : kind === 'recent' ? History : MapPin
            return (
              <li
                key={`${kind}-${location.id}-${index}`}
                id={optionId(index)}
                role="option"
                aria-selected={index === active}
                onPointerEnter={() => setActive(index)}
                // Keep focus in the input so the list does not close first.
                onPointerDown={(event) => event.preventDefault()}
                onClick={() => choose(location)}
                className={cx(
                  'flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5',
                  index === active ? 'bg-white/10' : 'hover:bg-white/5',
                )}
              >
                <Icon aria-hidden="true" className={cx('size-4 flex-none', kind === 'favorite' ? 'text-amber' : 'text-ink-mute')} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink">{location.name}</span>
                  <span className="block truncate text-xs text-ink-mute">{locationSubtitle(location) || 'Coordinates'}</span>
                </span>
                {location.countryCode && (
                  <span className="flex-none rounded-md border border-line px-1.5 py-0.5 text-[0.625rem] font-semibold text-ink-mute">
                    {location.countryCode}
                  </span>
                )}
              </li>
            )
          })}
        </ul>
        {status && (
          <p role="status" className="px-3 py-3 text-sm text-ink-mute">
            {status}
          </p>
        )}
      </div>
    </div>
  )
}
