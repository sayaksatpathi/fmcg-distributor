import React, { useEffect, useState } from 'react'
import api from '../api'
import toast from 'react-hot-toast'

const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const now = new Date()

export default function SalesTargets() {
  const [targets, setTargets] = useState([])
  const [progress, setProgress] = useState(null)
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ month: now.getMonth() + 1, year: now.getFullYear(), target: '', category: '', notes: '' })

  const load = async () => {
    try {
      const [t, p] = await Promise.all([
        api.get('/sales-targets'),
        api.get(`/sales-targets/progress/${now.getMonth() + 1}/${now.getFullYear()}`)
      ])
      setTargets(t.data); setProgress(p.data)
    } catch { toast.error('Failed to load') } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const handleSave = async (e) => {
    e.preventDefault()
    try {
      await api.post('/sales-targets', { ...form, target: Number(form.target) })
      toast.success('Target set!'); setModal(false); load()
    } catch (err) { toast.error(err.response?.data?.message || 'Error') }
  }

  const handleDelete = async (id) => {
    try { await api.delete(`/sales-targets/${id}`); toast.success('Deleted'); load() }
    catch { toast.error('Delete failed') }
  }

  const currentMonthTargets = targets.filter(t => t.month === now.getMonth() + 1 && t.year === now.getFullYear())
  const totalTarget = currentMonthTargets.reduce((a, t) => a + t.target, 0)
  const achieved = progress?.achieved || 0
  const pct = totalTarget > 0 ? Math.round((achieved / totalTarget) * 100) : 0

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Sales Targets</h1>
        <button className="btn btn-primary" onClick={() => setModal(true)}>+ Set Target</button>
      </div>

      {/* This Month Progress */}
      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ marginBottom: 16, fontWeight: 700 }}>This Month — {MONTHS[now.getMonth()]} {now.getFullYear()}</h3>
        <div className="grid grid-3" style={{ marginBottom: 16 }}>
          <div className="stat-card"><div className="stat-value">{fmt(totalTarget)}</div><div className="stat-label">Target</div></div>
          <div className="stat-card"><div className="stat-value" style={{ color: 'var(--success)' }}>{fmt(achieved)}</div><div className="stat-label">Achieved</div></div>
          <div className="stat-card"><div className="stat-value" style={{ color: pct >= 100 ? 'var(--success)' : pct >= 70 ? 'var(--warning)' : 'var(--danger)' }}>{pct}%</div><div className="stat-label">Progress</div></div>
        </div>
        <div style={{ background: 'var(--bg)', borderRadius: 8, height: 16, overflow: 'hidden' }}>
          <div style={{ width: `${Math.min(100, pct)}%`, background: pct >= 100 ? 'var(--success)' : pct >= 70 ? 'var(--warning)' : 'var(--primary)', height: '100%', borderRadius: 8, transition: 'width 0.5s ease' }} />
        </div>
      </div>

      {loading ? <div className="loading-center"><div className="spinner" /></div> : (
        <div className="card">
          <div className="table-wrapper">
            <table>
              <thead><tr><th>Month</th><th>Year</th><th>Target</th><th>Category</th><th>Notes</th><th>Actions</th></tr></thead>
              <tbody>
                {targets.length === 0 && <tr><td colSpan={6}><div className="empty-state"><div className="empty-icon">🎯</div><p>No targets set</p></div></td></tr>}
                {targets.map(t => (
                  <tr key={t._id}>
                    <td><strong>{MONTHS[t.month - 1]}</strong></td>
                    <td>{t.year}</td>
                    <td style={{ fontWeight: 700, color: 'var(--primary)' }}>{fmt(t.target)}</td>
                    <td className="text-muted">{t.category || '—'}</td>
                    <td className="text-muted">{t.notes || '—'}</td>
                    <td><button className="btn-icon" onClick={() => handleDelete(t._id)}>🗑️</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(false)}>
          <div className="modal" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">Set Sales Target</h2>
            <form onSubmit={handleSave}>
              <div className="grid grid-2">
                <div className="form-group"><label className="form-label">Month *</label>
                  <select className="form-control" value={form.month} onChange={e => setForm(p => ({ ...p, month: Number(e.target.value) }))}>
                    {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                  </select>
                </div>
                <div className="form-group"><label className="form-label">Year *</label><input className="form-control" type="number" value={form.year} onChange={e => setForm(p => ({ ...p, year: Number(e.target.value) }))} /></div>
                <div className="form-group"><label className="form-label">Target Amount (₹) *</label><input className="form-control" type="number" required min="0" value={form.target} onChange={e => setForm(p => ({ ...p, target: e.target.value }))} /></div>
                <div className="form-group"><label className="form-label">Category</label><input className="form-control" value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} /></div>
              </div>
              <div className="form-group"><label className="form-label">Notes</label><textarea className="form-control" rows={2} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} /></div>
              <div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button><button type="submit" className="btn btn-primary">Set Target</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
