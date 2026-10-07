<div align="center">

# 📦 FMCG Distributor Control System

### A comprehensive internal control system for FMCG distributors — retailers, inventory, sales, credit, and profit analysis, hardened with enterprise-grade security.

[![Live Demo](https://img.shields.io/badge/▶_Live_Demo-sayak--traders.vercel.app-22c55e?style=for-the-badge)](https://sayak-traders.vercel.app)

[![Node.js](https://img.shields.io/badge/Node.js-18+-5FA04E?style=flat-square&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4-000000?style=flat-square&logo=express&logoColor=white)](https://expressjs.com/)
[![SQLite](https://img.shields.io/badge/SQLite-003B57?style=flat-square&logo=sqlite&logoColor=white)](https://www.sqlite.org/)
[![Security](https://img.shields.io/badge/Security-24--layer_middleware_·_TOTP_2FA-brightgreen?style=flat-square&logo=letsencrypt&logoColor=white)](#-security-features)
[![Tests](https://img.shields.io/badge/Security_Tests-70+-success?style=flat-square)](#)

</div>

---

> **Note:** The app runs on Node.js + Express + SQLite with a vanilla-JS frontend (see [Tech Stack](#tech-stack)).

## 🚀 Highlights

### 🔐 Security Features
- **24-Layer Security Middleware** - Complete enterprise-grade protection
- **CSP with Nonces** - No unsafe-inline, dynamic nonce generation
- **TOTP-based 2FA** - Two-factor authentication for admin users
- **Security Event Notifications** - Real-time security monitoring
- **70+ Automated Security Tests** - Comprehensive test coverage

### 📊 New Business Features

| Feature | Description | Endpoint |
|---------|-------------|----------|
| **Reports & PDF Export** | Sales, profit, inventory, credit reports with export | `/api/reports/*` |
| **Purchase Orders** | Track incoming stock from suppliers | `/api/purchase-orders/*` |
| **Invoice Generation** | Generate and manage invoices for sales | `/api/invoices/*` |
| **Inventory Alerts** | Low stock warnings, reorder points | `/api/inventory-alerts/*` |
| **Payment Reminders** | Auto-remind retailers about dues | `/api/payment-reminders/*` |
| **Sales Targets** | Set & track sales targets by salesperson | `/api/sales-targets/*` |
| **Returns Management** | Handle product returns/damages | `/api/returns/*` |
| **Data Backup/Restore** | One-click database backup | `/api/backup/*` |
| **Dashboard Charts** | Visual graphs using Chart.js | Frontend |
| **WhatsApp Integration** | Send invoices via WhatsApp | `/api/whatsapp/*` |
| **Mobile Responsive** | Touch-friendly, responsive UI | CSS |

## Features
- Credit & Cash Flow Control
- SKU Efficiency Tracking
- Brand-wise Capital Allocation
- Profit Analysis (not turnover)
- Role-based Access Control
- Excel Import Functionality

## 📋 Prerequisites

- Node.js >= 18.0.0
- npm or yarn

## Installation

1. Install dependencies:
```bash
npm install
```

2. Copy environment file:
```bash
cp .env.example .env
```

3. Start the server:
```bash
npm start
```

## 🔧 Available Scripts

| Script | Description |
|--------|-------------|
| `npm start` | Start the production server |
| `npm run start:old` | Start the original server |
| `npm run dev` | Start with auto-restart on changes |
| `npm run init-db` | Initialize database tables |

## Default Login

- Owner: username: `owner`, password: `owner123`
- Accountant: username: `accountant`, password: `acc123`
- Sales: username: `sales`, password: `sales123`

**IMPORTANT:** Change default passwords after first login!

## 📁 Project Structure

```
├── config/               # Configuration management
├── middleware/           # Express middleware
│   ├── cors.js           # CORS configuration
│   ├── errorHandler.js   # Global error handling
│   ├── logger.js         # Request logging
│   ├── rateLimiter.js    # Rate limiting
│   └── validators.js     # Input validation
├── routes/               # API route modules
├── scripts/              # Database scripts
├── utils/                # Utility functions
├── public/               # Frontend files
├── uploads/              # File uploads
├── server.new.js         # New improved server
└── server.js             # Original server (legacy)
```

## Tech Stack
- Frontend: HTML + CSS + Vanilla JavaScript
- Backend: Node.js + Express
- Database: SQLite

## 📡 API Health Endpoints

- `GET /api/health` - Basic health check
- `GET /api/health/detailed` - Detailed health with DB stats
- `GET /api/health/ready` - Readiness probe
- `GET /api/health/live` - Liveness probe

## Pages
0. Login & Role Control
1. Owner Dashboard
2. Retailer Master
3. Brand & SKU Master
4. Daily Dispatch / Bill Entry
5. Credit Control Panel
6. Profit Analysis
7. Weekly Review (Owner Only)
8. New Product Test

