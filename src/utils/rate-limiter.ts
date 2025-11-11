/**
 * Rate limiter to prevent API rate limit errors
 * Manages separate queues per provider with configurable delays
 */

type ProviderKey = string

/**
 * Default rate limits in requests per minute (RPM)
 */
const DEFAULT_RATE_LIMITS = {
  openai: 500, // Usage tier 1
  anthropic: 5, // Free tier
  vercel: 10, // Free tier (10 requests per day)
} as const

type QueuedTask<T> = {
  execute: () => Promise<T>
  resolve: (value: T) => void
  reject: (error: unknown) => void
}

class ProviderRateLimiter {
  private queues: Map<ProviderKey, QueuedTask<any>[]> = new Map()
  private processing: Map<ProviderKey, boolean> = new Map()
  private lastExecutionTime: Map<ProviderKey, number> = new Map()
  private delays: Map<ProviderKey, number>

  constructor(delays: Map<ProviderKey, number>) {
    this.delays = delays
    this.logRateLimits()
  }

  /**
   * Log the rate limits for each provider
   */
  private logRateLimits(): void {
    const limits = Array.from(this.delays.entries())
      .map(([provider, delayMs]) => {
        const rpm = Math.round(60000 / delayMs)
        const capitalizedProvider = provider.charAt(0).toUpperCase() + provider.slice(1)
        return `${capitalizedProvider}=${rpm} RPM`
      })
      .join(', ')

    console.log(`Rate limiting enabled: ${limits}`)
  }

  /**
   * Add a task to the provider's queue
   */
  async schedule<T>(provider: ProviderKey, task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const queuedTask: QueuedTask<T> = {
        execute: task,
        resolve,
        reject,
      }

      if (!this.queues.has(provider)) {
        this.queues.set(provider, [])
      }

      this.queues.get(provider)?.push(queuedTask)
      this.processQueue(provider)
    })
  }

  /**
   * Process the next task in the provider's queue
   */
  private async processQueue(provider: ProviderKey): Promise<void> {
    // If already processing this provider's queue, return
    if (this.processing.get(provider)) {
      return
    }

    const queue = this.queues.get(provider)
    if (!queue || queue.length === 0) {
      return
    }

    this.processing.set(provider, true)

    while (queue.length > 0) {
      const task = queue.shift()
      if (!task) break

      // Calculate delay needed
      const delay = this.delays.get(provider) ?? 0
      const lastExecution = this.lastExecutionTime.get(provider) ?? 0
      const now = Date.now()
      const timeSinceLastExecution = now - lastExecution
      const waitTime = Math.max(0, delay - timeSinceLastExecution)

      // Wait if needed
      if (waitTime > 0) {
        await new Promise((resolve) => setTimeout(resolve, waitTime))
      }

      // Execute the task
      try {
        const result = await task.execute()
        this.lastExecutionTime.set(provider, Date.now())
        task.resolve(result)
      } catch (error) {
        task.reject(error)
      }
    }

    this.processing.set(provider, false)
  }
}

/**
 * Parse rate limit configuration from environment variables
 */
function parseRateLimitConfig(): Map<ProviderKey, number> {
  const delays = new Map<ProviderKey, number>()

  const openaiRPM = Number.parseInt(
    process.env.OPENAI_RATE_LIMIT_RPM || String(DEFAULT_RATE_LIMITS.openai),
    10,
  )
  delays.set('openai', Math.ceil(60000 / openaiRPM))

  const anthropicRPM = Number.parseInt(
    process.env.ANTHROPIC_RATE_LIMIT_RPM || String(DEFAULT_RATE_LIMITS.anthropic),
    10,
  )
  delays.set('anthropic', Math.ceil(60000 / anthropicRPM))

  const vercelRPM = Number.parseInt(
    process.env.VERCEL_RATE_LIMIT_RPM || String(DEFAULT_RATE_LIMITS.vercel),
    10,
  )
  delays.set('vercel', Math.ceil(60000 / vercelRPM))

  return delays
}

/**
 * Global rate limiter instance
 */
export const rateLimiter = new ProviderRateLimiter(parseRateLimitConfig())
