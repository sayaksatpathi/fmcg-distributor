import React, { useEffect, useState } from 'react'
import api from '../api'
import toast from 'react-hot-toast'

const empty = { sku: '', batchNumber: '', testDate: '', testedBy: '', parameters: [], result: 'pass', notes: '' }

export default function ProductTests() {
  const [tests, setTests] = useState([])
  const [skus, setSkus] = useState([])
  const [loading, setLoading] = useState(true)
  const [show, setShow] = useState(false)
  const [form, setForm] = useState(empty)
  const [editId, setEditId] = useState(null)
  const [paramName, setParamName] = useState('')
  const [paramExpected, setParamExpected] = useState('')
  const [paramActual, setParamActual] = useState('')

  const load = async () => {
    try {
      const [t, s] = await Promise.all([api.get('/product-tests'), api.get('/skus?limit=200')])
      setTests(t.data.tests || t.data)
      setSkus(s.data.skus || s.data)
    } catch { toast.error('Failed') } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const openCreate = () => { setForm(empty); setEditId(null); setShow(true) }
  const openEdit = (t) => { setForm({ sku: t.sku?._id || t.sku, batchNumber: t.batchNumber, testDate: t.testDate?.slice(0, 10), testedBy: t.testedBy, parameters: t.parameters || [], result: t.result, notes: t.notes }); setEditId(t._id); setShow(true) }

  const addParam = () => {
    if (!paramName) return
    setForm(f => ({ ...f, parameters: [...f.parameters, { name: paramName, expectedValue: paramExpected, actualValue: paramActual, passed: true }] }))
    setParamName(''); setParamExpected(''); setParamActual('')
  }
  const removeParam = (i) => setForm(f => ({ ...f, parameters: f.parameters.filter((_, idx) => idx !== i) }))

  const handleSave = async () => {
    if (!form.sku) { toast.error('Select a product'); return }
    try {
      if (editId) await api.put(`/product-tests/${editId}`, form)
      else await api.post('/product-tests', form)
      toast.success('Saved!'); setShow(false); load()
    } catch (e) { toast.error(e.response?.data?.error || 'Error') }
  }
  const handleDelete = async (id) => {
    if (!window.confirm('Delete?')) return
    await api.delete(`/product-tests/${id}`); toast.success('Deleted'); load()
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Product Tests</h1>
        <button className="btn btn-primary" onClick={openCreate}>+ New Test</button>
      </div>
      {loading ? <div className="loading-center"><div className="spinner" /></div> : (
        <div className="card">
          <div className="table-wrapper">
            <table>
              <thead><tr><th>Product</th><th>Batch</th><th>Date</th><th>Tested By</th><th>Parameters</th><th>Result</th><th>Actions</th></tr></thead>
              <tbody>
                {tests.length === 0 && <tr><td colSpan={7}><div className="empty-state"><div className="empty-icon">🧪</div><p>No tests recorded yet</p></div></td></tr>}
                {tests.map(t => (
                  <tr key={t._id}>
                    <td><strong>{t.sku?.name}</strong><br /><span className="text-muted text-sm">{t.sku?.code}</span></td>
                    <td>{t.batchNumber || '—'}</td>
                    <td className="text-muted">{t.testDate ? new Date(t.testDate).toLocaleDateString('en-IN') : '—'}</td>
                    <td>{t.testedBy || '—'}</td>
                    <td className="text-muted">{t.parameters?.length} params</td>
                    <td><span className={`badge badge-${t.result === 'pass' ? 'success' : 'danger'}`}>{t.result === 'pass' ? '✅ Pass' : '❌ Fail'}</span></td>
                    <td>
                      <button className="btn btn-secondary" style={{ marginRight: 8 }} onClick={() => openEdit(t)}>Edit</button>
                      <button className="btn btn-danger" onClick={() => handleDelete(t._id)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {show && (
        <div className="modal-backdrop" onClick={() => setShow(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h2>{editId ? 'Edit Test' : 'New Product Test'}</h2><button className="modal-close" onClick={() => setShow(false)}>×</button></div>
            <div className="modal-body">
              <div className="grid grid-2">
                <div className="form-group">
                  <label className="form-label">Product *</label>
                  <select className="form-control" value={form.sku} onChange={e => setForm(f => ({ ...f, sku: e.target.value }))}>
                    <option value="">Select product</option>
                    {skus.map(s => <option key={s._id} value={s._id}>{s.name} ({s.code})</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Batch Number</label>
                  <input className="form-control" value={form.batchNumber} onChange={e => setForm(f => ({ ...f, batchNumber: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Test Date</label>
                  <input type="date" className="form-control" value={form.testDate} onChange={e => setForm(f => ({ ...f, testDate: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Tested By</label>
                  <input className="form-control" value={form.testedBy} onChange={e => setForm(f => ({ ...f, testedBy: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Result</label>
                  <select className="form-control" value={form.result} onChange={e => setForm(f => ({ ...f, result: e.target.value }))}>
                    <option value="pass">✅ Pass</option>
                    <option value="fail">❌ Fail</option>
                    <option value="pending">⏳ Pending</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Notes</label>
                  <input className="form-control" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
                </div>
              </div>
              <div style={{ background: 'var(--bg)', borderRadius: 8, padding: 16, marginTop: 8 }}>
                <h4 style={{ marginBottom: 12 }}>Parameters</h4>
                {form.parameters.map((p, i) => (
                  <div key={i} className="flex gap-2 items-center" style={{ marginBottom: 8, padding: '8px 12px', background: 'var(--bg-card)', borderRadius: 8 }}>
                    <span style={{ flex: 1 }}><strong>{p.name}</strong></span>
                    <span className="text-muted">Expected: {p.expectedValue}</span>
                    <span className="text-muted">Actual: {p.actualValue}</span>
                    <button className="btn btn-danger" style={{ padding: '4px 10px' }} onClick={() => removeParam(i)}>×</button>
                  </div>
                ))}
                <div className="flex gap-2" style={{ marginTop: 8, flexWrap: 'wrap' }}>
                  <input placeholder="Parameter name" className="form-control" style={{ flex: 2, minWidth: 120 }} value={paramName} onChange={e => setParamName(e.target.value)} />
                  <input placeholder="Expected" className="form-control" style={{ flex: 1, minWidth: 80 }} value={paramExpected} onChange={e => setParamExpected(e.target.value)} />
                  <input placeholder="Actual" className="form-control" style={{ flex: 1, minWidth: 80 }} value={paramActual} onChange={e => setParamActual(e.target.value)} />
                  <button className="btn btn-secondary" onClick={addParam}>+ Add</button>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShow(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave}>{editId ? 'Update' : 'Create'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
