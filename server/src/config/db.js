import pg from 'pg';
import { DATABASE_URL } from './env.js';

// Shared Postgres connection pool (one per process).
export const pool = new pg.Pool({ connectionString: DATABASE_URL });
// Shortcut: query('SELECT ... WHERE id = $1', [id]). Always pass user input as params.
export const query = (text, params) => pool.query(text, params);
