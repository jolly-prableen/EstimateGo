const cors = require('cors');
const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const port = Number(process.env.PORT || 4000);
const dataFile = path.join(__dirname, 'data.json');

app.use(cors());
app.use(express.json());

const seed = {
  profile: {
    name: 'Veloce Wholesale',
    address: 'Main Market, New Delhi',
    phone: '+91 98765 43210',
    tax_id: '',
    payment_terms: 'Due on receipt',
  },
  products: [
    { id: 'PRD-1001', name: 'Premium Rice Bag', sku: 'RICE-25KG', stock: 42, price: 1850, unit: 'bags' },
    { id: 'PRD-1002', name: 'Refined Oil Carton', sku: 'OIL-15L', stock: 18, price: 2200, unit: 'cartons' },
    { id: 'PRD-1003', name: 'Sugar Sack', sku: 'SUGAR-50KG', stock: 8, price: 4100, unit: 'sacks' },
  ],
  bills: [],
  documents: [],
};

function readData() {
  if (!fs.existsSync(dataFile)) {
    writeData(seed);
  }
  return JSON.parse(fs.readFileSync(dataFile, 'utf8'));
}

function writeData(data) {
  fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
}

function nextId(prefix, items) {
  return `${prefix}-${String(items.length + 1).padStart(4, '0')}`;
}

app.get('/api', (_req, res) => {
  res.json({ message: 'Wholesale billing API' });
});

app.get('/api/dashboard', (_req, res) => {
  const data = readData();
  const total_sales = data.bills.reduce((sum, bill) => sum + Number(bill.total || 0), 0);
  res.json({ total_sales, bill_count: data.bills.length });
});

app.get('/api/products', (_req, res) => {
  res.json(readData().products);
});

app.post('/api/products', (req, res) => {
  const data = readData();
  const product = {
    id: nextId('PRD', data.products),
    name: String(req.body.name || '').trim(),
    sku: req.body.sku || `SKU-${Date.now()}`,
    stock: Number(req.body.stock || 0),
    price: Number(req.body.price || 0),
    unit: req.body.unit || 'pcs',
  };

  if (!product.name) return res.status(400).json({ error: 'Product name is required' });

  data.products.push(product);
  writeData(data);
  res.status(201).json(product);
});

app.get('/api/bills', (_req, res) => {
  const data = readData();
  res.json([...data.bills].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
});

app.post('/api/bills', (req, res) => {
  const data = readData();
  const items = Array.isArray(req.body.items) ? req.body.items : [];
  const subtotal = items.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0);
  const tax = Number(req.body.tax_rate ?? req.body.tax ?? 0);
  const total = Math.round(subtotal + subtotal * (tax / 100));
  const bill = {
    id: nextId('BILL', data.bills),
    customer: String(req.body.customer || '').trim(),
    items,
    subtotal,
    tax,
    total,
    payment_status: 'Pending',
    created_at: new Date().toISOString(),
  };

  if (!bill.customer || !items.length) {
    return res.status(400).json({ error: 'Customer and at least one item are required' });
  }

  data.bills.push(bill);
  writeData(data);
  res.status(201).json(bill);
});

app.patch('/api/bills/:id/status', (req, res) => {
  const data = readData();
  const bill = data.bills.find((item) => item.id === req.params.id);
  if (!bill) return res.status(404).json({ error: 'Bill not found' });

  if (req.body.payment_status) {
    bill.payment_status = req.body.payment_status;
  }

  writeData(data);
  res.json(bill);
});

app.get('/api/documents', (_req, res) => {
  res.json(readData().documents);
});

app.post('/api/documents', (req, res) => {
  const data = readData();
  const document = {
    id: nextId('DOC', data.documents),
    name: String(req.body.name || '').trim(),
    category: req.body.category || 'Other',
    created_at: new Date().toISOString(),
  };

  if (!document.name) return res.status(400).json({ error: 'Document name is required' });

  data.documents.push(document);
  writeData(data);
  res.status(201).json(document);
});

app.get('/api/profile', (_req, res) => {
  res.json(readData().profile);
});

app.put('/api/profile', (req, res) => {
  const data = readData();
  data.profile = {
    ...data.profile,
    name: req.body.name || '',
    address: req.body.address || '',
    phone: req.body.phone || '',
    tax_id: req.body.tax_id || '',
    payment_terms: req.body.payment_terms || 'Due on receipt',
  };
  writeData(data);
  res.json(data.profile);
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Billing API running on http://localhost:${port}`);
});
