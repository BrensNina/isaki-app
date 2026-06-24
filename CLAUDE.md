# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Next.js 16 (App Router) application deployed to **Cloudflare Workers** via the
[OpenNext](https://opennext.js.org/cloudflare) adapter (`@opennextjs/cloudflare`),
not Vercel. Styling is Tailwind CSS v4. Code lives under `src/app/` with the `@/*`
import alias mapping to `src/*`.

## Commands

- `npm run dev` — Next.js dev server at http://localhost:3000 (standard Node, not the Workers runtime).
- `npm run lint` — ESLint (`next/core-web-vitals` + `next/typescript`).
- `npm run build` — Next.js production build only.
- `npm run preview` — Build with OpenNext **and** run the app locally on the Cloudflare Workers runtime (`workerd`). Use this to test anything that depends on Cloudflare bindings or Worker behavior; `npm run dev` won't surface those issues.
- `npm run deploy` — Build with OpenNext and deploy to Cloudflare.
- `npm run upload` — Build and upload a new version without deploying it.
- `npm run cf-typegen` — Regenerate `cloudflare-env.d.ts` (the `CloudflareEnv` types) from `wrangler.jsonc`. Run this after changing bindings.

There is no test runner configured.

## Architecture notes

- **Two runtimes.** `next dev` runs on Node; the deployed app and `npm run preview` run on the Cloudflare Workers runtime. Code must be Workers-compatible (Web APIs, no unsupported Node built-ins beyond what `nodejs_compat` provides).
- **Bindings.** Cloudflare resources (KV, R2, D1, env vars, etc.) are declared in `wrangler.jsonc` and accessed at runtime via `getCloudflareContext()` from `@opennextjs/cloudflare`. `next.config.ts` calls `initOpenNextCloudflareForDev()` so bindings also work under `next dev`. After editing `wrangler.jsonc`, run `npm run cf-typegen` to keep `CloudflareEnv` in sync.
- **Caching / image optimization** are configured through `open-next.config.ts` (incremental cache overrides) and `wrangler.jsonc` (the `IMAGES` binding, `WORKER_SELF_REFERENCE` service binding). These are wired up but mostly left at defaults.
- **Generated / do-not-edit:** `.open-next/` (OpenNext build output, the Worker entry is `.open-next/worker.js`), `.next/`, `cloudflare-env.d.ts`, `next-env.d.ts`.
- **Local secrets** go in `.dev.vars` (gitignored), not `.env`.
- **OpenNext build cleanup (Windows).** A `pre*` npm hook (`scripts/clean-opennext.mjs`) removes `.open-next` before `deploy`/`upload`/`preview`, because on Windows the dir is often still locked (lingering `workerd`) and OpenNext's own `rmSync` then fails with `EPERM`. If a build still fails to remove it, kill any running `npm run preview` (workerd) and retry.

## Firebase (Firestore + Auth)

This app uses **Firebase** for data and auth, accessed via the **client Web SDK only** (project: `isaki-app`, Firestore `(default)`, STANDARD edition). The Admin SDK is intentionally not used — it relies on gRPC, which doesn't run on Workers.

- **CRITICAL — keep Firebase out of SSR.** The Firebase JS SDK runs `new Function` at module-eval time, and the Workers runtime forbids code generation from strings (`EvalError: Code generation from strings disallowed`). So any module that imports `firebase/*` must **never be evaluated on the server**. The pattern here: `src/app/page.tsx` loads `src/app/app-shell.tsx` via `next/dynamic` with `{ ssr: false }`; the `AuthProvider` and all Firebase imports live inside that client-only subtree. Don't import `firebase/*` from `layout.tsx`, Server Components, route handlers, or anything in the SSR path.
- **Init.** `src/lib/firebase.ts` exposes lazy getters `getFirebaseApp() / getFirebaseAuth() / getDb()` (initialized on first use, in the browser). Auth state + the `users/{uid}` profile doc are managed in `src/lib/auth-context.tsx` (`AuthProvider` / `useAuth`).
- **Config.** Public web config (non-secret) is in `.env.local` as `NEXT_PUBLIC_FIREBASE_*` (inlined at build time). Re-fetch with `firebase apps:sdkconfig WEB <app-id> --project isaki-app`.
- **Backend config & deploys.** `firebase.json` holds Firestore rules/indexes + Auth providers (Email/Password, Google) and `authorizedDomains`. Deploy with `firebase deploy --only firestore` (rules + indexes) or `--only auth`. After deploying to a new domain, add it to `auth.authorizedDomains` or Google sign-in fails with `auth/unauthorized-domain`.
- **Security rules** live in `firestore.rules` (each user can only read/write their own `users/{uid}` doc). Treat them as a reviewed-but-not-hardened prototype.
