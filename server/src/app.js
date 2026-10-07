import express from 'express';
import cors from 'cors';
import routes from './routes/index.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';

// Builds the Express app. Kept separate from index.js so tests can use it
// without opening a port.
const app = express();
app.use(cors()); // allow the mobile app / browser to call the API
app.use(express.json()); // parse JSON request bodies

// Simple liveness check.
app.get('/health', (req, res) => res.json({ ok: true }));
app.use(routes);

// Must stay last: unknown routes -> 404, thrown errors -> JSON error.
app.use(notFound);
app.use(errorHandler);

export default app;
