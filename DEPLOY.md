# Deploying lofit

One service: the Hono server serves `/api` and the built web app from the same origin, so
there is no CORS to configure and no second host.

## Sign-in

Email and password, self-hosted with Better Auth. Sessions are httpOnly cookies, so the
browser needs no token handling; the bearer plugin is enabled for the native app later.
Sign-up is open — anyone who reaches the server can create an account. Put it behind a
closed door (or add an invite check) before pointing a public domain at it.

Every `/api` route outside `/api/auth` and `/api/health` answers 401 without a session, and
each query is scoped by the session's user id.

## What is in place

- `pnpm --filter @lofit/server build` bundles the server and a standalone migrator into
  `apps/server/dist`, so production needs neither `tsx` nor `drizzle-kit`.
- `Dockerfile` builds the web app and the server, then ships only `dist`, `drizzle` and the
  web files on a non-root user.
- `compose.yaml` runs Postgres 18 and the app, applying migrations before the server starts.
- The production composition adds request logging, security headers and a 300 requests per
  minute per caller limit. Dev and tests do not go through it.
- Prices refresh hourly inside the server process.

## Environment

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | required | Postgres connection string |
| `PORT` | 8787 | port to listen on |
| `WEB_ROOT` | unset | directory of built web files; unset serves API only |
| `MIGRATIONS_DIR` | ./drizzle | where the migrator looks |
| `PRICE_REFRESH_MINUTES` | 60 | 0 disables the refresh loop |
| `AUTH_SECRET` | required | signs session cookies; a long random string, keep it stable |
| `BASE_URL` | localhost:PORT | the full URL the app is served from, required in production |
| `TRUSTED_ORIGINS` | localhost:5173 in dev | comma-separated origins allowed to sign in |
| `DEV_USER_EMAIL` | dev@lofit.local | the seeded account, development only |
| `DEV_USER_PASSWORD` | lofit-dev-password | password for the seeded account, development only |

## Running it

```sh
POSTGRES_PASSWORD=... AUTH_SECRET=$(openssl rand -hex 32) BASE_URL=https://lofit.example \
    docker compose up --build
```

Rotating `AUTH_SECRET` signs everyone out.

Backups are not configured. For a single VPS, a nightly `pg_dump` into off-box storage is
the smallest thing that works.
