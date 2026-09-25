import { computed, shallowRef, type App, type ComputedRef, type InjectionKey, type Ref } from 'vue'
import { InactivityTimer } from './inactivity'
import { resolveStorage, SessionStore, type StoredSession } from './storage'
import type { AuthUser, CallbackResult, KeycloakSanctumOptions } from './types'

export const AUTH_KEY: InjectionKey<KeycloakSanctum<any>> = Symbol('keycloak-sanctum')

interface ServerSettings {
  login_url: string
  idle_timeout: number | null
}

/**
 * Client d'authentification : garde le jeton Sanctum et l'utilisateur, parle aux routes /sso
 * de l'API Laravel. C'est aussi le plugin Vue (app.use(auth)).
 */
export class KeycloakSanctum<TUser extends AuthUser = AuthUser> {
  /** Utilisateur connecté, ou null */
  readonly user: Ref<TUser | null> = shallowRef(null)
  /** Jeton Sanctum, ou null */
  readonly token: Ref<string | null> = shallowRef(null)
  /** Date d'expiration du jeton (ISO 8601), ou null si le jeton n'expire pas */
  readonly expiresAt: Ref<string | null> = shallowRef(null)

  readonly isAuthenticated: ComputedRef<boolean> = computed(() => this.token.value !== null)
  readonly roles: ComputedRef<string[]> = computed(() => {
    const roles = this.user.value?.roles
    return Array.isArray(roles) ? roles.map(String) : []
  })

  /** Minuteur d'inactivité, si l'option inactivity est activée */
  readonly inactivity: InactivityTimer | null

  private readonly apiUrl: string
  private readonly prefix: string
  private readonly store: SessionStore<TUser>
  private readonly returnToStore: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
  private readonly fetcher: typeof fetch
  private settingsPromise: Promise<ServerSettings | null> | null = null
  private removeStorageListener: (() => void) | null = null

  constructor(private readonly options: KeycloakSanctumOptions = {}) {
    this.apiUrl = (options.apiUrl ?? '').replace(/\/+$/, '')
    this.prefix = '/' + (options.prefix ?? '/sso').replace(/^\/+|\/+$/g, '')
    this.store = new SessionStore<TUser>(resolveStorage(options.storage ?? 'local'), options.storageKey ?? 'keycloak-sanctum')
    this.returnToStore = resolveStorage('session')
    this.fetcher = options.fetch ?? ((...args: Parameters<typeof fetch>) => globalThis.fetch(...args))

    this.inactivity = options.inactivity
      ? new InactivityTimer(options.inactivity, {
          onTimeout: () => this.expire(),
          storageKey: this.store.key + ':activity',
        })
      : null

    this.applySession(this.store.read())
  }

  /**
   * Plugin Vue : rend l'objet disponible avec useAuth() et $auth dans les templates.
   */
  install(app: App): void {
    app.provide(AUTH_KEY, this)
    app.config.globalProperties.$auth = this
    this.listenToOtherTabs()
    void this.startInactivity()
  }

  /** Adresse de la route de connexion de l'API */
  loginUrl(): string {
    return this.url('/login')
  }

  /**
   * Redirige vers la connexion Keycloak.
   * @param returnTo chemin du front où revenir après la connexion (ex : '/projets/12')
   */
  login(returnTo?: string): void {
    if (returnTo !== undefined && isSafePath(returnTo)) {
      this.returnToStore.setItem(this.returnToKey(), returnTo)
    }

    window.location.assign(this.loginUrl())
  }

