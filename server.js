const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const createDatabase = require('./db');
const runBackup = require('./db/backup');
const { getBackupRanToday } = require('./db/backup');

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

module.exports = async function createApp() {
  const app = express();
  const PORT = process.env.PORT || 3000;
  const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
  const PHOTOS_DIR = path.join(DATA_DIR, 'photos');

  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(PHOTOS_DIR)) fs.mkdirSync(PHOTOS_DIR, { recursive: true });

  const db = await createDatabase();
  const pool = db.getPool();

  await runBackup(db);

  try {
    await db.exec("ALTER TABLE service_cards ADD COLUMN is_fake INTEGER DEFAULT 0");
    console.log("  Added is_fake column to service_cards");
  } catch (e) {
    // Column already exists, ignore
  }

  function generateCustomerToken() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let token = '';
    for (let i = 0; i < 8; i++) token += chars.charAt(Math.floor(Math.random() * chars.length));
    return token;
  }

  const cardsWithoutToken = await db.prepare("SELECT id FROM service_cards WHERE customer_token IS NULL OR customer_token = ''").all();
  if (cardsWithoutToken.length > 0) {
    console.log(`  Backfilling customer_token for ${cardsWithoutToken.length} existing card(s)...`);
    for (const card of cardsWithoutToken) {
      let token = generateCustomerToken();
      while (await db.prepare('SELECT id FROM service_cards WHERE customer_token = ?').get(token)) {
        token = generateCustomerToken();
      }
      await db.prepare('UPDATE service_cards SET customer_token = ? WHERE id = ?').run(token, card.id);
    }
    console.log('  customer_token backfill complete');
  }

  const cardsWithoutWO = await db.prepare("SELECT id FROM service_cards WHERE work_order_no IS NULL OR work_order_no = ''").all();
  if (cardsWithoutWO.length > 0) {
    console.log(`  Backfilling work_order_no for ${cardsWithoutWO.length} existing card(s)...`);
    const maxWO = await db.prepare("SELECT MAX(CAST(REPLACE(work_order_no, 'WO-', '') AS UNSIGNED)) as maxNum FROM service_cards WHERE work_order_no LIKE 'WO-%'").get();
    let nextNum = (maxWO && maxWO.maxNum) ? maxWO.maxNum + 1 : 1000;
    for (const card of cardsWithoutWO) {
      await db.prepare('UPDATE service_cards SET work_order_no = ? WHERE id = ?').run('WO-' + nextNum, card.id);
      nextNum++;
    }
    console.log('  work_order_no backfill complete');
  }

  const productCount = await db.prepare('SELECT COUNT(*) as c FROM products').get();
  if (productCount.c === 0) {
    const seen = new Set();
    const partsDescs = await db.prepare('SELECT DISTINCT description FROM parts_used WHERE description IS NOT NULL AND description != \'\'').all();
    partsDescs.forEach(r => { if (!seen.has(r.description)) seen.add(r.description); });
    const invoiceDescs = await db.prepare('SELECT DISTINCT description FROM invoice_items WHERE description IS NOT NULL AND description != \'\'').all();
    invoiceDescs.forEach(r => { if (!seen.has(r.description)) seen.add(r.description); });
    const workRows = await db.prepare('SELECT products_used FROM authorized_work WHERE products_used IS NOT NULL').all();
    workRows.forEach(r => {
      try {
        const arr = typeof r.products_used === 'string' ? JSON.parse(r.products_used) : [];
        if (Array.isArray(arr)) arr.forEach(p => { if (p.description && !seen.has(p.description)) seen.add(p.description); });
      } catch(e) {}
    });
    if (seen.size > 0) {
      for (const name of seen) {
        try { await db.prepare('INSERT IGNORE INTO products (name, active) VALUES (?, 1)').run(name); } catch(e) {}
      }
      console.log(`  ${seen.size} products seeded from existing data`);
    }
  }

  const templateCount = await db.prepare('SELECT COUNT(*) as c FROM service_item_templates').get();
  if (templateCount.c === 0) {
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
    for (const row of [...serviceItems, ...cleaningItems]) {
      await db.prepare('INSERT INTO service_item_templates (item_key, label, category, cleaning_cat, sort_order) VALUES (?, ?, ?, ?, ?)').run(...row);
    }
    console.log('  Default service item templates seeded');
  }

  const empCount = await db.prepare('SELECT COUNT(*) as c FROM employees').get();
  if (empCount.c === 0) {
    const pinHash = crypto.createHash('sha256').update('0000').digest('hex');
    await db.prepare(`INSERT INTO employees (name, role, initials, pin_hash) VALUES ('Admin', 'admin', 'AD', ?)`).run(pinHash);
    console.log('  Default admin created — PIN: 0000');

    const custRes = await db.prepare(`INSERT INTO customers (name, phone, email) VALUES ('John Doe', '555-0101', 'john@example.com')`).run();
    const customerId = custRes.lastInsertRowid;
    const boatRes = await db.prepare(`INSERT INTO boats (customer_id, name, motor_type, model, length_ft) VALUES (?, 'Sea Breeze', 'Yamaha 200', 'Sea Ray 240', 24)`).run(customerId);
    const boatId = boatRes.lastInsertRowid;
    await db.prepare(`INSERT INTO service_cards (boat_id, season_year, work_order_no) VALUES (?, ?, ?)`).run(boatId, new Date().getFullYear(), 'WO-1000');
    console.log('  Default customer, boat, and service card seeded');
  }

  app.use(express.json({ limit: '10mb' }));
  const staticDir = path.join(__dirname, 'dist');
  if (!fs.existsSync(staticDir)) {
    console.error('  Build not found. Run "npm run build" first.');
    process.exit(1);
  }
  app.use(express.static(staticDir));
  app.use('/photos', express.static(PHOTOS_DIR));

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
    db.prepare('SELECT * FROM device_tokens WHERE token = ?').get(token).then(row => {
      if (!row) return res.status(401).json({ error: 'Invalid token' });
      return db.prepare('SELECT * FROM employees WHERE id = ? AND active = 1').get(row.employee_id).then(emp => {
        if (!emp) return res.status(401).json({ error: 'Account deactivated' });
        req.employee = emp;
        next();
      });
    }).catch(next);
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

  app.post('/api/auth/login', asyncHandler(async (req, res) => {
    const { pin } = req.body;
    if (!pin) return res.status(400).json({ error: 'PIN required' });
    const emp = await db.prepare('SELECT * FROM employees WHERE pin_hash = ? AND active = 1').get(hashPin(pin));
    if (!emp) return res.status(401).json({ error: 'Invalid PIN' });
    const token = crypto.randomBytes(32).toString('hex');
    await db.prepare('INSERT INTO device_tokens (token, employee_id) VALUES (?, ?)').run(token, emp.id);
    const response = { token, employee: { id: emp.id, name: emp.name, role: emp.role, initials: emp.initials } };
    if (emp.role === 'admin' && getBackupRanToday()) {
      response.backup_notice = 'Database backup completed';
    }
    res.json(response);
  }));

  app.post('/api/auth/logout', requireAuth, asyncHandler(async (req, res) => {
    const token = (req.headers.authorization || '').replace('Bearer ', '');
    await db.prepare('DELETE FROM device_tokens WHERE token = ?').run(token);
    res.json({ ok: true });
  }));

  app.get('/api/auth/me', requireAuth, (req, res) => {
    const { id, name, role, initials } = req.employee;
    res.json({ id, name, role, initials });
  });

  app.get('/api/employees', requireAuth, asyncHandler(async (req, res) => {
    res.json(await db.prepare('SELECT id, name, role, initials, active, created_at FROM employees ORDER BY name').all());
  }));

  app.post('/api/employees', requireAdmin, asyncHandler(async (req, res) => {
    const { name, role, initials, pin } = req.body;
    if (!name || !pin) return res.status(400).json({ error: 'Name and PIN required' });
    if (!/^\d{4}$/.test(pin)) return res.status(400).json({ error: 'PIN must be 4 digits' });
    const r = await db.prepare('INSERT INTO employees (name, role, initials, pin_hash) VALUES (?, ?, ?, ?)').run(name, role || 'mechanic', initials || name.slice(0, 2).toUpperCase(), hashPin(pin));
    res.json({ id: r.lastInsertRowid, name, role: role || 'mechanic' });
  }));

  app.put('/api/employees/:id', requireAdmin, asyncHandler(async (req, res) => {
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
      if (!active) await db.prepare('DELETE FROM device_tokens WHERE employee_id = ?').run(id);
    }
    if (updates.length) {
      params.push(id);
      await db.prepare(`UPDATE employees SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    }
    res.json({ ok: true });
  }));

  app.get('/api/customers', requireAuth, asyncHandler(async (req, res) => {
    const q = req.query.q;
    if (q) {
      res.json(await db.prepare(`SELECT * FROM customers WHERE name LIKE ? OR phone LIKE ? OR email LIKE ? ORDER BY name LIMIT 30`).all(`%${q}%`, `%${q}%`, `%${q}%`));
    } else {
      res.json(await db.prepare('SELECT * FROM customers ORDER BY name').all());
    }
  }));

  app.get('/api/customers/:id', requireAuth, asyncHandler(async (req, res) => {
    const customer = await db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
    if (!customer) return res.status(404).json({ error: 'Not found' });
    customer.boats = await db.prepare('SELECT * FROM boats WHERE customer_id = ? ORDER BY name').all(req.params.id);
    res.json(customer);
  }));

  app.post('/api/customers', requireEditor, asyncHandler(async (req, res) => {
    const { name, address = null, city = null, postal_code = null, phone = null, email = null } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });
    const r = await db.prepare(`INSERT INTO customers (name, address, city, postal_code, phone, email) VALUES (?, ?, ?, ?, ?, ?)`).run(name, address, city, postal_code, phone, email);
    res.json({ id: r.lastInsertRowid, name, phone });
  }));

  app.put('/api/customers/:id', requireEditor, asyncHandler(async (req, res) => {
    const { name, address, city, postal_code, phone, email } = req.body;
    const updates = [];
    const params = [];
    if (name !== undefined) { updates.push('name = ?'); params.push(name); }
    if (address !== undefined) { updates.push('address = ?'); params.push(address); }
    if (city !== undefined) { updates.push('city = ?'); params.push(city); }
    if (postal_code !== undefined) { updates.push('postal_code = ?'); params.push(postal_code); }
    if (phone !== undefined) { updates.push('phone = ?'); params.push(phone); }
    if (email !== undefined) { updates.push('email = ?'); params.push(email); }
    if (updates.length) {
      params.push(req.params.id);
      await db.prepare(`UPDATE customers SET ${updates.join(', ')} WHERE id=?`).run(...params);
    }
    res.json({ ok: true });
  }));

  app.get('/api/boats', requireAuth, asyncHandler(async (req, res) => {
    const { q } = req.query;
    if (q) {
      res.json(await db.prepare(`
        SELECT b.*, c.name as customer_name 
        FROM boats b 
        LEFT JOIN customers c ON b.customer_id = c.id 
        WHERE b.name LIKE ? OR c.name LIKE ? 
        ORDER BY b.name LIMIT 30
      `).all(`%${q}%`, `%${q}%`));
    } else {
      res.json(await db.prepare(`
        SELECT b.*, c.name as customer_name 
        FROM boats b 
        LEFT JOIN customers c ON b.customer_id = c.id 
        ORDER BY b.name
      `).all());
    }
  }));

  app.post('/api/boats', requireEditor, asyncHandler(async (req, res) => {
    const { customer_id, name = null, motor_type = null, model = null, licence = null, trailer_licence = null, rate_type = 'SW', length_ft = null } = req.body;
    if (!customer_id) return res.status(400).json({ error: 'Customer required' });
    const r = await db.prepare(`INSERT INTO boats (customer_id, name, motor_type, model, licence, trailer_licence, rate_type, length_ft) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(customer_id, name, motor_type, model, licence, trailer_licence, rate_type, length_ft);
    res.json({ id: r.lastInsertRowid });
  }));

  app.put('/api/boats/:id', requireEditor, asyncHandler(async (req, res) => {
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
    if (updates.length) {
      params.push(req.params.id);
      await db.prepare(`UPDATE boats SET ${updates.join(', ')} WHERE id=?`).run(...params);
    }
    res.json({ ok: true });
  }));

  app.get('/api/assignments', requireAuth, asyncHandler(async (req, res) => {
    const { employee_id } = req.query;
    if (employee_id) {
      res.json(await db.prepare(`
        SELECT ba.*, b.name as boat_name, c.name as customer_name
        FROM boat_assignments ba
        JOIN boats b ON ba.boat_id = b.id
        JOIN customers c ON b.customer_id = c.id
        WHERE ba.employee_id = ?
        ORDER BY b.name
      `).all(employee_id));
    } else {
      res.json(await db.prepare(`
        SELECT ba.*, b.name as boat_name, c.name as customer_name, e.name as employee_name, e.initials as employee_initials
        FROM boat_assignments ba
        JOIN boats b ON ba.boat_id = b.id
        JOIN customers c ON b.customer_id = c.id
        JOIN employees e ON ba.employee_id = e.id
        ORDER BY e.name, b.name
      `).all());
    }
  }));

  app.post('/api/assignments', requireEditor, asyncHandler(async (req, res) => {
    const { boat_id, employee_id } = req.body;
    if (!boat_id || !employee_id) return res.status(400).json({ error: 'Boat and employee required' });
    try {
      const r = await db.prepare('INSERT IGNORE INTO boat_assignments (boat_id, employee_id, assigned_by) VALUES (?, ?, ?)').run(boat_id, employee_id, req.employee.id);
      res.json({ id: r.lastInsertRowid });
    } catch (e) { res.status(400).json({ error: 'Assignment failed' }); }
  }));

  app.delete('/api/assignments/:id', requireEditor, asyncHandler(async (req, res) => {
    await db.prepare('DELETE FROM boat_assignments WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  }));

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

  app.get('/api/cards', requireAuth, asyncHandler(async (req, res) => {
    const { status, season, q } = req.query;
    let where = 'WHERE 1=1';
    const params = [];
    if (status && status !== 'all') { where += ' AND sc.status = ?'; params.push(status); }
    if (season) { where += ' AND sc.season_year = ?'; params.push(season); }
    if (q) { where += ' AND (c.name LIKE ? OR b.name LIKE ? OR sc.work_order_no LIKE ? OR b.licence LIKE ?)'; params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`); }
    res.json(await db.prepare(`${CARD_SELECT} ${where} ORDER BY sc.updated_at DESC`).all(...params));
  }));

  app.get('/api/cards/:id', requireAuth, asyncHandler(async (req, res) => {
    const card = await db.prepare(`${CARD_SELECT} WHERE sc.id = ?`).get(req.params.id);
    if (!card) return res.status(404).json({ error: 'Not found' });
    card.received_items = await db.prepare('SELECT * FROM received_items WHERE card_id = ?').all(req.params.id);
    card.authorized_work = await db.prepare('SELECT * FROM authorized_work WHERE card_id = ?').all(req.params.id);
    card.condition = await db.prepare('SELECT * FROM condition_assessment WHERE card_id = ?').all(req.params.id);
    card.work_logs = (await db.prepare(`
      SELECT wl.*, e.name as employee_name, e.initials as employee_initials
      FROM work_logs wl
      JOIN employees e ON wl.employee_id = e.id
      WHERE wl.card_id = ?
      ORDER BY wl.log_date DESC, wl.created_at DESC
    `).all(req.params.id));
    for (const log of card.work_logs) {
      log.parts = await db.prepare('SELECT * FROM parts_used WHERE work_log_id = ?').all(log.id);
    }
    card.photos = await db.prepare(`
      SELECT p.*, e.name as uploaded_by_name
      FROM photos p LEFT JOIN employees e ON p.uploaded_by = e.id
      WHERE p.card_id = ? ORDER BY p.uploaded_at DESC
    `).all(req.params.id);
    card.checklists = await db.prepare('SELECT * FROM checklist_completions WHERE card_id = ?').all(req.params.id);
    card.status_history = await db.prepare(`
      SELECT sh.*, e.name as employee_name FROM status_history sh
      LEFT JOIN employees e ON sh.employee_id = e.id
      WHERE sh.card_id = ? ORDER BY sh.changed_at DESC
    `).all(req.params.id);
    res.json(card);
  }));

  const RECEIVED_ITEMS = ['battery', 'keys', 'cover', 'paddles', 'life_jackets', 'cushions', 'gas_cans', 'tie_ropes', 'lights'];
  const CONDITIONS = ['top', 'hull', 'upholstery', 'motor', 'propeller', 'lower_unit'];

  app.post('/api/cards', requireEditor, asyncHandler(async (req, res) => {
    const { boat_id, season_year, work_order_no, storage_type, wrap_required, remarks, other_work, date_in, storage_building, storage_row, storage_col, boathouse_no, slip_no, is_fake } = req.body;
    if (!boat_id) return res.status(400).json({ error: 'Boat required' });

    let storage_location = null;
    if (storage_type === 'storage_building' && (storage_building || storage_row || storage_col)) {
      const parts = [];
      if (storage_building) parts.push(storage_building);
      if (storage_row) parts.push('Row ' + storage_row);
      if (storage_col) parts.push('Column ' + storage_col);
      storage_location = parts.join(', ');
    } else if ((storage_type === 'marina_boathouse' || storage_type === 'customer_boathouse') && (boathouse_no || slip_no)) {
      const parts = [];
      if (boathouse_no) parts.push('Boathouse ' + boathouse_no);
      if (slip_no) parts.push('Slip ' + slip_no);
      storage_location = parts.join(', ');
    }

    let customerToken = generateCustomerToken();
    while (await db.prepare('SELECT id FROM service_cards WHERE customer_token = ?').get(customerToken)) {
      customerToken = generateCustomerToken();
    }

    const r = await db.prepare(`
      INSERT INTO service_cards (boat_id, season_year, work_order_no, storage_type, storage_location, storage_building, storage_row, storage_col, boathouse_no, slip_no, wrap_required, remarks, other_work, date_in, created_by, customer_token, is_fake)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(boat_id, season_year || new Date().getFullYear(), work_order_no || null, storage_type || null, storage_location, storage_building || null, storage_row || null, storage_col || null, boathouse_no ? Number(boathouse_no) : null, slip_no ? Number(slip_no) : null, wrap_required ? 1 : 0, remarks || null, other_work || null, date_in || new Date().toISOString().split('T')[0], req.employee.id, customerToken, is_fake ? 1 : 0);
    const cardId = r.lastInsertRowid;

    for (const item of RECEIVED_ITEMS) {
      await db.prepare('INSERT IGNORE INTO received_items (card_id, item) VALUES (?, ?)').run(cardId, item);
    }
    const activeTemplates = await db.prepare("SELECT item_key FROM service_item_templates WHERE active = 1").all();
    for (const row of activeTemplates) {
      await db.prepare('INSERT IGNORE INTO authorized_work (card_id, service_type) VALUES (?, ?)').run(cardId, row.item_key);
    }
    for (const area of CONDITIONS) {
      await db.prepare('INSERT IGNORE INTO condition_assessment (card_id, area) VALUES (?, ?)').run(cardId, area);
    }
    await db.prepare('INSERT INTO status_history (card_id, to_status, employee_id) VALUES (?, ?, ?)').run(cardId, 'intake', req.employee.id);
    res.json({ id: cardId });
  }));

  app.put('/api/cards/:id', requireAuth, asyncHandler(async (req, res) => {
    const id = req.params.id;
    const card = await db.prepare('SELECT status FROM service_cards WHERE id = ?').get(id);
    if (!card) return res.status(404).json({ error: 'Not found' });

    const isEditor = req.employee.role === 'admin' || req.employee.role === 'office';
    const { status, storage_type, storage_location, wrap_required, remarks, other_work, date_out, invoice_number, work_order_no, storage_building, storage_row, storage_col, boathouse_no, slip_no, pickup_delivery } = req.body;

    if (!isEditor) {
       const protectedKeys = ['storage_type', 'storage_location', 'wrap_required', 'remarks', 'other_work', 'date_out', 'invoice_number', 'work_order_no', 'storage_building', 'storage_row', 'storage_col', 'boathouse_no', 'slip_no', 'pickup_delivery'];
       const hasProtected = protectedKeys.some(k => req.body[k] !== undefined);
       if (hasProtected) return res.status(403).json({ error: 'Only admin and office can edit relevant data' });
    }

    let computedLoc = storage_location;
    if (storage_type === 'storage_building' && (storage_building || storage_row || storage_col)) {
      const parts = [];
      if (storage_building) parts.push(storage_building);
      if (storage_row) parts.push('Row ' + storage_row);
      if (storage_col) parts.push('Column ' + storage_col);
      computedLoc = parts.join(', ');
    } else if ((storage_type === 'marina_boathouse' || storage_type === 'customer_boathouse') && (boathouse_no || slip_no)) {
      const parts = [];
      if (boathouse_no) parts.push('Boathouse ' + boathouse_no);
      if (slip_no) parts.push('Slip ' + slip_no);
      computedLoc = parts.join(', ');
    }

    if (status && status !== card.status) {
      await db.prepare('INSERT INTO status_history (card_id, from_status, to_status, employee_id) VALUES (?, ?, ?, ?)').run(id, card.status, status, req.employee.id);
    }
    await db.prepare(`UPDATE service_cards SET
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
      updated_at = NOW()
      WHERE id = ?`).run(status ?? null, storage_type ?? null, computedLoc ?? null, storage_building || null, storage_row || null, storage_col || null, boathouse_no ? Number(boathouse_no) : null, slip_no ? Number(slip_no) : null, wrap_required != null ? (wrap_required ? 1 : 0) : null, remarks ?? null, other_work ?? null, date_out ?? null, invoice_number ?? null, work_order_no ?? null, pickup_delivery ?? null, id);
    res.json({ ok: true });
  }));

  app.put('/api/cards/:id/items', requireAuth, asyncHandler(async (req, res) => {
    for (const { item, present, notes } of (req.body.items || [])) {
      const pCount = present ? 1 : 0;
      const r = await db.prepare('UPDATE received_items SET present=?, notes=? WHERE card_id=? AND item=?').run(pCount, notes || null, req.params.id, item);
      if (r.changes === 0) await db.prepare('INSERT INTO received_items (card_id, item, present, notes) VALUES (?, ?, ?, ?)').run(req.params.id, item, pCount, notes || null);
    }
    res.json({ ok: true });
  }));

  app.put('/api/cards/:id/work', requireAuth, asyncHandler(async (req, res) => {
    for (const { service_type, authorized, completed, notes, completed_by, completed_at, products_used } of (req.body.work || [])) {
      let productsJson;
      try {
        const p = typeof products_used === 'string' ? JSON.parse(products_used) : (products_used || []);
        productsJson = JSON.stringify(Array.isArray(p) ? p : []);
      } catch { productsJson = '[]'; }
      await db.prepare('REPLACE INTO authorized_work (card_id, service_type, authorized, completed, notes, completed_by, completed_at, products_used) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(req.params.id, service_type, authorized ? 1 : 0, completed ? 1 : 0, notes || null, completed_by || null, completed_at || null, productsJson);
    }
    await db.prepare('UPDATE service_cards SET updated_at = NOW() WHERE id=?').run(req.params.id);

    const card = await db.prepare('SELECT boat_id, status FROM service_cards WHERE id = ?').get(req.params.id);
    if (card) {
      const allWork = await db.prepare('SELECT service_type, authorized, completed FROM authorized_work WHERE card_id = ?').all(req.params.id);
      const templates = await db.prepare("SELECT item_key, category FROM service_item_templates WHERE active = 1").all();
      const cleanKeys = new Set(templates.filter(t => t.category === 'cleaning').map(t => t.item_key));

      const serviceWork = allWork.filter(w => w.authorized && !cleanKeys.has(w.service_type));
      const cleaningWork = allWork.filter(w => w.authorized && cleanKeys.has(w.service_type));

      const allServiceComplete = serviceWork.length > 0 && serviceWork.every(w => w.completed);
      const allCleaningComplete = cleaningWork.length > 0 && cleaningWork.every(w => w.completed);

      if (allServiceComplete && card.status === 'service') {
        await db.prepare('DELETE FROM boat_assignments WHERE boat_id = ? AND employee_id = ?').run(card.boat_id, req.employee.id);
      }
      if (allCleaningComplete && card.status === 'cleaning') {
        await db.prepare('DELETE FROM boat_assignments WHERE boat_id = ? AND employee_id = ?').run(card.boat_id, req.employee.id);
      }
    }

    res.json({ ok: true });
  }));

  app.get('/api/authorized-items', requireAdmin, asyncHandler(async (req, res) => {
    res.json(await db.prepare('SELECT * FROM service_item_templates ORDER BY sort_order').all());
  }));

  app.get('/api/authorized-items/active', requireAuth, asyncHandler(async (req, res) => {
    res.json(await db.prepare("SELECT * FROM service_item_templates WHERE active = 1 ORDER BY sort_order").all());
  }));

  app.post('/api/authorized-items', requireAdmin, asyncHandler(async (req, res) => {
    const { item_key, label, category, cleaning_cat, sort_order, unit_price } = req.body;
    if (!item_key || !label || !category) return res.status(400).json({ error: 'Key, label, and category required' });
    if (!['service', 'cleaning'].includes(category)) return res.status(400).json({ error: 'Category must be service or cleaning' });
    try {
      const r = await db.prepare('INSERT INTO service_item_templates (item_key, label, category, cleaning_cat, sort_order, unit_price) VALUES (?, ?, ?, ?, ?, ?)').run(item_key, label, category, cleaning_cat || null, sort_order != null ? sort_order : 0, unit_price || 0);
      res.json({ id: r.lastInsertRowid, item_key, label, category, unit_price: unit_price || 0 });
    } catch (e) {
      res.status(400).json({ error: 'Item key already exists' });
    }
  }));

  app.put('/api/authorized-items/:id', requireAdmin, asyncHandler(async (req, res) => {
    const { label, category, cleaning_cat, sort_order, active, unit_price } = req.body;
    const updates = [];
    const params = [];
    if (label !== undefined) { updates.push('label = ?'); params.push(label); }
    if (category !== undefined) { updates.push('category = ?'); params.push(category); }
    if (cleaning_cat !== undefined) { updates.push('cleaning_cat = ?'); params.push(cleaning_cat); }
    if (sort_order !== undefined) { updates.push('sort_order = ?'); params.push(sort_order); }
    if (active !== undefined) { updates.push('active = ?'); params.push(active ? 1 : 0); }
    if (unit_price !== undefined) { updates.push('unit_price = ?'); params.push(unit_price); }
    if (updates.length) {
      params.push(req.params.id);
      await db.prepare(`UPDATE service_item_templates SET ${updates.join(', ')} WHERE id=?`).run(...params);
    }
    res.json({ ok: true });
  }));

  app.get('/api/products', requireAuth, asyncHandler(async (req, res) => {
    const { q, active } = req.query;
    if (q && q.length >= 1) {
      res.json(await db.prepare(`SELECT * FROM products WHERE (name LIKE ? OR part_number LIKE ?) AND active = 1 ORDER BY name LIMIT 20`).all(`%${q}%`, `%${q}%`));
    } else if (active === 'true') {
      res.json(await db.prepare('SELECT * FROM products WHERE active = 1 ORDER BY name').all());
    } else {
      res.json(await db.prepare('SELECT * FROM products ORDER BY name').all());
    }
  }));

  app.post('/api/products', requireAuth, asyncHandler(async (req, res) => {
    const { name, part_number, unit, category, unit_price } = req.body;
    if (!name) return res.status(400).json({ error: 'Product name required' });
    try {
      const r = await db.prepare('INSERT INTO products (name, part_number, unit, category, unit_price) VALUES (?, ?, ?, ?, ?)').run(name, part_number || null, unit || null, category || null, unit_price || 0);
      res.json({ id: r.lastInsertRowid, name });
    } catch (e) {
      const existing = await db.prepare('SELECT id, name, active FROM products WHERE name = ?').get(name);
      if (existing) {
        if (!existing.active) {
          await db.prepare('UPDATE products SET active = 1 WHERE id = ?').run(existing.id);
          return res.json({ id: existing.id, name: existing.name, restored: true });
        }
        return res.status(200).json({ id: existing.id, name: existing.name, exists: true });
      }
      res.status(400).json({ error: 'Failed to create product' });
    }
  }));

  app.put('/api/products/:id', requireAdmin, asyncHandler(async (req, res) => {
    const { name, part_number, unit, category, unit_price, active } = req.body;
    const updates = [];
    const params = [];
    if (name !== undefined) { updates.push('name = ?'); params.push(name); }
    if (part_number !== undefined) { updates.push('part_number = ?'); params.push(part_number); }
    if (unit !== undefined) { updates.push('unit = ?'); params.push(unit); }
    if (category !== undefined) { updates.push('category = ?'); params.push(category); }
    if (unit_price !== undefined) { updates.push('unit_price = ?'); params.push(unit_price); }
    if (active !== undefined) { updates.push('active = ?'); params.push(active ? 1 : 0); }
    if (updates.length) {
      params.push(req.params.id);
      await db.prepare(`UPDATE products SET ${updates.join(', ')} WHERE id=?`).run(...params);
    }
    res.json({ ok: true });
  }));

  app.get('/api/cards/:id/invoice', requireAuth, asyncHandler(async (req, res) => {
    const card = await db.prepare(`SELECT id, invoice_number, invoice_status, tax_rate FROM service_cards WHERE id = ?`).get(req.params.id);
    if (!card) return res.status(404).json({ error: 'Not found' });
    card.items = await db.prepare('SELECT * FROM invoice_items WHERE card_id = ? ORDER BY sort_order').all(req.params.id);
    res.json(card);
  }));

  app.get('/api/next-work-order-number', requireAuth, asyncHandler(async (req, res) => {
    const maxWO = await db.prepare("SELECT MAX(CAST(REPLACE(work_order_no, 'WO-', '') AS UNSIGNED)) as maxNum FROM service_cards WHERE work_order_no LIKE 'WO-%'").get();
    const nextNum = (maxWO && maxWO.maxNum) ? maxWO.maxNum + 1 : 1000;
    res.json({ work_order_no: 'WO-' + nextNum });
  }));

  app.get('/api/next-invoice-number', requireAuth, asyncHandler(async (req, res) => {
    const maxInv = await db.prepare("SELECT MAX(CAST(REPLACE(invoice_number, 'INV-', '') AS UNSIGNED)) as maxNum FROM service_cards WHERE invoice_number LIKE 'INV-%'").get();
    const nextNum = (maxInv && maxInv.maxNum) ? maxInv.maxNum + 1 : 1000;
    res.json({ invoice_number: 'INV-' + nextNum });
  }));

  app.put('/api/cards/:id/invoice', requireEditor, asyncHandler(async (req, res) => {
    const { invoice_number, invoice_status, tax_rate, items } = req.body;
    if (invoice_number !== undefined || invoice_status !== undefined || tax_rate !== undefined) {
      const updates = [];
      const params = [];
      if (invoice_number !== undefined) { updates.push('invoice_number = ?'); params.push(invoice_number); }
      if (invoice_status !== undefined) { updates.push('invoice_status = ?'); params.push(invoice_status); }
      if (tax_rate !== undefined) { updates.push('tax_rate = ?'); params.push(tax_rate); }
      if (updates.length) {
        params.push(req.params.id);
        await db.prepare(`UPDATE service_cards SET ${updates.join(', ')} WHERE id=?`).run(...params);
      }
    }
    if (items) {
      await db.prepare('DELETE FROM invoice_items WHERE card_id = ?').run(req.params.id);
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const total = (item.quantity || 1) * (item.unit_price || 0);
        await db.prepare('INSERT INTO invoice_items (card_id, description, quantity, unit_price, total, sort_order) VALUES (?, ?, ?, ?, ?, ?)').run(req.params.id, item.description, item.quantity || 1, item.unit_price || 0, total, i);
      }
    }
    res.json({ ok: true });
  }));

  app.put('/api/cards/:id/condition', requireAuth, asyncHandler(async (req, res) => {
    const card = await db.prepare('SELECT status FROM service_cards WHERE id = ?').get(req.params.id);
    if (!card) return res.status(404).json({ error: 'Not found' });
    const isEditor = req.employee.role === 'admin' || req.employee.role === 'office';
    if (card.status !== 'intake' && !isEditor) {
      return res.status(403).json({ error: 'Condition assessment can only be edited during intake or by admin/office' });
    }
    for (const { area, rating, notes } of (req.body.condition || [])) {
      await db.prepare('UPDATE condition_assessment SET rating=?, notes=? WHERE card_id=? AND area=?').run(rating || null, notes || null, req.params.id, area);
    }
    res.json({ ok: true });
  }));

  app.post('/api/cards/:id/logs', requireAuth, asyncHandler(async (req, res) => {
    const { log_date, description, transcription, parts } = req.body;
    const r = await db.prepare(`INSERT INTO work_logs (card_id, employee_id, log_date, description, transcription) VALUES (?, ?, ?, ?, ?)`).run(req.params.id, req.employee.id, log_date || new Date().toISOString().split('T')[0], description || null, transcription || null);
    const logId = r.lastInsertRowid;
    if (parts && parts.length) {
      for (const p of parts.filter(p => p.description)) {
        await db.prepare('INSERT INTO parts_used (work_log_id, part_number, description, quantity) VALUES (?, ?, ?, ?)').run(logId, p.part_number || null, p.description, p.quantity || 1);
      }
    }
    await db.prepare('UPDATE service_cards SET updated_at = NOW() WHERE id=?').run(req.params.id);
    res.json({ id: logId });
  }));

  app.delete('/api/logs/:id', requireAuth, asyncHandler(async (req, res) => {
    await db.prepare('DELETE FROM work_logs WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  }));

  app.post('/api/cards/:id/photos', requireAuth, upload.single('photo'), asyncHandler(async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const { photo_type, caption, work_log_id } = req.body;
    const r = await db.prepare(`INSERT INTO photos (card_id, work_log_id, filename, photo_type, caption, uploaded_by) VALUES (?, ?, ?, ?, ?, ?)`).run(req.params.id, work_log_id || null, req.file.filename, photo_type || 'general', caption || null, req.employee.id);
    res.json({ id: r.lastInsertRowid, filename: req.file.filename, url: `/photos/${req.file.filename}` });
  }));

  app.delete('/api/photos/:id', requireAuth, asyncHandler(async (req, res) => {
    const photo = await db.prepare('SELECT filename FROM photos WHERE id = ?').get(req.params.id);
    if (photo) {
      const filePath = path.join(PHOTOS_DIR, photo.filename);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      await db.prepare('DELETE FROM photos WHERE id = ?').run(req.params.id);
    }
    res.json({ ok: true });
  }));

  app.post('/api/cards/:id/checklists', requireAuth, asyncHandler(async (req, res) => {
    const { checklist_type, items_json } = req.body;
    const items = JSON.parse(items_json || '{}');
    const allDone = Object.keys(items).length > 0 && Object.values(items).every(v => v === true);
    const existing = await db.prepare('SELECT id FROM checklist_completions WHERE card_id=? AND checklist_type=?').get(req.params.id, checklist_type);
    if (existing) {
      await db.prepare('UPDATE checklist_completions SET items_json=?,employee_id=?,completed_at=?,updated_at=NOW() WHERE id=?').run(items_json, req.employee.id, allDone ? new Date().toISOString() : null, existing.id);
      res.json({ id: existing.id });
    } else {
      const r = await db.prepare('INSERT INTO checklist_completions (card_id,checklist_type,employee_id,items_json,completed_at) VALUES (?,?,?,?,?)').run(req.params.id, checklist_type, req.employee.id, items_json, allDone ? new Date().toISOString() : null);
      res.json({ id: r.lastInsertRowid });
    }

    if (allDone) {
      const card = await db.prepare('SELECT boat_id, status FROM service_cards WHERE id = ?').get(req.params.id);
      if (card) {
        if (checklist_type === 'fall' && card.status === 'fall_checklist') {
          await db.prepare('DELETE FROM boat_assignments WHERE boat_id = ? AND employee_id = ?').run(card.boat_id, req.employee.id);
        }
        if (checklist_type === 'spring' && card.status === 'spring_checklist') {
          await db.prepare('DELETE FROM boat_assignments WHERE boat_id = ? AND employee_id = ?').run(card.boat_id, req.employee.id);
        }
        if (checklist_type === 'storage' && card.status === 'storage') {
          await db.prepare('DELETE FROM boat_assignments WHERE boat_id = ? AND employee_id = ?').run(card.boat_id, req.employee.id);
        }
      }
    }
  }));

  app.get('/api/search', requireAuth, asyncHandler(async (req, res) => {
    const q = req.query.q;
    if (!q || q.length < 2) return res.json([]);
    res.json(await db.prepare(`
      SELECT sc.id, sc.work_order_no, sc.status, sc.season_year,
             c.name as customer_name, b.name as boat_name, b.licence
      FROM service_cards sc
      JOIN boats b ON sc.boat_id = b.id
      JOIN customers c ON b.customer_id = c.id
      WHERE c.name LIKE ? OR b.name LIKE ? OR b.licence LIKE ? OR sc.work_order_no LIKE ?
      ORDER BY sc.updated_at DESC LIMIT 20
    `).all(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`));
  }));

  app.get('/api/wrap-queue', requireAuth, asyncHandler(async (req, res) => {
    res.json(await db.prepare(`
      ${CARD_SELECT}
      LEFT JOIN checklist_completions cc ON cc.card_id = sc.id AND cc.checklist_type = 'storage'
      WHERE sc.wrap_required=1
        AND (cc.id IS NULL OR JSON_EXTRACT(cc.items_json, '$.wrap') IS NULL OR JSON_EXTRACT(cc.items_json, '$.wrap') != 1)
        AND sc.status IN ('fall_checklist','storage')
      ORDER BY c.name
    `).all());
  }));

  app.get('/api/version', (req, res) => {
    res.json({ version: require('./package.json').version });
  });

  app.get('/api/public/card/:token', asyncHandler(async (req, res) => {
    const card = await db.prepare(`
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
    card.authorized_work = await db.prepare('SELECT * FROM authorized_work WHERE card_id = ?').all(card.id);
    card.photos = await db.prepare('SELECT filename, photo_type FROM photos WHERE card_id = ? ORDER BY uploaded_at DESC').all(card.id);
    card.checklists = await db.prepare('SELECT * FROM checklist_completions WHERE card_id = ?').all(card.id);
    card.status_history = await db.prepare(`
      SELECT sh.*, e.name as employee_name FROM status_history sh
      LEFT JOIN employees e ON sh.employee_id = e.id
      WHERE sh.card_id = ? ORDER BY sh.changed_at DESC
    `).all(card.id);
    card.invoice = await db.prepare('SELECT * FROM invoice_items WHERE card_id = ? ORDER BY sort_order').all(card.id);
    res.json(card);
  }));

  app.get('/api/export', requireAdmin, asyncHandler(async (req, res) => {
    const archiver = require('archiver');
    res.attachment(`marina-backup-${new Date().toISOString().split('T')[0]}.zip`);
    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('error', err => res.status(500).end());
    archive.pipe(res);

    const [tables] = await pool.query("SHOW TABLES");
    let dump = `-- Marina backup ${new Date().toISOString()}\n\n`;
    for (const tableRow of tables) {
      const tableName = Object.values(tableRow)[0];
      const [rows] = await pool.query(`SELECT * FROM \`${tableName}\``);
      if (rows.length === 0) continue;
      const columns = Object.keys(rows[0]);
      dump += `INSERT INTO \`${tableName}\` (${columns.map(c => `\`${c}\``).join(', ')}) VALUES\n`;
      const values = rows.map(row => {
        const vals = columns.map(col => {
          if (row[col] === null) return 'NULL';
          if (typeof row[col] === 'number') return String(row[col]);
          if (row[col] instanceof Date) return `'${row[col].toISOString().slice(0, 19).replace('T', ' ')}'`;
          return `'${String(row[col]).replace(/'/g, "''")}'`;
        });
        return `  (${vals.join(', ')})`;
      });
      dump += values.join(',\n') + ';\n\n';
    }
    archive.append(dump, { name: 'backup.sql' });

    if (fs.existsSync(PHOTOS_DIR)) archive.directory(PHOTOS_DIR, 'photos');
    archive.finalize();
  }));

  app.get('/api/backups', requireAdmin, asyncHandler(async (req, res) => {
    const BACKUP_DIR = path.join(__dirname, 'backup');
    if (!fs.existsSync(BACKUP_DIR)) return res.json([]);
    
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.endsWith('.sql'))
      .sort()
      .reverse()
      .slice(0, 2)
      .map(f => {
        const stat = fs.statSync(path.join(BACKUP_DIR, f));
        return { filename: f, date: f.replace('.sql', ''), size: stat.size };
      });
    
    res.json(files);
  }));

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
      console.log(`\n⚓ Marina Manager`);
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
