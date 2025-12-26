/**
 * Centralized error handler.
 * Keeps responses consistent and avoids leaking stack traces in production.
 */
module.exports = function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  const status = err.status || err.statusCode || 500;
  const message =
    status >= 500 ? 'Internal server error' : err.message || 'Request failed';

  // Log full error server-side
  console.error(err);

  res.status(status).json({
    error: message,
    ...(process.env.NODE_ENV === 'development' && {
      details: err.message,
      stack: err.stack,
    }),
  });
};


