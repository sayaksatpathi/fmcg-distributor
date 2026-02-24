import React, { useEffect, useState } from 'react'
import api from '../api'
import toast from 'react-hot-toast'

const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`

export default function Reports() {
  const [tab, setTab] = useState('sales')
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const ep = { sales: '/reports/sales', retailer: '/reports/retailer-wise', product: '/reports/product-wise' }[tab]
      const { data: d } = await api.get(ep, { params: { from: from || undefined, to: to || undefined } })
      setData(d)
    } catch { toast.error('Failed to load') } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [tab])

  const exportCSV = () => {
    let csv = ''
    if (!data.length) return
    if (tab === 'retailer') {
      csv = 'Retailer,Sales,Paid,Balance,Orders\n' + data.map(r => `"${r.name}",${r.totalSales},${r.totalPaid},${r.totalBalance},${r.count}`).join('\n')
    } else if (tab === 'product') {
      csv = 'Product,Qty Sold,Revenue\n' + data.map(r => `"${r.name}",${r.totalQty},${r.totalRevenue}`).join('\n')
    } else {
      csv = 'Invoice,Retailer,Total,Paid,Balance,Status,Date\n' + data.map(r => `"${r.invoiceNumber}","${r.retailerName || ''}",${r.total},${r.paid},${r.balance},${r.status},${new Date(r.saleDate).toLocaleDateString('en-IN')}`).join('\n')
    }
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `report-${tab}-${Date.now()}.csv`; a.click()
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Reports</h1>
        <div className="flex gap-2">
          <button className="btn btn-secondary" onClick={load}>🔄 Refresh</button>
          <button className="btn btn-primary" onClick={exportCSV}>📥 Export CSV</button>
        </div>
      </div>
      <div className="filters-bar">
        <div className="flex gap-2">
          {['sales', 'retailer', 'product'].map(t => (
            <button key={t} className={`btn ${tab === t ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab(t)}>
              {t === 'sales' ? '🛒 Sales' : t === 'retailer' ? '🏪 Retailer-wise' : '📦 Product-wise'}
            </button>
          ))}
        </div>
        {tab !== 'product' && <>
          <input className="form-control" type="date" value={from} onChange={e => setFrom(e.target.value)} placeholder="From" title="From" />
          <input className="form-control" type="date" value={to} onChange={e => setTo(e.target.value)} placeholder="To" title="To" />
          <button className="btn btn-secondary" onClick={load}>Apply</button>
        </>}
      </div>
      {loading ? <div className="loading-center"><div className="spinner" /></div> : (
        <div className="card">
          <div className="table-wrapper">
            {tab === 'sales' && (
              <table>
                <thead><tr><th>Invoice</th><th>Retailer</th><th>Total</th><th>Paid</th><th>Balance</th><th>Status</th><th>Date</th></tr></thead>
                <tbody>
                  {data.length === 0 && <tr><td colSpan={7}><div className="empty-state"><div className="empty-icon">📄</div><p>No data</p></div></td></tr>}
                  {data.map(r => (
                    <tr key={r._id}>
                      <td><strong>{r.invoiceNumber}</strong></td>
                      <td>{r.retailerName || r.retailer?.name}</td>
                      <td style={{ fontWeight: 700 }}>{fmt(r.total)}</td>
                      <td>{fmt(r.paid)}</td>
                      <td style={{ color: r.balance > 0 ? 'var(--danger)' : 'var(--success)' }}>{fmt(r.balance)}</td>
                      <td><span className={`badge badge-${r.status === 'paid' ? 'success' : 'warning'}`}>{r.status}</span></td>
                      <td className="text-muted">{new Date(r.saleDate).toLocaleDateString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {tab === 'retailer' && (
              <table>
                <thead><tr><th>Retailer</th><th>Total Sales</th><th>Total Paid</th><th>Total Balance</th><th>Orders</th></tr></thead>
                <tbody>
                  {data.length === 0 && <tr><td colSpan={5}><div className="empty-state"><p>No data</p></div></td></tr>}
                  {data.map(r => (
                    <tr key={r._id}>
                      <td><strong>{r.name}</strong></td>
                      <td style={{ fontWeight: 700, color: 'var(--primary)' }}>{fmt(r.totalSales)}</td>
                      <td style={{ color: 'var(--success)' }}>{fmt(r.totalPaid)}</td>
                      <td style={{ color: r.totalBalance > 0 ? 'var(--danger)' : 'var(--success)' }}>{fmt(r.totalBalance)}</td>
                      <td className="text-muted">{r.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {tab === 'product' && (
              <table>
                <thead><tr><th>Product</th><th>Qty Sold</th><th>Revenue</th></tr></thead>
                <tbody>
                  {data.length === 0 && <tr><td colSpan={3}><div className="empty-state"><p>No data</p></div></td></tr>}
                  {data.map(r => (
                    <tr key={r._id}>
                      <td><strong>{r.name}</strong></td>
                      <td>{r.totalQty}</td>
                      <td style={{ fontWeight: 700, color: 'var(--primary)' }}>{fmt(r.totalRevenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
