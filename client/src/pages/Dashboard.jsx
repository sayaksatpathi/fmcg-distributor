import React, { useEffect, useState } from 'react'
import api from '../api'
import toast from 'react-hot-toast'
import { Bar, Doughnut } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement,
  ArcElement, Tooltip, Legend, Title
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend, Title)

const fmt = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)

export default function Dashboard() {
  const [summary, setSummary] = useState(null)
  const [topRetailers, setTopRetailers] = useState([])
  const [recentActivity, setRecentActivity] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [s, t, r] = await Promise.all([
          api.get('/dashboard/summary'),
          api.get('/dashboard/top-retailers'),
          api.get('/dashboard/recent-activity'),
        ])
        setSummary(s.data)
        setTopRetailers(t.data)
        setRecentActivity(r.data)
      } catch { toast.error('Failed to load dashboard') }
      finally { setLoading(false) }
    }
    fetchAll()
  }, [])

  if (loading) return <div className="loading-center"><div className="spinner" /></div>

  const monthLabels = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const chartData = {
    labels: summary?.monthlySalesChart?.map(m => monthLabels[m._id.month - 1]) || [],
    datasets: [{
      label: 'Monthly Sales (₹)',
      data: summary?.monthlySalesChart?.map(m => m.total) || [],
      backgroundColor: 'rgba(99,102,241,.8)',
      borderRadius: 8,
    }]
  }

  const stats = [
    { label: 'Sales Today',       value: fmt(summary?.salesToday?.total || 0),   sub: `${summary?.salesToday?.count || 0} orders`,   color: '#6366f1', icon: '🛒' },
    { label: 'Monthly Sales',     value: fmt(summary?.salesMonth?.total || 0),   sub: `${summary?.salesMonth?.count || 0} orders`,   color: '#22c55e', icon: '📊' },
    { label: 'Pending Payments',  value: fmt(summary?.pendingPayments?.total || 0), sub: `${summary?.pendingPayments?.count || 0} retailers`, color: '#f59e0b', icon: '💳' },
    { label: 'Active Retailers',  value: summary?.totalRetailers || 0,            sub: 'in system',                                  color: '#3b82f6', icon: '🏪' },
    { label: 'Low Stock Items',   value: summary?.lowStockCount || 0,             sub: 'need reorder',                               color: '#ef4444', icon: '⚠️' },
    { label: 'Pending Returns',   value: summary?.pendingReturns || 0,            sub: 'awaiting action',                            color: '#8b5cf6', icon: '↩️' },
  ]

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p style={{ color: 'var(--text-muted)', marginTop: -16 }}>Overview &bull; {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-3" style={{ marginBottom: 24 }}>
        {stats.map(s => (
          <div key={s.label} className="stat-card" style={{ borderLeft: `4px solid ${s.color}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div className="stat-value">{s.value}</div>
                <div className="stat-label">{s.label}</div>
                <div className="stat-delta text-muted">{s.sub}</div>
              </div>
              <span style={{ fontSize: 28 }}>{s.icon}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-2" style={{ gap: 20 }}>
        {/* Chart */}
        <div className="card">
          <h3 style={{ marginBottom: 16, fontWeight: 700 }}>Monthly Sales Trend</h3>
          <Bar data={chartData} options={{ responsive: true, plugins: { legend: { display: false } } }} />
        </div>

        {/* Top Retailers */}
        <div className="card">
          <h3 style={{ marginBottom: 16, fontWeight: 700 }}>Top Retailers This Month</h3>
          {topRetailers.length === 0 ? (
            <div className="empty-state"><div className="empty-icon">🏪</div><p>No sales this month yet</p></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {topRetailers.map((r, i) => (
                <div key={r._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ width: 24, height: 24, background: 'var(--primary-light)', color: 'var(--primary)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>{i + 1}</span>
                    <span style={{ fontWeight: 500 }}>{r.name}</span>
                  </div>
                  <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{fmt(r.total)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="card" style={{ marginTop: 20 }}>
        <h3 style={{ marginBottom: 16, fontWeight: 700 }}>Recent Sales</h3>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Retailer</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {recentActivity.length === 0 && (
                <tr><td colSpan={5} className="empty-state">No recent activity</td></tr>
              )}
              {recentActivity.map(s => (
                <tr key={s._id}>
                  <td><strong>{s.invoiceNumber}</strong></td>
                  <td>{s.retailerName}</td>
                  <td>{fmt(s.total)}</td>
                  <td>
                    <span className={`badge badge-${s.status === 'paid' ? 'success' : s.status === 'partial' ? 'warning' : s.status === 'cancelled' ? 'danger' : 'neutral'}`}>
                      {s.status}
                    </span>
                  </td>
                  <td className="text-muted">{new Date(s.createdAt).toLocaleDateString('en-IN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
