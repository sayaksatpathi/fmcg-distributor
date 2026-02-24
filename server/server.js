require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const path = require('path');

const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorHandler');
const authMiddleware = require('./middleware/auth');

// ─── Routes ──────────────────────────────────────────────────────────────────
const authRoutes          = require('./routes/auth');
const retailerRoutes      = require('./routes/retailers');
const brandRoutes         = require('./routes/brands');
const skuRoutes           = require('./routes/skus');
const salesRoutes         = require('./routes/sales');
const purchaseOrderRoutes = require('./routes/purchaseOrders');
const returnRoutes        = require('./routes/returns');
const invoiceRoutes       = require('./routes/invoices');
const creditControlRoutes = require('./routes/creditControl');
const salesTargetRoutes   = require('./routes/salesTargets');
const paymentRoutes       = require('./routes/paymentReminders');
const reportRoutes        = require('./routes/reports');
const dashboardRoutes     = require('./routes/dashboard');
const importRoutes        = require('./routes/import');
const backupRoutes        = require('./routes/backup');
const weeklyReviewRoutes  = require('./routes/weeklyReview');
const profitRoutes        = require('./routes/profit');
const inventoryRoutes     = require('./routes/inventoryAlerts');
const whatsappRoutes      = require('./routes/whatsapp');
const productTestRoutes   = require('./routes/productTests');
const notificationRoutes  = require('./routes/notifications');
const healthRoutes        = require('./routes/health');

// ─── App Init ─────────────────────────────────────────────────────────────────
const app = express();
connectDB();

// ─── Global Middleware ────────────────────────────────────────────────────────
app.use(helmet());
app.use(compression());
app.use(morgan(process.env.NODE_ENV === 'development' ? 'dev' : 'combined'));

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(mongoSanitize()); // Prevent NoSQL injection

// Global rate limiter
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500,
  message: { message: 'Too many requests, please try again later.' },
}));

// Static uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/auth',             authRoutes);
app.use('/api/health',           healthRoutes);
app.use('/api/retailers',        authMiddleware, retailerRoutes);
app.use('/api/brands',           authMiddleware, brandRoutes);
app.use('/api/skus',             authMiddleware, skuRoutes);
app.use('/api/sales',            authMiddleware, salesRoutes);
app.use('/api/purchase-orders',  authMiddleware, purchaseOrderRoutes);
app.use('/api/returns',          authMiddleware, returnRoutes);
app.use('/api/invoices',         authMiddleware, invoiceRoutes);
app.use('/api/credit-control',   authMiddleware, creditControlRoutes);
app.use('/api/sales-targets',    authMiddleware, salesTargetRoutes);
app.use('/api/payment-reminders',authMiddleware, paymentRoutes);
app.use('/api/reports',          authMiddleware, reportRoutes);
app.use('/api/dashboard',        authMiddleware, dashboardRoutes);
app.use('/api/import',           authMiddleware, importRoutes);
app.use('/api/backup',           authMiddleware, backupRoutes);
app.use('/api/weekly-review',    authMiddleware, weeklyReviewRoutes);
app.use('/api/profit',           authMiddleware, profitRoutes);
app.use('/api/inventory-alerts', authMiddleware, inventoryRoutes);
app.use('/api/notifications',    authMiddleware, notificationRoutes);
app.use('/api/whatsapp',         authMiddleware, whatsappRoutes);
app.use('/api/product-tests',    authMiddleware, productTestRoutes);

// ─── 404 ──────────────────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ message: 'Route not found' }));

// ─── Error Handler ────────────────────────────────────────────────────────────
app.use(errorHandler);

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 FMCG Server running on http://localhost:${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
});
