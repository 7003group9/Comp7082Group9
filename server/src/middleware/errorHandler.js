// 404 for any route nothing else handled.
export const notFound = (req, res) => res.status(404).json({ error: 'Not found' });

// Catches errors passed to next(err), and (Express 5) errors thrown in async routes.
// 4xx errors carry messages meant for the user. Anything else may contain
// internals (SQL, SMTP, server paths), so it is only logged here and the user
// gets a generic line.
// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, next) => {
  console.error(err);
  const status = err.status || 500;
  res.status(status).json({ error: status < 500 ? err.message : 'Something went wrong. Please try again.' });
};
