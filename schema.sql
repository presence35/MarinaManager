-- ============================================================
-- Campbell's Landing Marina - MySQL Schema & Seed Data
-- Import into GoDaddy via phpMyAdmin or MySQL CLI
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;

-- ─── DROP EXISTING TABLES (safe re-import) ──────────────────
DROP TABLE IF EXISTS status_history;
DROP TABLE IF EXISTS checklist_completions;
DROP TABLE IF EXISTS photos;
DROP TABLE IF EXISTS parts_used;
DROP TABLE IF EXISTS work_logs;
DROP TABLE IF EXISTS condition_assessment;
DROP TABLE IF EXISTS authorized_work;
DROP TABLE IF EXISTS received_items;
DROP TABLE IF EXISTS service_cards;
DROP TABLE IF EXISTS boat_assignments;
DROP TABLE IF EXISTS boats;
DROP TABLE IF EXISTS customers;
DROP TABLE IF EXISTS device_tokens;
DROP TABLE IF EXISTS employees;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS invoice_items;
DROP TABLE IF EXISTS service_item_templates;
DROP TABLE IF EXISTS storage_locations;

SET FOREIGN_KEY_CHECKS = 1;

-- ─── EMPLOYEES ──────────────────────────────────────────────
CREATE TABLE employees (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'mechanic',
  initials VARCHAR(10),
  pin_hash VARCHAR(64) NOT NULL,
  active TINYINT NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── DEVICE TOKENS ──────────────────────────────────────────
CREATE TABLE device_tokens (
  token VARCHAR(255) PRIMARY KEY,
  employee_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── CUSTOMERS ──────────────────────────────────────────────
CREATE TABLE customers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  address VARCHAR(255),
  city VARCHAR(255),
  postal_code VARCHAR(20),
  phone VARCHAR(50),
  email VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── BOATS ──────────────────────────────────────────────────
CREATE TABLE boats (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer_id INT NOT NULL,
  name VARCHAR(255),
  motor_type VARCHAR(255),
  serial_no VARCHAR(255),
  model VARCHAR(255),
  licence VARCHAR(50),
  trailer_licence VARCHAR(50),
  rate_type VARCHAR(10) DEFAULT 'SW',
  length_ft DECIMAL(5,1),
  FOREIGN KEY (customer_id) REFERENCES customers(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── SERVICE CARDS ──────────────────────────────────────────
CREATE TABLE service_cards (
  id INT AUTO_INCREMENT PRIMARY KEY,
  work_order_no VARCHAR(50),
  boat_id INT NOT NULL,
  season_year INT NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'intake',
  storage_type VARCHAR(50),
  storage_location VARCHAR(255),
  wrap_required TINYINT DEFAULT 0,
  remarks TEXT,
  other_work TEXT,
  date_in DATE,
  date_out DATE,
  invoice_number VARCHAR(50),
  invoice_status VARCHAR(50) DEFAULT 'draft',
  tax_rate DECIMAL(5,1) DEFAULT 13.0,
  unwrap_done TINYINT DEFAULT 0,
  storage_building VARCHAR(100),
  storage_row VARCHAR(20),
  storage_col VARCHAR(20),
  boathouse_no INT,
  slip_no INT,
  customer_token VARCHAR(20),
  pickup_delivery VARCHAR(50) DEFAULT NULL,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (boat_id) REFERENCES boats(id),
  FOREIGN KEY (created_by) REFERENCES employees(id),
  UNIQUE INDEX idx_cards_customer_token (customer_token)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── RECEIVED ITEMS ─────────────────────────────────────────
CREATE TABLE received_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  card_id INT NOT NULL,
  item VARCHAR(100) NOT NULL,
  present TINYINT DEFAULT 0,
  notes TEXT,
  UNIQUE KEY uk_card_item (card_id, item),
  FOREIGN KEY (card_id) REFERENCES service_cards(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── AUTHORIZED WORK ────────────────────────────────────────
CREATE TABLE authorized_work (
  id INT AUTO_INCREMENT PRIMARY KEY,
  card_id INT NOT NULL,
  service_type VARCHAR(100) NOT NULL,
  authorized TINYINT DEFAULT 0,
  completed TINYINT DEFAULT 0,
  notes TEXT,
  completed_by INT REFERENCES employees(id),
  completed_at TIMESTAMP NULL,
  products_used JSON DEFAULT '[]',
  UNIQUE KEY uk_card_service (card_id, service_type),
  FOREIGN KEY (card_id) REFERENCES service_cards(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── CONDITION ASSESSMENT ───────────────────────────────────
CREATE TABLE condition_assessment (
  id INT AUTO_INCREMENT PRIMARY KEY,
  card_id INT NOT NULL,
  area VARCHAR(50) NOT NULL,
  rating VARCHAR(50),
  notes TEXT,
  UNIQUE KEY uk_card_area (card_id, area),
  FOREIGN KEY (card_id) REFERENCES service_cards(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── WORK LOGS ──────────────────────────────────────────────
CREATE TABLE work_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  card_id INT NOT NULL,
  employee_id INT NOT NULL,
  log_date DATE NOT NULL,
  description TEXT,
  transcription TEXT,
  voice_url VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (card_id) REFERENCES service_cards(id) ON DELETE CASCADE,
  FOREIGN KEY (employee_id) REFERENCES employees(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── PARTS USED ─────────────────────────────────────────────
CREATE TABLE parts_used (
  id INT AUTO_INCREMENT PRIMARY KEY,
  work_log_id INT NOT NULL,
  part_number VARCHAR(100),
  description VARCHAR(255) NOT NULL,
  quantity DECIMAL(8,2) DEFAULT 1,
  FOREIGN KEY (work_log_id) REFERENCES work_logs(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── PHOTOS ─────────────────────────────────────────────────
CREATE TABLE photos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  card_id INT NOT NULL,
  work_log_id INT,
  filename VARCHAR(255) NOT NULL,
  photo_type VARCHAR(50) DEFAULT 'general',
  caption TEXT,
  uploaded_by INT,
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (card_id) REFERENCES service_cards(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── CHECKLIST COMPLETIONS ──────────────────────────────────
CREATE TABLE checklist_completions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  card_id INT NOT NULL,
  checklist_type VARCHAR(100) NOT NULL,
  employee_id INT NOT NULL,
  items_json JSON DEFAULT '{}',
  completed_at TIMESTAMP NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_card_checklist (card_id, checklist_type),
  FOREIGN KEY (card_id) REFERENCES service_cards(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── STATUS HISTORY ─────────────────────────────────────────
CREATE TABLE status_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  card_id INT NOT NULL,
  from_status VARCHAR(50),
  to_status VARCHAR(50) NOT NULL,
  employee_id INT,
  note TEXT,
  changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (card_id) REFERENCES service_cards(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── STORAGE LOCATIONS ──────────────────────────────────────
CREATE TABLE storage_locations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  facility_name VARCHAR(255) NOT NULL,
  facility_type VARCHAR(50) NOT NULL DEFAULT 'dry_land',
  row_label VARCHAR(50),
  col_num INT,
  level_num INT,
  notes TEXT,
  current_card_id INT,
  FOREIGN KEY (current_card_id) REFERENCES service_cards(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── BOAT ASSIGNMENTS ───────────────────────────────────────
CREATE TABLE boat_assignments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  boat_id INT NOT NULL,
  employee_id INT NOT NULL,
  assigned_by INT,
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_boat_employee (boat_id, employee_id),
  FOREIGN KEY (boat_id) REFERENCES boats(id) ON DELETE CASCADE,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_by) REFERENCES employees(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── INVOICE ITEMS ──────────────────────────────────────────
CREATE TABLE invoice_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  card_id INT NOT NULL,
  description VARCHAR(255) NOT NULL,
  quantity DECIMAL(8,2) DEFAULT 1,
  unit_price DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(10,2) DEFAULT 0,
  sort_order INT DEFAULT 0,
  FOREIGN KEY (card_id) REFERENCES service_cards(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── PRODUCTS ───────────────────────────────────────────────
CREATE TABLE products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  part_number VARCHAR(100),
  unit VARCHAR(50),
  category VARCHAR(100),
  unit_price DECIMAL(10,2) DEFAULT 0,
  active TINYINT NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ─── SERVICE ITEM TEMPLATES ─────────────────────────────────
CREATE TABLE service_item_templates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  item_key VARCHAR(100) NOT NULL UNIQUE,
  label VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL DEFAULT 'service',
  cleaning_cat VARCHAR(50),
  sort_order INT DEFAULT 0,
  unit_price DECIMAL(10,2) DEFAULT 0,
  active TINYINT NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- SEED DATA
-- ============================================================

-- Default admin (PIN: 0000, SHA-256 hash)
INSERT INTO employees (name, role, initials, pin_hash) VALUES
  ('Admin', 'admin', 'AD', '9af15b336e6a9619928537df30b2e6a2376569fcf9d7e773eccede65606529a0');

-- Default customer, boat, and service card for testing
INSERT INTO customers (name, phone, email) VALUES
  ('John Doe', '555-0101', 'john@example.com');

-- Service item templates - Service
INSERT INTO service_item_templates (item_key, label, category, cleaning_cat, sort_order, unit_price) VALUES
  ('oil_change', 'Oil & Filter', 'service', NULL, 1, 0),
  ('outdrive_service', 'Outdrive Svc', 'service', NULL, 2, 0),
  ('tune_up', 'Tune-Up', 'service', NULL, 3, 0),
  ('lower_unit_drain', 'Lower Unit', 'service', NULL, 4, 0),
  ('prop_rebuild', 'Prop Rebuild', 'service', NULL, 5, 0);

-- Service item templates - Cleaning
INSERT INTO service_item_templates (item_key, label, category, cleaning_cat, sort_order, unit_price) VALUES
  ('int_quick_wipe', 'Quick Wipe', 'cleaning', 'Interior', 8, 0),
  ('int_power_wash', 'Power Wash', 'cleaning', 'Interior', 9, 0),
  ('int_spotless', 'Make It Shiny & Spotless', 'cleaning', 'Interior', 10, 0),
  ('ext_quick_wipe', 'Quick Wipe', 'cleaning', 'Exterior', 11, 0),
  ('ext_power_wash', 'Power Wash', 'cleaning', 'Exterior', 12, 0),
  ('ext_algae_wax', 'Algae Strip & Wax', 'cleaning', 'Exterior', 13, 0),
  ('ext_buff_polish', 'Buff / Polish', 'cleaning', 'Exterior', 14, 0);

-- ============================================================
-- DATA MIGRATION PLACEHOLDER
-- ============================================================
-- After creating tables, import your existing data here.
-- Use a tool like sqlite3 CLI or DB Browser for SQLite to
-- export your marina.db as CSV/SQL, then paste INSERT
-- statements below or use a migration script.
-- ============================================================
