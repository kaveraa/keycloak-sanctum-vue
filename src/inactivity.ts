import { computed, shallowRef, type ComputedRef, type Ref } from 'vue'
import { resolveStorage } from './storage'
import type { InactivityOptions } from './types'

const DEFAULT_EVENTS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'wheel']

interface Callbacks {
  onTimeout: () => void
  /** Clé de stockage partagée pour que l'activité d'un onglet compte pour les autres */
  storageKey: string
}

/**
 * Déconnexion après une période sans activité (souris, clavier, défilement, toucher).
 * L'activité dans un onglet repousse la déconnexion dans tous les onglets.
 */
export class InactivityTimer {
  /** Secondes restantes avant la déconnexion, ou null si le minuteur est arrêté */
  readonly secondsLeft: Ref<number | null> = shallowRef(null)
  /** true pendant les dernières secondes (warnBefore) : moment d'afficher un avertissement */
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
   * @param minutes délai d'inactivité
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
   * Compte une activité (par exemple un bouton "Rester connecté" dans l'avertissement).
   */
  touch(): void {
    this.onActivity()
  }

  private readonly onActivity = (): void => {
    const now = Date.now()
    this.lastActivity = now

    // Partage l'activité avec les autres onglets, au plus toutes les 5 secondes
    if (now - this.lastShared > 5000) {
      this.lastShared = now
      try {
        this.shared.setItem(this.callbacks.storageKey, String(now))
      } catch {
        // stockage indisponible : chaque onglet compte sa propre activité
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
