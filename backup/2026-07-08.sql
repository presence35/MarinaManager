-- Marina Manager backup 2026-07-08T13:09:17.201Z

CREATE TABLE authorized_work (
  card_id INTEGER NOT NULL,
  service_type TEXT NOT NULL,
  authorized INTEGER DEFAULT 0,
  completed INTEGER DEFAULT 0,
  notes TEXT,
  completed_by INTEGER,
  completed_at TEXT,
  products_used TEXT DEFAULT '[]',
  PRIMARY KEY (card_id, service_type),
  FOREIGN KEY (card_id) REFERENCES service_cards(id)
);

INSERT INTO `authorized_work` (`card_id`, `service_type`, `authorized`, `completed`, `notes`, `completed_by`, `completed_at`, `products_used`) VALUES
  (1, 'oil_change', 1, 1, 'fdafdsa', 1, '2026-06-17T11:49:51.972Z', '[{"description":"fds","quantity":1}]'),
  (2, 'oil_change', 0, 0, NULL, NULL, NULL, '[]'),
  (2, 'outdrive_service', 0, 0, NULL, NULL, NULL, '[]'),
  (2, 'tune_up', 0, 0, NULL, NULL, NULL, '[]'),
  (2, 'lower_unit_drain', 0, 0, NULL, NULL, NULL, '[]'),
  (2, 'prop_rebuild', 0, 0, NULL, NULL, NULL, '[]'),
  (2, 'int_quick_wipe', 0, 0, NULL, NULL, NULL, '[]'),
  (2, 'int_power_wash', 0, 0, NULL, NULL, NULL, '[]'),
  (2, 'int_spotless', 0, 0, NULL, NULL, NULL, '[]'),
  (2, 'ext_quick_wipe', 0, 0, NULL, NULL, NULL, '[]'),
  (2, 'ext_power_wash', 0, 0, NULL, NULL, NULL, '[]'),
  (2, 'ext_algae_wax', 0, 0, NULL, NULL, NULL, '[]'),
  (2, 'ext_buff_polish', 0, 0, NULL, NULL, NULL, '[]');

CREATE TABLE boat_assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  boat_id INTEGER NOT NULL,
  employee_id INTEGER NOT NULL,
  assigned_by INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(boat_id, employee_id),
  FOREIGN KEY (boat_id) REFERENCES boats(id),
  FOREIGN KEY (employee_id) REFERENCES employees(id),
  FOREIGN KEY (assigned_by) REFERENCES employees(id)
);

CREATE TABLE boats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL,
  name TEXT,
  motor_type TEXT,
  model TEXT,
  licence TEXT,
  trailer_licence TEXT,
  rate_type TEXT DEFAULT 'SW',
  length_ft REAL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);

INSERT INTO `boats` (`id`, `customer_id`, `name`, `motor_type`, `model`, `licence`, `trailer_licence`, `rate_type`, `length_ft`, `created_at`) VALUES
  (1, 1, 'Sea Breeze', 'Yamaha 200', 'Sea Ray 240', NULL, NULL, 'SW', 24, '2026-06-17 11:34:40');

CREATE TABLE checklist_completions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  card_id INTEGER NOT NULL,
  checklist_type TEXT NOT NULL,
  employee_id INTEGER NOT NULL,
  items_json TEXT DEFAULT '{}',
  completed_at TEXT,
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (card_id) REFERENCES service_cards(id),
  FOREIGN KEY (employee_id) REFERENCES employees(id)
);

CREATE TABLE condition_assessment (
  card_id INTEGER NOT NULL,
  area TEXT NOT NULL,
  rating INTEGER,
  notes TEXT,
  PRIMARY KEY (card_id, area),
  FOREIGN KEY (card_id) REFERENCES service_cards(id)
);

INSERT INTO `condition_assessment` (`card_id`, `area`, `rating`, `notes`) VALUES
  (2, 'top', NULL, NULL),
  (2, 'hull', NULL, NULL),
  (2, 'upholstery', NULL, NULL),
  (2, 'motor', NULL, NULL),
  (2, 'propeller', NULL, NULL),
  (2, 'lower_unit', NULL, NULL);

CREATE TABLE customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  postal_code TEXT,
  phone TEXT,
  email TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

