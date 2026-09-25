import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { createMemoryHistory, createRouter, type RouteLocationRaw } from 'vue-router'
import { createAuthGuard } from '../src'
import { makeAuth, mockNavigation, storedSession } from './helpers'

const Page = defineComponent({ template: '<div />' })

function makeRouter(options: { loginRoute?: RouteLocationRaw; forbiddenRoute?: RouteLocationRaw } = { loginRoute: { name: 'login' } }) {
  const { auth } = makeAuth()
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: Page },
      { path: '/login', name: 'login', component: Page },
      { path: '/forbidden', name: 'forbidden', component: Page },
      { path: '/projects', component: Page, meta: { requiresAuth: true } },
      { path: '/admin', component: Page, meta: { roles: ['admin'] }, children: [{ path: 'users', component: Page }] },
    ],
  })
  router.beforeEach(createAuthGuard(auth, options))

  return { auth, router }
}

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

describe('createAuthGuard', () => {
  it('page publique', async () => {
    const { router } = makeRouter()

    await router.push('/')

    expect(router.currentRoute.value.path).toBe('/')
  })

  it('page protégée sans connexion : page de login avec la page demandée', async () => {
    const { router } = makeRouter()

    await router.push('/projects?tri=nom')

    expect(router.currentRoute.value.name).toBe('login')
    expect(router.currentRoute.value.query.redirect).toBe('/projects?tri=nom')
  })

  it('page de login donnée sous forme de chemin', async () => {
    const { router } = makeRouter({ loginRoute: '/login' })

    await router.push('/projects')

    expect(router.currentRoute.value.fullPath).toBe('/login?redirect=/projects')
  })

  it('sans page de login : lance directement la connexion Keycloak', async () => {
    const assign = mockNavigation()
    const { router } = makeRouter({})

    await router.push('/projects')

    expect(assign).toHaveBeenCalledWith('https://api.example.test/sso/login')
    expect(router.currentRoute.value.path).toBe('/')
  })

  it('page protégée avec connexion', async () => {
    storedSession('t', { roles: [] })
    const { router } = makeRouter()

    await router.push('/projects')

    expect(router.currentRoute.value.path).toBe('/projects')
  })

  it('rôle demandé sur la route parente', async () => {
    storedSession('t', { roles: ['admin'] })
    const { router } = makeRouter()

    await router.push('/admin/users')

    expect(router.currentRoute.value.path).toBe('/admin/users')
  })

  it('rôle manquant : navigation annulée', async () => {
    storedSession('t', { roles: ['reader'] })
    const { router } = makeRouter()

    await router.push('/admin/users')

    expect(router.currentRoute.value.path).toBe('/')
  })

  it('rôle manquant : page dédiée', async () => {
    storedSession('t', { roles: ['reader'] })
    const { router } = makeRouter({ loginRoute: '/login', forbiddenRoute: { name: 'forbidden' } })

    await router.push('/admin')

    expect(router.currentRoute.value.name).toBe('forbidden')
  })
})
