import React, { useEffect, useState } from 'react'
import api from '../api'
import toast from 'react-hot-toast'

const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`

export default function Sales() {
  const [sales, setSales] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [retailers, setRetailers] = useState([])
  const [skus, setSkus] = useState([])
  const [filterStatus, setFilterStatus] = useState('')
  const [form, setForm] = useState({ retailer: '', items: [{ sku: '', quantity: 1, price: '', discount: 0 }], discount: 0, tax: 0, paid: 0, paymentMode: 'credit', notes: '' })
  const [totals, setTotals] = useState({ subtotal: 0, total: 0, balance: 0 })

  const load = async () => {
    try {
      const [s, r, k] = await Promise.all([
        api.get('/sales', { params: { status: filterStatus || undefined, limit: 100 } }),
        api.get('/retailers', { params: { limit: 200 } }),
        api.get('/skus')
      ])
      setSales(s.data.sales || [])
      setRetailers(r.data.retailers || [])
      setSkus(k.data)
    } catch { toast.error('Failed to load') } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [filterStatus])

  // Recalculate totals whenever items/discount/tax change
  useEffect(() => {
    let sub = 0
    for (const item of form.items) {
      if (item.sku && item.quantity && item.price) {
        sub += (Number(item.price) * Number(item.quantity)) - Number(item.discount || 0)
      }
    }
    const total = sub - Number(form.discount || 0) + Number(form.tax || 0)
    const balance = total - Number(form.paid || 0)
    setTotals({ subtotal: sub, total, balance })
  }, [form.items, form.discount, form.tax, form.paid])

  const openAdd = () => {
    setForm({ retailer: '', items: [{ sku: '', quantity: 1, price: '', discount: 0 }], discount: 0, tax: 0, paid: 0, paymentMode: 'credit', notes: '' })
    setModal(true)
  }

  const addItem = () => setForm(p => ({ ...p, items: [...p.items, { sku: '', quantity: 1, price: '', discount: 0 }] }))
  const removeItem = (i) => setForm(p => ({ ...p, items: p.items.filter((_, idx) => idx !== i) }))
  const updateItem = (i, k, v) => setForm(p => {
    const items = [...p.items]
    items[i] = { ...items[i], [k]: v }
    // Auto-fill price from SKU
    if (k === 'sku' && v) {
      const sku = skus.find(s => s._id === v)
      if (sku) items[i].price = sku.sellingPrice
    }
    return { ...p, items }
  })

  const handleSave = async (e) => {
    e.preventDefault()
    try {
      const items = form.items.filter(i => i.sku && i.quantity && i.price).map(i => ({
        sku: i.sku, quantity: Number(i.quantity), price: Number(i.price), discount: Number(i.discount || 0),
        total: (Number(i.price) * Number(i.quantity)) - Number(i.discount || 0)
      }))
      if (!items.length) return toast.error('Add at least one item')
      await api.post('/sales', { ...form, items, discount: Number(form.discount), tax: Number(form.tax), paid: Number(form.paid) })
      toast.success('Sale created!'); setModal(false); load()
    } catch (err) { toast.error(err.response?.data?.message || 'Error') }
  }

  const handlePayment = async (sale) => {
    const amount = prompt(`Record payment for ${sale.retailerName}\nBalance: ${fmt(sale.balance)}\nAmount:`)
    if (!amount) return
    try {
      await api.put(`/sales/${sale._id}`, { paid: (sale.paid || 0) + Number(amount) })
      toast.success('Payment recorded!'); load()
    } catch { toast.error('Failed') }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Sales</h1>
        <button className="btn btn-primary" onClick={openAdd}>+ New Sale</button>
      </div>
      <div className="filters-bar">
        <select className="form-control" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="partial">Partial</option>
          <option value="paid">Paid</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>
      {loading ? <div className="loading-center"><div className="spinner" /></div> : (
        <div className="card">
          <div className="table-wrapper">
            <table>
              <thead><tr><th>Invoice</th><th>Retailer</th><th>Total</th><th>Paid</th><th>Balance</th><th>Mode</th><th>Status</th><th>Date</th><th>Actions</th></tr></thead>
              <tbody>
                {sales.length === 0 && <tr><td colSpan={9}><div className="empty-state"><div className="empty-icon">🛒</div><p>No sales</p></div></td></tr>}
                {sales.map(s => (
                  <tr key={s._id}>
                    <td><strong>{s.invoiceNumber}</strong></td>
                    <td>{s.retailerName}</td>
                    <td style={{ fontWeight: 700 }}>{fmt(s.total)}</td>
                    <td style={{ color: 'var(--success)' }}>{fmt(s.paid)}</td>
                    <td style={{ color: s.balance > 0 ? 'var(--danger)' : 'var(--success)', fontWeight: 600 }}>{fmt(s.balance)}</td>
                    <td className="text-muted">{s.paymentMode}</td>
                    <td><span className={`badge badge-${s.status === 'paid' ? 'success' : s.status === 'partial' ? 'warning' : s.status === 'cancelled' ? 'danger' : 'neutral'}`}>{s.status}</span></td>
                    <td className="text-muted">{new Date(s.saleDate).toLocaleDateString('en-IN')}</td>
                    <td>
                      <div className="flex gap-2">
                        {s.balance > 0 && <button className="btn btn-sm btn-success" onClick={() => handlePayment(s)}>💰 Pay</button>}
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
          <div className="modal" style={{ maxWidth: 800 }} onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">New Sale</h2>
            <form onSubmit={handleSave}>
              <div className="grid grid-2">
                <div className="form-group" style={{ gridColumn: '1/-1' }}>
                  <label className="form-label">Retailer *</label>
                  <select className="form-control" required value={form.retailer} onChange={e => setForm(p => ({ ...p, retailer: e.target.value }))}>
                    <option value="">Select retailer</option>
                    {retailers.map(r => <option key={r._id} value={r._id}>{r.name} — {r.phone}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <div className="flex justify-between items-center" style={{ marginBottom: 10 }}>
                  <label className="form-label" style={{ marginBottom: 0 }}>Items</label>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={addItem}>+ Add Item</button>
                </div>
                {form.items.map((item, i) => (
                  <div key={i} className="grid" style={{ gridTemplateColumns: '3fr 1fr 1fr 1fr auto', gap: 8, marginBottom: 8, alignItems: 'flex-end' }}>
                    <select className="form-control" value={item.sku} onChange={e => updateItem(i, 'sku', e.target.value)}>
                      <option value="">Select SKU</option>
                      {skus.map(s => <option key={s._id} value={s._id}>{s.name} — ₹{s.sellingPrice}</option>)}
                    </select>
                    <input className="form-control" type="number" min="1" placeholder="Qty" value={item.quantity} onChange={e => updateItem(i, 'quantity', e.target.value)} />
                    <input className="form-control" type="number" min="0" step="0.01" placeholder="Price" value={item.price} onChange={e => updateItem(i, 'price', e.target.value)} />
                    <input className="form-control" type="number" min="0" placeholder="Disc" value={item.discount} onChange={e => updateItem(i, 'discount', e.target.value)} />
                    {form.items.length > 1 && <button type="button" className="btn-icon" onClick={() => removeItem(i)}>🗑️</button>}
                  </div>
                ))}
              </div>

              <div className="grid grid-2">
                <div className="form-group"><label className="form-label">Discount (₹)</label><input className="form-control" type="number" min="0" value={form.discount} onChange={e => setForm(p => ({ ...p, discount: e.target.value }))} /></div>
                <div className="form-group"><label className="form-label">Tax (₹)</label><input className="form-control" type="number" min="0" value={form.tax} onChange={e => setForm(p => ({ ...p, tax: e.target.value }))} /></div>
                <div className="form-group"><label className="form-label">Amount Paid (₹)</label><input className="form-control" type="number" min="0" value={form.paid} onChange={e => setForm(p => ({ ...p, paid: e.target.value }))} /></div>
                <div className="form-group"><label className="form-label">Payment Mode</label>
                  <select className="form-control" value={form.paymentMode} onChange={e => setForm(p => ({ ...p, paymentMode: e.target.value }))}>
                    <option value="credit">Credit</option><option value="cash">Cash</option><option value="upi">UPI</option><option value="bank_transfer">Bank Transfer</option>
                  </select>
                </div>
              </div>

              <div className="card" style={{ background: 'var(--primary-light)', marginBottom: 16, padding: 16 }}>
                <div className="flex justify-between"><span>Subtotal</span><strong>{fmt(totals.subtotal)}</strong></div>
                <div className="flex justify-between"><span>Discount</span><strong>- {fmt(form.discount)}</strong></div>
                <div className="flex justify-between"><span>Tax</span><strong>+ {fmt(form.tax)}</strong></div>
                <div className="flex justify-between" style={{ fontSize: 18, marginTop: 8 }}><strong>Total</strong><strong style={{ color: 'var(--primary)' }}>{fmt(totals.total)}</strong></div>
                <div className="flex justify-between" style={{ color: 'var(--danger)' }}><span>Balance</span><strong>{fmt(totals.balance)}</strong></div>
              </div>

              <div className="form-group"><label className="form-label">Notes</label><textarea className="form-control" rows={2} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} /></div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create Sale</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
