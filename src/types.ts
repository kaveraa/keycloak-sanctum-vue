/**
 * Utilisateur renvoyé par l'API (routes /sso/token et /sso/user).
 * Le contenu dépend de l'application : on le précise avec useAuth<MonUtilisateur>().
 */
export interface AuthUser {
  roles?: string[]
  [key: string]: unknown
}

/**
 * Stockage du jeton : 'local' (localStorage, garde la session après fermeture du navigateur),
 * 'session' (sessionStorage, un onglet), 'memory' (rien n'est gardé), ou un objet compatible Storage.
 */
export type StorageOption = 'local' | 'session' | 'memory' | Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export interface InactivityOptions {
  /**
   * Délai d'inactivité en minutes. Par défaut : la valeur idle_timeout donnée par l'API (/sso/settings).
   */
  timeout?: number
  /** Nombre de secondes avant la déconnexion pendant lesquelles "warning" passe à true. Défaut : 60. */
  warnBefore?: number
  /** Événements du navigateur qui comptent comme une activité. */
  events?: string[]
}

export interface KeycloakSanctumOptions {
  /** Adresse de l'API Laravel, par exemple https://api.example.org. Vide = même domaine que le front. */
  apiUrl?: string
  /** Préfixe des routes du paquet Laravel. Défaut : /sso */
  prefix?: string
  /** Où garder le jeton. Défaut : 'local' */
  storage?: StorageOption
  /** Clé utilisée dans le stockage. Défaut : 'keycloak-sanctum' */
  storageKey?: string
  /**
   * Appelé quand l'API répond 401 (jeton expiré, déconnexion depuis Keycloak, inactivité).
   * La session locale est déjà effacée à ce moment. Par défaut : rien.
   */
  onUnauthenticated?: () => void
  /** Déconnexion automatique après une période sans activité. false = désactivée (défaut). */
  inactivity?: false | InactivityOptions
  /** Fonction fetch à utiliser (tests, environnements particuliers). Défaut : window.fetch */
  fetch?: typeof fetch
}

/** Résultat de handleCallback(), sur la page qui reçoit ?code=... */
export type CallbackResult<TUser extends AuthUser = AuthUser> =
  | { ok: true; user: TUser; returnTo: string | null }
  | { ok: false; error: CallbackError; returnTo: string | null }

/**
 * Erreurs possibles :
 * - erreurs envoyées par l'API dans ?error= : access_denied, authentication_failed, invalid_token,
 *   user_not_found, no_role
 * - missing_code : la page a été ouverte sans ?code=
 * - invalid_code : code expiré ou déjà utilisé
 * - network_error : l'API n'a pas répondu
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
