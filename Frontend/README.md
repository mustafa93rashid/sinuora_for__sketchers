# Sinuora frontend

English, LTR operations dashboard. React + TypeScript + Vite + Tailwind CSS 4.

## Local startup

Expected sibling folders: `D:\Sinuora for sketchers\Backend` and `D:\Sinuora for sketchers\Frontend`.

From `Frontend`, run `npm run dev:full`. This starts the existing backend and Vite together, or reuses an already running backend. Open **http://localhost:5173** (use `localhost` consistently). The login page checks `/api/health` and displays connection status. Sign in with an existing activated backend account; no new credentials are created by the frontend. Preview is explicitly selected and read-only. Exit preview before signing in.

Alternatively, run `npm start` inside `Backend` and `npm run dev` inside `Frontend` in separate terminals.

## API and authentication

- `Frontend/.env.local`: `VITE_API_BASE_URL=/api/v1`, `API_PROXY_TARGET=http://127.0.0.1:3000`.
- Backend remains configured by its own `.env`: `PORT=3000`, `NODE_ENV=development`, `DASHBOARD_URL_LOCAL=http://localhost:5173`.
- Vite proxies `/api` to Express. HttpOnly cookies remain on the frontend origin. No tokens are stored in localStorage.
- Authentication refresh is single-flight per tab. Public authentication requests do not attempt session refresh.
- Uploads use multipart FormData; order and inventory mutations use payload-specific idempotency keys.
- No backend secrets are copied into the frontend. Restart Vite after changing environment variables.
- Backend startup requires its configured MongoDB replica set and services. A connection failure is reported, never replaced with sample data automatically.

## Tailwind styling

Component layout, spacing, color, responsive behavior and states live in static Tailwind utilities in TSX. `src/styles.css` contains only Tailwind import, theme tokens and shared document/form defaults in `@layer base`. Semantic class names remain as selector hooks for nested Tailwind variants, not as stylesheet rules. Static status palettes avoid runtime-generated Tailwind class names.

Three layouts: mobile below 768px, tablet 768–1199px, desktop 1200px and above. Wide desktop refinements begin at 1600px. Reduced motion is supported.

## Verification and production

Run `npm test`, `npm run build`, then `npm run preview` to inspect the build at the same localhost origin and API proxy. `.github/workflows/ci.yml` runs `npm test` and `npm run build` automatically on every pull request and push to `main` (see `Backend/docs/deployment-readiness.md` for its verification status).

Production hosting must serve `index.html` for client routes and reverse-proxy `/api` to Express; Vite's proxy is not shipped in static assets. Configure HTTPS, frontend origins and cookies in the backend for production.

No automated deployment or database seeding is performed.
