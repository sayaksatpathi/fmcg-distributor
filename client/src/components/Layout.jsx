import React, { useState, useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import './Layout.css'

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') === 'dark')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light')
    localStorage.setItem('theme', darkMode ? 'dark' : 'light')
  }, [darkMode])

  return (
    <div className={`app-layout ${sidebarOpen ? '' : 'sidebar-collapsed'}`}>
      {/* Fixed hamburger — always top-left */}
      <button
        className={`sidebar-toggle-btn ${sidebarOpen ? 'sidebar-open' : ''}`}
        onClick={() => setSidebarOpen(o => !o)}
        title="Toggle sidebar"
        aria-label="Toggle sidebar"
      >
        <span /><span /><span />
      </button>

      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="main-area">
        <Topbar
          darkMode={darkMode}
          onToggleDark={() => setDarkMode(d => !d)}
        />
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
