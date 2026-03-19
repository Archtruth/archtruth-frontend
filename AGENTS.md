# AGENTS.md

## Cursor Cloud specific instructions

### Overview

This is `archtruth-frontend`, a Next.js 14 (App Router) frontend for an AI-powered developer documentation platform. The backend is **external** (not in this repo) and is accessed via `NEXT_PUBLIC_BACKEND_URL`.

### Running the app

- **Dev server**: `npm run dev` (port 3000)
- **Build**: `npm run build`
- **Lint**: `npm run lint`
- Standard `package.json` scripts; see `scripts` section there.

### Environment variables

Copy `env.example` to `.env.local` and fill in values. Required variables:
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase auth
- `NEXT_PUBLIC_BACKEND_URL` — backend API endpoint
- `NEXT_PUBLIC_GITHUB_APP_INSTALL_URL` — GitHub App install link
- `NEXT_PUBLIC_SITE_URL` — defaults to `http://localhost:3000`

For local development without a real backend, the dev server starts fine with placeholder values, but login and dashboard features require real Supabase + backend credentials.

### Key caveats

- Authentication uses GitHub OAuth via Supabase PKCE flow. Protected routes (e.g. `/dashboard`) redirect unauthenticated users to the home page with a login modal.
- The build produces warnings about `@supabase/realtime-js` using Node.js APIs in Edge Runtime — these are safe to ignore and come from upstream Supabase packages.
- No automated test suite exists in this repo; `npm run lint` is the only code quality check available.
