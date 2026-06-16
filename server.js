const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const initSqlJs = require('sql.js');

let SQL;

class Database {
  constructor(dbPath) {
    this.path = dbPath;
    this.db = new SQL.Database(fs.existsSync(dbPath) ? fs.readFileSync(dbPath) : undefined);
  }
  exec(sql) { this.db.exec(sql); this._save(); }
  prepare(sql) {
    const stmt = this.db.prepare(sql);
    const _db = this;
    return {
      get(...p) {
        if (p.length) stmt.bind(p);
        const r = stmt.step() ? stmt.getAsObject() : undefined;
        stmt.reset();
        return r;
      },
      all(...p) {
        if (p.length) stmt.bind(p);
        const r = [];
        while (stmt.step()) r.push(stmt.getAsObject());
        stmt.reset();
        return r;
      },
      run(...p) {
        try {
          _db.db.run(sql, p);
        } catch (err) {
          throw err;
        }
        const res = _db.db.exec('SELECT last_insert_rowid() id, changes() changes');
        const lastInsertRowid = res[0].values[0][0];
        const changes = res[0].values[0][1];
        _db._save();
        return { lastInsertRowid, changes };
      },
    };
  }
  close() { this._save(); this.db.close(); }
  _save() { fs.writeFileSync(this.path, Buffer.from(this.db.export())); }
}

