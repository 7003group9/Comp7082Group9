import pg from 'pg';
import { DATABASE_URL } from './env.js';

export const pool = new pg.Pool({ connectionString: DATABASE_URL });
export const query = (text, params) => pool.query(text, params);
