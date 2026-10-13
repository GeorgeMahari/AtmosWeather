/**
 * Small request cache with three jobs:
 *  - serve fresh entries without touching the network,
 *  - share one in-flight promise between identical simultaneous requests,
 *  - optionally persist the last successful value so it can be shown (clearly
 *    marked as stale) when a later refresh fails or the page is reloaded offline.
 */

interface Entry<T> {
  value: T
  storedAt: number
}

interface CacheOptions {
  ttlMs: number
  /** localStorage key prefix; omit to keep the cache in memory only. */
  persistPrefix?: string
  maxPersisted?: number
}

export class RequestCache<T> {
  private readonly memory = new Map<string, Entry<T>>()
  private readonly inflight = new Map<string, Promise<T>>()
  private readonly options: CacheOptions

  constructor(options: CacheOptions) {
    this.options = options
  }

  /** Any stored entry, fresh or not. */
  peek(key: string): Entry<T> | null {
    const hit = this.memory.get(key)
    if (hit) return hit
    const persisted = this.readPersisted(key)
    if (persisted) this.memory.set(key, persisted)
    return persisted
  }

  isFresh(entry: Entry<T>): boolean {
    return Date.now() - entry.storedAt < this.options.ttlMs
  }

  async get(key: string, load: () => Promise<T>, force = false): Promise<T> {
    if (!force) {
      const hit = this.peek(key)
      if (hit && this.isFresh(hit)) return hit.value
    }
    const pending = this.inflight.get(key)
    if (pending) return pending

    const promise = load()
      .then((value) => {
        const entry = { value, storedAt: Date.now() }
        this.memory.set(key, entry)
        this.writePersisted(key, entry)
        return value
      })
      .finally(() => {
        this.inflight.delete(key)
      })
    this.inflight.set(key, promise)
    return promise
  }

  private storageKey(key: string) {
    return `${this.options.persistPrefix}:${key}`
  }

  private readPersisted(key: string): Entry<T> | null {
    if (!this.options.persistPrefix || typeof localStorage === 'undefined') return null
    try {
      const raw = localStorage.getItem(this.storageKey(key))
      if (!raw) return null
      const parsed = JSON.parse(raw) as Entry<T>
      if (typeof parsed?.storedAt !== 'number' || parsed.value == null) return null
      return parsed
    } catch {
      return null
    }
  }

  private writePersisted(key: string, entry: Entry<T>) {
    const prefix = this.options.persistPrefix
    if (!prefix || typeof localStorage === 'undefined') return
    try {
      localStorage.setItem(this.storageKey(key), JSON.stringify(entry))
      this.prune(prefix)
    } catch {
      // Quota or privacy mode: persistence is a nicety, memory still works.
    }
  }

  private prune(prefix: string) {
    const max = this.options.maxPersisted ?? 8
    const keys: { key: string; storedAt: number }[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key?.startsWith(`${prefix}:`)) continue
      try {
        const storedAt = (JSON.parse(localStorage.getItem(key) ?? '{}') as Entry<T>).storedAt ?? 0
        keys.push({ key, storedAt })
      } catch {
        keys.push({ key, storedAt: 0 })
      }
    }
    keys
      .sort((a, b) => b.storedAt - a.storedAt)
      .slice(max)
      .forEach(({ key }) => localStorage.removeItem(key))
  }
}
