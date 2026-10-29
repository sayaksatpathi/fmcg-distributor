<div align="center">

# 📦 FMCG Distributor Control System

### A security-hardened ERP for FMCG distributors — retailers, inventory, sales, credit, and **profit** (not just turnover) in one control panel.

[![Live Demo](https://img.shields.io/badge/▶_Live_Demo-sayak--traders.vercel.app-22c55e?style=for-the-badge)](https://sayak-traders.vercel.app)

[![CI](https://github.com/sayaksatpathi/fmcg-distributor/actions/workflows/ci.yml/badge.svg)](https://github.com/sayaksatpathi/fmcg-distributor/actions/workflows/ci.yml)
[![Security Tests](https://img.shields.io/badge/Security_Tests-46_passing-brightgreen?style=flat-square&logo=checkmarx&logoColor=white)](tests/security.test.js)
[![Node.js](https://img.shields.io/badge/Node.js-18+-5FA04E?style=flat-square&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4-000000?style=flat-square&logo=express&logoColor=white)](https://expressjs.com/)
[![SQLite](https://img.shields.io/badge/SQLite-003B57?style=flat-square&logo=sqlite&logoColor=white)](https://www.sqlite.org/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat-square&logo=docker&logoColor=white)](docker-compose.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

</div>

---

## Overview

A complete internal control system for FMCG distributors to manage retailers, inventory,
sales, credit exposure, and **profit analysis** — built with a serious focus on security.
It ships in two editions that share the same frontend and domain model:

| Edition | Stack | Use it when |
|---------|-------|-------------|
| 🏰 **FORTRESS** (canonical) | Node.js · Express · **SQLite** | Self-hosting; full security hardening + the automated security test suite. `npm start` / `npm test`. |
| ☁️ **Cloud** | Node.js · Express · **MongoDB** | Serverless deployment (the live demo runs this on Vercel, since SQLite doesn't persist on serverless). `cloud:*` scripts. |

## ✨ Features

**Business**

| Feature | Endpoint |
|---------|----------|
| Reports & PDF export (sales, profit, inventory, credit) | `/api/reports/*` |
| Purchase orders · Invoices · Returns | `/api/purchase-orders`, `/api/invoices`, `/api/returns` |
| Inventory alerts (low-stock, reorder points) | `/api/inventory-alerts/*` |
| Payment reminders · Sales targets | `/api/payment-reminders`, `/api/sales-targets` |
| **Profit by retailer** (revenue − COGS) | `/api/profit/by-retailer` |
| WhatsApp messaging (Cloud API / Twilio) | `/api/whatsapp/*` |
| Data backup & restore · Excel import | `/api/backup/*` |

Plus: credit & cash-flow control, SKU efficiency tracking, brand-wise capital allocation,
role-based access control, Chart.js dashboards, and a mobile-responsive UI.

**Security** ([details](SECURITY.md))

- 24-layer security middleware; **Helmet** headers + CSP with nonces (no `unsafe-inline`)
- **TOTP-based 2FA** for admins (`speakeasy`); bcrypt password hashing; JWT auth
- Input validation, SQL-injection / XSS / SSRF / open-redirect protection, rate limiting
- Security-event notifications (email + Slack); **46 automated security tests, 100% passing**

## 🚀 Quickstart

### FORTRESS (self-hosted)

```bash
npm install
cp .env.example .env          # then set a real 64-byte hex SESSION_SECRET
npm start                     # → http://localhost:3000
```

### Docker (one command)

```bash
docker compose up --build     # → http://localhost:3000
```

### Cloud edition (MongoDB)

```bash
npm run cloud:dev             # server/ (MongoDB) + client/ (Vite)
```

> Seed demo data with `node scripts/seed-test-data.js`. **Change the seeded
> credentials before exposing any instance.**

## 🧪 Testing & Quality

```bash
npm run check                 # syntax-check every JS file
npm test                      # boots the server, runs 46 security tests, shuts down
```

CI runs the syntax check + security suite (server) and the client build on every push/PR —
see [`.github/workflows/ci.yml`](.github/workflows/ci.yml).

## 📁 Project Structure

```
src/        FORTRESS edition — config/, middleware/, routes/, utils/, server.js (SQLite)
server/     Cloud edition — Express + Mongoose models/routes (deployed on Vercel)
client/     React + Vite frontend
public/     FORTRESS static frontend (HTML/CSS/JS)
tests/      security.test.js (46 checks)
scripts/    run-security-tests.js, check-syntax.js, seed-test-data.js
docs/       Additional documentation
```

## 📡 Health Endpoints

`GET /api/health` · `/api/health/detailed` · `/api/health/ready` · `/api/health/live`

## 📄 License

[MIT](LICENSE) © Sayak Satpathi

<div align="center">

Built by **[Sayak Satpathi](https://github.com/sayaksatpathi)** · [Live Demo](https://sayak-traders.vercel.app)

</div>
