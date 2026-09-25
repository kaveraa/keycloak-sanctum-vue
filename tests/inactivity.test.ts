import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { API, makeAuth, storedSession } from './helpers'

const app = () => ({ provide: vi.fn(), config: { globalProperties: {} } }) as never

beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('déconnexion après inactivité', () => {
  it('compte à rebours, avertissement puis déconnexion', async () => {
    storedSession()
    const onUnauthenticated = vi.fn()
    const { auth } = makeAuth({ onUnauthenticated, inactivity: { timeout: 2, warnBefore: 30 } })
    auth.install(app())
    await vi.advanceTimersByTimeAsync(0)

    expect(auth.inactivity?.secondsLeft.value).toBe(120)
    expect(auth.inactivity?.warning.value).toBe(false)

    await vi.advanceTimersByTimeAsync(95_000)
    expect(auth.inactivity?.secondsLeft.value).toBe(25)
    expect(auth.inactivity?.warning.value).toBe(true)

    await vi.advanceTimersByTimeAsync(25_000)
    expect(auth.isAuthenticated.value).toBe(false)
    expect(onUnauthenticated).toHaveBeenCalledOnce()
    expect(auth.inactivity?.secondsLeft.value).toBeNull()

    auth.destroy()
  })

  it('une activité repousse la déconnexion', async () => {
    storedSession()
    const { auth } = makeAuth({ inactivity: { timeout: 1 } })
    auth.install(app())
    await vi.advanceTimersByTimeAsync(0)

    await vi.advanceTimersByTimeAsync(50_000)
    window.dispatchEvent(new Event('keydown'))
    await vi.advanceTimersByTimeAsync(50_000)

    expect(auth.isAuthenticated.value).toBe(true)
    expect(auth.inactivity?.secondsLeft.value).toBe(10)

    auth.destroy()
  })

  it('l\'activité d\'un autre onglet compte aussi', async () => {
    storedSession()
    const { auth } = makeAuth({ inactivity: { timeout: 1 } })
    auth.install(app())
    await vi.advanceTimersByTimeAsync(50_000)

    window.dispatchEvent(new StorageEvent('storage', { key: 'keycloak-sanctum:activity', newValue: String(Date.now()) }))

    expect(auth.inactivity?.secondsLeft.value).toBe(60)
    auth.destroy()
  })

  it('utilise le délai donné par l\'API si aucun délai n\'est configuré', async () => {
    storedSession()
    const { auth, fetch } = makeAuth({ inactivity: {} }, { 'GET /sso/settings': [200, { login_url: `${API}/sso/login`, idle_timeout: 15 }] })
    auth.install(app())
    await vi.advanceTimersByTimeAsync(0)

    expect(auth.inactivity?.secondsLeft.value).toBe(900)
    expect(fetch).toHaveBeenCalledOnce()
    auth.destroy()
  })

  it('pas de délai côté API : pas de minuteur', async () => {
    storedSession()
    const { auth } = makeAuth({ inactivity: {} }, { 'GET /sso/settings': [200, { login_url: '', idle_timeout: null }] })
    auth.install(app())
    await vi.advanceTimersByTimeAsync(0)

    expect(auth.inactivity?.running).toBe(false)
    auth.destroy()
  })

  it('ne démarre pas sans session, démarre après la connexion', async () => {
    const { auth } = makeAuth({ inactivity: { timeout: 5 } }, { 'POST /sso/token': [200, { token: 't', user: {} }] })
    auth.install(app())
    await vi.advanceTimersByTimeAsync(0)
    expect(auth.inactivity?.running).toBe(false)

    await auth.handleCallback('https://front.test/cb?code=abc')
    await vi.advanceTimersByTimeAsync(0)

    expect(auth.inactivity?.running).toBe(true)
    auth.destroy()
  })

  it('désactivée par défaut', () => {
    expect(makeAuth().auth.inactivity).toBeNull()
  })
})
