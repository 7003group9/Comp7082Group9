import app from './app.js';
import { PORT } from './config/env.js';
import { loadSuspended } from './services/suspensions.js';
import { readFile } from 'node:fs/promises';
import { query } from './config/db.js';

// Bring the database up to date.
await query(await readFile(new URL('./db/schema.sql', import.meta.url), 'utf8'));
await loadSuspended(); // so suspended users are blocked from the first request
app.listen(PORT, () => console.log(`Campus Claim API on http://localhost:${PORT}`));
we 