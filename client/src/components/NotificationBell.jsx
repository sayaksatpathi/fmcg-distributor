import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'
import './NotificationBell.css'

const POLL_INTERVAL = 30_000

const ICONS = {
  inventory: '📦',
  credit:    '💳',
  payment:   '🔔',
  return:    '↩️',
  sale:      '🛒',
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr)
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState([])
  const [counts, setCounts]               = useState({ total: 0, errors: 0, warnings: 0, infos: 0 })
  const [open, setOpen]                   = useState(false)
  const [loading, setLoading]             = useState(false)
  const [filter, setFilter]               = useState('all')
  const [readIds, setReadIds]             = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('notif_read') || '[]')) }
    catch { return new Set() }
  })
  const [dismissedIds, setDismissedIds]   = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('notif_dismissed') || '[]')) }
    catch { return new Set() }
  })
  const panelRef = useRef(null)
  const navigate = useNavigate()

  const fetchNotifications = useCallback(async () => {
    try {
      const { data } = await api.get('/notifications')
      setNotifications(data.notifications || [])
      setCounts(data.counts || { total: 0, errors: 0, warnings: 0, infos: 0 })
    } catch {
      // silently ignore polling errors
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    setLoading(true)
    fetchNotifications()
    const id = setInterval(fetchNotifications, POLL_INTERVAL)
    return () => clearInterval(id)
  }, [fetchNotifications])

  useEffect(() => {
    if (!open) return
    const handler = e => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Compute derived state
  const visible = notifications.filter(n => !dismissedIds.has(n.id))
  const unreadCount = visible.filter(n => !readIds.has(n.id)).length
  const visibleCounts = {
    total:    visible.length,
    errors:   visible.filter(n => n.severity === 'error').length,
    warnings: visible.filter(n => n.severity === 'warning').length,
    infos:    visible.filter(n => n.severity === 'info').length,
  }
  const filtered = filter === 'all' ? visible : visible.filter(n => n.severity === filter)

  // Handlers
  const markAllRead = () => {
    const ids = new Set(notifications.map(n => n.id))
    setReadIds(ids)
    localStorage.setItem('notif_read', JSON.stringify([...ids]))
  }

  const markRead = id => {
    const next = new Set(readIds).add(id)
    setReadIds(next)
    localStorage.setItem('notif_read', JSON.stringify([...next]))
  }

  const dismiss = (e, id) => {
    e.stopPropagation()
    const next = new Set(dismissedIds).add(id)
    setDismissedIds(next)
    localStorage.setItem('notif_dismissed', JSON.stringify([...next]))
  }

  const clearAll = () => {
    const ids = new Set(visible.map(n => n.id))
    const next = new Set([...dismissedIds, ...ids])
    setDismissedIds(next)
    localStorage.setItem('notif_dismissed', JSON.stringify([...next]))
  }

  const handleClick = notif => {
    markRead(notif.id)
    setOpen(false)
    navigate(notif.link)
  }

  return (
    <div className="notif-wrap" ref={panelRef}>
      {/* Bell button */}
      <button
        className={`notif-bell ${open ? 'active' : ''} ${counts.errors > 0 ? 'has-error' : ''}`}
        onClick={() => setOpen(o => !o)}
        title="Notifications"
        aria-label={`${unreadCount} unread notifications`}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        {unreadCount > 0 && (
          <span className={`notif-badge ${counts.errors > 0 ? 'badge-error' : 'badge-warning'}`}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
        {loading && <span className="notif-loading-ring" />}
      </button>

      {/* Panel */}
      {open && (
        <div className="notif-panel">
          {/* Header */}
          <div className="notif-panel-header">
            <div>
              <div className="notif-panel-title">Notifications</div>
              <div className="notif-panel-sub">{visibleCounts.total} active alerts</div>
            </div>
            <div className="notif-header-actions">
              <button
                className="notif-refresh-btn"
                onClick={() => { setLoading(true); fetchNotifications() }}
                title="Refresh"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <polyline points="23 4 23 10 17 10"/>
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                </svg>
              </button>
              {unreadCount > 0 && (
                <button className="notif-mark-all-btn" onClick={markAllRead}>Mark all read</button>
              )}
              {visible.length > 0 && (
                <button className="notif-clear-all-btn" onClick={clearAll}>Clear all</button>
              )}
            </div>
          </div>

          {/* Filter tabs */}
          <div className="notif-filters">
            {['all', 'error', 'warning', 'info'].map(f => (
              <button
                key={f}
                className={`notif-filter-btn ${filter === f ? 'active' : ''}`}
                onClick={() => setFilter(f)}
              >
                {f === 'all'     && `All ${visibleCounts.total}`}
                {f === 'error'   && `🔴 ${visibleCounts.errors}`}
                {f === 'warning' && `🟡 ${visibleCounts.warnings}`}
                {f === 'info'    && `🔵 ${visibleCounts.infos}`}
              </button>
            ))}
          </div>

          {/* List */}
          <div className="notif-list">
            {filtered.length === 0 ? (
              <div className="notif-empty">
                <div className="notif-empty-icon">✅</div>
                <div>No {filter === 'all' ? '' : filter} alerts right now</div>
              </div>
            ) : (
              filtered.map(n => (
                <div
                  key={n.id}
                  className={`notif-item severity-${n.severity} ${readIds.has(n.id) ? 'read' : 'unread'}`}
                  onClick={() => handleClick(n)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => e.key === 'Enter' && handleClick(n)}
                >
                  <div className={`notif-item-icon icon-${n.type}`}>
                    {ICONS[n.type] || '📋'}
                  </div>
                  <div className="notif-item-body">
                    <div className="notif-item-title">{n.title}</div>
                    <div className="notif-item-msg">{n.message}</div>
                    <div className="notif-item-time">{timeAgo(n.time)}</div>
                  </div>
                  {!readIds.has(n.id) && <span className="notif-unread-dot" />}
                  <button
                    className="notif-dismiss-btn"
                    onClick={e => dismiss(e, n.id)}
                    title="Dismiss"
                    aria-label="Dismiss notification"
                  >✕</button>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="notif-panel-footer">
            <span className="notif-footer-note">🔄 Auto-refreshes every 30s</span>
          </div>
        </div>
      )}
    </div>
  )
}
