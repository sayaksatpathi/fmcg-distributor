import React from 'react'
import NotificationBell from './NotificationBell'
import './Topbar.css'

export default function Topbar({ darkMode, onToggleDark }) {
  return (
    <header className="topbar">
      <div />
      <div className="topbar-right">
        <NotificationBell />
        <button className="btn-icon" onClick={onToggleDark} title="Toggle dark mode">
          {darkMode ? '☀️' : '🌙'}
        </button>
      </div>
    </header>
  )
}
