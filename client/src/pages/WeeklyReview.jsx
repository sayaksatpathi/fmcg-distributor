import React, { useEffect, useState } from 'react'
import api from '../api'
import toast from 'react-hot-toast'
import { Bar } from 'react-chartjs-2'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip } from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip)

const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function WeeklyReview() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/weekly-review').then(r => setData(r.data)).catch(() => toast.error('Failed')).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="loading-center"><div className="spinner" /></div>

  const chartData = {
    labels: data?.dailyBreakdown?.map(d => DAYS[d._id - 1]) || [],
    datasets: [{
      label: 'Sales',
      data: data?.dailyBreakdown?.map(d => d.total) || [],
      backgroundColor: 'rgba(99,102,241,.8)',
      borderRadius: 8,
    }]
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Weekly Review</h1>
        <div className="text-muted">{new Date(data?.weekStart).toLocaleDateString('en-IN')} — {new Date(data?.weekEnd).toLocaleDateString('en-IN')}</div>
      </div>
      <div className="grid grid-2" style={{ marginBottom: 20 }}>
        <div className="stat-card" style={{ borderLeft: '4px solid var(--primary)' }}>
          <div className="stat-value">{fmt(data?.summary?.total || 0)}</div>
          <div className="stat-label">Weekly Revenue</div>
        </div>
        <div className="stat-card" style={{ borderLeft: '4px solid var(--success)' }}>
          <div className="stat-value">{data?.summary?.count || 0}</div>
          <div className="stat-label">Total Orders</div>
        </div>
      </div>
      <div className="card">
        <h3 style={{ marginBottom: 16, fontWeight: 700 }}>Daily Breakdown</h3>
        {data?.dailyBreakdown?.length > 0 ? (
          <Bar data={chartData} options={{ responsive: true, plugins: { legend: { display: false } } }} />
        ) : (
          <div className="empty-state"><div className="empty-icon">📅</div><p>No sales this week</p></div>
        )}
      </div>
    </div>
  )
}
