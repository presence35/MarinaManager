/**
 * Migration script: Exports existing SQLite data to MySQL INSERT statements.
 * Run: node export-sqlite-data.js
 * Output: data-export.sql (append to schema.sql or import separately)
 */

const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'marina.db');
const OUTPUT = path.join(__dirname, 'data-export.sql');

async function main() {
  if (!fs.existsSync(DB_PATH)) {
    console.error(`Database not found: ${DB_PATH}`);
    console.error('Set DB_PATH env var if your database is elsewhere.');
    process.exit(1);
  }

  const SQL = await initSqlJs();
  const db = new SQL.Database(fs.readFileSync(DB_PATH));

  const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
  const tableNames = tables[0].values.map(r => r[0]);

  console.log(`Found tables: ${tableNames.join(', ')}`);

  let output = `-- ============================================================
-- Data exported from SQLite: ${new Date().toISOString()}
-- Import AFTER schema.sql tables are created
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;

`;

  for (const table of tableNames) {
    const columns = db.exec(`PRAGMA table_info(${table})`);
    const colNames = columns[0].values.map(c => c[1]);

    const rows = db.exec(`SELECT * FROM ${table}`);
    if (!rows[0] || rows[0].values.length === 0) {
      console.log(`  ${table}: 0 rows (skipped)`);
      continue;
    }

    output += `-- ${table} (${rows[0].values.length} rows)\n`;
    output += `INSERT INTO \`${table}\` (${colNames.map(c => `\`${c}\``).join(', ')}) VALUES\n`;

    const insertRows = rows[0].values.map(row => {
      const values = row.map(v => {
        if (v === null) return 'NULL';
        if (typeof v === 'number') return String(v);
        if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'`;
        return `'${String(v).replace(/'/g, "''")}'`;
      });
      return `  (${values.join(', ')})`;
    });

    output += insertRows.join(',\n') + ';\n\n';
    console.log(`  ${table}: ${rows[0].values.length} rows`);
  }

  output += `SET FOREIGN_KEY_CHECKS = 1;\n`;

  fs.writeFileSync(OUTPUT, output);
  console.log(`\nExported to: ${OUTPUT}`);
  console.log('Import into MySQL: mysql -u user -p database_name < data-export.sql');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
