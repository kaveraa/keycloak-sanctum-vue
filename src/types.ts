/**
 * User returned by the API (/sso/token and /sso/user routes).
 * Its content depends on the application: specify it with useAuth<MyUser>().
 */
export interface AuthUser {
  roles?: string[]
  [key: string]: unknown
}

/**
 * Token storage: 'local' (localStorage, keeps the session after the browser is closed),
 * 'session' (sessionStorage, one tab), 'memory' (nothing is kept), or a Storage-compatible object.
 */
export type StorageOption = 'local' | 'session' | 'memory' | Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export interface InactivityOptions {
  /**
   * Inactivity delay in minutes. Default: the idle_timeout value given by the API (/sso/settings).
   */
  timeout?: number
  /** Number of seconds before logout during which "warning" is true. Default: 60. */
  warnBefore?: number
  /** Browser events that count as activity. */
  events?: string[]
}

export interface KeycloakSanctumOptions {
  /** URL of the Laravel API, for example https://api.example.org. Empty = same domain as the front-end. */
  apiUrl?: string
  /** Route prefix of the Laravel package. Default: /sso */
  prefix?: string
  /** Where to keep the token. Default: 'local' */
  storage?: StorageOption
  /** Key used in storage. Default: 'keycloak-sanctum' */
  storageKey?: string
  /**
   * Called when the API answers 401 (expired token, logout from Keycloak, inactivity).
   * The local session is already cleared at that point. Default: nothing.
   */
  onUnauthenticated?: () => void
  /** Automatic logout after a period without activity. false = disabled (default). */
  inactivity?: false | InactivityOptions
  /** fetch function to use (tests, special environments). Default: window.fetch */
  fetch?: typeof fetch
}

/** Result of handleCallback(), on the page that receives ?code=... */
export type CallbackResult<TUser extends AuthUser = AuthUser> =
  | { ok: true; user: TUser; returnTo: string | null }
  | { ok: false; error: CallbackError; returnTo: string | null }

/**
 * Possible errors:
 * - errors sent by the API in ?error=: access_denied, authentication_failed, invalid_token,
 *   user_not_found, no_role
 * - missing_code: the page was opened without ?code=
 * - invalid_code: code expired or already used
 * - network_error: the API did not answer
 */
export type CallbackError =
  | 'access_denied'
  | 'authentication_failed'
  | 'invalid_token'
  | 'user_not_found'
  | 'no_role'
  | 'missing_code'
  | 'invalid_code'
  | 'network_error'
  | (string & {})
