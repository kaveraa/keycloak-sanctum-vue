import { vi } from 'vitest'
import { createKeycloakSanctum } from '../src'
import type { KeycloakSanctumOptions } from '../src'

export const API = 'https://api.example.test'

/**
 * Faux serveur : chaque route "METHODE /chemin" retourne [statut, corps JSON].
 */
export function fakeApi(routes: Record<string, [number, unknown] | (() => never)>) {
  return vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(String(input))
    const key = `${(init.method ?? 'GET').toUpperCase()} ${url.origin === API ? url.pathname : url.href}`
    const route = routes[key]

    if (route === undefined) {
      return new Response(JSON.stringify({ message: 'Not found' }), { status: 404 })
    }
    if (typeof route === 'function') {
      return route()
    }

    return new Response(JSON.stringify(route[1]), { status: route[0], headers: { 'Content-Type': 'application/json' } })
  })
}

export function makeAuth(options: KeycloakSanctumOptions = {}, routes: Parameters<typeof fakeApi>[0] = {}) {
  const fetch = fakeApi(routes)
  const auth = createKeycloakSanctum({ apiUrl: API, fetch, ...options })

  return { auth, fetch }
}

/**
 * Empêche la vraie navigation et enregistre les adresses demandées.
 */
export function mockNavigation() {
  return vi.spyOn(window.location, 'assign').mockImplementation(() => undefined)
}

export function storedSession(token = 'stored-token', user: Record<string, unknown> = { id: 1, name: 'Jean', roles: ['admin'] }) {
  localStorage.setItem('keycloak-sanctum', JSON.stringify({ token, user, expiresAt: null }))
}
