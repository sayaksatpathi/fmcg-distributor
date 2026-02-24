import React, { useRef, useState } from 'react'
import api from '../api'
import toast from 'react-hot-toast'

export default function Backup() {
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importFile, setImportFile] = useState(null)
  const fileRef = useRef()

  const handleExport = async () => {
    setExporting(true)
    try {
      const res = await api.get('/backup/export', { responseType: 'blob' })
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/json' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `fmcg-backup-${new Date().toISOString().split('T')[0]}.json`
      a.click()
      toast.success('Backup downloaded!')
    } catch { toast.error('Export failed') } finally { setExporting(false) }
  }

  const handleImport = async () => {
    if (!importFile) { toast.error('Select a backup file'); return }
    if (!window.confirm('⚠️ This will overwrite the current database. Continue?')) return
    const formData = new FormData()
    formData.append('file', importFile)
    setImporting(true)
    try {
      const { data } = await api.post('/backup/import', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
      toast.success(data.message || 'Restored successfully!')
      setImportFile(null)
      if (fileRef.current) fileRef.current.value = ''
    } catch (e) { toast.error(e.response?.data?.error || 'Import failed') } finally { setImporting(false) }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Backup & Restore</h1>
      </div>
      <div className="grid grid-2" style={{ gap: 20 }}>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>💾</div>
          <h2 style={{ marginBottom: 8 }}>Export Backup</h2>
          <p className="text-muted" style={{ marginBottom: 24, lineHeight: 1.7 }}>
            Download a full JSON backup of all your data including retailers, sales, invoices, products, and more.
          </p>
          <button className="btn btn-primary" style={{ minWidth: 200 }} onClick={handleExport} disabled={exporting}>
            {exporting ? <><span className="spinner-sm" /> Exporting...</> : '⬇️ Download Backup'}
          </button>
          <p className="text-muted" style={{ marginTop: 16, fontSize: 13 }}>Backup includes: Retailers, Brands, SKUs, Sales, Purchase Orders, Returns, Targets, Reminders</p>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>📤</div>
          <h2 style={{ marginBottom: 8 }}>Restore from Backup</h2>
          <p className="text-muted" style={{ marginBottom: 24, lineHeight: 1.7 }}>
            <strong style={{ color: 'var(--danger)' }}>Warning:</strong> Restoring will overwrite existing data. Make sure you have a fresh backup before proceeding.
          </p>
          <div
            style={{ border: '2px dashed var(--border)', borderRadius: 10, padding: 24, cursor: 'pointer', marginBottom: 16 }}
            onClick={() => fileRef.current?.click()}
          >
            {importFile
              ? <p style={{ color: 'var(--success)', fontWeight: 600 }}>📄 {importFile.name}</p>
              : <p className="text-muted">Click to select backup file (.json)</p>
            }
            <input ref={fileRef} type="file" accept=".json" style={{ display: 'none' }} onChange={e => setImportFile(e.target.files[0])} />
          </div>
          <button className="btn btn-danger" style={{ minWidth: 200 }} onClick={handleImport} disabled={importing || !importFile}>
            {importing ? <><span className="spinner-sm" /> Restoring...</> : '⬆️ Restore Backup'}
          </button>
        </div>
      </div>
      <div className="card" style={{ marginTop: 20, padding: 20 }}>
        <h3 style={{ marginBottom: 12 }}>💡 Backup Best Practices</h3>
        <ul className="text-muted" style={{ lineHeight: 2.2, paddingLeft: 20 }}>
          <li>Take a backup before making bulk changes or importing data</li>
          <li>Store backups in a secure cloud drive (Google Drive, OneDrive, etc.)</li>
          <li>Recommended: daily backups for active businesses</li>
          <li>Backup files contain sensitive business data — keep them confidential</li>
          <li>Always verify a restore in a test environment before overwriting production data</li>
        </ul>
      </div>
    </div>
  )
}
