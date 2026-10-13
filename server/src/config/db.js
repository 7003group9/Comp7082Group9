import pg from 'pg';
import { DATABASE_URL } from './env.js';

// Shared Postgres connection pool (one per process).
export const pool = new pg.Pool({ connectionString: DATABASE_URL });
// An idle connection can fail (e.g. the database restarts). Without a handler
// that event would crash the whole server; the pool just opens a new connection.
pool.on('error', (err) => console.error('Database connection error:', err.message));
// Shortcut: query('SELECT ... WHERE id = $1', [id]). Always pass user input as params.
export const query = (text, params) => pool.query(text, params);
