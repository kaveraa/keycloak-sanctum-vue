import type { KeycloakSanctum } from './auth'

/**
 * Minimal shape of an axios instance: the package does not depend on axios.
 */
interface AxiosLike {
  defaults?: { baseURL?: string }
  interceptors: {
    request: { use: (onFulfilled: (config: any) => any) => number }
    response: { use: (onFulfilled: (response: any) => any, onRejected: (error: any) => any) => number }
  }
}

/**
 * Plugs the token into an axios instance: adds "Authorization: Bearer ..." to requests sent to
 * the API, and clears the session when the API answers 401.
 *
 *     const api = axios.create({ baseURL: 'https://api.example.org' })
 *     attachAxios(auth, api)
 */
export function attachAxios<T extends AxiosLike>(auth: KeycloakSanctum<any>, instance: T): T {
  instance.interceptors.request.use((config) => {
    const url = fullUrl(config?.baseURL ?? instance.defaults?.baseURL, config?.url)

    if (auth.token.value !== null && auth.isApiUrl(auth.resolveUrl(url))) {
      const headers = config.headers ?? {}
      if (typeof headers.set === 'function') {
        if (!headers.has?.('Authorization')) headers.set('Authorization', `Bearer ${auth.token.value}`)
      } else if (headers.Authorization === undefined) {
        headers.Authorization = `Bearer ${auth.token.value}`
      }
      config.headers = headers
    }

    return config
  })

  instance.interceptors.response.use(
    (response) => response,
    (error) => {
      const config = error?.config
      const url = fullUrl(config?.baseURL ?? instance.defaults?.baseURL, config?.url)

      if (error?.response?.status === 401 && auth.isApiUrl(auth.resolveUrl(url))) {
        auth.expire()
      }

      return Promise.reject(error)
    },
  )

  return instance
}

function fullUrl(baseURL: string | undefined, url: string | undefined): string {
  const path = url ?? ''
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(path) || baseURL === undefined || baseURL === '') {
    return path
  }

  return baseURL.replace(/\/+$/, '') + '/' + path.replace(/^\/+/, '')
}
