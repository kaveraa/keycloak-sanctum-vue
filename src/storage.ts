import type { AuthUser, StorageOption } from './types'

export interface StoredSession<TUser extends AuthUser = AuthUser> {
  token: string
  user: TUser | null
  expiresAt: string | null
}

type SimpleStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function memoryStorage(): SimpleStorage {
  const data = new Map<string, string>()

  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  }
}

export function resolveStorage(option: StorageOption): SimpleStorage {
  if (typeof option === 'object') {
    return option
  }

  // Le navigateur peut refuser l'accès au stockage (navigation privée, cookies bloqués)
  try {
    if (option === 'local' && typeof localStorage !== 'undefined') return localStorage
    if (option === 'session' && typeof sessionStorage !== 'undefined') return sessionStorage
  } catch {
    // on garde la session en mémoire
  }

  return memoryStorage()
}

/**
 * Lit et écrit la session (jeton + utilisateur) dans le stockage choisi.
 */
export class SessionStore<TUser extends AuthUser = AuthUser> {
  constructor(
    private readonly storage: SimpleStorage,
    readonly key: string,
  ) {}

  read(): StoredSession<TUser> | null {
    try {
      const raw = this.storage.getItem(this.key)
      const parsed = raw ? (JSON.parse(raw) as StoredSession<TUser>) : null

      return parsed && typeof parsed.token === 'string' && parsed.token !== '' ? parsed : null
    } catch {
      return null
    }
  }

  write(session: StoredSession<TUser>): void {
    try {
      this.storage.setItem(this.key, JSON.stringify(session))
    } catch {
      // stockage plein ou refusé : la session reste en mémoire pour cet onglet
    }
  }

  clear(): void {
    try {
      this.storage.removeItem(this.key)
    } catch {
      // rien à faire
    }
  }
}
