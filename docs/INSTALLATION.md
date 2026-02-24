# Installation & Setup Guide

## Prerequisites
- Node.js (v14 or higher)
- npm (comes with Node.js)

## Installation Steps

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Initialize Database**
   ```bash
   npm run init-db
   ```
   This creates the SQLite database with all required tables and default users.

3. **Start the Server**
   ```bash
   npm start
   ```
   The server will start on http://localhost:3000

4. **Login**
   Open your browser and go to http://localhost:3000
   
   Default credentials:
   - **Owner**: username: `owner`, password: `owner123`
   - **Accountant**: username: `accountant`, password: `acc123`
   - **Sales**: username: `sales`, password: `sales123`

   **IMPORTANT**: Change these passwords immediately after first login!

## Project Structure

```
business/
├── public/           # Frontend files (HTML, CSS, JS)
│   ├── index.html    # Login page
│   ├── dashboard.html
│   ├── retailers.html
│   ├── brands-skus.html
│   ├── dispatch.html
│   ├── credit-control.html
│   ├── profit-analysis.html
│   ├── weekly-review.html
│   ├── product-test.html
│   ├── excel-import.html
│   ├── css/
│   └── js/
├── scripts/
│   └── init-database.js
├── server.js         # Backend Express server
├── distributor.db    # SQLite database (created after init-db)
└── package.json
```

## Features

- **Page 0**: Login & Role Control
- **Page 1**: Owner Dashboard (business health check)
- **Page 2**: Retailer Master
- **Page 3**: Brand & SKU Master
- **Page 4**: Daily Dispatch / Bill Entry
- **Page 5**: Credit Control Panel
- **Page 6**: Profit Analysis
- **Page 7**: Weekly Review (Owner only)
- **Page 8**: New Product Test (Owner only)

## Data Backup

The SQLite database file (`distributor.db`) should be backed up regularly. You can simply copy this file to create backups.

## Troubleshooting

- **Port already in use**: Change PORT in server.js
- **Database errors**: Delete distributor.db and run `npm run init-db` again
- **Module not found**: Run `npm install` again

