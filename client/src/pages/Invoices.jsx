import React, { useEffect, useState } from 'react'
import api from '../api'
import toast from 'react-hot-toast'

const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`

export default function Invoices() {
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    api.get('/invoices').then(r => setInvoices(r.data.invoices || [])).catch(() => toast.error('Failed to load')).finally(() => setLoading(false))
  }, [])

  const printInvoice = (inv) => {
    const items = inv.items?.map(i => `<tr><td>${i.skuName}</td><td>${i.quantity}</td><td>${fmt(i.price)}</td><td>${fmt(i.total)}</td></tr>`).join('')
    const html = `<!DOCTYPE html><html><head><title>Invoice ${inv.invoiceNumber}</title><style>body{font-family:sans-serif;padding:20px}table{width:100%;border-collapse:collapse}td,th{border:1px solid #ddd;padding:8px}h1{color:#6366f1}.total{font-size:18px;font-weight:bold}</style></head><body><h1>Invoice: ${inv.invoiceNumber}</h1><p>Retailer: <strong>${inv.retailerName || inv.retailer?.name}</strong></p><p>Date: ${new Date(inv.saleDate).toLocaleDateString('en-IN')}</p><table><thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead><tbody>${items}</tbody></table><p class="total">Grand Total: ${fmt(inv.total)}</p><p>Paid: ${fmt(inv.paid)} | Balance: ${fmt(inv.balance)}</p></body></html>`
    const w = window.open('', '_blank')
    w.document.write(html)
    w.document.close(); w.print()
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Invoices</h1>
      </div>
      {loading ? <div className="loading-center"><div className="spinner" /></div> : (
        <div className="card">
          <div className="table-wrapper">
            <table>
              <thead><tr><th>Invoice #</th><th>Retailer</th><th>Total</th><th>Paid</th><th>Balance</th><th>Status</th><th>Date</th><th>Actions</th></tr></thead>
              <tbody>
                {invoices.length === 0 && <tr><td colSpan={8}><div className="empty-state"><div className="empty-icon">🧾</div><p>No invoices</p></div></td></tr>}
                {invoices.map(inv => (
                  <tr key={inv._id}>
                    <td><strong>{inv.invoiceNumber}</strong></td>
                    <td>{inv.retailerName || inv.retailer?.name}</td>
                    <td style={{ fontWeight: 700 }}>{fmt(inv.total)}</td>
                    <td style={{ color: 'var(--success)' }}>{fmt(inv.paid)}</td>
                    <td style={{ color: inv.balance > 0 ? 'var(--danger)' : 'var(--success)', fontWeight: 600 }}>{fmt(inv.balance)}</td>
                    <td><span className={`badge badge-${inv.status === 'paid' ? 'success' : inv.status === 'partial' ? 'warning' : 'neutral'}`}>{inv.status}</span></td>
                    <td className="text-muted">{new Date(inv.saleDate).toLocaleDateString('en-IN')}</td>
                    <td><button className="btn btn-sm btn-secondary" onClick={() => printInvoice(inv)}>🖨️ Print</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
