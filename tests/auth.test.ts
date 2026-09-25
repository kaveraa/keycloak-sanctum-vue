import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { API, makeAuth, mockNavigation, storedSession } from './helpers'

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

describe('session', () => {
  it('démarre sans session', () => {
    const { auth } = makeAuth()

    expect(auth.isAuthenticated.value).toBe(false)
    expect(auth.user.value).toBeNull()
    expect(auth.roles.value).toEqual([])
  })

  it('reprend la session enregistrée', () => {
    storedSession()
    const { auth } = makeAuth()

    expect(auth.isAuthenticated.value).toBe(true)
    expect(auth.token.value).toBe('stored-token')
    expect(auth.roles.value).toEqual(['admin'])
  })

  it('ignore une session illisible', () => {
    localStorage.setItem('keycloak-sanctum', '{pas du json')

    expect(makeAuth().auth.isAuthenticated.value).toBe(false)
  })

  it('stockage en mémoire : rien dans localStorage', async () => {
    const { auth } = makeAuth({ storage: 'memory' }, { 'POST /sso/token': [200, { token: 't', user: {} }] })

    await auth.handleCallback('https://front.test/login/callback?code=abc')

    expect(auth.isAuthenticated.value).toBe(true)
    expect(localStorage.getItem('keycloak-sanctum')).toBeNull()
  })

  it('stockage de session', async () => {
    const { auth } = makeAuth({ storage: 'session' }, { 'POST /sso/token': [200, { token: 't', user: {} }] })

    await auth.handleCallback('https://front.test/login/callback?code=abc')

    expect(sessionStorage.getItem('keycloak-sanctum')).toContain('"token":"t"')
    expect(localStorage.getItem('keycloak-sanctum')).toBeNull()
  })

  it('rôles : au moins un ou tous', () => {
    storedSession('t', { roles: ['admin', 'editor'] })
    const { auth } = makeAuth()

    expect(auth.hasRole('reader', 'editor')).toBe(true)
    expect(auth.hasRole('reader')).toBe(false)
    expect(auth.hasAllRoles('admin', 'editor')).toBe(true)
    expect(auth.hasAllRoles('admin', 'reader')).toBe(false)
  })
})

