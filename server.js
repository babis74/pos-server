require('dotenv').config()
const express    = require('express')
const cors       = require('cors')
const nodePath   = require('path')
const app        = express()

app.use(cors())
app.use(express.json())
app.use(express.static(nodePath.join(__dirname, 'public')))
app.get('/', (req, res) => {
  res.sendFile(nodePath.join(__dirname, 'public', 'pos-dashboard.html'))
})
const SUPA_URL = process.env.SUPABASE_URL
const SUPA_KEY = process.env.SUPABASE_KEY

// Helper — μιλάει με Supabase
async function supa(method, endpoint, body) {
  const fetch = (await import('node-fetch')).default
  const opts = {
    method,
    headers: {
      'apikey': SUPA_KEY,
      'Authorization': 'Bearer ' + SUPA_KEY,
      'Content-Type': 'application/json',
      'Prefer': method === 'POST' ? 'return=representation' : ''
    }
  }
  if (body) opts.body = JSON.stringify(body)
  const res = await fetch(SUPA_URL + '/rest/v1/' + endpoint, opts)
  const txt = await res.text()
  return txt ? JSON.parse(txt) : null
}

// ─── ENDPOINTS ────────────────────────────────

// GET /api/products — όλα τα προϊόντα
app.get('/api/products', async (req, res) => {
  try {
    const data = await supa('GET', 'products?select=*&order=id')
    res.json(data)
  } catch(e) {
    res.status(500).json({ error: e.message })
  }
})

// GET /api/sales — ιστορικό πωλήσεων
app.get('/api/sales', async (req, res) => {
  try {
    const data = await supa('GET', 'sales?select=*&order=created_at.desc&limit=20')
    res.json(data)
  } catch(e) {
    res.status(500).json({ error: e.message })
  }
})

// POST /api/sales — νέα πώληση
app.post('/api/sales', async (req, res) => {
  try {
    const { items, total, net, vat } = req.body
    for (const item of items) {
      await supa('PATCH', `products?id=eq.${item.id}`, {
        stock: item.newStock
      })
    }
    const saved = await supa('POST', 'sales', { total, net, vat, items })
    res.json({ success: true, sale: saved[0] })
  } catch(e) {
    res.status(500).json({ error: e.message })
  }
})

// GET /api/report — σύνολο σημερινών πωλήσεων
app.get('/api/report', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0]
    const data  = await supa('GET', `sales?created_at=gte.${today}&select=total,net,vat`)
    const total = data.reduce((s, r) => s + Number(r.total), 0)
    const net   = data.reduce((s, r) => s + Number(r.net),   0)
    const vat   = data.reduce((s, r) => s + Number(r.vat),   0)
    res.json({ count: data.length, total, net, vat })
  } catch(e) {
    res.status(500).json({ error: e.message })
  }
})

// ─── START ────────────────────────────────────
const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`✅ Server τρέχει στο http://localhost:${PORT}`)
  console.log(`📦 GET  http://localhost:${PORT}/api/products`)
  console.log(`📋 GET  http://localhost:${PORT}/api/sales`)
  console.log(`💰 POST http://localhost:${PORT}/api/sales`)
  console.log(`📊 GET  http://localhost:${PORT}/api/report`)
})
