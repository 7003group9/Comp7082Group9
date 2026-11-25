// 404 for any route not handled above this middleware.
export const notFound = (req, res) =>
  res.status(404).json({ error: 'Not found', code: 'NOT_FOUND' });

const postgresErrors = {
  '22P02': [400, 'Invalid value provided'],
  '23502': [400, 'A required field is missing'],
  '22001': [400, 'A provided value is too long'],
  '23505': [409, 'This record already exists'],
  '23503': [409, 'This record is referenced by another record'],
};

// Catches operational and unexpected failures once, after all routes.
// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, next) => {
  let status = Number(err?.statusCode ?? err?.status);
  let message = err?.message;
  let code;

  if (err?.type === 'entity.parse.failed' || err instanceof SyntaxError) {
    status = 400;
    message = 'Invalid JSON request body';
    code = 'INVALID_JSON';
  } else if (err?.code === '23503' && err?.detail?.includes('table "users"')) {
    status = 401;
    message = 'Your login is no longer valid. Please log in again.';
    code = 'INVALID_LOGIN';
  } else if (postgresErrors[err?.code]) {
    [status, message] = postgresErrors[err.code];
    code = `DB_${err.code}`;
  } else if (!Number.isInteger(status) || status < 400 || status >= 600) {
    status = 500;
  }

  if (status >= 500) {
    console.error('Unhandled server error', {
      method: req?.method,
      path: req?.originalUrl,
      code: err?.code,
      message: err?.message,
      stack: err?.stack,
    });
    message = 'Something went wrong. Please try again.';
    code = 'INTERNAL_SERVER_ERROR';
  } else {
    code = code ?? (status === 404 ? 'NOT_FOUND' : `HTTP_${status}`);
  }

  const payload = { error: message || 'Request failed', code };
  if (err?.fields) payload.fields = err.fields;
  res.status(status).json(payload);
};
