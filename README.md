# Keycloak Sanctum Vue

<p align="center"><img src="https://raw.githubusercontent.com/kaveraa/keycloak-sanctum-vue/main/art/banner.svg" alt="Keycloak Sanctum Vue" width="100%"></p>

[![Tests](https://github.com/kaveraa/keycloak-sanctum-vue/actions/workflows/tests.yml/badge.svg)](https://github.com/kaveraa/keycloak-sanctum-vue/actions/workflows/tests.yml)
[![npm](https://img.shields.io/npm/v/@kaveraa/keycloak-sanctum-vue.svg)](https://www.npmjs.com/package/@kaveraa/keycloak-sanctum-vue)
[![Licence](https://img.shields.io/github/license/kaveraa/keycloak-sanctum-vue.svg)](https://github.com/kaveraa/keycloak-sanctum-vue/blob/main/LICENSE)
[![Taille](https://img.shields.io/bundlephobia/minzip/@kaveraa/keycloak-sanctum-vue.svg)](https://bundlephobia.com/package/@kaveraa/keycloak-sanctum-vue)

**Français** - [English](https://github.com/kaveraa/keycloak-sanctum-vue/blob/main/README.en.md)

Client **Vue 3** pour la connexion **Keycloak (SSO)** avec une **API Laravel**. C'est la partie front du paquet PHP [kaveraa/laravel-keycloak-sanctum](https://github.com/kaveraa/laravel-keycloak-sanctum).

```js
const auth = useAuth()

auth.login()                     // connexion Keycloak
auth.user.value                  // utilisateur connecté
auth.hasRole('admin')            // rôles
auth.fetch('/api/projects')      // appels à l'API avec le jeton
auth.logout()                    // déconnexion (API + Keycloak)
```

- **Prêt à l'emploi** : un plugin Vue, un composable `useAuth()`, un garde pour vue-router.
- **Réactif** : `user`, `roles`, `isAuthenticated` sont des `ref` Vue, utilisables directement dans les templates.
- **Sécurisé** : le jeton n'est envoyé qu'à votre API, jamais à un autre site. La page de retour après connexion ne peut pas renvoyer vers un site externe.
- **Plusieurs onglets** : une connexion ou une déconnexion dans un onglet est suivie par les autres.
- **Inactivité** (facultative) : déconnexion automatique, avec un avertissement avant.
- **fetch ou axios** : `auth.fetch()` intégré, ou `attachAxios()` pour une instance axios existante.
- **Léger** : aucune dépendance en dehors de Vue. Écrit en TypeScript.

---

## Sommaire

- [Prérequis](#prérequis)
- [Installation](#installation)
- [Mise en place](#mise-en-place)
- [Page de retour après connexion](#page-de-retour-après-connexion)
- [Protéger les pages](#protéger-les-pages)
- [Appeler l'API](#appeler-lapi)
- [Utilisateur et rôles](#utilisateur-et-rôles)
- [Déconnexion](#déconnexion)
- [Inactivité](#inactivité)
- [Toutes les options](#toutes-les-options)
- [TypeScript](#typescript)
- [Sécurité](#sécurité)
- [Développement](#développement)

## Prérequis

- Vue 3.3+ (et vue-router 4 ou 5 pour le garde de navigation, facultatif).
- Une API Laravel avec [kaveraa/laravel-keycloak-sanctum](https://github.com/kaveraa/laravel-keycloak-sanctum). Dans son `.env`, la page de retour doit pointer vers le front :

```dotenv
KEYCLOAK_SANCTUM_FRONTEND_CALLBACK_URL=https://app.example.org/login/callback
```

## Installation

```bash
npm install @kaveraa/keycloak-sanctum-vue
```

## Mise en place

```js
// src/auth.js
import { createKeycloakSanctum } from '@kaveraa/keycloak-sanctum-vue'

export const auth = createKeycloakSanctum({
  apiUrl: import.meta.env.VITE_API_URL, // https://api.example.org
})
```

```js
// src/main.js
import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { auth } from './auth'

createApp(App).use(router).use(auth).mount('#app')
```

Dans n'importe quel composant :

```vue
<script setup>
import { useAuth } from '@kaveraa/keycloak-sanctum-vue'

const auth = useAuth()
</script>

<template>
  <button v-if="!auth.isAuthenticated.value" @click="auth.login()">Se connecter</button>
  <span v-else>Bonjour {{ auth.user.value.name }}</span>
</template>
```

L'objet `auth` créé dans `src/auth.js` s'utilise aussi en dehors des composants : routeur, stores Pinia, services.

## Page de retour après connexion

Après la connexion Keycloak, l'API redirige vers la page du front avec `?code=...`. Cette page échange le code contre le jeton :

```vue
<!-- src/views/LoginCallback.vue (route /login/callback) -->
<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '@kaveraa/keycloak-sanctum-vue'

const auth = useAuth()
const router = useRouter()
const error = ref(null)

const messages = {
  access_denied: 'Connexion annulée.',
  user_not_found: 'Votre compte n\'a pas accès à cette application.',
  no_role: 'Vous n\'avez aucun rôle dans cette application.',
}

onMounted(async () => {
  const result = await auth.handleCallback()

  if (result.ok) {
    router.replace(result.returnTo ?? '/')
  } else {
    error.value = messages[result.error] ?? 'La connexion a échoué, réessayez.'
  }
})
</script>

<template>
  <p v-if="error">{{ error }} <button @click="auth.login()">Réessayer</button></p>
  <p v-else>Connexion en cours...</p>
</template>
```

| Erreur (`result.error`) | Signification |
|---|---|
| `access_denied` | L'utilisateur a annulé dans Keycloak |
| `user_not_found` | Utilisateur inconnu de l'application (création automatique désactivée côté API) |
| `no_role` | Aucun rôle, alors que l'API en exige un |
| `invalid_token`, `authentication_failed` | Problème de connexion avec Keycloak |
| `invalid_code` | Code expiré ou déjà utilisé (page rechargée, par exemple) |
| `missing_code` | Page ouverte sans `?code=` |
| `network_error` | L'API ne répond pas |

## Protéger les pages

Ajoutez `requiresAuth` ou `roles` dans les `meta` des routes, puis le garde :

```js
// src/router.js
import { createRouter, createWebHistory } from 'vue-router'
import { createAuthGuard } from '@kaveraa/keycloak-sanctum-vue'
import { auth } from './auth'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: Home },
    { path: '/login', name: 'login', component: Login },
    { path: '/login/callback', component: LoginCallback },
    { path: '/projects', component: Projects, meta: { requiresAuth: true } },
    { path: '/admin', component: Admin, meta: { roles: ['admin'] } }, // roles implique requiresAuth
  ],
})

router.beforeEach(createAuthGuard(auth, { loginRoute: { name: 'login' } }))

export default router
```

- **Utilisateur non connecté** : il est envoyé vers `loginRoute` avec `?redirect=/page-demandee`. Sur cette page, `auth.login(route.query.redirect)` le ramènera au bon endroit après la connexion.
- **Sans `loginRoute`** : la connexion Keycloak démarre directement.
- **Rôle manquant** : la navigation est annulée, ou l'utilisateur est envoyé vers `forbiddenRoute` si vous la précisez.
- Les `meta` des routes parentes s'appliquent aux routes enfants.

## Appeler l'API

**Avec fetch** : `auth.fetch()` ajoute le jeton, et les chemins qui commencent par `/` partent vers `apiUrl`.

```js
const response = await auth.fetch('/api/projects')
const projects = await response.json()

await auth.fetch('/api/projects', { method: 'POST', body: JSON.stringify(data), headers: { 'Content-Type': 'application/json' } })
```

**Avec axios** :

```js
import axios from 'axios'
import { attachAxios } from '@kaveraa/keycloak-sanctum-vue'
import { auth } from './auth'

export const api = attachAxios(auth, axios.create({ baseURL: import.meta.env.VITE_API_URL }))

const { data } = await api.get('/api/projects')
```

Dans les deux cas, une réponse **401** de l'API (jeton expiré, déconnexion depuis Keycloak, inactivité) efface la session et appelle `onUnauthenticated` :

```js
export const auth = createKeycloakSanctum({
  apiUrl: import.meta.env.VITE_API_URL,
  onUnauthenticated: () => router.push({ name: 'login' }),
})
```

## Utilisateur et rôles

| Propriété / méthode | Rôle |
|---|---|
| `auth.isAuthenticated.value` | `true` si un jeton est présent |
| `auth.user.value` | Utilisateur envoyé par l'API, ou `null` |
| `auth.roles.value` | Rôles de l'utilisateur (`[]` si aucun) |
| `auth.token.value` | Jeton Sanctum, ou `null` |
| `auth.hasRole('admin', 'editor')` | A au moins un des rôles |
| `auth.hasAllRoles('admin', 'editor')` | A tous les rôles |
| `auth.fetchUser()` | Recharge l'utilisateur depuis l'API (`GET /sso/user`) |

Dans les templates, `$auth` est aussi disponible :

```vue
<button v-if="$auth.hasRole('admin')">Administration</button>
```

## Déconnexion

```js
await auth.logout()
```

`logout()` supprime le jeton côté API, efface la session locale, puis redirige vers la déconnexion Keycloak. La session SSO est ainsi fermée elle aussi. Avec `auth.logout({ redirect: false })`, la redirection n'a pas lieu et l'adresse de déconnexion Keycloak est retournée.

## Inactivité

```js
export const auth = createKeycloakSanctum({
  apiUrl: import.meta.env.VITE_API_URL,
  inactivity: { warnBefore: 60 }, // délai lu dans l'API (KEYCLOAK_SANCTUM_IDLE_TIMEOUT)
  // inactivity: { timeout: 30 }, // ou délai fixe, en minutes
  onUnauthenticated: () => router.push({ name: 'login' }),
})
```

Sans souris, clavier, défilement ni toucher pendant le délai, l'utilisateur est déconnecté et `onUnauthenticated` est appelé. L'activité dans un onglet compte pour tous les onglets.

Afficher un avertissement :

```vue
<script setup>
import { useAuth } from '@kaveraa/keycloak-sanctum-vue'

const { inactivity } = useAuth()
</script>

<template>
  <div v-if="inactivity?.warning.value" class="alert">
    Déconnexion dans {{ inactivity.secondsLeft.value }} secondes.
    <button @click="inactivity.touch()">Rester connecté</button>
  </div>
</template>
```

## Toutes les options

| Option | Défaut | Rôle |
|---|---|---|
| `apiUrl` | `''` (même domaine) | Adresse de l'API Laravel |
| `prefix` | `'/sso'` | Préfixe des routes du paquet Laravel |
| `storage` | `'local'` | `'local'` (garde la session), `'session'` (un onglet), `'memory'` (rien n'est gardé), ou un objet compatible `Storage` |
| `storageKey` | `'keycloak-sanctum'` | Clé utilisée dans le stockage |
| `onUnauthenticated` | - | Appelé quand la session se termine (401, inactivité) |
| `inactivity` | `false` | `{ timeout?, warnBefore?, events? }` |
| `fetch` | `window.fetch` | Fonction fetch à utiliser |

## TypeScript

Le paquet est écrit en TypeScript. Précisez la forme de votre utilisateur :

```ts
interface User {
  id: number
  name: string
  email: string
  roles: string[]
}

export const auth = createKeycloakSanctum<User>({ apiUrl: import.meta.env.VITE_API_URL })

const auth = useAuth<User>()
auth.user.value?.email // typé
```

Les `meta` de vue-router (`requiresAuth`, `roles`) sont aussi typées.

## Sécurité

- **Le jeton n'est envoyé qu'à l'API** : `auth.fetch()` et `attachAxios()` ne l'ajoutent qu'aux requêtes vers le domaine de `apiUrl`.
- **Page de retour** : `login(returnTo)` n'accepte que des chemins du site (`/...`). Une adresse externe est ignorée.
- **Stockage** : avec `'local'` (le défaut), le jeton est gardé dans `localStorage`, comme la plupart des SPA. Il est donc lisible par un script injecté dans la page (faille XSS). Protégez votre front contre les XSS (pas de `v-html` sur des données utilisateur, en-tête Content-Security-Policy). Pour limiter l'exposition, utilisez `'session'` ou `'memory'`, et une durée de vie courte côté API (`KEYCLOAK_SANCTUM_TOKEN_EXPIRATION`).
- La vérification des jetons Keycloak se fait côté API, dans le paquet Laravel.

Pour signaler une faille, ouvrez une [alerte de sécurité privée](https://github.com/kaveraa/keycloak-sanctum-vue/security/advisories/new) plutôt qu'une issue publique.

## Développement

```bash
git clone https://github.com/kaveraa/keycloak-sanctum-vue.git
cd keycloak-sanctum-vue
npm install
npm test
npm run build
```

Pour proposer une modification, lisez le guide [CONTRIBUTING.md](https://github.com/kaveraa/keycloak-sanctum-vue/blob/main/CONTRIBUTING.md). Voir le [CHANGELOG](https://github.com/kaveraa/keycloak-sanctum-vue/blob/main/CHANGELOG.md) pour l'historique des versions.

## Licence

MIT. Voir [LICENSE](https://github.com/kaveraa/keycloak-sanctum-vue/blob/main/LICENSE).
