const cors = require('cors');
const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const port = Number(process.env.PORT || 4000);
const dataFile = path.join(__dirname, 'data.json');
const SALT = 'estimatego-v1';

app.use(cors());
app.use(express.json());

const hash = (pw) => crypto.createHash('sha256').update(SALT + pw).digest('hex');

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
  customers: [],
  recurring: [],
  users: [
    { id: 'USR-0001', username: 'admin', password: hash('admin123'), role: 'admin' },
    { id: 'USR-0002', username: 'staff', password: hash('staff123'), role: 'staff' },
  ],
  sessions: {},
};

function readData() {
  let changed = false;
  let data;
  if (!fs.existsSync(dataFile)) {
    data = JSON.parse(JSON.stringify(seed));
    writeData(data);
    return data;
  }
  data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
  for (const key of ['users', 'customers', 'sessions', 'recurring']) {
    if (!data[key]) {
      data[key] = JSON.parse(JSON.stringify(seed[key]));
      changed = true;
    }
  }
  if (!data.users.some((u) => u.username === 'admin')) {
    data.users.push({ id: 'USR-' + String(data.users.length + 1).padStart(4, '0'), username: 'admin', password: hash('admin123'), role: 'admin' });
    changed = true;
  }
  if (changed) writeData(data);
  return data;
}

function writeData(data) {
  fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
}

function nextId(prefix, items) {
  return `${prefix}-${String(items.length + 1).padStart(4, '0')}`;
}

function applyStock(data, items, sign) {
  for (const item of items || []) {
    const qty = Number(item.quantity || 0);
    if (!qty) continue;
    const product =
      (item.productId && data.products.find((p) => p.id === item.productId)) ||
      data.products.find((p) => p.name.toLowerCase() === String(item.name || '').toLowerCase());
    if (product) product.stock = Number(product.stock || 0) + sign * qty;
  }
}

function requireAuth(req, res, next) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '') || req.query.token || '';
  const session = readData().sessions[token];
  if (!session) return res.status(401).json({ error: 'Please sign in' });
  req.user = session;
  req.token = token;
  next();
}

function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  next();
}

app.post('/api/login', (req, res) => {
  const data = readData();
  const username = String(req.body.username || '').trim();
  const user = data.users.find((u) => u.username === username);
  if (!user || user.password !== hash(String(req.body.password || ''))) {
    return res.status(401).json({ error: 'Wrong username or password' });
  }
  const token = crypto.randomBytes(24).toString('hex');
  data.sessions[token] = { username: user.username, role: user.role, created_at: new Date().toISOString() };
  writeData(data);
  res.json({ token, user: { username: user.username, role: user.role } });
});

app.get('/api/me', requireAuth, (req, res) => {
  res.json({ username: req.user.username, role: req.user.role });
});

app.get('/api/dashboard', requireAuth, (_req, res) => {
  const data = readData();
  const dayKey = (iso) => new Date(iso).toLocaleDateString('en-CA');
  const today = dayKey(new Date());
  const days = {};
  let lifetime_sales = 0;
  for (const bill of data.bills) {
    const t = Number(bill.total || 0);
    lifetime_sales += t;
    const key = dayKey(bill.created_at);
    if (!days[key]) days[key] = { date: key, total_sales: 0, bill_count: 0 };
    days[key].total_sales += t;
    days[key].bill_count += 1;
  }
  const dayList = Object.values(days).sort((a, b) => (a.date < b.date ? 1 : -1));
  res.json({
    total_sales: days[today] ? days[today].total_sales : 0,
    bill_count: days[today] ? days[today].bill_count : 0,
    lifetime_sales,
    lifetime_bill_count: data.bills.length,
    days: dayList,
  });
});

app.get('/api/products', requireAuth, (_req, res) => {
  res.json(readData().products);
});

