import React, { useEffect, useState } from 'react'
import api from '../api'
import toast from 'react-hot-toast'

const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`
const INIT = { supplier: '', supplierPhone: '', items: [{ skuName: '', quantity: 1, price: '', total: 0 }], status: 'draft', orderDate: new Date().toISOString().split('T')[0], expectedDate: '', notes: '' }

export default function PurchaseOrders() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(INIT)
  const [filterStatus, setFilterStatus] = useState('')

  const load = async () => {
    try { const { data } = await api.get('/purchase-orders', { params: { status: filterStatus || undefined } }); setOrders(data.orders || []) }
    catch { toast.error('Failed to load') } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [filterStatus])

  const addItem = () => setForm(p => ({ ...p, items: [...p.items, { skuName: '', quantity: 1, price: '', total: 0 }] }))
  const removeItem = (i) => setForm(p => ({ ...p, items: p.items.filter((_, idx) => idx !== i) }))
  const updateItem = (i, k, v) => setForm(p => {
    const items = [...p.items]; items[i] = { ...items[i], [k]: v }
    if (k === 'quantity' || k === 'price') items[i].total = Number(items[i].quantity) * Number(items[i].price || 0)
    return { ...p, items }
  })

  const getTotal = () => form.items.reduce((a, i) => a + Number(i.total || 0), 0)

  const handleSave = async (e) => {
    e.preventDefault()
    try {
      const items = form.items.filter(i => i.skuName && i.quantity && i.price).map(i => ({ skuName: i.skuName, quantity: Number(i.quantity), price: Number(i.price), total: Number(i.total) }))
      await api.post('/purchase-orders', { ...form, items, subtotal: getTotal(), total: getTotal() })
      toast.success('PO created!'); setModal(false); load()
    } catch (err) { toast.error(err.response?.data?.message || 'Error') }
  }

  const handleReceive = async (id) => {
    if (!confirm('Mark PO as received and update stock?')) return
    try { await api.post(`/purchase-orders/${id}/receive`); toast.success('PO received! Stock updated.'); load() }
    catch { toast.error('Failed') }
  }

  const handleStatusChange = async (id, status) => {
    try { await api.put(`/purchase-orders/${id}`, { status }); toast.success('Status updated'); load() }
    catch { toast.error('Failed') }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Purchase Orders</h1>
        <button className="btn btn-primary" onClick={() => { setForm(INIT); setModal(true) }}>+ New PO</button>
      </div>
      <div className="filters-bar">
        <select className="form-control" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">All Status</option>
          <option value="draft">Draft</option><option value="ordered">Ordered</option><option value="received">Received</option><option value="cancelled">Cancelled</option>
        </select>
      </div>
      {loading ? <div className="loading-center"><div className="spinner" /></div> : (
        <div className="card">
          <div className="table-wrapper">
            <table>
              <thead><tr><th>PO Number</th><th>Supplier</th><th>Total</th><th>Status</th><th>Order Date</th><th>Expected</th><th>Actions</th></tr></thead>
              <tbody>
                {orders.length === 0 && <tr><td colSpan={7}><div className="empty-state"><div className="empty-icon">📋</div><p>No purchase orders</p></div></td></tr>}
                {orders.map(o => (
                  <tr key={o._id}>
                    <td><strong>{o.poNumber}</strong></td>
                    <td>{o.supplier}<br /><span className="text-muted text-sm">{o.supplierPhone}</span></td>
                    <td style={{ fontWeight: 700 }}>{fmt(o.total)}</td>
                    <td><span className={`badge badge-${o.status === 'received' ? 'success' : o.status === 'cancelled' ? 'danger' : o.status === 'ordered' ? 'info' : 'neutral'}`}>{o.status}</span></td>
                    <td className="text-muted">{new Date(o.orderDate).toLocaleDateString('en-IN')}</td>
                    <td className="text-muted">{o.expectedDate ? new Date(o.expectedDate).toLocaleDateString('en-IN') : '—'}</td>
                    <td>
                      <div className="flex gap-2">
                        {o.status === 'ordered' && <button className="btn btn-sm btn-success" onClick={() => handleReceive(o._id)}>✅ Receive</button>}
                        {o.status === 'draft' && <button className="btn btn-sm btn-primary" onClick={() => handleStatusChange(o._id, 'ordered')}>📤 Place Order</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(false)}>
          <div className="modal" style={{ maxWidth: 750 }} onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">New Purchase Order</h2>
            <form onSubmit={handleSave}>
              <div className="grid grid-2">
                <div className="form-group"><label className="form-label">Supplier Name *</label><input className="form-control" required value={form.supplier} onChange={e => setForm(p => ({ ...p, supplier: e.target.value }))} /></div>
                <div className="form-group"><label className="form-label">Supplier Phone</label><input className="form-control" value={form.supplierPhone} onChange={e => setForm(p => ({ ...p, supplierPhone: e.target.value }))} /></div>
                <div className="form-group"><label className="form-label">Order Date</label><input className="form-control" type="date" value={form.orderDate} onChange={e => setForm(p => ({ ...p, orderDate: e.target.value }))} /></div>
                <div className="form-group"><label className="form-label">Expected Date</label><input className="form-control" type="date" value={form.expectedDate} onChange={e => setForm(p => ({ ...p, expectedDate: e.target.value }))} /></div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <div className="flex justify-between items-center" style={{ marginBottom: 10 }}>
                  <label className="form-label" style={{ marginBottom: 0 }}>Items</label>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={addItem}>+ Add Item</button>
                </div>
                {form.items.map((item, i) => (
                  <div key={i} className="grid" style={{ gridTemplateColumns: '3fr 1fr 1fr auto', gap: 8, marginBottom: 8 }}>
                    <input className="form-control" placeholder="Product name" value={item.skuName} onChange={e => updateItem(i, 'skuName', e.target.value)} />
                    <input className="form-control" type="number" min="1" placeholder="Qty" value={item.quantity} onChange={e => updateItem(i, 'quantity', e.target.value)} />
                    <input className="form-control" type="number" min="0" step="0.01" placeholder="Price" value={item.price} onChange={e => updateItem(i, 'price', e.target.value)} />
                    {form.items.length > 1 && <button type="button" className="btn-icon" onClick={() => removeItem(i)}>🗑️</button>}
                  </div>
                ))}
                <div style={{ textAlign: 'right', fontWeight: 700, fontSize: 16 }}>Total: {fmt(getTotal())}</div>
              </div>
              <div className="form-group"><label className="form-label">Notes</label><textarea className="form-control" rows={2} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} /></div>
              <div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button><button type="submit" className="btn btn-primary">Create PO</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