module.exports = async function createApp() {
  SQL = await initSqlJs();

  const app = express();
  const PORT = process.env.PORT || 3000;
  const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
  const PHOTOS_DIR = path.join(DATA_DIR, 'photos');
  const DB_PATH = path.join(DATA_DIR, 'marina.db');

  [DATA_DIR, PHOTOS_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });

  // ─── DATABASE SETUP ───────────────────────────────────────────────────────────
  const db = new Database(DB_PATH);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');

  function generateCustomerToken() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let token = '';
    for (let i = 0; i < 8; i++) token += chars.charAt(Math.floor(Math.random() * chars.length));
    return token;
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'mechanic',
      initials TEXT,
      pin_hash TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS device_tokens (
      token TEXT PRIMARY KEY,
      employee_id INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      address TEXT,
      city TEXT,
      postal_code TEXT,
      phone TEXT,
      email TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS boats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      name TEXT,
      motor_type TEXT,
      serial_no TEXT,
      model TEXT,
      licence TEXT,
      trailer_licence TEXT,
      rate_type TEXT DEFAULT 'SW',
      length_ft REAL,
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    );

    CREATE TABLE IF NOT EXISTS service_cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      work_order_no TEXT,
      boat_id INTEGER NOT NULL,
      season_year INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'intake',
      storage_type TEXT,
      storage_location TEXT,
      wrap_required INTEGER DEFAULT 0,
      remarks TEXT,
      other_work TEXT,
      date_in TEXT,
      date_out TEXT,
      invoice_number TEXT,
      created_by INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (boat_id) REFERENCES boats(id),
      FOREIGN KEY (created_by) REFERENCES employees(id)
    );

    CREATE TABLE IF NOT EXISTS received_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      card_id INTEGER NOT NULL,
      item TEXT NOT NULL,
      present INTEGER DEFAULT 0,
      notes TEXT,
      UNIQUE(card_id, item),
      FOREIGN KEY (card_id) REFERENCES service_cards(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS authorized_work (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      card_id INTEGER NOT NULL,
      service_type TEXT NOT NULL,
      authorized INTEGER DEFAULT 0,
      completed INTEGER DEFAULT 0,
      notes TEXT,
      UNIQUE(card_id, service_type),
      FOREIGN KEY (card_id) REFERENCES service_cards(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS condition_assessment (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      card_id INTEGER NOT NULL,
      area TEXT NOT NULL,
      rating TEXT,
      notes TEXT,
      UNIQUE(card_id, area),
      FOREIGN KEY (card_id) REFERENCES service_cards(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS work_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      card_id INTEGER NOT NULL,
      employee_id INTEGER NOT NULL,
      log_date TEXT NOT NULL,
      description TEXT,
      transcription TEXT,
      voice_url TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (card_id) REFERENCES service_cards(id) ON DELETE CASCADE,
      FOREIGN KEY (employee_id) REFERENCES employees(id)
    );

    CREATE TABLE IF NOT EXISTS parts_used (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      work_log_id INTEGER NOT NULL,
      part_number TEXT,
      description TEXT NOT NULL,
      quantity REAL DEFAULT 1,
      FOREIGN KEY (work_log_id) REFERENCES work_logs(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS photos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      card_id INTEGER NOT NULL,
      work_log_id INTEGER,
      filename TEXT NOT NULL,
      photo_type TEXT DEFAULT 'general',
      caption TEXT,
      uploaded_by INTEGER,
      uploaded_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (card_id) REFERENCES service_cards(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS checklist_completions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      card_id INTEGER NOT NULL,
      checklist_type TEXT NOT NULL,
      employee_id INTEGER NOT NULL,
      items_json TEXT NOT NULL DEFAULT '{}',
      completed_at TEXT,
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(card_id, checklist_type),
      FOREIGN KEY (card_id) REFERENCES service_cards(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS status_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      card_id INTEGER NOT NULL,
      from_status TEXT,
      to_status TEXT NOT NULL,
      employee_id INTEGER,
      note TEXT,
      changed_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (card_id) REFERENCES service_cards(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS storage_locations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      facility_name TEXT NOT NULL,
      facility_type TEXT NOT NULL DEFAULT 'dry_land',
      row_label TEXT,
      col_num INTEGER,
      level_num INTEGER,
      notes TEXT,
      current_card_id INTEGER,
      FOREIGN KEY (current_card_id) REFERENCES service_cards(id)
    );
  `);

  // Migrate: add trailer_licence if missing
  try { db.exec('ALTER TABLE boats ADD COLUMN trailer_licence TEXT'); } catch(e) {}

  // Migrate: add completed_by/completed_at/products_used to authorized_work
  try { db.exec('ALTER TABLE authorized_work ADD COLUMN completed_by INTEGER REFERENCES employees(id)'); } catch(e) {}
  try { db.exec('ALTER TABLE authorized_work ADD COLUMN completed_at TEXT'); } catch(e) {}
  try { db.exec("ALTER TABLE authorized_work ADD COLUMN products_used TEXT DEFAULT '[]'"); } catch(e) {}

  // Migrate: add invoice_status, tax_rate to service_cards
  try { db.exec("ALTER TABLE service_cards ADD COLUMN invoice_status TEXT DEFAULT 'draft'"); } catch(e) {}
  try { db.exec('ALTER TABLE service_cards ADD COLUMN tax_rate REAL DEFAULT 13.0'); } catch(e) {}

  // Migrate: add unwrap_done to service_cards
  try { db.exec("ALTER TABLE service_cards ADD COLUMN unwrap_done INTEGER DEFAULT 0"); } catch(e) {}

  // Migrate: add storage location structured fields
  try { db.exec("ALTER TABLE service_cards ADD COLUMN storage_building TEXT"); } catch(e) {}
  try { db.exec("ALTER TABLE service_cards ADD COLUMN storage_row TEXT"); } catch(e) {}
  try { db.exec("ALTER TABLE service_cards ADD COLUMN storage_col TEXT"); } catch(e) {}
  try { db.exec("ALTER TABLE service_cards ADD COLUMN boathouse_no INTEGER"); } catch(e) {}
  try { db.exec("ALTER TABLE service_cards ADD COLUMN slip_no INTEGER"); } catch(e) {}

  // Migrate: add customer_token for public customer view
  try { db.exec("ALTER TABLE service_cards ADD COLUMN customer_token TEXT"); } catch(e) {}
  try { db.exec("ALTER TABLE service_cards ADD COLUMN pickup_delivery TEXT DEFAULT NULL"); } catch(e) {}
  try { db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_cards_customer_token ON service_cards(customer_token)"); } catch(e) {}

  // One-time migration: backfill customer_token for existing cards
  const cardsWithoutToken = db.prepare("SELECT id FROM service_cards WHERE customer_token IS NULL OR customer_token = ''").all();
  if (cardsWithoutToken.length > 0) {
    console.log(`  \u2713 Backfilling customer_token for ${cardsWithoutToken.length} existing card(s)...`);
    const updateStmt = db.prepare('UPDATE service_cards SET customer_token = ? WHERE id = ?');
    for (const card of cardsWithoutToken) {
      let token = generateCustomerToken();
      while (db.prepare('SELECT id FROM service_cards WHERE customer_token = ?').get(token)) {
        token = generateCustomerToken();
      }
      updateStmt.run(token, card.id);
    }
    console.log('  \u2713 customer_token backfill complete');
  }

  // One-time migration: backfill work_order_no for existing cards
  const cardsWithoutWO = db.prepare("SELECT id FROM service_cards WHERE work_order_no IS NULL OR work_order_no = ''").all();
  if (cardsWithoutWO.length > 0) {
    console.log(`  \u2713 Backfilling work_order_no for ${cardsWithoutWO.length} existing card(s)...`);
    // Get the highest existing WO number to continue the sequence
    const maxWO = db.prepare("SELECT MAX(CAST(REPLACE(work_order_no, 'WO-', '') AS INTEGER)) as maxNum FROM service_cards WHERE work_order_no LIKE 'WO-%'").get();
    let nextNum = (maxWO && maxWO.maxNum) ? maxWO.maxNum + 1 : 1000;
    const updateWO = db.prepare('UPDATE service_cards SET work_order_no = ? WHERE id = ?');
    for (const card of cardsWithoutWO) {
      updateWO.run('WO-' + nextNum, card.id);
      nextNum++;
    }
    console.log('  \u2713 work_order_no backfill complete');
  }

  // Migrate: add unit_price to service_item_templates
  try { db.exec("ALTER TABLE service_item_templates ADD COLUMN unit_price REAL DEFAULT 0"); } catch(e) {}

  // Create boat_assignments table
  db.exec(`
    CREATE TABLE IF NOT EXISTS boat_assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      boat_id INTEGER NOT NULL,
      employee_id INTEGER NOT NULL,
      assigned_by INTEGER,
      assigned_at TEXT DEFAULT (datetime('now')),
      UNIQUE(boat_id, employee_id),
      FOREIGN KEY (boat_id) REFERENCES boats(id) ON DELETE CASCADE,
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
      FOREIGN KEY (assigned_by) REFERENCES employees(id)
    );
  `);

  // Create invoice_items table
  db.exec(`
    CREATE TABLE IF NOT EXISTS invoice_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      card_id INTEGER NOT NULL,
      description TEXT NOT NULL,
      quantity REAL DEFAULT 1,
      unit_price REAL DEFAULT 0,
      total REAL DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      FOREIGN KEY (card_id) REFERENCES service_cards(id) ON DELETE CASCADE
    );
  `);

  // Create products table (product catalog for autocomplete)
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      part_number TEXT,
      unit TEXT,
      category TEXT,
      unit_price REAL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Seed products from existing free-text entries if empty
  const productCount = db.prepare('SELECT COUNT(*) as c FROM products').get();
  if (productCount.c === 0) {
    const seen = new Set();
    const insert = db.prepare('INSERT OR IGNORE INTO products (name, active) VALUES (?, 1)');
    // Extract from parts_used
    const partsDescs = db.prepare('SELECT DISTINCT description FROM parts_used WHERE description IS NOT NULL AND description != \'\'').all();
    partsDescs.forEach(r => { if (!seen.has(r.description)) { seen.add(r.description); try { insert.run(r.description); } catch(e) {} } });
    // Extract from invoice_items
    const invoiceDescs = db.prepare('SELECT DISTINCT description FROM invoice_items WHERE description IS NOT NULL AND description != \'\'').all();
    invoiceDescs.forEach(r => { if (!seen.has(r.description)) { seen.add(r.description); try { insert.run(r.description); } catch(e) {} } });
    // Extract from authorized_work products_used JSON
    const workRows = db.prepare('SELECT products_used FROM authorized_work WHERE products_used IS NOT NULL').all();
    workRows.forEach(r => {
      try {
        const arr = typeof r.products_used === 'string' ? JSON.parse(r.products_used) : [];
        if (Array.isArray(arr)) arr.forEach(p => { if (p.description && !seen.has(p.description)) { seen.add(p.description); try { insert.run(p.description); } catch(e) {} } });
      } catch(e) {}
    });
    const totalSeeded = seen.size;
    if (totalSeeded > 0) console.log(`  \u2713 ${totalSeeded} products seeded from existing data`);
  }

  // Create service_item_templates table (admin-managed authorized items)
  db.exec(`
    CREATE TABLE IF NOT EXISTS service_item_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_key TEXT NOT NULL UNIQUE,
      label TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'service',
      cleaning_cat TEXT,
      sort_order INTEGER DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Seed default service_item_templates if empty
  const templateCount = db.prepare('SELECT COUNT(*) as c FROM service_item_templates').get();
  if (templateCount.c === 0) {
    const ins = db.prepare('INSERT INTO service_item_templates (item_key, label, category, cleaning_cat, sort_order) VALUES (?, ?, ?, ?, ?)');
    const serviceItems = [
      ['oil_change', 'Oil & Filter', 'service', null, 1],
      ['outdrive_service', 'Outdrive Svc', 'service', null, 2],
      ['tune_up', 'Tune-Up', 'service', null, 3],
      ['lower_unit_drain', 'Lower Unit', 'service', null, 4],
      ['prop_rebuild', 'Prop Rebuild', 'service', null, 5],
    ];
    const cleaningItems = [
      ['int_quick_wipe', 'Quick Wipe', 'cleaning', 'Interior', 8],
      ['int_power_wash', 'Power Wash', 'cleaning', 'Interior', 9],
      ['int_spotless', 'Make It Shiny & Spotless', 'cleaning', 'Interior', 10],
      ['ext_quick_wipe', 'Quick Wipe', 'cleaning', 'Exterior', 11],
      ['ext_power_wash', 'Power Wash', 'cleaning', 'Exterior', 12],
      ['ext_algae_wax', 'Algae Strip & Wax', 'cleaning', 'Exterior', 13],
      ['ext_buff_polish', 'Buff / Polish', 'cleaning', 'Exterior', 14],
    ];
    [...serviceItems, ...cleaningItems].forEach(row => ins.run(...row));
    console.log('  \u2713 Default service item templates seeded');
  }

  // Seed default admin if none exist
  const empCount = db.prepare('SELECT COUNT(*) as c FROM employees').get();
  if (empCount.c === 0) {
    const pinHash = crypto.createHash('sha256').update('0000').digest('hex');
    db.prepare(`INSERT INTO employees (name, role, initials, pin_hash) VALUES ('Admin', 'admin', 'AD', ?)`).run(pinHash);
    console.log('  \u2713 Default admin created \u2014 PIN: 0000');
    
    // Seed default customer, boat and card for testing scenarios
    const custRes = db.prepare(`INSERT INTO customers (name, phone, email) VALUES ('John Doe', '555-0101', 'john@example.com')`).run();
    const customerId = custRes.lastInsertRowid;
    const boatRes = db.prepare(`INSERT INTO boats (customer_id, name, motor_type, model, length_ft) VALUES (?, 'Sea Breeze', 'Yamaha 200', 'Sea Ray 240', 24)`).run(customerId);
    const boatId = boatRes.lastInsertRowid;
    db.prepare(`INSERT INTO service_cards (boat_id, season_year, work_order_no) VALUES (?, ?, ?)`).run(boatId, new Date().getFullYear(), 'WO-1000');
    console.log('  \u2713 Default customer, boat, and service card seeded');
  }

  // ─── MIDDLEWARE ───────────────────────────────────────────────────────────────
  app.use(express.json({ limit: '10mb' }));
  const staticDir = fs.existsSync(path.join(__dirname, 'dist'))
    ? path.join(__dirname, 'dist')
    : path.join(__dirname, 'public');
  app.use(express.static(staticDir));
  app.use('/photos', express.static(PHOTOS_DIR));

  // Health checks for GoDaddy / Kubernetes
  app.get('/_health/liveness', (req, res) => res.json({ status: 'ok' }));
  app.get('/_health/readiness', (req, res) => res.json({ status: 'ok' }));

  const storage = multer.diskStorage({
    destination: PHOTOS_DIR,
    filename: (req, file, cb) => {
      const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
      cb(null, unique + path.extname(file.originalname).toLowerCase());
    }
  });
  const upload = multer({ storage, limits: { fileSize: 25 * 1024 * 1024 } });

  function hashPin(pin) {
    return crypto.createHash('sha256').update(String(pin)).digest('hex');
  }

  function requireAuth(req, res, next) {
    const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const row = db.prepare('SELECT * FROM device_tokens WHERE token = ?').get(token);
    if (!row) return res.status(401).json({ error: 'Invalid token' });
    const emp = db.prepare('SELECT * FROM employees WHERE id = ? AND active = 1').get(row.employee_id);
    if (!emp) return res.status(401).json({ error: 'Account deactivated' });
    req.employee = emp;
    next();
  }

  function requireAdmin(req, res, next) {
    requireAuth(req, res, () => {
      if (req.employee.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
      next();
    });
  }

  function requireEditor(req, res, next) {
    requireAuth(req, res, () => {
      if (req.employee.role !== 'admin' && req.employee.role !== 'office') return res.status(403).json({ error: 'Admin or office only' });
      next();
    });
  }

  // ─── AUTH ─────────────────────────────────────────────────────────────────────
  app.post('/api/auth/login', (req, res) => {
    const { pin } = req.body;
    if (!pin) return res.status(400).json({ error: 'PIN required' });
    const emp = db.prepare('SELECT * FROM employees WHERE pin_hash = ? AND active = 1').get(hashPin(pin));
    if (!emp) return res.status(401).json({ error: 'Invalid PIN' });
    const token = crypto.randomBytes(32).toString('hex');
    db.prepare('INSERT INTO device_tokens (token, employee_id) VALUES (?, ?)').run(token, emp.id);
    res.json({ token, employee: { id: emp.id, name: emp.name, role: emp.role, initials: emp.initials } });
  });

  app.post('/api/auth/logout', requireAuth, (req, res) => {
    const token = (req.headers.authorization || '').replace('Bearer ', '');
    db.prepare('DELETE FROM device_tokens WHERE token = ?').run(token);
    res.json({ ok: true });
  });

  app.get('/api/auth/me', requireAuth, (req, res) => {
    const { id, name, role, initials } = req.employee;
    res.json({ id, name, role, initials });
  });

  // ─── EMPLOYEES ────────────────────────────────────────────────────────────────
  app.get('/api/employees', requireAuth, (req, res) => {
    res.json(db.prepare('SELECT id, name, role, initials, active, created_at FROM employees ORDER BY name').all());
  });

  app.post('/api/employees', requireAdmin, (req, res) => {
    const { name, role, initials, pin } = req.body;
    if (!name || !pin) return res.status(400).json({ error: 'Name and PIN required' });
    if (!/^\d{4}$/.test(pin)) return res.status(400).json({ error: 'PIN must be 4 digits' });
    const r = db.prepare('INSERT INTO employees (name, role, initials, pin_hash) VALUES (?, ?, ?, ?)').run(name, role || 'mechanic', initials || name.slice(0, 2).toUpperCase(), hashPin(pin));
    res.json({ id: r.lastInsertRowid, name, role: role || 'mechanic' });
  });

  app.put('/api/employees/:id', requireAdmin, (req, res) => {
    const { name, role, initials, active, pin } = req.body;
    const id = req.params.id;
    const updates = [];
    const params = [];
    if (name !== undefined) { updates.push('name = ?'); params.push(name); }
    if (role !== undefined) { updates.push('role = ?'); params.push(role); }
    if (initials !== undefined) { updates.push('initials = ?'); params.push(initials); }
    if (pin !== undefined) {
      if (!/^\d{4}$/.test(pin)) return res.status(400).json({ error: 'PIN must be 4 digits' });
      updates.push('pin_hash = ?'); params.push(hashPin(pin));
    }
    if (active !== undefined) {
      updates.push('active = ?'); params.push(active ? 1 : 0);
      if (!active) db.prepare('DELETE FROM device_tokens WHERE employee_id = ?').run(id);
    }
    if (updates.length) db.prepare(`UPDATE employees SET ${updates.join(', ')} WHERE id = ?`).run(...params, id);
    res.json({ ok: true });
  });

  // ─── CUSTOMERS ────────────────────────────────────────────────────────────────
  app.get('/api/customers', requireAuth, (req, res) => {
    const q = req.query.q;
    if (q) {
      res.json(db.prepare(`SELECT * FROM customers WHERE name LIKE ? OR phone LIKE ? OR email LIKE ? ORDER BY name LIMIT 30`).all(`%${q}%`, `%${q}%`, `%${q}%`));
    } else {
      res.json(db.prepare('SELECT * FROM customers ORDER BY name').all());
    }
  });

  app.get('/api/customers/:id', requireAuth, (req, res) => {
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
    if (!customer) return res.status(404).json({ error: 'Not found' });
    customer.boats = db.prepare('SELECT * FROM boats WHERE customer_id = ? ORDER BY name').all(req.params.id);
    res.json(customer);
  });

  app.post('/api/customers', requireEditor, (req, res) => {
    const { name, address = null, city = null, postal_code = null, phone = null, email = null } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });
    const r = db.prepare(`INSERT INTO customers (name, address, city, postal_code, phone, email) VALUES (?, ?, ?, ?, ?, ?)`).run(name, address, city, postal_code, phone, email);
    res.json({ id: r.lastInsertRowid, name, phone });
  });

  app.put('/api/customers/:id', requireEditor, (req, res) => {
    const { name, address, city, postal_code, phone, email } = req.body;
    const updates = [];
    const params = [];
    if (name !== undefined) { updates.push('name = ?'); params.push(name); }
    if (address !== undefined) { updates.push('address = ?'); params.push(address); }
    if (city !== undefined) { updates.push('city = ?'); params.push(city); }
    if (postal_code !== undefined) { updates.push('postal_code = ?'); params.push(postal_code); }
    if (phone !== undefined) { updates.push('phone = ?'); params.push(phone); }
    if (email !== undefined) { updates.push('email = ?'); params.push(email); }
    if (updates.length) db.prepare(`UPDATE customers SET ${updates.join(', ')} WHERE id=?`).run(...params, req.params.id);
    res.json({ ok: true });
  });

  // ─── BOATS ────────────────────────────────────────────────────────────────────
  app.get('/api/boats', requireAuth, (req, res) => {
    const { q } = req.query;
    if (q) {
      res.json(db.prepare(`
        SELECT b.*, c.name as customer_name 
        FROM boats b 
        LEFT JOIN customers c ON b.customer_id = c.id 
        WHERE b.name LIKE ? OR c.name LIKE ? 
        ORDER BY b.name LIMIT 30
      `).all(`%${q}%`, `%${q}%`));
    } else {
      res.json(db.prepare(`
        SELECT b.*, c.name as customer_name 
        FROM boats b 
        LEFT JOIN customers c ON b.customer_id = c.id 
        ORDER BY b.name
      `).all());
    }
  });

  app.post('/api/boats', requireEditor, (req, res) => {
    const { customer_id, name = null, motor_type = null, model = null, licence = null, trailer_licence = null, rate_type = 'SW', length_ft = null } = req.body;
    if (!customer_id) return res.status(400).json({ error: 'Customer required' });
    const r = db.prepare(`INSERT INTO boats (customer_id, name, motor_type, model, licence, trailer_licence, rate_type, length_ft) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(customer_id, name, motor_type, model, licence, trailer_licence, rate_type, length_ft);
    res.json({ id: r.lastInsertRowid });
  });

  app.put('/api/boats/:id', requireEditor, (req, res) => {
    const { name, motor_type, model, licence, trailer_licence, rate_type, length_ft } = req.body;
    const updates = [];
    const params = [];
    if (name !== undefined) { updates.push('name = ?'); params.push(name); }
    if (motor_type !== undefined) { updates.push('motor_type = ?'); params.push(motor_type); }
    if (model !== undefined) { updates.push('model = ?'); params.push(model); }
    if (licence !== undefined) { updates.push('licence = ?'); params.push(licence); }
    if (trailer_licence !== undefined) { updates.push('trailer_licence = ?'); params.push(trailer_licence); }
    if (rate_type !== undefined) { updates.push('rate_type = ?'); params.push(rate_type); }
    if (length_ft !== undefined) { updates.push('length_ft = ?'); params.push(length_ft); }
    if (updates.length) db.prepare(`UPDATE boats SET ${updates.join(', ')} WHERE id=?`).run(...params, req.params.id);
    res.json({ ok: true });
  });

  // ─── BOAT ASSIGNMENTS ─────────────────────────────────────────────────────────
  app.get('/api/assignments', requireAuth, (req, res) => {
    const { employee_id } = req.query;
    if (employee_id) {
      res.json(db.prepare(`
        SELECT ba.*, b.name as boat_name, c.name as customer_name
        FROM boat_assignments ba
        JOIN boats b ON ba.boat_id = b.id
        JOIN customers c ON b.customer_id = c.id
        WHERE ba.employee_id = ?
        ORDER BY b.name
      `).all(employee_id));
    } else {
      res.json(db.prepare(`
        SELECT ba.*, b.name as boat_name, c.name as customer_name, e.name as employee_name, e.initials as employee_initials
        FROM boat_assignments ba
        JOIN boats b ON ba.boat_id = b.id
        JOIN customers c ON b.customer_id = c.id
        JOIN employees e ON ba.employee_id = e.id
        ORDER BY e.name, b.name
      `).all());
    }
  });

  app.post('/api/assignments', requireEditor, (req, res) => {
    const { boat_id, employee_id } = req.body;
    if (!boat_id || !employee_id) return res.status(400).json({ error: 'Boat and employee required' });
    try {
      const r = db.prepare('INSERT OR IGNORE INTO boat_assignments (boat_id, employee_id, assigned_by) VALUES (?, ?, ?)').run(boat_id, employee_id, req.employee.id);
      res.json({ id: r.lastInsertRowid });
    } catch (e) { res.status(400).json({ error: 'Assignment failed' }); }
  });

  app.delete('/api/assignments/:id', requireEditor, (req, res) => {
    db.prepare('DELETE FROM boat_assignments WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  });

  // ─── SERVICE CARDS ────────────────────────────────────────────────────────────
  const CARD_SELECT = `
    SELECT sc.*,
      c.name as customer_name, c.phone as customer_phone, c.email as customer_email,
      c.address, c.city, c.postal_code, c.id as customer_id,
      b.name as boat_name, b.motor_type, b.model, b.licence, b.trailer_licence, b.length_ft, b.rate_type,
      e.name as created_by_name
    FROM service_cards sc
    JOIN boats b ON sc.boat_id = b.id
    JOIN customers c ON b.customer_id = c.id
    LEFT JOIN employees e ON sc.created_by = e.id
  `;

  app.get('/api/cards', requireAuth, (req, res) => {
    const { status, season, q } = req.query;
    let where = 'WHERE 1=1';
    const params = [];
    if (status && status !== 'all') { where += ' AND sc.status = ?'; params.push(status); }
    if (season) { where += ' AND sc.season_year = ?'; params.push(season); }
    if (q) { where += ' AND (c.name LIKE ? OR b.name LIKE ? OR sc.work_order_no LIKE ? OR b.licence LIKE ?)'; params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`); }
    res.json(db.prepare(`${CARD_SELECT} ${where} ORDER BY sc.updated_at DESC`).all(...params));
  });

  app.get('/api/cards/:id', requireAuth, (req, res) => {
    const card = db.prepare(`${CARD_SELECT} WHERE sc.id = ?`).get(req.params.id);
    if (!card) return res.status(404).json({ error: 'Not found' });
    card.received_items = db.prepare('SELECT * FROM received_items WHERE card_id = ?').all(req.params.id);
    card.authorized_work = db.prepare('SELECT * FROM authorized_work WHERE card_id = ?').all(req.params.id);
    card.condition = db.prepare('SELECT * FROM condition_assessment WHERE card_id = ?').all(req.params.id);
    card.work_logs = db.prepare(`
      SELECT wl.*, e.name as employee_name, e.initials as employee_initials
      FROM work_logs wl
      JOIN employees e ON wl.employee_id = e.id
      WHERE wl.card_id = ?
      ORDER BY wl.log_date DESC, wl.created_at DESC
    `).all(req.params.id).map(log => ({
      ...log,
      parts: db.prepare('SELECT * FROM parts_used WHERE work_log_id = ?').all(log.id)
    }));
    card.photos = db.prepare(`
      SELECT p.*, e.name as uploaded_by_name
      FROM photos p LEFT JOIN employees e ON p.uploaded_by = e.id
      WHERE p.card_id = ? ORDER BY p.uploaded_at DESC
    `).all(req.params.id);
    card.checklists = db.prepare('SELECT * FROM checklist_completions WHERE card_id = ?').all(req.params.id);
    card.status_history = db.prepare(`
      SELECT sh.*, e.name as employee_name FROM status_history sh
      LEFT JOIN employees e ON sh.employee_id = e.id
      WHERE sh.card_id = ? ORDER BY sh.changed_at DESC
    `).all(req.params.id);
    res.json(card);
  });

  const RECEIVED_ITEMS = ['battery', 'keys', 'cover', 'paddles', 'life_jackets', 'cushions', 'gas_cans', 'tie_ropes', 'lights'];
  const CONDITIONS = ['top', 'hull', 'upholstery', 'motor', 'propeller', 'lower_unit'];

  app.post('/api/cards', requireEditor, (req, res) => {
    const { boat_id, season_year, work_order_no, storage_type, wrap_required, remarks, other_work, date_in, storage_building, storage_row, storage_col, boathouse_no, slip_no } = req.body;
    if (!boat_id) return res.status(400).json({ error: 'Boat required' });

    let storage_location = null
    if (storage_type === 'storage_building' && (storage_building || storage_row || storage_col)) {
      const parts = []
      if (storage_building) parts.push(storage_building)
      if (storage_row) parts.push('Row ' + storage_row)
      if (storage_col) parts.push('Column ' + storage_col)
      storage_location = parts.join(', ')
    } else if ((storage_type === 'marina_boathouse' || storage_type === 'customer_boathouse') && (boathouse_no || slip_no)) {
      const parts = []
      if (boathouse_no) parts.push('Boathouse ' + boathouse_no)
      if (slip_no) parts.push('Slip ' + slip_no)
      storage_location = parts.join(', ')
    }

    let customerToken = generateCustomerToken();
    // Ensure uniqueness
    while (db.prepare('SELECT id FROM service_cards WHERE customer_token = ?').get(customerToken)) {
      customerToken = generateCustomerToken();
    }

    const r = db.prepare(`
      INSERT INTO service_cards (boat_id, season_year, work_order_no, storage_type, storage_location, storage_building, storage_row, storage_col, boathouse_no, slip_no, wrap_required, remarks, other_work, date_in, created_by, customer_token)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(boat_id, season_year || new Date().getFullYear(), work_order_no || null, storage_type || null, storage_location, storage_building || null, storage_row || null, storage_col || null, boathouse_no ? Number(boathouse_no) : null, slip_no ? Number(slip_no) : null, wrap_required ? 1 : 0, remarks || null, other_work || null, date_in || new Date().toISOString().split('T')[0], req.employee.id, customerToken);
    const cardId = r.lastInsertRowid;
    const ii = db.prepare('INSERT OR IGNORE INTO received_items (card_id, item) VALUES (?, ?)');
    RECEIVED_ITEMS.forEach(item => ii.run(cardId, item));
    const activeTemplates = db.prepare("SELECT item_key FROM service_item_templates WHERE active = 1").all();
    const iw = db.prepare('INSERT OR IGNORE INTO authorized_work (card_id, service_type) VALUES (?, ?)');
    activeTemplates.forEach(row => iw.run(cardId, row.item_key));
    const ic = db.prepare('INSERT OR IGNORE INTO condition_assessment (card_id, area) VALUES (?, ?)');
    CONDITIONS.forEach(a => ic.run(cardId, a));
    db.prepare('INSERT INTO status_history (card_id, to_status, employee_id) VALUES (?, ?, ?)').run(cardId, 'intake', req.employee.id);
    res.json({ id: cardId });
  });

  app.put('/api/cards/:id', requireAuth, (req, res) => {
    const id = req.params.id;
    const card = db.prepare('SELECT status FROM service_cards WHERE id = ?').get(id);
    if (!card) return res.status(404).json({ error: 'Not found' });

    const isEditor = req.employee.role === 'admin' || req.employee.role === 'office';
    const { status, storage_type, storage_location, wrap_required, remarks, other_work, date_out, invoice_number, work_order_no, storage_building, storage_row, storage_col, boathouse_no, slip_no, pickup_delivery } = req.body;
    
    if (!isEditor) {
       const protectedKeys = ['storage_type', 'storage_location', 'wrap_required', 'remarks', 'other_work', 'date_out', 'invoice_number', 'work_order_no', 'storage_building', 'storage_row', 'storage_col', 'boathouse_no', 'slip_no', 'pickup_delivery'];
       const hasProtected = protectedKeys.some(k => req.body[k] !== undefined);
       if (hasProtected) return res.status(403).json({ error: 'Only admin and office can edit relevant data' });
    }

    // Compute storage_location from structured fields if provided
    let computedLoc = storage_location
    if (storage_type === 'storage_building' && (storage_building || storage_row || storage_col)) {
      const parts = []
      if (storage_building) parts.push(storage_building)
      if (storage_row) parts.push('Row ' + storage_row)
      if (storage_col) parts.push('Column ' + storage_col)
      computedLoc = parts.join(', ')
    } else if ((storage_type === 'marina_boathouse' || storage_type === 'customer_boathouse') && (boathouse_no || slip_no)) {
      const parts = []
      if (boathouse_no) parts.push('Boathouse ' + boathouse_no)
      if (slip_no) parts.push('Slip ' + slip_no)
      computedLoc = parts.join(', ')
    }

    if (status && status !== card.status) {
      db.prepare('INSERT INTO status_history (card_id, from_status, to_status, employee_id) VALUES (?, ?, ?, ?)').run(id, card.status, status, req.employee.id);
    }
    db.prepare(`UPDATE service_cards SET
      status = COALESCE(?, status), storage_type = COALESCE(?, storage_type),
      storage_location = COALESCE(?, storage_location),
      storage_building = COALESCE(?, storage_building),
      storage_row = COALESCE(?, storage_row),
      storage_col = COALESCE(?, storage_col),
      boathouse_no = COALESCE(?, boathouse_no),
      slip_no = COALESCE(?, slip_no),
      wrap_required = COALESCE(?, wrap_required),
      remarks = COALESCE(?, remarks), other_work = COALESCE(?, other_work),
      date_out = COALESCE(?, date_out), invoice_number = COALESCE(?, invoice_number),
      work_order_no = COALESCE(?, work_order_no),
      pickup_delivery = COALESCE(?, pickup_delivery),
      updated_at = datetime('now')
      WHERE id = ?`).run(status ?? null, storage_type ?? null, computedLoc ?? null, storage_building || null, storage_row || null, storage_col || null, boathouse_no ? Number(boathouse_no) : null, slip_no ? Number(slip_no) : null, wrap_required != null ? (wrap_required ? 1 : 0) : null, remarks ?? null, other_work ?? null, date_out ?? null, invoice_number ?? null, work_order_no ?? null, pickup_delivery ?? null, id);
    res.json({ ok: true });
  });

  app.put('/api/cards/:id/items', requireAuth, (req, res) => {
    const upd = db.prepare('UPDATE received_items SET present=?, notes=? WHERE card_id=? AND item=?');
    const ins = db.prepare('INSERT INTO received_items (card_id, item, present, notes) VALUES (?, ?, ?, ?)');
    (req.body.items || []).forEach(({ item, present, notes }) => {
      const pCount = present ? 1 : 0;
      const r = upd.run(pCount, notes || null, req.params.id, item);
      if (r.changes === 0) ins.run(req.params.id, item, pCount, notes || null);
    });
    res.json({ ok: true });
  });

  app.put('/api/cards/:id/work', requireAuth, (req, res) => {
    const upd = db.prepare('INSERT OR REPLACE INTO authorized_work (card_id, service_type, authorized, completed, notes, completed_by, completed_at, products_used) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    (req.body.work || []).forEach(({ service_type, authorized, completed, notes, completed_by, completed_at, products_used }) =>
      upd.run(req.params.id, service_type, authorized ? 1 : 0, completed ? 1 : 0, notes || null, completed_by || null, completed_at || null,         (() => { try { const p = typeof products_used === 'string' ? JSON.parse(products_used) : (products_used || []); return Array.isArray(p) ? JSON.stringify(p) : '[]'; } catch { return '[]'; } })()));
    db.prepare('UPDATE service_cards SET updated_at=datetime("now") WHERE id=?').run(req.params.id);
    res.json({ ok: true });
  });

  // ─── AUTHORIZED ITEMS (SERVICE ITEM TEMPLATES) ───────────────────────────────
  app.get('/api/authorized-items', requireAdmin, (req, res) => {
    res.json(db.prepare('SELECT * FROM service_item_templates ORDER BY sort_order').all());
  });

  app.get('/api/authorized-items/active', requireAuth, (req, res) => {
    res.json(db.prepare("SELECT * FROM service_item_templates WHERE active = 1 ORDER BY sort_order").all());
  });

  app.post('/api/authorized-items', requireAdmin, (req, res) => {
    const { item_key, label, category, cleaning_cat, sort_order, unit_price } = req.body;
    if (!item_key || !label || !category) return res.status(400).json({ error: 'Key, label, and category required' });
    if (!['service', 'cleaning'].includes(category)) return res.status(400).json({ error: 'Category must be service or cleaning' });
    try {
      const r = db.prepare('INSERT INTO service_item_templates (item_key, label, category, cleaning_cat, sort_order, unit_price) VALUES (?, ?, ?, ?, ?, ?)')
        .run(item_key, label, category, cleaning_cat || null, sort_order != null ? sort_order : 0, unit_price || 0);
      res.json({ id: r.lastInsertRowid, item_key, label, category, unit_price: unit_price || 0 });
    } catch (e) {
      res.status(400).json({ error: 'Item key already exists' });
    }
  });

  app.put('/api/authorized-items/:id', requireAdmin, (req, res) => {
    const { label, category, cleaning_cat, sort_order, active, unit_price } = req.body;
    const updates = [];
    const params = [];
    if (label !== undefined) { updates.push('label = ?'); params.push(label); }
    if (category !== undefined) { updates.push('category = ?'); params.push(category); }
    if (cleaning_cat !== undefined) { updates.push('cleaning_cat = ?'); params.push(cleaning_cat); }
    if (sort_order !== undefined) { updates.push('sort_order = ?'); params.push(sort_order); }
    if (active !== undefined) { updates.push('active = ?'); params.push(active ? 1 : 0); }
    if (unit_price !== undefined) { updates.push('unit_price = ?'); params.push(unit_price); }
    if (updates.length) db.prepare(`UPDATE service_item_templates SET ${updates.join(', ')} WHERE id=?`).run(...params, req.params.id);
    res.json({ ok: true });
  });

  // ─── PRODUCTS ─────────────────────────────────────────────────────────────────
  app.get('/api/products', requireAuth, (req, res) => {
    const { q, active } = req.query;
    if (q && q.length >= 1) {
      res.json(db.prepare(`SELECT * FROM products WHERE (name LIKE ? OR part_number LIKE ?) AND active = 1 ORDER BY name LIMIT 20`).all(`%${q}%`, `%${q}%`));
    } else if (active === 'true') {
      res.json(db.prepare('SELECT * FROM products WHERE active = 1 ORDER BY name').all());
    } else {
      res.json(db.prepare('SELECT * FROM products ORDER BY name').all());
    }
  });

  app.post('/api/products', requireAuth, (req, res) => {
    const { name, part_number, unit, category, unit_price } = req.body;
    if (!name) return res.status(400).json({ error: 'Product name required' });
    try {
      const r = db.prepare('INSERT INTO products (name, part_number, unit, category, unit_price) VALUES (?, ?, ?, ?, ?)').run(name, part_number || null, unit || null, category || null, unit_price || 0);
      res.json({ id: r.lastInsertRowid, name });
    } catch (e) {
      const existing = db.prepare('SELECT id, name, active FROM products WHERE name = ?').get(name);
      if (existing) {
        if (!existing.active) {
          db.prepare('UPDATE products SET active = 1 WHERE id = ?').run(existing.id);
          return res.json({ id: existing.id, name: existing.name, restored: true });
        }
        return res.status(200).json({ id: existing.id, name: existing.name, exists: true });
      }
      res.status(400).json({ error: 'Failed to create product' });
    }
  });

  app.put('/api/products/:id', requireAdmin, (req, res) => {
    const { name, part_number, unit, category, unit_price, active } = req.body;
    const updates = [];
    const params = [];
    if (name !== undefined) { updates.push('name = ?'); params.push(name); }
    if (part_number !== undefined) { updates.push('part_number = ?'); params.push(part_number); }
    if (unit !== undefined) { updates.push('unit = ?'); params.push(unit); }
    if (category !== undefined) { updates.push('category = ?'); params.push(category); }
    if (unit_price !== undefined) { updates.push('unit_price = ?'); params.push(unit_price); }
    if (active !== undefined) { updates.push('active = ?'); params.push(active ? 1 : 0); }
    if (updates.length) db.prepare(`UPDATE products SET ${updates.join(', ')} WHERE id=?`).run(...params, req.params.id);
    res.json({ ok: true });
  });

  // ─── INVOICE ──────────────────────────────────────────────────────────────────
  app.get('/api/cards/:id/invoice', requireAuth, (req, res) => {
    const card = db.prepare(`SELECT id, invoice_number, invoice_status, tax_rate FROM service_cards WHERE id = ?`).get(req.params.id);
    if (!card) return res.status(404).json({ error: 'Not found' });
    card.items = db.prepare('SELECT * FROM invoice_items WHERE card_id = ? ORDER BY sort_order').all(req.params.id);
    res.json(card);
  });

  app.put('/api/cards/:id/invoice', requireEditor, (req, res) => {
    const { invoice_number, invoice_status, tax_rate, items } = req.body;
    if (invoice_number !== undefined || invoice_status !== undefined || tax_rate !== undefined) {
      const updates = [];
      const params = [];
      if (invoice_number !== undefined) { updates.push('invoice_number = ?'); params.push(invoice_number); }
      if (invoice_status !== undefined) { updates.push('invoice_status = ?'); params.push(invoice_status); }
      if (tax_rate !== undefined) { updates.push('tax_rate = ?'); params.push(tax_rate); }
      if (updates.length) db.prepare(`UPDATE service_cards SET ${updates.join(', ')} WHERE id=?`).run(...params, req.params.id);
    }
    if (items) {
      db.prepare('DELETE FROM invoice_items WHERE card_id = ?').run(req.params.id);
      const ins = db.prepare('INSERT INTO invoice_items (card_id, description, quantity, unit_price, total, sort_order) VALUES (?, ?, ?, ?, ?, ?)');
      items.forEach((item, i) => {
        const total = (item.quantity || 1) * (item.unit_price || 0);
        ins.run(req.params.id, item.description, item.quantity || 1, item.unit_price || 0, total, i);
      });
    }
    res.json({ ok: true });
  });

  app.put('/api/cards/:id/condition', requireAuth, (req, res) => {
    const card = db.prepare('SELECT status FROM service_cards WHERE id = ?').get(req.params.id);
    if (!card) return res.status(404).json({ error: 'Not found' });
    const isEditor = req.employee.role === 'admin' || req.employee.role === 'office';
    if (card.status !== 'intake' && !isEditor) {
      return res.status(403).json({ error: 'Condition assessment can only be edited during intake or by admin/office' });
    }
    const upd = db.prepare('UPDATE condition_assessment SET rating=?, notes=? WHERE card_id=? AND area=?');
    (req.body.condition || []).forEach(({ area, rating, notes }) => upd.run(rating || null, notes || null, req.params.id, area));
    res.json({ ok: true });
  });

  // ─── WORK LOGS ────────────────────────────────────────────────────────────────
  app.post('/api/cards/:id/logs', requireAuth, (req, res) => {
    const { log_date, description, transcription, parts } = req.body;
    const r = db.prepare(`INSERT INTO work_logs (card_id, employee_id, log_date, description, transcription) VALUES (?, ?, ?, ?, ?)`).run(req.params.id, req.employee.id, log_date || new Date().toISOString().split('T')[0], description || null, transcription || null);
    const logId = r.lastInsertRowid;
    if (parts && parts.length) {
      const ip = db.prepare('INSERT INTO parts_used (work_log_id, part_number, description, quantity) VALUES (?, ?, ?, ?)');
      parts.filter(p => p.description).forEach(p => ip.run(logId, p.part_number || null, p.description, p.quantity || 1));
    }
    db.prepare('UPDATE service_cards SET updated_at=datetime("now") WHERE id=?').run(req.params.id);
    res.json({ id: logId });
  });

  app.delete('/api/logs/:id', requireAuth, (req, res) => {
    db.prepare('DELETE FROM work_logs WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  });

  // ─── PHOTOS ───────────────────────────────────────────────────────────────────
  app.post('/api/cards/:id/photos', requireAuth, upload.single('photo'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const { photo_type, caption, work_log_id } = req.body;
    const r = db.prepare(`INSERT INTO photos (card_id, work_log_id, filename, photo_type, caption, uploaded_by) VALUES (?, ?, ?, ?, ?, ?)`).run(req.params.id, work_log_id || null, req.file.filename, photo_type || 'general', caption || null, req.employee.id);
    res.json({ id: r.lastInsertRowid, filename: req.file.filename, url: `/photos/${req.file.filename}` });
  });

  app.delete('/api/photos/:id', requireAuth, (req, res) => {
    const photo = db.prepare('SELECT filename FROM photos WHERE id = ?').get(req.params.id);
    if (photo) {
      const filePath = path.join(PHOTOS_DIR, photo.filename);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      db.prepare('DELETE FROM photos WHERE id = ?').run(req.params.id);
    }
    res.json({ ok: true });
  });

  // ─── CHECKLISTS ───────────────────────────────────────────────────────────────
  app.post('/api/cards/:id/checklists', requireAuth, (req, res) => {
    const { checklist_type, items_json } = req.body;
    const items = JSON.parse(items_json || '{}');
    const allDone = Object.keys(items).length > 0 && Object.values(items).every(v => v === true);
    const existing = db.prepare('SELECT id FROM checklist_completions WHERE card_id=? AND checklist_type=?').get(req.params.id, checklist_type);
    if (existing) {
      db.prepare('UPDATE checklist_completions SET items_json=?,employee_id=?,completed_at=?,updated_at=datetime("now") WHERE id=?').run(items_json, req.employee.id, allDone ? new Date().toISOString() : null, existing.id);
      res.json({ id: existing.id });
    } else {
      const r = db.prepare('INSERT INTO checklist_completions (card_id,checklist_type,employee_id,items_json,completed_at) VALUES (?,?,?,?,?)').run(req.params.id, checklist_type, req.employee.id, items_json, allDone ? new Date().toISOString() : null);
      res.json({ id: r.lastInsertRowid });
    }
  });

  // ─── SEARCH ───────────────────────────────────────────────────────────────────
  app.get('/api/search', requireAuth, (req, res) => {
    const q = req.query.q;
    if (!q || q.length < 2) return res.json([]);
    res.json(db.prepare(`
      SELECT sc.id, sc.work_order_no, sc.status, sc.season_year,
             c.name as customer_name, b.name as boat_name, b.licence
      FROM service_cards sc
      JOIN boats b ON sc.boat_id = b.id
      JOIN customers c ON b.customer_id = c.id
      WHERE c.name LIKE ? OR b.name LIKE ? OR b.licence LIKE ? OR sc.work_order_no LIKE ?
      ORDER BY sc.updated_at DESC LIMIT 20
    `).all(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`));
  });

  // ─── WRAP QUEUE ───────────────────────────────────────────────────────────────
  app.get('/api/wrap-queue', requireAuth, (req, res) => {
    res.json(db.prepare(`
      ${CARD_SELECT}
      LEFT JOIN checklist_completions cc ON cc.card_id = sc.id AND cc.checklist_type = 'storage'
      WHERE sc.wrap_required=1
        AND (cc.id IS NULL OR json_extract(cc.items_json, '$.wrap') IS NOT 1)
        AND sc.status IN ('fall_checklist','storage')
      ORDER BY c.name
    `).all());
  });

  // ─── VERSION ──────────────────────────────────────────────────────────────────
  app.get('/api/version', (req, res) => {
    res.json({ version: require('./package.json').version });
  });

  // ─── PUBLIC CUSTOMER VIEW ──────────────────────────────────────────────────────
  app.get('/api/public/card/:token', (req, res) => {
    const card = db.prepare(`
      SELECT sc.id, sc.work_order_no, sc.status, sc.season_year, sc.storage_type, sc.storage_location,
             sc.wrap_required, sc.remarks, sc.other_work, sc.date_in, sc.date_out,
             sc.invoice_status, sc.pickup_delivery,
             c.name as customer_name, c.phone as customer_phone,
             b.name as boat_name, b.motor_type, b.model, b.licence, b.length_ft, b.rate_type
      FROM service_cards sc
      JOIN boats b ON sc.boat_id = b.id
      JOIN customers c ON b.customer_id = c.id
      WHERE sc.customer_token = ?
    `).get(req.params.token);
    if (!card) return res.status(404).json({ error: 'Not found' });
    card.authorized_work = db.prepare('SELECT * FROM authorized_work WHERE card_id = ?').all(card.id);
    card.photos = db.prepare('SELECT filename, photo_type FROM photos WHERE card_id = ? ORDER BY uploaded_at DESC').all(card.id);
    card.checklists = db.prepare('SELECT * FROM checklist_completions WHERE card_id = ?').all(card.id);
    card.status_history = db.prepare(`
      SELECT sh.*, e.name as employee_name FROM status_history sh
      LEFT JOIN employees e ON sh.employee_id = e.id
      WHERE sh.card_id = ? ORDER BY sh.changed_at DESC
    `).all(card.id);
    card.invoice = db.prepare('SELECT * FROM invoice_items WHERE card_id = ? ORDER BY sort_order').all(card.id);
    res.json(card);
  });

// ─── EXPORT ───────────────────────────────────────────────────────────────────
  app.get('/api/export', requireAdmin, (req, res) => {
    const archiver = require('archiver');
    res.attachment(`marina-backup-${new Date().toISOString().split('T')[0]}.zip`);
    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('error', err => res.status(500).end());
    archive.pipe(res);
    archive.file(DB_PATH, { name: 'marina.db' });
    if (fs.existsSync(PHOTOS_DIR)) archive.directory(PHOTOS_DIR, 'photos');
    archive.finalize();
  });

  // Catch-all → serve index.html
  app.get('*', (req, res) => {
    res.sendFile(path.join(staticDir, 'index.html'));
  });

  app.use((err, req, res, next) => {
    console.error('[ERROR]', err);
    res.status(500).json({ error: 'Internal server error' });
  });

  app.db = db;
  return app;
};

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  module.exports().then(app => {
    const server = app.listen(PORT, '0.0.0.0', () => {
      const ifaces = require('os').networkInterfaces();
      const localIP = Object.values(ifaces).flat().find(i => i.family === 'IPv4' && !i.internal)?.address || 'localhost';
      console.log(`\n\u2693 Marina Manager`);
      console.log(`   Local:   http://localhost:${PORT}`);
      console.log(`   Network: http://${localIP}:${PORT}`);
      console.log(`   Default admin PIN: 0000\n`);
    });
    process.on('SIGTERM', () => {
      app.db.close();
      server.close(() => process.exit(0));
    });
  }).catch(err => {
    console.error('Failed to start:', err);
    process.exit(1);
  });
}
