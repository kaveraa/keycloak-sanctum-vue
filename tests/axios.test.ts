import { beforeEach, describe, expect, it, vi } from 'vitest'
import { attachAxios } from '../src'
import { API, makeAuth, storedSession } from './helpers'

/**
 * Imitation d'une instance axios : garde les intercepteurs pour les appeler à la main.
 */
function fakeAxios(baseURL?: string) {
  const handlers: { request?: (c: any) => any; rejected?: (e: any) => any } = {}

  return {
    handlers,
    defaults: { baseURL },
    interceptors: {
      request: { use: (fn: (c: any) => any) => ((handlers.request = fn), 0) },
      response: { use: (_ok: (r: any) => any, fn: (e: any) => any) => ((handlers.rejected = fn), 0) },
    },
  }
}

beforeEach(() => localStorage.clear())

describe('attachAxios', () => {
  it('ajoute le jeton aux requêtes vers l\'API', () => {
    storedSession()
    const { auth } = makeAuth()
    const axios = attachAxios(auth, fakeAxios(API))

    const config = axios.handlers.request!({ url: '/api/projects', headers: {} })

    expect(config.headers.Authorization).toBe('Bearer stored-token')
  })

  it('fonctionne avec les en-têtes AxiosHeaders (set/has)', () => {
    storedSession()
    const { auth } = makeAuth()
    const axios = attachAxios(auth, fakeAxios(API))
    const headers = new Map<string, string>()
    const axiosHeaders = { set: (k: string, v: string) => headers.set(k, v), has: (k: string) => headers.has(k) }

    axios.handlers.request!({ url: 'api/projects', headers: axiosHeaders })

    expect(headers.get('Authorization')).toBe('Bearer stored-token')
  })

  it('pas de jeton vers un autre site', () => {
    storedSession()
    const { auth } = makeAuth()
    const axios = attachAxios(auth, fakeAxios(API))

    const config = axios.handlers.request!({ url: 'https://autre-site.test/data', headers: {} })

    expect(config.headers.Authorization).toBeUndefined()
  })

  it('pas de jeton sans session', () => {
    const { auth } = makeAuth()
    const axios = attachAxios(auth, fakeAxios(API))

    expect(axios.handlers.request!({ url: '/api/projects', headers: {} }).headers.Authorization).toBeUndefined()
  })

  it('401 de l\'API : efface la session', async () => {
    storedSession()
    const onUnauthenticated = vi.fn()
    const { auth } = makeAuth({ onUnauthenticated })
    const axios = attachAxios(auth, fakeAxios(API))
    const error = { config: { url: '/api/projects' }, response: { status: 401 } }

    await expect(axios.handlers.rejected!(error)).rejects.toBe(error)

    expect(auth.isAuthenticated.value).toBe(false)
    expect(onUnauthenticated).toHaveBeenCalledOnce()
  })

  it('autre erreur : la session reste', async () => {
    storedSession()
    const { auth } = makeAuth()
    const axios = attachAxios(auth, fakeAxios(API))

    await expect(axios.handlers.rejected!({ config: { url: '/api/x' }, response: { status: 500 } })).rejects.toBeDefined()

    expect(auth.isAuthenticated.value).toBe(true)
  })
})