INSERT INTO `customers` (`id`, `name`, `address`, `city`, `postal_code`, `phone`, `email`, `created_at`) VALUES
  (1, 'John Doe', NULL, NULL, NULL, '555-0101', 'john@example.com', '2026-06-17 11:34:40');

CREATE TABLE device_tokens (
  token TEXT PRIMARY KEY,
  employee_id INTEGER NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (employee_id) REFERENCES employees(id)
);

INSERT INTO `device_tokens` (`token`, `employee_id`, `created_at`) VALUES
  ('23e2f366cf82a28a40bcaeac8b8c260bd537f681d20255b8b060a1fb79bd7656', 1, '2026-06-17 11:37:52');

CREATE TABLE employees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'mechanic',
  initials TEXT,
  pin_hash TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

INSERT INTO `employees` (`id`, `name`, `role`, `initials`, `pin_hash`, `active`, `created_at`) VALUES
  (1, 'Admin', 'admin', 'AD', '9af15b336e6a9619928537df30b2e6a2376569fcf9d7e773eccede65606529a0', 1, '2026-06-17 11:34:40');

CREATE TABLE invoice_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  card_id INTEGER NOT NULL,
  description TEXT NOT NULL,
  quantity REAL DEFAULT 1,
  unit_price REAL DEFAULT 0,
  total REAL DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  FOREIGN KEY (card_id) REFERENCES service_cards(id)
);

INSERT INTO `invoice_items` (`id`, `card_id`, `description`, `quantity`, `unit_price`, `total`, `sort_order`) VALUES
  (2, 1, 'Service: oil_change', 1, 0, 0, 0);

CREATE TABLE parts_used (
  work_log_id INTEGER NOT NULL,
  part_number TEXT,
  description TEXT NOT NULL,
  quantity INTEGER DEFAULT 1,
  FOREIGN KEY (work_log_id) REFERENCES work_logs(id)
);

CREATE TABLE photos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  card_id INTEGER NOT NULL,
  work_log_id INTEGER,
  filename TEXT NOT NULL,
  photo_type TEXT DEFAULT 'general',
  caption TEXT,
  uploaded_by INTEGER,
  uploaded_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (card_id) REFERENCES service_cards(id),
  FOREIGN KEY (work_log_id) REFERENCES work_logs(id),
  FOREIGN KEY (uploaded_by) REFERENCES employees(id)
);

CREATE TABLE products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  part_number TEXT,
  unit TEXT,
  category TEXT,
  unit_price REAL DEFAULT 0,
  active INTEGER DEFAULT 1
);

INSERT INTO `products` (`id`, `name`, `part_number`, `unit`, `category`, `unit_price`, `active`) VALUES
  (1, 'fds', NULL, NULL, NULL, 0, 1);

CREATE TABLE received_items (
  card_id INTEGER NOT NULL,
  item TEXT NOT NULL,
  present INTEGER DEFAULT 0,
  notes TEXT,
  PRIMARY KEY (card_id, item),
  FOREIGN KEY (card_id) REFERENCES service_cards(id)
);

INSERT INTO `received_items` (`card_id`, `item`, `present`, `notes`) VALUES
  (2, 'battery', 0, NULL),
  (2, 'keys', 0, NULL),
  (2, 'cover', 0, NULL),
  (2, 'paddles', 0, NULL),
  (2, 'life_jackets', 0, NULL),
  (2, 'cushions', 0, NULL),
  (2, 'gas_cans', 0, NULL),
  (2, 'tie_ropes', 0, NULL),
  (2, 'lights', 0, NULL);

CREATE TABLE service_cards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  boat_id INTEGER NOT NULL,
  season_year INTEGER,
  work_order_no TEXT,
  storage_type TEXT,
  storage_location TEXT,
  storage_building TEXT,
  storage_row TEXT,
  storage_col TEXT,
  boathouse_no INTEGER,
  slip_no INTEGER,
  wrap_required INTEGER DEFAULT 0,
  remarks TEXT,
  other_work TEXT,
  date_in TEXT,
  date_out TEXT,
  invoice_number TEXT,
  invoice_status TEXT,
  tax_rate REAL DEFAULT 0,
  status TEXT DEFAULT 'intake',
  created_by INTEGER,
  customer_token TEXT UNIQUE,
  pickup_delivery TEXT,
  updated_at TEXT DEFAULT (datetime('now')), is_fake INTEGER DEFAULT 0,
  FOREIGN KEY (boat_id) REFERENCES boats(id),
  FOREIGN KEY (created_by) REFERENCES employees(id)
);

