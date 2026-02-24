import React, { useEffect, useState } from 'react'
import api from '../api'
import toast from 'react-hot-toast'

const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`
const INIT = { retailer: '', amount: '', dueDate: '', notes: '' }

export default function PaymentReminders() {
  const [reminders, setReminders] = useState([])
  const [retailers, setRetailers] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(INIT)

  const load = async () => {
    try {
      const [r, ret] = await Promise.all([api.get('/payment-reminders'), api.get('/retailers', { params: { limit: 200 } })])
      setReminders(r.data); setRetailers(ret.data.retailers || [])
    } catch { toast.error('Failed to load') } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const handleSave = async (e) => {
    e.preventDefault()
    try {
      const retailerName = retailers.find(r => r._id === form.retailer)?.name
      await api.post('/payment-reminders', { ...form, retailerName, amount: Number(form.amount) })
      toast.success('Reminder added!'); setModal(false); load()
    } catch (err) { toast.error(err.response?.data?.message || 'Error') }
  }

  const markPaid = async (id) => {
    try { await api.put(`/payment-reminders/${id}`, { status: 'paid' }); toast.success('Marked paid!'); load() }
    catch { toast.error('Failed') }
  }

  const sendReminder = async (r) => {
    const waUrl = `https://api.whatsapp.com/send?phone=91${r.retailer?.phone || ''}&text=${encodeURIComponent(`Dear ${r.retailerName}, This is a reminder for payment of ${fmt(r.amount)} due on ${new Date(r.dueDate).toLocaleDateString('en-IN')}. Please arrange payment. Thank you.`)}`
    window.open(waUrl, '_blank')
    try { await api.put(`/payment-reminders/${r._id}`, { status: 'sent', sentAt: new Date() }) ; load() }
    catch {}
  }

  const overdue = reminders.filter(r => r.status !== 'paid' && new Date(r.dueDate) < new Date())

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Payment Reminders</h1>
        <button className="btn btn-primary" onClick={() => { setForm(INIT); setModal(true) }}>+ Add Reminder</button>
      </div>
      {overdue.length > 0 && (
        <div className="card" style={{ background: '#fff1f2', border: '1px solid #fecdd3', marginBottom: 16 }}>
          <p style={{ color: 'var(--danger)', fontWeight: 600 }}>⚠️ {overdue.length} payment{overdue.length > 1 ? 's' : ''} overdue!</p>
        </div>
      )}
      {loading ? <div className="loading-center"><div className="spinner" /></div> : (
        <div className="card">
          <div className="table-wrapper">
            <table>
              <thead><tr><th>Retailer</th><th>Amount</th><th>Due Date</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {reminders.length === 0 && <tr><td colSpan={5}><div className="empty-state"><div className="empty-icon">🔔</div><p>No reminders</p></div></td></tr>}
                {reminders.map(r => {
                  const isOverdue = r.status !== 'paid' && new Date(r.dueDate) < new Date()
                  return (
                    <tr key={r._id} style={{ background: isOverdue ? '#fff1f2' : '' }}>
                      <td><strong>{r.retailerName}</strong></td>
                      <td style={{ fontWeight: 700 }}>{fmt(r.amount)}</td>
                      <td style={{ color: isOverdue ? 'var(--danger)' : 'var(--text)' }}>{new Date(r.dueDate).toLocaleDateString('en-IN')}{isOverdue ? ' 🔴' : ''}</td>
                      <td><span className={`badge badge-${r.status === 'paid' ? 'success' : r.status === 'sent' ? 'info' : isOverdue ? 'danger' : 'warning'}`}>{isOverdue && r.status !== 'paid' ? 'Overdue' : r.status}</span></td>
                      <td>
                        <div className="flex gap-2">
                          {r.status !== 'paid' && <>
                            <button className="btn btn-sm btn-success" onClick={() => markPaid(r._id)}>✅ Paid</button>
                            <button className="btn btn-sm btn-secondary" onClick={() => sendReminder(r)}>💬 WhatsApp</button>
                          </>}
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
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(false)}>
          <div className="modal" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">Add Payment Reminder</h2>
            <form onSubmit={handleSave}>
              <div className="form-group"><label className="form-label">Retailer *</label>
                <select className="form-control" required value={form.retailer} onChange={e => setForm(p => ({ ...p, retailer: e.target.value }))}>
                  <option value="">Select retailer</option>
                  {retailers.map(r => <option key={r._id} value={r._id}>{r.name} — {fmt(r.outstandingBalance)} outstanding</option>)}
                </select>
              </div>
              <div className="grid grid-2">
                <div className="form-group"><label className="form-label">Amount (₹) *</label><input className="form-control" type="number" required min="0" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} /></div>
                <div className="form-group"><label className="form-label">Due Date *</label><input className="form-control" type="date" required value={form.dueDate} onChange={e => setForm(p => ({ ...p, dueDate: e.target.value }))} /></div>
              </div>
              <div className="form-group"><label className="form-label">Notes</label><textarea className="form-control" rows={2} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} /></div>
              <div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button><button type="submit" className="btn btn-primary">Add Reminder</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
