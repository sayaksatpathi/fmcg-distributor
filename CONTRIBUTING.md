# Contributing

Thanks for your interest in improving the FMCG Distributor Control System.

## Editions

This repo contains two editions that share a frontend and data model:

- **FORTRESS (self-hosted)** — `src/`, Node.js + Express + **SQLite**. The
  canonical app, with the full security hardening and the automated security
  test suite. This is what `npm start` / `npm test` run.
- **Cloud (Vercel)** — `server/`, Node.js + Express + **MongoDB**. A serverless
  deployment variant (SQLite does not persist on serverless). Run via the
  `cloud:*` scripts.

## Development setup

```bash
npm install          # install root (FORTRESS) dependencies
cp .env.example .env # then set a real 64-byte hex SESSION_SECRET
npm run dev          # start FORTRESS with nodemon  → http://localhost:3000
```

Frontend (client):

```bash
cd client && npm install && npm run dev
```

## Before you open a pull request

Run the same checks CI runs — they must pass:

```bash
npm run check        # syntax-checks every JS file
npm test             # boots the server and runs the 46 security tests
cd client && npm run build
```

- Add or update tests for behavior changes. New endpoints should keep the
  security posture (headers, validation, rate limiting, auth) that the suite
  verifies.
- **No secrets** in code or fixtures — `SESSION_SECRET` and credentials come
  from the environment (`.env.example` lists the variables).
- Keep commits focused with clear, present-tense messages (`feat:`, `fix:`,
  `docs:`, `chore:`).

## Reporting issues

Open a GitHub issue with reproduction steps and environment details. For
security vulnerabilities, see [SECURITY.md](SECURITY.md) instead.
