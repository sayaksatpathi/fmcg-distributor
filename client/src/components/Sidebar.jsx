import React from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import './Sidebar.css'

const NAV = [
  { section: 'Overview' },
  { to: '/dashboard',         icon: '📊', label: 'Dashboard' },
  { section: 'Commerce' },
  { to: '/sales',             icon: '🛒', label: 'Sales' },
  { to: '/purchase-orders',   icon: '📋', label: 'Purchase Orders' },
  { to: '/returns',           icon: '↩️',  label: 'Returns' },
  { to: '/invoices',          icon: '🧾', label: 'Invoices' },
  { section: 'Customers' },
  { to: '/retailers',         icon: '🏪', label: 'Retailers' },
  { to: '/credit-control',    icon: '💳', label: 'Credit Control' },
  { to: '/payment-reminders', icon: '🔔', label: 'Payment Reminders' },
  { section: 'Catalogue' },
  { to: '/brands',            icon: '🏷️',  label: 'Brands' },
  { to: '/skus',              icon: '📦', label: 'SKUs / Products' },
  { to: '/inventory-alerts',  icon: '⚠️',  label: 'Inventory Alerts' },
  { section: 'Analytics' },
  { to: '/profit-analysis',   icon: '📈', label: 'Profit Analysis' },
  { to: '/reports',           icon: '📄', label: 'Reports' },
  { to: '/weekly-review',     icon: '📅', label: 'Weekly Review' },
  { to: '/sales-targets',     icon: '🎯', label: 'Sales Targets' },
  { section: 'Tools' },
  { to: '/product-tests',     icon: '🔬', label: 'Product Tests' },
  { to: '/excel-import',      icon: '📁', label: 'Excel Import' },
  { to: '/whatsapp',          icon: '💬', label: 'WhatsApp' },
  { to: '/backup',            icon: '💾', label: 'Backup / Restore' },
]

export default function Sidebar({ open, onClose }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => { logout(); navigate('/login') }

  return (
    <>
      {open && <div className="sidebar-overlay" onClick={onClose} />}
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <span className="logo-icon">🏭</span>
            <div>
              <div className="logo-title">FMCG Control</div>
              <div className="logo-sub">Distributor System</div>
            </div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {NAV.map((item, i) =>
            item.section
              ? <div key={i} className="nav-section-label">{item.section}</div>
              : (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                >
                  <span className="nav-icon">{item.icon}</span>
                  <span className="nav-label">{item.label}</span>
                </NavLink>
              )
          )}
        </nav>

        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">{user?.name?.[0]?.toUpperCase() || 'U'}</div>
            <div>
              <div className="user-name">{user?.name}</div>
              <div className="user-role">{user?.role}</div>
            </div>
          </div>
          <button className="sidebar-logout-btn" onClick={handleLogout}>🚪 Logout</button>
        </div>
      </aside>
    </>
  )
}
