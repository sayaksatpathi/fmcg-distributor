import React, { useEffect, useState } from 'react'
import api from '../api'
import toast from 'react-hot-toast'

export default function InventoryAlerts() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    try { const { data: d } = await api.get('/inventory-alerts'); setData(d) }
    catch { toast.error('Failed to load') } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  if (loading) return <div className="loading-center"><div className="spinner" /></div>

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Inventory Alerts</h1>
        <button className="btn btn-secondary" onClick={load}>🔄 Refresh</button>
      </div>
      <div className="grid grid-3" style={{ marginBottom: 24 }}>
        <div className="stat-card" style={{ borderLeft: '4px solid var(--danger)' }}>
          <div className="stat-value">{data?.outOfStock?.length || 0}</div>
          <div className="stat-label">Out of Stock</div>
        </div>
        <div className="stat-card" style={{ borderLeft: '4px solid var(--warning)' }}>
          <div className="stat-value">{data?.critical?.length || 0}</div>
          <div className="stat-label">Critical (≤50% min)</div>
        </div>
        <div className="stat-card" style={{ borderLeft: '4px solid var(--info)' }}>
          <div className="stat-value">{data?.warning?.length || 0}</div>
          <div className="stat-label">Low Stock Warning</div>
        </div>
      </div>
      <div className="card">
        <div className="table-wrapper">
          <table>
            <thead><tr><th>Product</th><th>Code</th><th>Brand</th><th>Current Stock</th><th>Min Stock</th><th>Alert Level</th></tr></thead>
            <tbody>
              {(!data?.lowStock?.length) && <tr><td colSpan={6}><div className="empty-state"><div className="empty-icon">✅</div><p>All stock levels are healthy!</p></div></td></tr>}
              {data?.lowStock?.map(s => (
                <tr key={s._id} style={{ background: s.stock === 0 ? '#fff1f2' : s.stock <= s.minStock / 2 ? '#fff7ed' : '#fefce8' }}>
                  <td><strong>{s.name}</strong><br /><span className="text-muted text-sm">{s.unitSize}</span></td>
                  <td><code style={{ fontSize: 12, background: 'var(--bg)', padding: '2px 6px', borderRadius: 4 }}>{s.code}</code></td>
                  <td className="text-muted">{s.brand?.name}</td>
                  <td style={{ fontWeight: 700, color: s.stock === 0 ? 'var(--danger)' : 'var(--warning)', fontSize: 18 }}>{s.stock} {s.unit}</td>
                  <td className="text-muted">{s.minStock}</td>
                  <td>
                    {s.stock === 0
                      ? <span className="badge badge-danger">🔴 Out of Stock</span>
                      : s.stock <= s.minStock / 2
                        ? <span className="badge badge-warning">🟠 Critical</span>
                        : <span className="badge" style={{ background: '#fef9c3', color: '#854d0e' }}>🟡 Low Stock</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
