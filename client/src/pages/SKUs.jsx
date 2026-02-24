import React, { useEffect, useState } from 'react'
import api from '../api'
import toast from 'react-hot-toast'

const INIT = { name: '', code: '', brand: '', category: '', unitSize: '', mrp: '', sellingPrice: '', purchasePrice: '', stock: 0, minStock: 10, unit: 'pcs', active: true, description: '' }

export default function SKUs() {
  const [skus, setSkus] = useState([])
  const [brands, setBrands] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterBrand, setFilterBrand] = useState('')
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(INIT)
  const [editId, setEditId] = useState(null)

  const load = async () => {
    try {
      const [s, b] = await Promise.all([
        api.get('/skus', { params: { search, brand: filterBrand || undefined } }),
        api.get('/brands')
      ])
      setSkus(s.data); setBrands(b.data)
    } catch { toast.error('Failed to load') } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [search, filterBrand])

  const openAdd = () => { setForm(INIT); setEditId(null); setModal(true) }
  const openEdit = (s) => { setForm({ ...s, brand: s.brand?._id || s.brand }); setEditId(s._id); setModal(true) }
  const closeModal = () => setModal(false)
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const handleSave = async (e) => {
    e.preventDefault()
    try {
      const payload = { ...form, mrp: Number(form.mrp), sellingPrice: Number(form.sellingPrice), purchasePrice: Number(form.purchasePrice), stock: Number(form.stock), minStock: Number(form.minStock) }
      if (editId) await api.put(`/skus/${editId}`, payload)
      else await api.post('/skus', payload)
      toast.success('Saved!'); closeModal(); load()
    } catch (err) { toast.error(err.response?.data?.message || 'Error') }
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete SKU?')) return
    try { await api.delete(`/skus/${id}`); toast.success('Deleted'); load() }
    catch { toast.error('Delete failed') }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">SKUs / Products <span style={{ fontSize: 18, color: 'var(--text-muted)' }}>({skus.length})</span></h1>
        <button className="btn btn-primary" onClick={openAdd}>+ Add SKU</button>
      </div>
      <div className="filters-bar">
        <div className="search-bar"><span className="search-icon">🔍</span><input className="form-control" placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} /></div>
        <select className="form-control" value={filterBrand} onChange={e => setFilterBrand(e.target.value)}>
          <option value="">All Brands</option>
          {brands.map(b => <option key={b._id} value={b._id}>{b.name}</option>)}
        </select>
      </div>
      {loading ? <div className="loading-center"><div className="spinner" /></div> : (
        <div className="card">
          <div className="table-wrapper">
            <table>
              <thead><tr><th>Code</th><th>Name</th><th>Brand</th><th>MRP</th><th>Selling Price</th><th>Stock</th><th>Min Stock</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {skus.length === 0 && <tr><td colSpan={9}><div className="empty-state"><div className="empty-icon">📦</div><p>No SKUs found</p></div></td></tr>}
                {skus.map(s => (
                  <tr key={s._id}>
                    <td><code style={{ background: 'var(--bg)', padding: '2px 6px', borderRadius: 4, fontSize: 12 }}>{s.code}</code></td>
                    <td><strong>{s.name}</strong><br /><span className="text-muted text-sm">{s.unitSize}</span></td>
                    <td>{s.brand?.name}</td>
                    <td>₹{s.mrp}</td>
                    <td>₹{s.sellingPrice}</td>
                    <td style={{ color: s.stock <= s.minStock ? 'var(--danger)' : 'var(--text)', fontWeight: 600 }}>{s.stock} {s.unit}</td>
                    <td className="text-muted">{s.minStock}</td>
                    <td>{s.stock === 0 ? <span className="badge badge-danger">Out of Stock</span> : s.stock <= s.minStock ? <span className="badge badge-warning">Low Stock</span> : <span className="badge badge-success">In Stock</span>}</td>
                    <td><div className="flex gap-2"><button className="btn-icon" onClick={() => openEdit(s)}>✏️</button><button className="btn-icon" onClick={() => handleDelete(s._id)}>🗑️</button></div></td>
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
            <h2 className="modal-title">{editId ? 'Edit SKU' : 'Add SKU'}</h2>
            <form onSubmit={handleSave}>
              <div className="grid grid-2">
                <div className="form-group"><label className="form-label">Name *</label><input className="form-control" required value={form.name} onChange={e => f('name', e.target.value)} /></div>
                <div className="form-group"><label className="form-label">Code *</label><input className="form-control" required value={form.code} onChange={e => f('code', e.target.value)} /></div>
                <div className="form-group"><label className="form-label">Brand *</label>
                  <select className="form-control" required value={form.brand} onChange={e => f('brand', e.target.value)}>
                    <option value="">Select brand</option>
                    {brands.map(b => <option key={b._id} value={b._id}>{b.name}</option>)}
                  </select>
                </div>
                <div className="form-group"><label className="form-label">Category</label><input className="form-control" value={form.category} onChange={e => f('category', e.target.value)} /></div>
                <div className="form-group"><label className="form-label">Unit Size (e.g. 500ml)</label><input className="form-control" value={form.unitSize} onChange={e => f('unitSize', e.target.value)} /></div>
                <div className="form-group"><label className="form-label">Unit</label><input className="form-control" value={form.unit} onChange={e => f('unit', e.target.value)} /></div>
                <div className="form-group"><label className="form-label">MRP (₹) *</label><input className="form-control" type="number" required min="0" step="0.01" value={form.mrp} onChange={e => f('mrp', e.target.value)} /></div>
                <div className="form-group"><label className="form-label">Selling Price (₹) *</label><input className="form-control" type="number" required min="0" step="0.01" value={form.sellingPrice} onChange={e => f('sellingPrice', e.target.value)} /></div>
                <div className="form-group"><label className="form-label">Purchase Price (₹)</label><input className="form-control" type="number" min="0" step="0.01" value={form.purchasePrice} onChange={e => f('purchasePrice', e.target.value)} /></div>
                <div className="form-group"><label className="form-label">Current Stock</label><input className="form-control" type="number" min="0" value={form.stock} onChange={e => f('stock', e.target.value)} /></div>
                <div className="form-group"><label className="form-label">Min Stock (reorder point)</label><input className="form-control" type="number" min="0" value={form.minStock} onChange={e => f('minStock', e.target.value)} /></div>
                <div className="form-group"><label className="form-label">Status</label><select className="form-control" value={form.active ? 'active' : 'inactive'} onChange={e => f('active', e.target.value === 'active')}><option value="active">Active</option><option value="inactive">Inactive</option></select></div>
              </div>
              <div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={closeModal}>Cancel</button><button type="submit" className="btn btn-primary">Save</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
