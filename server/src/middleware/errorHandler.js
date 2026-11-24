// 404 for any route nothing else handled.
export const notFound = (req, res) => res.status(404).json({ error: 'Not found' });

// Catches errors passed to next(err), and (Express 5) errors thrown in async routes.
// 4xx errors carry messages meant for the user. Anything else may contain
// internals (SQL, SMTP, server paths), so it is only logged here and the user
// gets a generic line.
// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, next) => {
  console.error(err);
  // A valid token for a user that no longer exists (e.g. after a database reset):
  // saving anything with their id breaks the users foreign key. 401 makes the app log them out.
  if (err.code === '23503' && err.detail?.includes('table "users"')) {
    return res.status(401).json({ error: 'Your login is no longer valid. Please log in again.' });
  }
  const status = err.status || 500;
  res.status(status).json({ error: status < 500 ? err.message : 'Something went wrong. Please try again.' });
};
