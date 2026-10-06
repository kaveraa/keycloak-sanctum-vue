# Changelog

**FR** Toutes les évolutions notables du paquet sont listées ici. Le format suit [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) et le projet respecte le [versionnage sémantique](https://semver.org/lang/fr/).

**EN** All important changes of the package are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [semantic versioning](https://semver.org/).

## [Unreleased]

### Maintenance

- **FR** Le paquet est construit avec tsdown à la place de tsup, qui ne prend pas en charge TypeScript 6. Mêmes fichiers dans `dist/`, aucun changement dans le code. Pour développer, il faut maintenant Node.js 22 ou plus.
  **EN** The package is built with tsdown instead of tsup, which does not support TypeScript 6. Same files in `dist/`, no code change. Development now needs Node.js 22 or more.

## [1.0.3] - 2026-09-30

### Documentation

- **FR** L'URL de la bannière du README pointe sur un commit précis, plus sur la branche `main`, pour que les sites qui affichent le README montrent toujours la bannière en cours. Le guide de contribution explique la marche à suivre quand la bannière change.
  **EN** The README banner URL now points to a fixed commit instead of the `main` branch, so sites that show the README always display the current banner. The contributing guide explains what to do when the banner changes.

## [1.0.2] - 2026-09-29

### Documentation

- **FR** Badges du README mis à jour (téléchargements npm à la place de Bundlephobia) et actions de la CI mises à jour.
  **EN** README badges updated (npm downloads instead of Bundlephobia) and CI actions bumped.

## [1.0.1] - 2026-09-29

### Documentation

- **FR** Le README affiché par défaut est maintenant en anglais (`README.md`), le français est dans `README.fr.md`.
  **EN** The default README is now in English (`README.md`), the French version is in `README.fr.md`.

## [1.0.0] - 2026-09-25

### Ajouté / Added

- **FR** Plugin Vue `createKeycloakSanctum()` et composable `useAuth()` : utilisateur, rôles et jeton réactifs, connexion, page de retour (`handleCallback()`), déconnexion API + Keycloak.
  **EN** Vue plugin `createKeycloakSanctum()` and `useAuth()` composable: reactive user, roles and token, login, return page (`handleCallback()`), API + Keycloak logout.
- **FR** `auth.fetch()` : appels à l'API avec le jeton, jamais envoyé à un autre domaine, session effacée sur une réponse 401.
  **EN** `auth.fetch()`: API calls with the token, never sent to another domain, session cleared on a 401 answer.
- **FR** `attachAxios()` pour une instance axios, et garde de navigation `createAuthGuard()` pour vue-router 4 et 5 (`meta.requiresAuth`, `meta.roles`).
  **EN** `attachAxios()` for an axios instance, and `createAuthGuard()` navigation guard for vue-router 4 and 5 (`meta.requiresAuth`, `meta.roles`).
- **FR** Suivi de la session entre onglets, et déconnexion après inactivité avec avertissement.
  **EN** Session sync between tabs, and logout after inactivity with a warning.

[1.0.1]: https://github.com/kaveraa/keycloak-sanctum-vue/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/kaveraa/keycloak-sanctum-vue/releases/tag/v1.0.0
