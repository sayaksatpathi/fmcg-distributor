import React, { useEffect, useState } from 'react'
import api from '../api'
import toast from 'react-hot-toast'

const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`
const INIT = { retailer: '', items: [{ skuName: '', quantity: 1, price: 0 }], type: 'damage', notes: '' }

export default function Returns() {
  const [returns, setReturns] = useState([])
  const [retailers, setRetailers] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(INIT)

  const load = async () => {
    try {
      const [r, ret] = await Promise.all([api.get('/returns'), api.get('/retailers', { params: { limit: 200 } })])
      setReturns(r.data); setRetailers(ret.data.retailers || [])
    } catch { toast.error('Failed to load') } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const addItem = () => setForm(p => ({ ...p, items: [...p.items, { skuName: '', quantity: 1, price: 0 }] }))
  const removeItem = (i) => setForm(p => ({ ...p, items: p.items.filter((_, idx) => idx !== i) }))
  const upd = (i, k, v) => setForm(p => { const items = [...p.items]; items[i] = { ...items[i], [k]: v }; return { ...p, items } })

  const getTotal = () => form.items.reduce((a, i) => a + Number(i.quantity || 0) * Number(i.price || 0), 0)

  const handleSave = async (e) => {
    e.preventDefault()
    try {
      const items = form.items.filter(i => i.skuName).map(i => ({ skuName: i.skuName, quantity: Number(i.quantity), price: Number(i.price), total: Number(i.quantity) * Number(i.price) }))
      const retailerName = retailers.find(r => r._id === form.retailer)?.name || ''
      await api.post('/returns', { ...form, items, retailerName, totalAmount: getTotal() })
      toast.success('Return created!'); setModal(false); load()
    } catch (err) { toast.error(err.response?.data?.message || 'Error') }
  }

  const handleApprove = async (id) => {
    try { await api.put(`/returns/${id}`, { status: 'approved' }); toast.success('Approved!'); load() }
    catch { toast.error('Failed') }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Returns</h1>
        <button className="btn btn-primary" onClick={() => { setForm(INIT); setModal(true) }}>+ New Return</button>
      </div>
      {loading ? <div className="loading-center"><div className="spinner" /></div> : (
        <div className="card">
          <div className="table-wrapper">
            <table>
              <thead><tr><th>Return #</th><th>Retailer</th><th>Type</th><th>Amount</th><th>Status</th><th>Date</th><th>Actions</th></tr></thead>
              <tbody>
                {returns.length === 0 && <tr><td colSpan={7}><div className="empty-state"><div className="empty-icon">↩️</div><p>No returns</p></div></td></tr>}
                {returns.map(r => (
                  <tr key={r._id}>
                    <td><strong>{r.returnNumber}</strong></td>
                    <td>{r.retailerName || r.retailer?.name}</td>
                    <td><span className="badge badge-neutral">{r.type}</span></td>
                    <td style={{ fontWeight: 700 }}>{fmt(r.totalAmount)}</td>
                    <td><span className={`badge badge-${r.status === 'approved' ? 'success' : r.status === 'rejected' ? 'danger' : 'warning'}`}>{r.status}</span></td>
                    <td className="text-muted">{new Date(r.returnDate).toLocaleDateString('en-IN')}</td>
                    <td>{r.status === 'pending' && <button className="btn btn-sm btn-success" onClick={() => handleApprove(r._id)}>✅ Approve</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(false)}>
          <div className="modal" style={{ maxWidth: 700 }} onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">New Return</h2>
            <form onSubmit={handleSave}>
              <div className="grid grid-2">
                <div className="form-group">
                  <label className="form-label">Retailer *</label>
                  <select className="form-control" required value={form.retailer} onChange={e => setForm(p => ({ ...p, retailer: e.target.value }))}>
                    <option value="">Select retailer</option>
                    {retailers.map(r => <option key={r._id} value={r._id}>{r.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Return Type</label>
                  <select className="form-control" value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}>
                    <option value="damage">Damage</option><option value="expiry">Expiry</option><option value="quality">Quality Issue</option><option value="wrong_item">Wrong Item</option><option value="other">Other</option>
                  </select>
                </div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <div className="flex justify-between items-center" style={{ marginBottom: 10 }}>
                  <label className="form-label" style={{ marginBottom: 0 }}>Items</label>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={addItem}>+ Add</button>
                </div>
                {form.items.map((item, i) => (
                  <div key={i} className="grid" style={{ gridTemplateColumns: '3fr 1fr 1fr auto', gap: 8, marginBottom: 8 }}>
                    <input className="form-control" placeholder="Product name" value={item.skuName} onChange={e => upd(i, 'skuName', e.target.value)} />
                    <input className="form-control" type="number" min="1" placeholder="Qty" value={item.quantity} onChange={e => upd(i, 'quantity', e.target.value)} />
                    <input className="form-control" type="number" min="0" placeholder="Price" value={item.price} onChange={e => upd(i, 'price', e.target.value)} />
                    {form.items.length > 1 && <button type="button" className="btn-icon" onClick={() => removeItem(i)}>🗑️</button>}
                  </div>
                ))}
                <div style={{ textAlign: 'right', fontWeight: 700 }}>Total: {fmt(getTotal())}</div>
              </div>
              <div className="form-group"><label className="form-label">Notes</label><textarea className="form-control" rows={2} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} /></div>
              <div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button><button type="submit" className="btn btn-primary">Submit</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
