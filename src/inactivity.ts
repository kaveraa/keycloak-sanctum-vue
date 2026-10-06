import { computed, shallowRef, type ComputedRef, type Ref } from 'vue'
import { resolveStorage } from './storage'
import type { InactivityOptions } from './types'

const DEFAULT_EVENTS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'wheel']

interface Callbacks {
  onTimeout: () => void
  /** Shared storage key so that activity in one tab counts for the others */
  storageKey: string
}

/**
 * Logout after a period without activity (mouse, keyboard, scroll, touch).
 * Activity in one tab delays the logout in all tabs.
 */
export class InactivityTimer {
  /** Seconds left before logout, or null if the timer is stopped */
  readonly secondsLeft: Ref<number | null> = shallowRef(null)
  /** true during the last seconds (warnBefore): time to show a warning */
  readonly warning: ComputedRef<boolean> = computed(
    () => this.secondsLeft.value !== null && this.secondsLeft.value <= this.warnBefore,
  )

  readonly configuredTimeout: number | null
  private readonly warnBefore: number
  private readonly events: string[]
  private readonly shared = resolveStorage('local')
  private timeoutMs = 0
  private lastActivity = 0
  private lastShared = 0
  private interval: ReturnType<typeof setInterval> | null = null

  constructor(
    options: InactivityOptions,
    private readonly callbacks: Callbacks,
  ) {
    this.configuredTimeout = options.timeout ?? null
    this.warnBefore = options.warnBefore ?? 60
    this.events = options.events ?? DEFAULT_EVENTS
  }

  get running(): boolean {
    return this.interval !== null
  }

  /**
   * @param minutes inactivity delay
   */
  start(minutes: number): void {
    this.stop()
    this.timeoutMs = minutes * 60_000
    this.lastActivity = Date.now()

    for (const event of this.events) {
      window.addEventListener(event, this.onActivity, { passive: true })
    }
    window.addEventListener('storage', this.onSharedActivity)

    this.interval = setInterval(this.tick, 1000)
    this.tick()
  }

  stop(): void {
    if (this.interval !== null) {
      clearInterval(this.interval)
      this.interval = null
    }

    for (const event of this.events) {
      window.removeEventListener(event, this.onActivity)
    }
    window.removeEventListener('storage', this.onSharedActivity)

    this.secondsLeft.value = null
  }

  /**
   * Counts an activity (for example a "Stay logged in" button in the warning).
   */
  touch(): void {
    this.onActivity()
  }

  private readonly onActivity = (): void => {
    const now = Date.now()
    this.lastActivity = now

    // Shares the activity with the other tabs, at most every 5 seconds
    if (now - this.lastShared > 5000) {
      this.lastShared = now
      try {
        this.shared.setItem(this.callbacks.storageKey, String(now))
      } catch {
        // storage unavailable: each tab counts its own activity
      }
    }

    this.tick()
  }

  private readonly onSharedActivity = (event: StorageEvent): void => {
    if (event.key === this.callbacks.storageKey && event.newValue !== null) {
      this.lastActivity = Math.max(this.lastActivity, Number(event.newValue) || 0)
      this.tick()
    }
  }

  private readonly tick = (): void => {
    const remaining = Math.max(0, Math.ceil((this.lastActivity + this.timeoutMs - Date.now()) / 1000))
    this.secondsLeft.value = remaining

    if (remaining === 0) {
      this.stop()
      this.callbacks.onTimeout()
    }
  }
}
