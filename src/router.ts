import type { NavigationGuardWithThis, RouteLocationNormalized, RouteLocationRaw } from 'vue-router'
import type { KeycloakSanctum } from './auth'

declare module 'vue-router' {
  interface RouteMeta {
    /** The page requires login */
    requiresAuth?: boolean
    /** The page requires at least one of these roles (implies requiresAuth) */
    roles?: string[]
  }
}

export interface AuthGuardOptions {
  /**
   * Front-end login page. The requested page is passed in ?redirect=...
   * If absent, the guard starts the Keycloak login directly.
   */
  loginRoute?: RouteLocationRaw
  /** Page shown when the user does not have the required role. Default: the navigation is cancelled. */
  forbiddenRoute?: RouteLocationRaw
}

/**
 * Navigation guard for vue-router, based on the route meta:
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
