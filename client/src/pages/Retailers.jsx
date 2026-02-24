import React, { useEffect, useState } from 'react'
import api from '../api'
import toast from 'react-hot-toast'

const INIT = { name: '', contactPerson: '', phone: '', phone2: '', email: '', area: '', city: '', gstin: '', creditLimit: 0, status: 'active', notes: '' }

export default function Retailers() {
  const [retailers, setRetailers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(INIT)
  const [editId, setEditId] = useState(null)

  const load = async () => {
    try {
      const { data } = await api.get('/retailers', { params: { search, limit: 200 } })
      setRetailers(data.retailers || [])
    } catch { toast.error('Failed to load retailers') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [search])

  const openAdd = () => { setForm(INIT); setEditId(null); setModal(true) }
  const openEdit = (r) => { setForm({ ...r, creditLimit: r.creditLimit || 0 }); setEditId(r._id); setModal(true) }
  const closeModal = () => { setModal(false); setEditId(null) }

  const handleSave = async (e) => {
    e.preventDefault()
    try {
      if (editId) { await api.put(`/retailers/${editId}`, form) }
      else { await api.post('/retailers', form) }
      toast.success(editId ? 'Retailer updated!' : 'Retailer added!')
      closeModal(); load()
    } catch (err) { toast.error(err.response?.data?.message || 'Error saving') }
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this retailer?')) return
    try { await api.delete(`/retailers/${id}`); toast.success('Deleted'); load() }
    catch { toast.error('Delete failed') }
  }

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Retailers <span style={{ fontSize: 18, color: 'var(--text-muted)' }}>({retailers.length})</span></h1>
        <button className="btn btn-primary" onClick={openAdd}>+ Add Retailer</button>
      </div>
      <div className="filters-bar">
        <div className="search-bar">
          <span className="search-icon">🔍</span>
          <input className="form-control" placeholder="Search retailers…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>
      {loading ? <div className="loading-center"><div className="spinner" /></div> : (
        <div className="card">
          <div className="table-wrapper">
            <table>
              <thead><tr><th>Name</th><th>Contact</th><th>Phone</th><th>Area / City</th><th>Credit Limit</th><th>Outstanding</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {retailers.length === 0 && <tr><td colSpan={8}><div className="empty-state"><div className="empty-icon">🏪</div><p>No retailers found</p></div></td></tr>}
                {retailers.map(r => (
                  <tr key={r._id}>
                    <td><strong>{r.name}</strong></td>
                    <td>{r.contactPerson}</td>
                    <td>{r.phone}</td>
                    <td>{r.area}{r.city ? `, ${r.city}` : ''}</td>
                    <td>₹{(r.creditLimit || 0).toLocaleString('en-IN')}</td>
                    <td style={{ color: r.outstandingBalance > 0 ? 'var(--warning)' : 'var(--success)', fontWeight: 600 }}>
                      ₹{(r.outstandingBalance || 0).toLocaleString('en-IN')}
                    </td>
                    <td><span className={`badge badge-${r.status === 'active' ? 'success' : r.status === 'blocked' ? 'danger' : 'neutral'}`}>{r.status}</span></td>
                    <td>
                      <div className="flex gap-2">
                        <button className="btn-icon" onClick={() => openEdit(r)} title="Edit">✏️</button>
                        <button className="btn-icon" onClick={() => handleDelete(r._id)} title="Delete">🗑️</button>
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
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">{editId ? 'Edit Retailer' : 'Add Retailer'}</h2>
            <form onSubmit={handleSave}>
              <div className="grid grid-2">
                <div className="form-group"><label className="form-label">Name *</label><input className="form-control" required value={form.name} onChange={e => f('name', e.target.value)} /></div>
                <div className="form-group"><label className="form-label">Contact Person</label><input className="form-control" value={form.contactPerson} onChange={e => f('contactPerson', e.target.value)} /></div>
                <div className="form-group"><label className="form-label">Phone</label><input className="form-control" value={form.phone} onChange={e => f('phone', e.target.value)} /></div>
                <div className="form-group"><label className="form-label">Phone 2</label><input className="form-control" value={form.phone2} onChange={e => f('phone2', e.target.value)} /></div>
                <div className="form-group"><label className="form-label">Email</label><input className="form-control" type="email" value={form.email} onChange={e => f('email', e.target.value)} /></div>
                <div className="form-group"><label className="form-label">GSTIN</label><input className="form-control" value={form.gstin} onChange={e => f('gstin', e.target.value)} /></div>
                <div className="form-group"><label className="form-label">Area</label><input className="form-control" value={form.area} onChange={e => f('area', e.target.value)} /></div>
                <div className="form-group"><label className="form-label">City</label><input className="form-control" value={form.city} onChange={e => f('city', e.target.value)} /></div>
                <div className="form-group"><label className="form-label">Credit Limit (₹)</label><input className="form-control" type="number" min="0" value={form.creditLimit} onChange={e => f('creditLimit', Number(e.target.value))} /></div>
                <div className="form-group"><label className="form-label">Status</label><select className="form-control" value={form.status} onChange={e => f('status', e.target.value)}><option>active</option><option>inactive</option><option>blocked</option></select></div>
              </div>
              <div className="form-group"><label className="form-label">Address</label><input className="form-control" value={form.address || ''} onChange={e => f('address', e.target.value)} /></div>
              <div className="form-group"><label className="form-label">Notes</label><textarea className="form-control" rows={2} value={form.notes} onChange={e => f('notes', e.target.value)} /></div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
