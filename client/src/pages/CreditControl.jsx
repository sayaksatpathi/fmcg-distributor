import React, { useEffect, useState } from 'react'
import api from '../api'
import toast from 'react-hot-toast'

const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`

export default function CreditControl() {
  const [retailers, setRetailers] = useState([])
  const [loading, setLoading] = useState(true)
  const [payModal, setPayModal] = useState(null)
  const [payAmount, setPayAmount] = useState('')
  const [limitModal, setLimitModal] = useState(null)
  const [newLimit, setNewLimit] = useState('')

  const load = async () => {
    try { const { data } = await api.get('/credit-control'); setRetailers(data) }
    catch { toast.error('Failed to load') } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const handlePayment = async () => {
    try {
      await api.post(`/credit-control/${payModal._id}/payment`, { amount: Number(payAmount) })
      toast.success('Payment recorded!'); setPayModal(null); setPayAmount(''); load()
    } catch { toast.error('Failed') }
  }

  const handleLimitUpdate = async () => {
    try {
      await api.put(`/credit-control/${limitModal._id}/limit`, { creditLimit: Number(newLimit) })
      toast.success('Credit limit updated!'); setLimitModal(null); setNewLimit(''); load()
    } catch { toast.error('Failed') }
  }

  const total = retailers.reduce((a, r) => a + (r.outstandingBalance || 0), 0)

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Credit Control</h1>
        <div className="card" style={{ padding: '12px 20px', background: 'var(--danger)', color: '#fff' }}>
          <div style={{ fontSize: 12 }}>Total Outstanding</div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{fmt(total)}</div>
        </div>
      </div>
      {loading ? <div className="loading-center"><div className="spinner" /></div> : (
        <div className="card">
          <div className="table-wrapper">
            <table>
              <thead><tr><th>Retailer</th><th>Area</th><th>Credit Limit</th><th>Outstanding</th><th>Utilisation</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {retailers.length === 0 && <tr><td colSpan={7}><div className="empty-state"><div className="empty-icon">💳</div><p>No credit data</p></div></td></tr>}
                {retailers.map(r => {
                  const util = r.creditLimit > 0 ? Math.round((r.outstandingBalance / r.creditLimit) * 100) : 0
                  const overLimit = r.outstandingBalance > r.creditLimit && r.creditLimit > 0
                  return (
                    <tr key={r._id}>
                      <td><strong>{r.name}</strong><br /><span className="text-muted text-sm">{r.phone}</span></td>
                      <td className="text-muted">{r.area}</td>
                      <td>{fmt(r.creditLimit)}</td>
                      <td style={{ fontWeight: 700, color: r.outstandingBalance > 0 ? 'var(--danger)' : 'var(--success)' }}>{fmt(r.outstandingBalance)}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ flex: 1, background: 'var(--bg)', borderRadius: 4, height: 8, overflow: 'hidden' }}>
                            <div style={{ width: `${Math.min(100, util)}%`, background: util > 90 ? 'var(--danger)' : util > 70 ? 'var(--warning)' : 'var(--success)', height: '100%', borderRadius: 4 }} />
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 600, color: overLimit ? 'var(--danger)' : 'var(--text-muted)' }}>{util}%</span>
                        </div>
                      </td>
                      <td><span className={`badge badge-${overLimit ? 'danger' : r.outstandingBalance > 0 ? 'warning' : 'success'}`}>{overLimit ? 'Over Limit' : r.outstandingBalance > 0 ? 'Pending' : 'Clear'}</span></td>
                      <td>
                        <div className="flex gap-2">
                          {r.outstandingBalance > 0 && <button className="btn btn-sm btn-success" onClick={() => { setPayModal(r); setPayAmount('') }}>💰 Pay</button>}
                          <button className="btn btn-sm btn-secondary" onClick={() => { setLimitModal(r); setNewLimit(r.creditLimit || '') }}>✏️ Limit</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {payModal && (
        <div className="modal-overlay" onClick={() => setPayModal(null)}>
          <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">Record Payment</h2>
            <p style={{ marginBottom: 16 }}><strong>{payModal.name}</strong><br />Outstanding: <span style={{ color: 'var(--danger)', fontWeight: 700 }}>{fmt(payModal.outstandingBalance)}</span></p>
            <div className="form-group"><label className="form-label">Payment Amount (₹)</label><input className="form-control" type="number" min="0" value={payAmount} onChange={e => setPayAmount(e.target.value)} placeholder={payModal.outstandingBalance} autoFocus /></div>
            <div className="modal-footer"><button className="btn btn-secondary" onClick={() => setPayModal(null)}>Cancel</button><button className="btn btn-success" onClick={handlePayment} disabled={!payAmount}>Confirm</button></div>
          </div>
        </div>
      )}
      {limitModal && (
        <div className="modal-overlay" onClick={() => setLimitModal(null)}>
          <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">Update Credit Limit</h2>
            <p style={{ marginBottom: 16 }}><strong>{limitModal.name}</strong><br />Current Limit: {fmt(limitModal.creditLimit)}</p>
            <div className="form-group"><label className="form-label">New Credit Limit (₹)</label><input className="form-control" type="number" min="0" value={newLimit} onChange={e => setNewLimit(e.target.value)} autoFocus /></div>
            <div className="modal-footer"><button className="btn btn-secondary" onClick={() => setLimitModal(null)}>Cancel</button><button className="btn btn-primary" onClick={handleLimitUpdate}>Update</button></div>
          </div>
        </div>
      )}
    </div>
  )
}