describe('connexion', () => {
  afterEach(() => vi.restoreAllMocks())

  it('adresse de connexion avec le préfixe', () => {
    expect(makeAuth().auth.loginUrl()).toBe(`${API}/sso/login`)
    expect(makeAuth({ prefix: 'auth/keycloak/' }).auth.loginUrl()).toBe(`${API}/auth/keycloak/login`)
    expect(makeAuth({ apiUrl: '' }).auth.loginUrl()).toBe('/sso/login')
  })

  it('login() redirige vers l\'API et retient la page de retour', async () => {
    const assign = mockNavigation()
    const { auth } = makeAuth({}, { 'POST /sso/token': [200, { token: 't', user: {} }] })

    auth.login('/projets/12?onglet=2')

    expect(assign).toHaveBeenCalledWith(`${API}/sso/login`)
    const result = await auth.handleCallback('https://front.test/login/callback?code=abc')
    expect(result.returnTo).toBe('/projets/12?onglet=2')
  })

  it('refuse une page de retour vers un autre site', async () => {
    mockNavigation()
    const { auth } = makeAuth({}, { 'POST /sso/token': [200, { token: 't', user: {} }] })

    for (const returnTo of ['https://pirate.test', '//pirate.test', '/\\pirate.test']) {
      auth.login(returnTo)
      const result = await auth.handleCallback('https://front.test/cb?code=abc')
      expect(result.returnTo).toBeNull()
    }
  })

  it('échange le code contre le jeton', async () => {
    const { auth, fetch } = makeAuth({}, {
      'POST /sso/token': [200, { token: 'new-token', token_type: 'Bearer', expires_at: null, user: { id: 7, name: 'Jean', roles: ['editor'] } }],
    })

    const result = await auth.handleCallback('https://front.test/login/callback?code=abc')

    expect(result).toEqual({ ok: true, user: { id: 7, name: 'Jean', roles: ['editor'] }, returnTo: null })
    expect(auth.token.value).toBe('new-token')
    expect(auth.roles.value).toEqual(['editor'])
    expect(JSON.parse(localStorage.getItem('keycloak-sanctum') ?? '{}').token).toBe('new-token')

    const [, init] = fetch.mock.calls[0]!
    expect(init?.body).toBe(JSON.stringify({ code: 'abc' }))
  })

  it.each([
    ['?error=user_not_found', 'user_not_found'],
    ['?error=access_denied', 'access_denied'],
    ['', 'missing_code'],
  ])('erreur dans l\'adresse de retour %s', async (query, error) => {
    const { auth, fetch } = makeAuth()

    expect(await auth.handleCallback(`https://front.test/cb${query}`)).toEqual({ ok: false, error, returnTo: null })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('code expiré ou déjà utilisé', async () => {
    const { auth } = makeAuth({}, { 'POST /sso/token': [422, { message: 'Code invalide ou expiré.', error: 'invalid_code' }] })

    expect(await auth.handleCallback('https://front.test/cb?code=old')).toMatchObject({ ok: false, error: 'invalid_code' })
    expect(auth.isAuthenticated.value).toBe(false)
  })

  it('API injoignable', async () => {
    const { auth } = makeAuth({}, { 'POST /sso/token': () => { throw new TypeError('Failed to fetch') } })

    expect(await auth.handleCallback('https://front.test/cb?code=abc')).toMatchObject({ ok: false, error: 'network_error' })
  })
})

describe('fetch authentifié', () => {
  it('ajoute le jeton pour l\'API seulement', async () => {
    storedSession()
    const { auth, fetch } = makeAuth()

    await auth.fetch('/api/projects')
    await auth.fetch(`${API}/api/projects`)
    await auth.fetch('https://autre-site.test/data')

    const headers = fetch.mock.calls.map(([, init]) => new Headers(init?.headers).get('Authorization'))
    expect(headers).toEqual(['Bearer stored-token', 'Bearer stored-token', null])
    expect(String(fetch.mock.calls[0]![0])).toBe(`${API}/api/projects`)
    expect(new Headers(fetch.mock.calls[0]![1]?.headers).get('Accept')).toBe('application/json')
  })

  it('401 de l\'API : efface la session et prévient l\'application', async () => {
    storedSession()
    const onUnauthenticated = vi.fn()
    const { auth } = makeAuth({ onUnauthenticated }, { 'GET /api/projects': [401, { message: 'Unauthenticated.' }] })

    const response = await auth.fetch('/api/projects')

    expect(response.status).toBe(401)
    expect(auth.isAuthenticated.value).toBe(false)
    expect(localStorage.getItem('keycloak-sanctum')).toBeNull()
    expect(onUnauthenticated).toHaveBeenCalledOnce()
  })

  it('401 d\'un autre site : la session reste', async () => {
    storedSession()
    const { auth } = makeAuth({}, { 'GET https://autre-site.test/data': [401, {}] })

    await auth.fetch('https://autre-site.test/data')

    expect(auth.isAuthenticated.value).toBe(true)
  })

  it('fetchUser() recharge l\'utilisateur', async () => {
    storedSession()
    const { auth } = makeAuth({}, { 'GET /sso/user': [200, { user: { id: 1, name: 'Jean Dupont', roles: ['reader'] } }] })

    await auth.fetchUser()

    expect(auth.user.value?.name).toBe('Jean Dupont')
    expect(auth.roles.value).toEqual(['reader'])
    expect(auth.token.value).toBe('stored-token')
  })
})

describe('déconnexion', () => {
  afterEach(() => vi.restoreAllMocks())

  it('supprime le jeton côté API puis redirige vers Keycloak', async () => {
    storedSession()
    const assign = mockNavigation()
    const { auth, fetch } = makeAuth({}, { 'POST /sso/logout': [200, { logout_url: 'https://sso.test/logout?id_token_hint=x' }] })

    await auth.logout()

    expect(new Headers(fetch.mock.calls[0]![1]?.headers).get('Authorization')).toBe('Bearer stored-token')
    expect(auth.isAuthenticated.value).toBe(false)
    expect(localStorage.getItem('keycloak-sanctum')).toBeNull()
    expect(assign).toHaveBeenCalledWith('https://sso.test/logout?id_token_hint=x')
  })

  it('sans redirection', async () => {
    storedSession()
    const assign = mockNavigation()
    const { auth } = makeAuth({}, { 'POST /sso/logout': [200, { logout_url: 'https://sso.test/logout' }] })

    expect(await auth.logout({ redirect: false })).toBe('https://sso.test/logout')
    expect(assign).not.toHaveBeenCalled()
  })

  it('efface la session même si l\'API ne répond pas', async () => {
    storedSession()
    mockNavigation()
    const { auth } = makeAuth({}, { 'POST /sso/logout': () => { throw new TypeError('Failed to fetch') } })

    expect(await auth.logout()).toBeNull()
    expect(auth.isAuthenticated.value).toBe(false)
  })
})

describe('plusieurs onglets', () => {
  it('suit la déconnexion et la connexion faites dans un autre onglet', () => {
    storedSession()
    const { auth } = makeAuth()
    auth.install({ provide: vi.fn(), config: { globalProperties: {} } } as never)

    localStorage.removeItem('keycloak-sanctum')
    window.dispatchEvent(new StorageEvent('storage', { key: 'keycloak-sanctum', newValue: null }))
    expect(auth.isAuthenticated.value).toBe(false)

    storedSession('other-tab-token')
    window.dispatchEvent(new StorageEvent('storage', { key: 'keycloak-sanctum' }))
    expect(auth.token.value).toBe('other-tab-token')

    auth.destroy()
  })
})
