import React, { useEffect, useState } from 'react'
import api from '../api'
import toast from 'react-hot-toast'

const INIT = { name: '', company: '', category: '', description: '', active: true }

export default function Brands() {
  const [brands, setBrands] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(INIT)
  const [editId, setEditId] = useState(null)

  const load = async () => {
    try { const { data } = await api.get('/brands'); setBrands(data) }
    catch { toast.error('Failed to load brands') } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const openAdd = () => { setForm(INIT); setEditId(null); setModal(true) }
  const openEdit = (b) => { setForm(b); setEditId(b._id); setModal(true) }
  const closeModal = () => { setModal(false) }
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const handleSave = async (e) => {
    e.preventDefault()
    try {
      if (editId) await api.put(`/brands/${editId}`, form)
      else await api.post('/brands', form)
      toast.success('Saved!'); closeModal(); load()
    } catch (err) { toast.error(err.response?.data?.message || 'Error') }
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete brand?')) return
    try { await api.delete(`/brands/${id}`); toast.success('Deleted'); load() }
    catch { toast.error('Delete failed') }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Brands</h1>
        <button className="btn btn-primary" onClick={openAdd}>+ Add Brand</button>
      </div>
      {loading ? <div className="loading-center"><div className="spinner" /></div> : (
        <div className="card">
          <div className="table-wrapper">
            <table>
              <thead><tr><th>Name</th><th>Company</th><th>Category</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {brands.length === 0 && <tr><td colSpan={5}><div className="empty-state"><div className="empty-icon">🏷️</div><p>No brands yet</p></div></td></tr>}
                {brands.map(b => (
                  <tr key={b._id}>
                    <td><strong>{b.name}</strong></td>
                    <td>{b.company}</td>
                    <td>{b.category}</td>
                    <td><span className={`badge ${b.active ? 'badge-success' : 'badge-neutral'}`}>{b.active ? 'Active' : 'Inactive'}</span></td>
                    <td><div className="flex gap-2"><button className="btn-icon" onClick={() => openEdit(b)}>✏️</button><button className="btn-icon" onClick={() => handleDelete(b._id)}>🗑️</button></div></td>
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
            <h2 className="modal-title">{editId ? 'Edit Brand' : 'Add Brand'}</h2>
            <form onSubmit={handleSave}>
              <div className="grid grid-2">
                <div className="form-group"><label className="form-label">Name *</label><input className="form-control" required value={form.name} onChange={e => f('name', e.target.value)} /></div>
                <div className="form-group"><label className="form-label">Company</label><input className="form-control" value={form.company || ''} onChange={e => f('company', e.target.value)} /></div>
                <div className="form-group"><label className="form-label">Category</label><input className="form-control" value={form.category || ''} onChange={e => f('category', e.target.value)} /></div>
                <div className="form-group"><label className="form-label">Status</label><select className="form-control" value={form.active ? 'active' : 'inactive'} onChange={e => f('active', e.target.value === 'active')}><option value="active">Active</option><option value="inactive">Inactive</option></select></div>
              </div>
              <div className="form-group"><label className="form-label">Description</label><textarea className="form-control" rows={2} value={form.description || ''} onChange={e => f('description', e.target.value)} /></div>
              <div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={closeModal}>Cancel</button><button type="submit" className="btn btn-primary">Save</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
