import type { NavigationGuardWithThis, RouteLocationNormalized, RouteLocationRaw } from 'vue-router'
import type { KeycloakSanctum } from './auth'

declare module 'vue-router' {
  interface RouteMeta {
    /** La page demande une connexion */
    requiresAuth?: boolean
    /** La page demande au moins un de ces rôles (implique requiresAuth) */
    roles?: string[]
  }
}

export interface AuthGuardOptions {
  /**
   * Page de connexion du front. La page demandée est passée dans ?redirect=...
   * Si absent, le garde lance directement la connexion Keycloak.
   */
  loginRoute?: RouteLocationRaw
  /** Page affichée quand l'utilisateur n'a pas le rôle demandé. Défaut : la navigation est annulée. */
  forbiddenRoute?: RouteLocationRaw
}

/**
 * Garde de navigation pour vue-router, basé sur les meta des routes :
 *
 *     { path: '/admin', component: Admin, meta: { requiresAuth: true, roles: ['admin'] } }
 *
 *     router.beforeEach(createAuthGuard(auth, { loginRoute: { name: 'login' } }))
 */
export function createAuthGuard(auth: KeycloakSanctum<any>, options: AuthGuardOptions = {}): NavigationGuardWithThis<undefined> {
  return (to: RouteLocationNormalized) => {
    const roles = to.matched.flatMap((record) => record.meta.roles ?? [])
    const requiresAuth = roles.length > 0 || to.matched.some((record) => record.meta.requiresAuth === true)

    if (!requiresAuth) {
      return true
    }

    if (!auth.isAuthenticated.value) {
      if (options.loginRoute === undefined) {
        auth.login(to.fullPath)
        return false
      }

      return withRedirect(options.loginRoute, to.fullPath)
    }

    if (roles.length > 0 && !auth.hasRole(...roles)) {
      return options.forbiddenRoute ?? false
    }

    return true
  }
}

function withRedirect(route: RouteLocationRaw, fullPath: string): RouteLocationRaw {
  if (typeof route === 'string') {
    return { path: route, query: { redirect: fullPath } }
  }

  return { ...route, query: { ...('query' in route ? route.query : {}), redirect: fullPath } }
}