app.post('/api/products', requireAuth, (req, res) => {
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

app.get('/api/customers', requireAuth, (_req, res) => {
  const data = readData();
  const customers = data.customers.map((c) => {
    const dues = data.bills
      .filter((b) => b.customer.toLowerCase() === c.name.toLowerCase() && b.payment_status !== 'Paid')
      .reduce((s, b) => s + Number(b.total || 0), 0);
    const open_bills = data.bills.filter((b) => b.customer.toLowerCase() === c.name.toLowerCase() && b.payment_status !== 'Paid').length;
    return { ...c, dues, open_bills };
  });
  res.json(customers);
});

app.post('/api/customers', requireAuth, (req, res) => {
  const data = readData();
  const name = String(req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Customer name is required' });

  const existing = data.customers.find((c) => c.name.toLowerCase() === name.toLowerCase());
  if (existing) {
    existing.phone = req.body.phone || existing.phone;
    existing.address = req.body.address || existing.address;
    writeData(data);
    return res.json(existing);
  }

  const customer = {
    id: nextId('CUS', data.customers),
    name,
    phone: String(req.body.phone || ''),
    address: String(req.body.address || ''),
    created_at: new Date().toISOString(),
  };
  data.customers.push(customer);
  writeData(data);
  res.status(201).json(customer);
});

app.get('/api/bills', requireAuth, (_req, res) => {
  const data = readData();
  res.json([...data.bills].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
});

function computeTotals(items, taxRate, discountInput, discountTypeInput) {
  const subtotal = (items || []).reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0);
  const tax = Number(taxRate ?? 0);
  const discount_type = discountTypeInput === 'percent' ? 'percent' : 'flat';
  let discount = Number(discountInput || 0);
  if (!Number.isFinite(discount) || discount < 0) discount = 0;
  if (discount_type === 'percent') discount = Math.min(discount, 100);
  const discount_amount = Math.round(discount_type === 'percent' ? subtotal * (discount / 100) : Math.min(discount, subtotal));
  const taxable = subtotal - discount_amount;
  const total = Math.round(taxable + taxable * (tax / 100));
  return { subtotal, tax, discount, discount_type, discount_amount, total };
}

app.post('/api/bills', requireAuth, (req, res) => {
  const data = readData();
  const items = Array.isArray(req.body.items) ? req.body.items : [];
  const totals = computeTotals(items, req.body.tax_rate ?? req.body.tax ?? 0, req.body.discount, req.body.discount_type);
  const modes = ['Cash', 'UPI', 'Card', 'Credit'];
  const payment_mode = modes.includes(req.body.payment_mode) ? req.body.payment_mode : 'Cash';
  const bill = {
    id: nextId('BILL', data.bills),
    customer: String(req.body.customer || '').trim(),
    items,
    ...totals,
    payment_mode,
    payment_status: 'Pending',
    created_by: req.user.username,
    created_at: new Date().toISOString(),
  };

  if (!bill.customer || !items.length) {
    return res.status(400).json({ error: 'Customer and at least one item are required' });
  }

  applyStock(data, items, -1);
  data.bills.push(bill);
  writeData(data);
  res.status(201).json(bill);
});

app.put('/api/bills/:id', requireAuth, requireAdmin, (req, res) => {
  const data = readData();
  const bill = data.bills.find((item) => item.id === req.params.id);
  if (!bill) return res.status(404).json({ error: 'Bill not found' });

  const items = Array.isArray(req.body.items) ? req.body.items : [];
  const totals = computeTotals(items, req.body.tax_rate ?? req.body.tax ?? bill.tax ?? 0, req.body.discount ?? bill.discount, req.body.discount_type ?? bill.discount_type);

  applyStock(data, bill.items, +1);
  applyStock(data, items, -1);

  bill.customer = String(req.body.customer || bill.customer).trim();
  bill.items = items;
  Object.assign(bill, totals);
  if (['Cash', 'UPI', 'Card', 'Credit'].includes(req.body.payment_mode)) bill.payment_mode = req.body.payment_mode;

  writeData(data);
  res.json(bill);
});

app.delete('/api/bills/:id', requireAuth, requireAdmin, (req, res) => {
  const data = readData();
  const idx = data.bills.findIndex((item) => item.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Bill not found' });

  applyStock(data, data.bills[idx].items, +1);
  data.bills.splice(idx, 1);
  writeData(data);
  res.json({ ok: true });
});

app.patch('/api/bills/:id/status', requireAuth, (req, res) => {
  const data = readData();
  const bill = data.bills.find((item) => item.id === req.params.id);
  if (!bill) return res.status(404).json({ error: 'Bill not found' });

  if (req.body.payment_status) {
    bill.payment_status = req.body.payment_status;
  }

  writeData(data);
  res.json(bill);
});

app.get('/api/export/bills.csv', requireAuth, (_req, res) => {
  const data = readData();
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = [['Bill No', 'Date', 'Customer', 'Payment Mode', 'Status', 'Subtotal', 'Discount', 'Tax %', 'Total', 'Created By'].join(',')];
  for (const b of [...data.bills].sort((a, b2) => new Date(a.created_at) - new Date(b2.created_at))) {
    rows.push([b.id, new Date(b.created_at).toLocaleString('en-IN'), esc(b.customer), b.payment_mode || 'Cash', b.payment_status, b.subtotal, b.discount_amount || 0, b.tax, b.total, esc(b.created_by || '')].join(','));
  }
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="estimatego-bills.csv"');
  res.send('\ufeff' + rows.join('\r\n'));
});

app.get('/api/recurring', requireAuth, (_req, res) => {
  res.json(readData().recurring);
});

function advanceMonth(iso, dayOfMonth) {
  const d = new Date(iso);
  const target = new Date(d.getFullYear(), d.getMonth() + 1, 1, 12);
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(dayOfMonth, last));
  return target.toISOString();
}

function firstRunFrom(dayOfMonth) {
  const now = new Date();
  let candidate = new Date(now.getFullYear(), now.getMonth(), 1, 12);
  const last = new Date(candidate.getFullYear(), candidate.getMonth() + 1, 0).getDate();
  candidate.setDate(Math.min(dayOfMonth, last));
  if (candidate <= now) candidate = new Date(advanceMonth(candidate.toISOString(), dayOfMonth));
  return candidate.toISOString();
}

app.post('/api/recurring', requireAuth, (req, res) => {
  const data = readData();
  const items = Array.isArray(req.body.items) ? req.body.items : [];
  const customer = String(req.body.customer || '').trim();
  if (!customer || !items.length) return res.status(400).json({ error: 'Customer and at least one item are required' });

  const day = Math.max(1, Math.min(31, Number(req.body.day_of_month) || new Date().getDate()));
  const totals = computeTotals(items, req.body.tax_rate ?? 0, req.body.discount ?? 0, req.body.discount_type);
  const template = {
    id: nextId('REC', data.recurring),
    customer,
    items,
    tax_rate: totals.tax,
    discount: totals.discount,
    discount_type: totals.discount_type,
    payment_mode: ['Cash', 'UPI', 'Card', 'Credit'].includes(req.body.payment_mode) ? req.body.payment_mode : 'Cash',
    amount: totals.total,
    day_of_month: day,
    active: true,
    created_by: req.user.username,
    next_run: firstRunFrom(day),
  };
  data.recurring.push(template);
  writeData(data);
  res.status(201).json(template);
});

app.delete('/api/recurring/:id', requireAuth, requireAdmin, (req, res) => {
  const data = readData();
  const idx = data.recurring.findIndex((r) => r.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Recurring bill not found' });
  data.recurring.splice(idx, 1);
  writeData(data);
  res.json({ ok: true });
});

app.get('/api/recurring/due', requireAuth, (req, res) => {
  const now = new Date();
  const due = readData().recurring.filter((r) => r.active && new Date(r.next_run) <= now);
  res.json(due);
});

app.patch('/api/recurring/:id/run', requireAuth, (req, res) => {
  const data = readData();
  const template = data.recurring.find((r) => r.id === req.params.id);
  if (!template) return res.status(404).json({ error: 'Recurring bill not found' });
  template.last_run = new Date().toISOString();
  template.next_run = advanceMonth(template.next_run, template.day_of_month);
  writeData(data);
  res.json(template);
});

app.get('/api/documents', requireAuth, (_req, res) => {
  res.json(readData().documents);
});

app.post('/api/documents', requireAuth, (req, res) => {
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

app.get('/api/users', requireAuth, requireAdmin, (req, res) => {
  res.json(readData().users.map(({ password, ...u }) => u));
});

app.post('/api/users', requireAuth, requireAdmin, (req, res) => {
  const data = readData();
  const username = String(req.body.username || '').trim();
  const password = String(req.body.password || '');
  const role = req.body.role === 'admin' ? 'admin' : 'staff';

  if (!username || password.length < 4) {
    return res.status(400).json({ error: 'Username and a password of 4+ characters are required' });
  }
  if (data.users.some((u) => u.username === username)) {
    return res.status(400).json({ error: 'That username already exists' });
  }

  const user = { id: nextId('USR', data.users), username, password: hash(password), role };
  data.users.push(user);
  writeData(data);
  res.status(201).json({ id: user.id, username: user.username, role: user.role });
});

app.get('/api/profile', requireAuth, (_req, res) => {
  res.json(readData().profile);
});

app.put('/api/profile', requireAuth, requireAdmin, (req, res) => {
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
