# Task Workflow MiniApp

React + Vite frontend for the Task Workflow system. This repository is the Telegram Web App and browser-facing UI for browsing tasks, viewing task details, working with groups, and handling browser login.

The backend API and Telegram bot live in a separate repository: `task-workflow-backend`.

This project is open source under the MIT License. See [LICENSE](./LICENSE).

## What This Repo Contains

- React application entrypoint in `src/main.tsx`
- App shell and routing/state in `src/App.tsx`
- API client in `src/services/api.ts`
- frontend config in `src/config.ts`
- shared UI and feature components in `src/components`
- type definitions in `src/types`
- Vite configuration in `vite.config.ts`
- deployment/versioning scripts in `scripts` and `deploy-production.sh`

## Stack

- React 18
- Vite
- TypeScript
- Telegram Web App SDK via `@twa-dev/sdk`
- GitHub Pages deployment via `gh-pages`

## High-Level Architecture

- This app runs as a Telegram Web App and also supports a browser login flow
- It calls the backend worker for auth, tasks, groups, roles, and media
- In development it uses `http://localhost:8787` as the backend base URL
- In production it points to the Cloudflare Worker backend
- Bot messages from the backend link users into this miniapp using the deployed GitHub Pages URL

## Important Files

```text
src/
  components/
  services/api.ts
  config.ts
  App.tsx
  main.tsx
  types/
public/
scripts/
deploy-production.sh
vite.config.ts
VERSION
package.json
```

## Prerequisites

- Node.js 20+ recommended
- npm
- a compatible Task Workflow backend if you want live API calls
- GitHub Pages push access only if you plan to deploy this repo yourself

## First-Time Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Confirm the repo remote:

   ```bash
   git remote -v
   ```

3. Confirm the app builds:

   ```bash
   npm run build
   ```

4. Confirm you can push to GitHub if you plan to deploy.

## Configuration

### Backend Base URL

Frontend API configuration is in `src/config.ts`. Runtime values are read from Vite environment variables at build time.

Supported variables:

```bash
VITE_API_BASE_URL=https://your-backend.example.com
VITE_MOCK_USER_ID=1
VITE_MOCK_ROLE=Admin
```

Defaults:

- Development API URL: `http://localhost:8787`
- Production API URL: `https://task-workflow-backend.kason1000.workers.dev`
- Local mock user ID: `1`
- Local mock role: `Admin`

For a public fork, set `VITE_API_BASE_URL` to your own backend before building for production.

Do not commit `.env` files. They are ignored by git.

### Deploy Base Path

Vite base path is configured in `vite.config.ts`:

- `/task-workflow-miniapp/`

This assumes GitHub Pages is serving the app from the repository path rather than a custom root domain.

### Telegram / Browser Auth

- Telegram mode uses `X-Telegram-InitData`
- Browser mode uses session token auth from `/auth/verify-code` and `/auth/validate-session`
- Local browser development can use mock auth through `VITE_MOCK_USER_ID` and `VITE_MOCK_ROLE`

## Local Development

Start the app with:

```bash
npm run dev
```

Useful commands:

```bash
npm run build
npm run preview
```

## Deployment

### Recommended Deploy Command

Use the shell script from the miniapp repo root:

```bash
bash ./deploy-production.sh
```

Why `bash`? As with the backend, this is the safest way to run the script even if the executable bit is missing.

### What The Deploy Script Does

`deploy-production.sh` performs these steps:

1. bumps the version using `node scripts/version-manager.js build`
2. builds the production bundle with `npm run build`
3. publishes `dist/` to the `gh-pages` branch using `npx gh-pages -d dist -b gh-pages`
4. stages repo changes, creates a git commit, and pushes to `origin main`

### Deploy Preconditions

Before deploying, make sure all of these are true:

- `npm install` has been run
- `npm run build` succeeds
- git remote `origin` is configured
- you have permission to push to GitHub
- `VITE_API_BASE_URL` points to the backend you intend to use, or the default backend URL is intentionally being used
- the Vite `base` path in `vite.config.ts` matches the GitHub Pages repo path

### Current Production URL

- `https://kason1000.github.io/task-workflow-miniapp/`

## Versioning

The miniapp uses version format `x.x.xxxx`.

Examples:

- `1.1.0131`
- `1.1.0132`

Single source of truth:

- `VERSION`

Generated from `VERSION` during version sync/deploy:

- `package.json`
- `package-lock.json`
- `public/version.json`
- `index.html`

The app UI reads the runtime version from `public/version.json`, so the displayed version and deployed version now come from the same source.

## Package Scripts

- `npm run dev`: start Vite dev server
- `npm run build`: production build
- `npm run build:tsc`: TypeScript compile plus Vite build
- `npm run preview`: preview built app locally
- `npm run deploy`: run `scripts/update-version.cjs`, build, and publish to GitHub Pages

## Open Source Notes

- License: MIT
- No backend secrets, Telegram bot tokens, Redis credentials, Cloudflare tokens, GitHub tokens, or private keys are required in this frontend repo.
- The frontend stores browser session tokens in `sessionStorage` at runtime only; those tokens are not committed.
- Public deployment URLs in this repo are not credentials. Forks should replace them with their own backend and Pages URLs.
- Generated dependencies and build output are ignored by git. Use `npm install` to recreate `node_modules` and `npm run build` to recreate `dist`.

## Secret Hygiene Check

Before publishing or accepting outside contributions, run:

```bash
git grep -n -I -E '(token|secret|password|api[_-]?key|private[_-]?key|client[_-]?secret|bearer|ghp_|github_pat_|sk-|AKIA|-----BEGIN)' -- ':!package-lock.json'
find . -maxdepth 3 -type f \( -name '.env*' -o -name '*.pem' -o -name '*.p12' -o -name '*.p8' \) -not -path './node_modules/*' -not -path './.git/*' -print
```

Review any hits before pushing. Expected matches are usually documentation, runtime `sessionStorage` key names, and auth header code.

## Deployment Scripts

- `deploy-production.sh`: full production deploy helper
- `scripts/version-manager.js`: canonical version manager; updates all generated version artifacts from `VERSION`
- `scripts/update-version.cjs`: version update helper used by `npm run deploy`

## Operational Notes

- This repo is separate from the backend repo, but the two are still operationally coupled by the configured backend URL.
- Browser login currently depends on backend auth routes.
- The deployment script not only publishes to `gh-pages`, it also commits and pushes to `main`.

## Common Failure Modes

### Dependencies Missing

Symptom:

- Vite or React imports fail
- build fails immediately

Fix:

```bash
npm install
```

### GitHub Pages Publish Fails

Symptom:

- `gh-pages` step fails

Check:

- git remote is correct
- credentials allow pushing to GitHub
- `gh-pages` branch permissions are valid

### Build Works But Assets 404 In Production

Usually caused by an incorrect Vite `base` path.

Check `vite.config.ts` and make sure it matches the GitHub Pages repo path.

### Browser Login Works Incorrectly

Check:

- backend production URL in `src/config.ts`
- any direct auth endpoint references in components

## If You Are A Fresh Agent

Start here, in order:

1. `npm install`
2. `npm run build`
3. inspect `src/config.ts`
4. inspect `vite.config.ts`
5. run `bash ./deploy-production.sh` when ready to publish
