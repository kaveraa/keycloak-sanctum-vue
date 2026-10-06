# Contribuer / Contributing

**Français** - [English](#english)

## Français

Merci de votre aide ! Toute modification passe par une **Pull Request** : la branche `main` est protégée et la CI doit être verte pour fusionner.

### 1. Préparer le projet

```bash
git clone https://github.com/kaveraa/keycloak-sanctum-vue.git
cd keycloak-sanctum-vue
npm install
```

Il faut Node.js 22 ou plus.

### 2. Créer une branche

```bash
git checkout -b fix/nom-court-du-changement
```

Préfixes conseillés : `feat/` (nouveauté), `fix/` (correction), `docs/` (documentation).

### 3. Lancer les tests

```bash
npm test
npm run typecheck
npm run build
```

Les tests utilisent Vitest avec un navigateur simulé (happy-dom) et un faux serveur (`tests/helpers.ts`) : aucune API à lancer.

### 4. Règles du projet

- **Tests** : toute correction ou nouveauté est accompagnée d'un test.
- **Sécurité** : le jeton ne doit jamais partir vers un autre domaine que l'API, et aucune redirection ne doit mener vers un site externe.
- **Dépendances** : le paquet ne dépend que de Vue (et de vue-router, facultatif). Pas de nouvelle dépendance sans discussion.
- **Documentation** : mettez à jour `README.md` (anglais simple) **et** `README.fr.md` (français), ainsi que le `CHANGELOG.md` (section en haut, en français et en anglais).
- **Commits** : en anglais simple, compréhensible par un débutant. Phrases courtes, pas de jargon.
- **Caractères** : uniquement des caractères du clavier dans les fichiers et les commits : `-` (pas de tiret long), `"` (pas de guillemets français), `->` (pas de flèche), pas d'emoji ni d'icône. Les lettres accentuées du français sont acceptées.

### 5. Ouvrir la Pull Request

Poussez votre branche, ouvrez une PR vers `main` et remplissez la checklist proposée. La PR peut être fusionnée quand le contrôle **All tests passed** est vert.

### Publier une version (mainteneur)

Après la fusion : mettre à jour la version dans `package.json` et le `CHANGELOG.md` (via une PR), créer un tag `vX.Y.Z` sur `main`, puis lancer `npm publish`.

### Changer la bannière (mainteneur)

Les README chargent `art/banner.svg` par une URL qui nomme un commit, pas la branche `main`. Certains sites qui affichent un README (Packagist, pour les paquets PHP) mettent en cache une URL de branche pendant un an ; la même règle vaut pour tous les paquets. Quand la bannière change :

1. Commiter le nouveau `art/banner.svg`.
2. Mettre ce commit dans l'URL de l'image de `README.md` et `README.fr.md`, dans un second commit.

---

## English

Thank you for your help! Every change goes through a **Pull Request**: the `main` branch is protected, and the CI must be green before merge.

### 1. Set up the project

```bash
git clone https://github.com/kaveraa/keycloak-sanctum-vue.git
cd keycloak-sanctum-vue
npm install
```

You need Node.js 22 or more.

### 2. Create a branch

```bash
git checkout -b fix/short-name-of-the-change
```

Suggested prefixes: `feat/` (new feature), `fix/` (bug fix), `docs/` (documentation).

### 3. Run the tests

```bash
npm test
npm run typecheck
npm run build
```

The tests use Vitest with a simulated browser (happy-dom) and a fake server (`tests/helpers.ts`): no API to start.

### 4. Project rules

- **Tests**: every fix or new feature comes with a test.
- **Security**: the token must never go to another domain than the API, and no redirect may lead to an external site.
- **Dependencies**: the package only depends on Vue (and vue-router, optional). No new dependency without a discussion.
- **Documentation**: update `README.md` (simple English) **and** `README.fr.md` (French), and the `CHANGELOG.md` (section at the top, in French and English).
- **Commits**: in simple English, easy to read for a beginner. Short sentences, no jargon.
- **Characters**: only keyboard characters in files and commits: `-` (no long dash), `"` (no French quotes), `->` (no arrow), no emoji or icon. French accented letters are fine.

### 5. Open the Pull Request

Push your branch, open a PR to `main` and fill in the checklist. The PR can be merged when the **All tests passed** check is green.

### Release a version (maintainer)

After the merge: update the version in `package.json` and the `CHANGELOG.md` (with a PR), create a `vX.Y.Z` tag on `main`, then run `npm publish`.

### Change the banner (maintainer)

The README files load `art/banner.svg` through a URL that names a commit, not the `main` branch. Some sites that show a README (Packagist, for the PHP packages) cache a branch URL for a year; the same rule applies to every package. When the banner changes:

1. Commit the new `art/banner.svg`.
2. Put that commit in the image URL of `README.md` and `README.fr.md`, in a second commit.
