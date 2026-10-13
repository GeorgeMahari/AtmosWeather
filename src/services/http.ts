export type ApiErrorKind =
  | 'network'
  | 'timeout'
  | 'rate-limit'
  | 'http'
  | 'bad-request'
  | 'malformed'
  | 'offline'

export class ApiError extends Error {
  readonly kind: ApiErrorKind
  readonly status?: number

  constructor(kind: ApiErrorKind, message: string, status?: number) {
    super(message)
    this.name = 'ApiError'
    this.kind = kind
    this.status = status
  }
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

/** A message suitable for showing directly to the user. */
export function describeError(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.kind) {
      case 'offline':
        return 'You appear to be offline. Check your connection and try again.'
      case 'timeout':
        return 'The weather service took too long to respond.'
      case 'rate-limit':
        return 'The weather service is rate-limiting requests. Please wait a minute before retrying.'
      case 'network':
        return 'Could not reach the weather service. Check your connection.'
      case 'malformed':
        return 'The weather service returned data in an unexpected format.'
      case 'bad-request':
        return `The weather service rejected the request: ${error.message}`
      case 'http':
        return `The weather service is temporarily unavailable (HTTP ${error.status ?? '?'}).`
    }
  }
  return 'Something went wrong while loading data.'
}

interface FetchJsonOptions {
  signal?: AbortSignal
  timeoutMs?: number
  /** Extra attempts after the first, for transient failures only. */
  retries?: number
}

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const id = setTimeout(resolve, ms)
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(id)
        reject(new DOMException('Aborted', 'AbortError'))
      },
      { once: true },
    )
  })

async function attempt(url: string, timeoutMs: number, signal?: AbortSignal): Promise<unknown> {
  const controller = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs)
  const onAbort = () => controller.abort()
  signal?.addEventListener('abort', onAbort, { once: true })

  try {
    let response: Response
    try {
      response = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } })
    } catch (error) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
      if (timedOut) throw new ApiError('timeout', 'Request timed out')
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        throw new ApiError('offline', 'Offline')
      }
      throw new ApiError('network', error instanceof Error ? error.message : 'Network error')
    }

    if (response.status === 429) throw new ApiError('rate-limit', 'Rate limited', 429)

    let body: unknown
    try {
      body = await response.json()
    } catch {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
      if (!response.ok) throw new ApiError('http', `HTTP ${response.status}`, response.status)
      throw new ApiError('malformed', 'Response was not valid JSON')
    }

    if (!response.ok) {
      // Open-Meteo reports problems as { error: true, reason: "…" }.
      const reason =
        typeof body === 'object' && body !== null && 'reason' in body
          ? String((body as { reason: unknown }).reason)
          : `HTTP ${response.status}`
      if (response.status >= 400 && response.status < 500) {
        throw new ApiError('bad-request', reason, response.status)
      }
      throw new ApiError('http', reason, response.status)
    }
    return body
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }
}

/**
 * GET a JSON document with a timeout, caller cancellation and a small
 * exponential backoff for transient failures (network, timeout, 5xx).
 */
export async function fetchJson(url: string, options: FetchJsonOptions = {}): Promise<unknown> {
  const { signal, timeoutMs = 12_000, retries = 2 } = options
  let lastError: unknown
  for (let i = 0; i <= retries; i++) {
    try {
      return await attempt(url, timeoutMs, signal)
    } catch (error) {
      lastError = error
      const transient =
        error instanceof ApiError && (error.kind === 'network' || error.kind === 'timeout' || error.kind === 'http')
      if (!transient || i === retries) throw error
      await sleep(600 * 2 ** i, signal)
    }
  }
  throw lastError
}

/**
 * Lets one caller stop waiting on a shared (cached / de-duplicated) request
 * without cancelling it for the other callers awaiting the same promise.
 */
export function withSignal<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise
  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(new DOMException('Aborted', 'AbortError'))
    if (signal.aborted) return abort()
    signal.addEventListener('abort', abort, { once: true })
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort))
  })
}
