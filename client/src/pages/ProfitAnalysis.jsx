import React, { useEffect, useState } from 'react'
import api from '../api'
import toast from 'react-hot-toast'
import { Doughnut, Bar } from 'react-chartjs-2'
import { Chart as ChartJS, ArcElement, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from 'chart.js'

ChartJS.register(ArcElement, CategoryScale, LinearScale, BarElement, Tooltip, Legend)

const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`

export default function ProfitAnalysis() {
  const [summary, setSummary] = useState(null)
  const [bySku, setBySku] = useState([])
  const [loading, setLoading] = useState(true)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const [s, b] = await Promise.all([
        api.get('/profit/summary', { params: { from: from || undefined, to: to || undefined } }),
        api.get('/profit/by-sku')
      ])
      setSummary(s.data); setBySku(b.data)
    } catch { toast.error('Failed to load') } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const doughnutData = summary ? {
    labels: ['COGS', 'Gross Profit'],
    datasets: [{ data: [summary.cogs, summary.grossProfit], backgroundColor: ['#f87171', '#4ade80'], borderWidth: 0 }]
  } : null

  const barData = {
    labels: bySku.map(s => s.name?.slice(0, 15)),
    datasets: [{ label: 'Revenue', data: bySku.map(s => s.revenue), backgroundColor: 'rgba(99,102,241,.8)', borderRadius: 6 }]
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Profit Analysis</h1>
        <div className="flex gap-2 items-center">
          <input className="form-control" type="date" value={from} onChange={e => setFrom(e.target.value)} />
          <input className="form-control" type="date" value={to} onChange={e => setTo(e.target.value)} />
          <button className="btn btn-primary" onClick={load}>Apply</button>
        </div>
      </div>
      {loading ? <div className="loading-center"><div className="spinner" /></div> : (
        <>
          <div className="grid grid-4" style={{ marginBottom: 24 }}>
            <div className="stat-card" style={{ borderLeft: '4px solid var(--primary)' }}>
              <div className="stat-value">{fmt(summary?.revenue)}</div>
              <div className="stat-label">Revenue</div>
            </div>
            <div className="stat-card" style={{ borderLeft: '4px solid var(--danger)' }}>
              <div className="stat-value">{fmt(summary?.cogs)}</div>
              <div className="stat-label">COGS</div>
            </div>
            <div className="stat-card" style={{ borderLeft: '4px solid var(--success)' }}>
              <div className="stat-value">{fmt(summary?.grossProfit)}</div>
              <div className="stat-label">Gross Profit</div>
            </div>
            <div className="stat-card" style={{ borderLeft: '4px solid var(--warning)' }}>
              <div className="stat-value">{summary?.margin}%</div>
              <div className="stat-label">Profit Margin</div>
            </div>
          </div>
          <div className="grid grid-2" style={{ gap: 20 }}>
            {doughnutData && (
              <div className="card">
                <h3 style={{ marginBottom: 16, fontWeight: 700 }}>Revenue Breakdown</h3>
                <div style={{ maxWidth: 300, margin: '0 auto' }}>
                  <Doughnut data={doughnutData} options={{ plugins: { legend: { position: 'bottom' } } }} />
                </div>
              </div>
            )}
            <div className="card">
              <h3 style={{ marginBottom: 16, fontWeight: 700 }}>Top Products by Revenue</h3>
              {bySku.length > 0 ? <Bar data={barData} options={{ responsive: true, indexAxis: 'y', plugins: { legend: { display: false } } }} /> : <div className="empty-state"><p>No data</p></div>}
            </div>
          </div>
          <div className="card" style={{ marginTop: 20 }}>
            <h3 style={{ marginBottom: 16, fontWeight: 700 }}>Product-wise Revenue</h3>
            <div className="table-wrapper">
              <table>
                <thead><tr><th>Product</th><th>Qty Sold</th><th>Revenue</th></tr></thead>
                <tbody>
                  {bySku.map(s => (
                    <tr key={s._id}>
                      <td><strong>{s.name}</strong></td>
                      <td>{s.qty}</td>
                      <td style={{ fontWeight: 700, color: 'var(--primary)' }}>{fmt(s.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