  /**
   * À appeler sur la page du front qui reçoit ?code=... après la connexion.
   * Échange le code contre le jeton et enregistre la session.
   */
  async handleCallback(url: string = window.location.href): Promise<CallbackResult<TUser>> {
    const params = new URL(url, 'http://localhost').searchParams
    const returnTo = this.pullReturnTo()

    const error = params.get('error')
    if (error !== null) {
      return { ok: false, error, returnTo }
    }

    const code = params.get('code')
    if (code === null || code === '') {
      return { ok: false, error: 'missing_code', returnTo }
    }

    let response: Response
    try {
      response = await this.fetcher(this.url('/token'), {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
    } catch {
      return { ok: false, error: 'network_error', returnTo }
    }

    const body = (await response.json().catch(() => null)) as
      | { token?: string; user?: TUser; expires_at?: string | null; error?: string }
      | null

    if (!response.ok || typeof body?.token !== 'string') {
      return { ok: false, error: body?.error ?? 'invalid_code', returnTo }
    }

    this.setSession({ token: body.token, user: body.user ?? null, expiresAt: body.expires_at ?? null })
    void this.startInactivity()

    return { ok: true, user: this.user.value as TUser, returnTo }
  }

  /**
   * Recharge l'utilisateur depuis l'API (GET /sso/user). Retourne null si la session n'est plus valable.
   */
  async fetchUser(): Promise<TUser | null> {
    if (this.token.value === null) {
      return null
    }

    const response = await this.fetch(this.url('/user'))
    if (!response.ok) {
      return null
    }

    const body = (await response.json()) as { user?: TUser }
    this.setSession({ token: this.token.value, user: body.user ?? null, expiresAt: this.expiresAt.value })

    return this.user.value
  }

  /**
   * Déconnexion : supprime le jeton côté API, efface la session, puis redirige vers la
   * déconnexion Keycloak pour fermer aussi la session SSO.
   *
   * @returns l'adresse de déconnexion Keycloak (utile avec redirect: false)
   */
  async logout(options: { redirect?: boolean } = {}): Promise<string | null> {
    let logoutUrl: string | null = null

    if (this.token.value !== null) {
      try {
        const response = await this.fetcher(this.url('/logout'), {
          method: 'POST',
          headers: { Accept: 'application/json', Authorization: `Bearer ${this.token.value}` },
        })
        const body = (await response.json().catch(() => null)) as { logout_url?: string | null } | null
        logoutUrl = body?.logout_url ?? null
      } catch {
        // l'API ne répond pas : la session locale est quand même effacée
      }
    }

    this.clear()

    if (options.redirect !== false && logoutUrl !== null) {
      window.location.assign(logoutUrl)
    }

    return logoutUrl
  }

  /** L'utilisateur a-t-il au moins un des rôles donnés ? */
  hasRole(...roles: string[]): boolean {
    return roles.some((role) => this.roles.value.includes(role))
  }

  /** L'utilisateur a-t-il tous les rôles donnés ? */
  hasAllRoles(...roles: string[]): boolean {
    return roles.every((role) => this.roles.value.includes(role))
  }

  /**
   * fetch() avec le jeton : ajoute "Authorization: Bearer ..." et "Accept: application/json".
   * Les chemins qui commencent par / sont envoyés à l'API (apiUrl).
   * Le jeton n'est jamais envoyé à un autre domaine que celui de l'API.
   * Une réponse 401 efface la session et appelle onUnauthenticated.
   */
  async fetch(input: string | URL, init: RequestInit = {}): Promise<Response> {
    const url = this.resolveUrl(String(input))
    const headers = new Headers(init.headers)

    if (!headers.has('Accept')) {
      headers.set('Accept', 'application/json')
    }
    if (this.token.value !== null && this.isApiUrl(url) && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${this.token.value}`)
    }

    const response = await this.fetcher(url, { ...init, headers })

    if (response.status === 401 && this.isApiUrl(url)) {
      this.expire()
    }

    return response
  }

  /**
   * Le jeton doit-il être envoyé à cette adresse ? Oui seulement pour l'API.
   */
  isApiUrl(url: string): boolean {
    const target = new URL(url, currentOrigin())
    const api = new URL(this.apiUrl || currentOrigin(), currentOrigin())

    return target.origin === api.origin
  }

  /** Transforme un chemin (/api/...) en adresse complète de l'API */
  resolveUrl(url: string): string {
    return url.startsWith('/') && !url.startsWith('//') ? this.apiUrl + url : url
  }

  /**
   * Réglages de l'API (GET /sso/settings), gardés en mémoire.
   */
  settings(): Promise<ServerSettings | null> {
    this.settingsPromise ??= this.fetcher(this.url('/settings'), { headers: { Accept: 'application/json' } })
      .then((response) => (response.ok ? (response.json() as Promise<ServerSettings>) : null))
      .catch(() => {
        this.settingsPromise = null
        return null
      })

    return this.settingsPromise
  }

  /**
   * Efface la session locale (sans appeler l'API).
   */
  clear(): void {
    this.store.clear()
    this.applySession(null)
    this.inactivity?.stop()
  }

  /**
   * Session terminée côté API (401) ou inactivité : efface tout et prévient l'application.
   */
  expire(): void {
    const wasAuthenticated = this.isAuthenticated.value
    this.clear()

    if (wasAuthenticated) {
      this.options.onUnauthenticated?.()
    }
  }

  /**
   * Arrête les écouteurs (onglets, inactivité). Utile dans les tests.
   */
  destroy(): void {
    this.removeStorageListener?.()
    this.removeStorageListener = null
    this.inactivity?.stop()
  }

  private setSession(session: StoredSession<TUser>): void {
    this.store.write(session)
    this.applySession(session)
  }

  private applySession(session: StoredSession<TUser> | null): void {
    this.token.value = session?.token ?? null
    this.user.value = session?.user ?? null
    this.expiresAt.value = session?.expiresAt ?? null
  }

  private async startInactivity(): Promise<void> {
    if (this.inactivity === null || !this.isAuthenticated.value) {
      return
    }

    const timeout = this.inactivity.configuredTimeout ?? (await this.settings())?.idle_timeout ?? null
    if (timeout !== null && timeout > 0 && this.isAuthenticated.value) {
      this.inactivity.start(timeout)
    }
  }

  /**
   * Connexion ou déconnexion dans un autre onglet : cet onglet suit.
   */
  private listenToOtherTabs(): void {
    if (typeof window === 'undefined' || this.removeStorageListener !== null) {
      return
    }

    const listener = (event: StorageEvent): void => {
      if (event.key !== this.store.key) {
        return
      }

      const session = this.store.read()
      this.applySession(session)

      if (session === null) {
        this.inactivity?.stop()
      } else {
        void this.startInactivity()
      }
    }

    window.addEventListener('storage', listener)
    this.removeStorageListener = () => window.removeEventListener('storage', listener)
  }

  private pullReturnTo(): string | null {
    const value = this.returnToStore.getItem(this.returnToKey())
    this.returnToStore.removeItem(this.returnToKey())

    return value !== null && isSafePath(value) ? value : null
  }

  private returnToKey(): string {
    return this.store.key + ':return-to'
  }

  private url(path: string): string {
    return this.apiUrl + this.prefix + path
  }
}

/**
 * Chemin interne au site (/projets?x=1), jamais une adresse externe (//site.com, https://...).
 */
function isSafePath(path: string): boolean {
  return path.startsWith('/') && !path.startsWith('//') && !path.startsWith('/\\')
}

function currentOrigin(): string {
  return typeof window !== 'undefined' && window.location ? window.location.origin : 'http://localhost'
}

/**
 * Crée le client d'authentification (à installer avec app.use()).
 */
export function createKeycloakSanctum<TUser extends AuthUser = AuthUser>(options: KeycloakSanctumOptions = {}): KeycloakSanctum<TUser> {
  return new KeycloakSanctum<TUser>(options)
}

declare module 'vue' {
  interface ComponentCustomProperties {
    $auth: KeycloakSanctum
  }
}
