import app from './app.js';
import { PORT } from './config/env.js';

app.listen(PORT, () => console.log(`Campus Claim API on http://localhost:${PORT}`));
