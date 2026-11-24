import { readFile } from 'node:fs/promises';
import pg from 'pg';

const connectionString =
  process.env.DATABASE_URL ||
  'postgresql://postgres:postgres@localhost:5432/campus_claim';
const pool = new pg.Pool({ connectionString });

try {
  const schema = await readFile(new URL('../src/db/schema.sql', import.meta.url), 'utf8');
  await pool.query(schema);
  console.log('Database schema initialized.');
} finally {
  await pool.end();
}