INSERT INTO `service_cards` (`id`, `boat_id`, `season_year`, `work_order_no`, `storage_type`, `storage_location`, `storage_building`, `storage_row`, `storage_col`, `boathouse_no`, `slip_no`, `wrap_required`, `remarks`, `other_work`, `date_in`, `date_out`, `invoice_number`, `invoice_status`, `tax_rate`, `status`, `created_by`, `customer_token`, `pickup_delivery`, `updated_at`, `is_fake`) VALUES
  (1, 1, 2026, 'WO-1000', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, NULL, NULL, 'draft', 13, 'invoiced', NULL, 'ryZ2Hb9W', NULL, '2026-06-17 11:55:22', 0),
  (2, 1, 2026, 'WO-1001', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, NULL, NULL, '2026-06-17', NULL, NULL, NULL, 0, 'intake', 1, 'tzaqDTKD', NULL, '2026-06-17 12:14:42', 1);

CREATE TABLE service_item_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_key TEXT UNIQUE NOT NULL,
  label TEXT NOT NULL,
  category TEXT NOT NULL,
  cleaning_cat TEXT,
  sort_order INTEGER DEFAULT 0,
  active INTEGER DEFAULT 1,
  unit_price REAL DEFAULT 0
);

INSERT INTO `service_item_templates` (`id`, `item_key`, `label`, `category`, `cleaning_cat`, `sort_order`, `active`, `unit_price`) VALUES
  (1, 'oil_change', 'Oil & Filter', 'service', NULL, 1, 1, 0),
  (2, 'outdrive_service', 'Outdrive Svc', 'service', NULL, 2, 1, 0),
  (3, 'tune_up', 'Tune-Up', 'service', NULL, 3, 1, 0),
  (4, 'lower_unit_drain', 'Lower Unit', 'service', NULL, 4, 1, 0),
  (5, 'prop_rebuild', 'Prop Rebuild', 'service', NULL, 5, 1, 0),
  (6, 'int_quick_wipe', 'Quick Wipe', 'cleaning', 'Interior', 8, 1, 0),
  (7, 'int_power_wash', 'Power Wash', 'cleaning', 'Interior', 9, 1, 0),
  (8, 'int_spotless', 'Make It Shiny & Spotless', 'cleaning', 'Interior', 10, 1, 0),
  (9, 'ext_quick_wipe', 'Quick Wipe', 'cleaning', 'Exterior', 11, 1, 0),
  (10, 'ext_power_wash', 'Power Wash', 'cleaning', 'Exterior', 12, 1, 0),
  (11, 'ext_algae_wax', 'Algae Strip & Wax', 'cleaning', 'Exterior', 13, 1, 0),
  (12, 'ext_buff_polish', 'Buff / Polish', 'cleaning', 'Exterior', 14, 1, 0);

CREATE TABLE status_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  card_id INTEGER NOT NULL,
  from_status TEXT,
  to_status TEXT NOT NULL,
  employee_id INTEGER,
  changed_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (card_id) REFERENCES service_cards(id),
  FOREIGN KEY (employee_id) REFERENCES employees(id)
);

INSERT INTO `status_history` (`id`, `card_id`, `from_status`, `to_status`, `employee_id`, `changed_at`) VALUES
  (1, 1, 'intake', 'ready', 1, '2026-06-17 11:41:21'),
  (2, 1, 'ready', 'service', 1, '2026-06-17 11:43:41'),
  (3, 1, 'service', 'storage', 1, '2026-06-17 11:43:46'),
  (4, 1, 'storage', 'service', 1, '2026-06-17 11:43:55'),
  (5, 1, 'service', 'intake', 1, '2026-06-17 11:47:50'),
  (6, 1, 'intake', 'service', 1, '2026-06-17 11:48:01'),
  (7, 1, 'service', 'invoiced', 1, '2026-06-17 11:55:22'),
  (8, 2, NULL, 'intake', 1, '2026-06-17 12:14:42');

CREATE TABLE work_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  card_id INTEGER NOT NULL,
  employee_id INTEGER NOT NULL,
  log_date TEXT,
  description TEXT,
  transcription TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (card_id) REFERENCES service_cards(id),
  FOREIGN KEY (employee_id) REFERENCES employees(id)
);

