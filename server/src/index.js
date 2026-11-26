import app from './app.js';
import { PORT } from './config/env.js';
import { loadSuspended } from './services/suspensions.js';

// The tables come from src/db/schema.sql, which Docker loads when it creates the database
// (docker compose up). After a schema change: npm run db:reset.
await loadSuspended(); // so suspended users are blocked from the first request
app.listen(PORT, () => console.log(`Campus Claim API on http://localhost:${PORT}`));
