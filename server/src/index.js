import app from './app.js';
import { PORT } from './config/env.js';
import { loadSuspended } from './services/suspensions.js';

await loadSuspended(); // so suspended users are blocked from the first request
app.listen(PORT, () => console.log(`Campus Claim API on http://localhost:${PORT}`));
