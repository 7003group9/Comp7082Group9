// 404 for any route nothing else handled.
export const notFound = (req, res) => res.status(404).json({ error: 'Not found' });

// Catches errors passed to next(err); logs them and replies with JSON.
// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Server error' });
};
