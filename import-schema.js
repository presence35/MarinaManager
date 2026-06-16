/**
 * Import schema.sql into GoDaddy MySQL
 * Run on GoDaddy's server: node import-schema.js
 */

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

async function main() {
  const schemaPath = path.join(__dirname, 'schema.sql');

  if (!fs.existsSync(schemaPath)) {
    console.error('schema.sql not found');
    process.exit(1);
  }

  const sql = fs.readFileSync(schemaPath, 'utf8');

  console.log('Connecting to MySQL...');
  console.log(`  Host: ${process.env.DB_HOST}`);
  console.log(`  Database: ${process.env.DB_NAME}`);
  console.log(`  User: ${process.env.DB_USER}`);
  console.log();

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: true,
  });

  try {
    console.log('Importing schema...');
    await connection.query(sql);
    console.log('Schema imported successfully!');

    const [rows] = await connection.query('SHOW TABLES');
    console.log(`\nTables created: ${rows.length}`);
    rows.forEach(r => console.log(`  - ${Object.values(r)[0]}`));
  } catch (err) {
    console.error('Import failed:', err.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

main();
