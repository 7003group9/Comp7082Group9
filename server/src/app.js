import express from 'express';
import cors from 'cors';
import auth from './routes/auth.routes.js';
import items from './routes/items.routes.js';
import claims from './routes/claims.routes.js';
import users from './routes/users.routes.js';
import { rejectSuspended } from './middleware/auth.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';

// Builds the Express app. Kept separate from index.js so tests can use it
// without opening a port.
const app = express();
app.use(cors()); // allow the mobile app / browser to call the API
app.use(express.json()); // parse JSON request bodies

// Simple liveness check.
app.get('/health', (req, res) => res.json({ ok: true }));
app.use(rejectSuspended); // a suspended user's token works nowhere
app.use('/auth', auth);
app.use('/items', items);
app.use('/claims', claims);
app.use('/users', users);

// Must stay last: unknown routes -> 404, thrown errors -> JSON error.
app.use(notFound);
app.use(errorHandler);

export default app;
