import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './context/AuthContext'
import PrivateRoute from './components/PrivateRoute'
import Layout from './components/Layout'

// Pages
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Retailers from './pages/Retailers'
import Brands from './pages/Brands'
import SKUs from './pages/SKUs'
import Sales from './pages/Sales'
import PurchaseOrders from './pages/PurchaseOrders'
import Returns from './pages/Returns'
import Invoices from './pages/Invoices'
import CreditControl from './pages/CreditControl'
import SalesTargets from './pages/SalesTargets'
import PaymentReminders from './pages/PaymentReminders'
import Reports from './pages/Reports'
import WeeklyReview from './pages/WeeklyReview'
import ProfitAnalysis from './pages/ProfitAnalysis'
import InventoryAlerts from './pages/InventoryAlerts'
import ProductTests from './pages/ProductTests'
import ExcelImport from './pages/ExcelImport'
import Backup from './pages/Backup'
import Whatsapp from './pages/Whatsapp'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" toastOptions={{ duration: 3500 }} />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<PrivateRoute />}>
            <Route element={<Layout />}>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard"         element={<Dashboard />} />
              <Route path="/retailers"         element={<Retailers />} />
              <Route path="/brands"            element={<Brands />} />
              <Route path="/skus"              element={<SKUs />} />
              <Route path="/sales"             element={<Sales />} />
              <Route path="/purchase-orders"   element={<PurchaseOrders />} />
              <Route path="/returns"           element={<Returns />} />
              <Route path="/invoices"          element={<Invoices />} />
              <Route path="/credit-control"    element={<CreditControl />} />
              <Route path="/sales-targets"     element={<SalesTargets />} />
              <Route path="/payment-reminders" element={<PaymentReminders />} />
              <Route path="/reports"           element={<Reports />} />
              <Route path="/weekly-review"     element={<WeeklyReview />} />
              <Route path="/profit-analysis"   element={<ProfitAnalysis />} />
              <Route path="/inventory-alerts"  element={<InventoryAlerts />} />
              <Route path="/product-tests"     element={<ProductTests />} />
              <Route path="/excel-import"      element={<ExcelImport />} />
              <Route path="/backup"            element={<Backup />} />
              <Route path="/whatsapp"          element={<Whatsapp />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
