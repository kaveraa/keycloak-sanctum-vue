import { inject } from 'vue'
import { AUTH_KEY, type KeycloakSanctum } from './auth'
import type { AuthUser } from './types'

/**
 * Access to the authentication client inside a component.
 *
 *     const auth = useAuth()
 *     auth.user.value, auth.isAuthenticated.value, auth.hasRole('admin'), auth.logout()
 */
export function useAuth<TUser extends AuthUser = AuthUser>(): KeycloakSanctum<TUser> {
  const auth = inject(AUTH_KEY, null)

  if (auth === null) {
    throw new Error('useAuth() : installez le plugin avec app.use(createKeycloakSanctum({ ... })).')
  }

  return auth as KeycloakSanctum<TUser>
}
