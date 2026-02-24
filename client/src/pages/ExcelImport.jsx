import React, { useRef, useState } from 'react'
import api from '../api'
import toast from 'react-hot-toast'

export default function ExcelImport() {
  const [tab, setTab] = useState('retailers')
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const fileRef = useRef()

  const templates = {
    retailers: ['name*', 'phone*', 'area', 'city', 'creditLimit'],
    skus: ['name*', 'code*', 'brand*', 'mrp*', 'sellingPrice*', 'purchasePrice', 'stock', 'minStock', 'unit', 'unitSize'],
    sales: ['retailerPhone*', 'skuCode*', 'qty*', 'price', 'saleDate'],
  }

  const handleFile = (e) => {
    const f = e.target.files[0]
    if (!f) return
    setFile(f)
    setPreview({ name: f.name, size: (f.size / 1024).toFixed(1) + ' KB' })
  }

  const handleUpload = async () => {
    if (!file) { toast.error('Select a file first'); return }
    const formData = new FormData()
    formData.append('file', file)
    setLoading(true)
    try {
      const { data } = await api.post(`/import/${tab}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } })
      toast.success(`Imported ${data.inserted || 0} records! ${data.errors?.length ? `(${data.errors.length} errors)` : ''}`)
      if (data.errors?.length) { console.log('Import errors:', data.errors) }
      setFile(null); setPreview(null)
      if (fileRef.current) fileRef.current.value = ''
    } catch (e) { toast.error(e.response?.data?.error || 'Import failed') }
    finally { setLoading(false) }
  }

  const downloadTemplate = () => {
    const cols = templates[tab]
    const csv = cols.join(',') + '\n'
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `${tab}-template.csv`; a.click()
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Excel / CSV Import</h1>
        <button className="btn btn-secondary" onClick={downloadTemplate}>📥 Download Template</button>
      </div>
      <div className="filters-bar">
        {['retailers', 'skus', 'sales'].map(t => (
          <button key={t} className={`btn ${tab === t ? 'btn-primary' : 'btn-secondary'}`} onClick={() => {setTab(t); setFile(null); setPreview(null)}}>
            {t === 'retailers' ? '🏪 Retailers' : t === 'skus' ? '📦 Products' : '🛒 Sales'}
          </button>
        ))}
      </div>
      <div className="grid grid-2" style={{ gap: 20 }}>
        <div className="card">
          <h3 style={{ marginBottom: 16, fontWeight: 700 }}>Upload File</h3>
          <p className="text-muted" style={{ marginBottom: 20 }}>
            Upload a .xlsx or .csv file to import <strong>{tab}</strong>. The file must include the required columns marked with *.
          </p>
          <div
            style={{
              border: '2px dashed var(--border)',
              borderRadius: 12,
              padding: 40,
              textAlign: 'center',
              cursor: 'pointer',
              background: file ? 'var(--bg)' : 'transparent',
              transition: 'border-color .2s',
            }}
            onClick={() => fileRef.current?.click()}
          >
            {!preview ? (
              <>
                <div style={{ fontSize: 48, marginBottom: 12 }}>📁</div>
                <p style={{ fontWeight: 600 }}>Click to select file</p>
                <p className="text-muted text-sm">.xlsx, .xls, .csv supported</p>
              </>
            ) : (
              <>
                <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
                <p style={{ fontWeight: 600 }}>{preview.name}</p>
                <p className="text-muted text-sm">{preview.size}</p>
              </>
            )}
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={handleFile} />
          </div>
          {file && (
            <button className="btn btn-primary" style={{ marginTop: 16, width: '100%' }} onClick={handleUpload} disabled={loading}>
              {loading ? <span className="spinner-sm" /> : '⬆️ Start Import'}
            </button>
          )}
        </div>
        <div className="card">
          <h3 style={{ marginBottom: 16, fontWeight: 700 }}>Required Columns</h3>
          <p className="text-muted" style={{ marginBottom: 16 }}>Columns marked with * are required. First row must be headers.</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {templates[tab].map(col => (
              <span key={col} style={{
                padding: '4px 12px',
                borderRadius: 20,
                background: col.endsWith('*') ? 'var(--primary)' : 'var(--bg)',
                color: col.endsWith('*') ? '#fff' : 'var(--text)',
                fontSize: 13,
                fontFamily: 'monospace',
              }}>{col}</span>
            ))}
          </div>
          <div style={{ marginTop: 24, padding: 16, background: 'var(--bg)', borderRadius: 8 }}>
            <h4 style={{ marginBottom: 12 }}>Important Notes:</h4>
            <ul className="text-muted" style={{ lineHeight: 2, paddingLeft: 20, fontSize: 14 }}>
              <li>First row must be the header row</li>
              <li>Date format: YYYY-MM-DD</li>
              {tab === 'sales' && <li>retailerPhone must match an existing retailer</li>}
              {tab === 'sales' && <li>skuCode must match an existing product</li>}
              {tab === 'skus' && <li>brand must match an existing brand name</li>}
              <li>Duplicate checks are applied where applicable</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
