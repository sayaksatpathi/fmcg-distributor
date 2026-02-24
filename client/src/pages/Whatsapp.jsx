import React, { useEffect, useState } from 'react'
import api from '../api'
import toast from 'react-hot-toast'

const TEMPLATES = [
  { label: 'Payment Due', msg: 'Dear {name}, your payment of ₹{amount} is due. Please clear at the earliest. Thanks.' },
  { label: 'Order Placed', msg: 'Dear {name}, your order has been placed successfully. It will be delivered shortly.' },
  { label: 'Delivery Done', msg: 'Dear {name}, your delivery has been completed. Please confirm receipt. Thanks.' },
  { label: 'Thank You', msg: 'Dear {name}, thank you for your business! We appreciate your continued support.' },
]

export default function Whatsapp() {
  const [retailers, setRetailers] = useState([])
  const [retailer, setRetailer] = useState('')
  const [message, setMessage] = useState('')
  const [phone, setPhone] = useState('')
  const [outstandings, setOutstandings] = useState([])

  useEffect(() => {
    api.get('/retailers?limit=200').then(r => {
      const list = r.data.retailers || r.data
      setRetailers(list)
      setOutstandings(list.filter(r => r.outstandingBalance > 0))
    })
  }, [])

  const handleRetailerChange = (id) => {
    setRetailer(id)
    const r = retailers.find(r => r._id === id)
    if (r) setPhone(r.phone)
  }

  const applyTemplate = (tpl) => {
    const r = retailers.find(r => r._id === retailer)
    let msg = tpl.msg
    if (r) {
      msg = msg.replace('{name}', r.name)
      msg = msg.replace('{amount}', `₹${r.outstandingBalance?.toLocaleString('en-IN') || '0'}`)
    }
    setMessage(msg)
  }

  const sendWhatsApp = async () => {
    if (!phone) { toast.error('Enter a phone number'); return }
    if (!message) { toast.error('Enter a message'); return }
    const clean = phone.replace(/\D/g, '')
    const number = clean.startsWith('91') ? clean : `91${clean}`
    const url = `https://wa.me/${number}?text=${encodeURIComponent(message)}`
    window.open(url, '_blank')
    toast.success('WhatsApp opened in new tab!')
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">WhatsApp Messages</h1>
      </div>
      <div className="grid grid-2" style={{ gap: 20 }}>
        <div className="card">
          <h3 style={{ marginBottom: 20, fontWeight: 700 }}>📤 Send Message</h3>
          <div className="form-group">
            <label className="form-label">Retailer (optional)</label>
            <select className="form-control" value={retailer} onChange={e => handleRetailerChange(e.target.value)}>
              <option value="">Select retailer or enter phone manually</option>
              {retailers.map(r => <option key={r._id} value={r._id}>{r.name} — {r.phone}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Phone Number *</label>
            <input className="form-control" placeholder="e.g. 9876543210" value={phone} onChange={e => setPhone(e.target.value)} />
            <span className="text-muted text-sm">India (+91) code will be added automatically</span>
          </div>
          <div className="form-group">
            <label className="form-label">Message *</label>
            <textarea className="form-control" rows={5} placeholder="Type your message here..." value={message} onChange={e => setMessage(e.target.value)} style={{ resize: 'vertical' }} />
          </div>
          <button className="btn btn-primary" style={{ width: '100%' }} onClick={sendWhatsApp}>
            📱 Open WhatsApp
          </button>
        </div>
        <div>
          <div className="card" style={{ marginBottom: 20 }}>
            <h3 style={{ marginBottom: 16, fontWeight: 700 }}>⚡ Quick Templates</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {TEMPLATES.map(t => (
                <button key={t.label} className="btn btn-secondary" style={{ textAlign: 'left', justifyContent: 'flex-start' }} onClick={() => applyTemplate(t)}>
                  <div style={{ fontWeight: 600 }}>{t.label}</div>
                  <div className="text-muted text-sm" style={{ marginTop: 2, whiteSpace: 'normal' }}>{t.msg.slice(0, 60)}...</div>
                </button>
              ))}
            </div>
          </div>
          {outstandings.length > 0 && (
            <div className="card">
              <h3 style={{ marginBottom: 16, fontWeight: 700 }}>🔔 Pending Payments</h3>
              <div style={{ maxHeight: 240, overflowY: 'auto' }}>
                {outstandings.map(r => (
                  <div key={r._id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{r.name}</div>
                      <div className="text-muted text-sm">{r.phone}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ color: 'var(--danger)', fontWeight: 700 }}>₹{r.outstandingBalance?.toLocaleString('en-IN')}</div>
                      <button className="btn btn-secondary" style={{ padding: '3px 10px', fontSize: 12, marginTop: 4 }}
                        onClick={() => { handleRetailerChange(r._id); applyTemplate(TEMPLATES[0]) }}>
                        Quick Remind
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
