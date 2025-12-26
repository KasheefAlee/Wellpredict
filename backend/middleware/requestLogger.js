/**
 * Basic request logger (no external deps).
 * Logs method, path, status, and duration.
 */
module.exports = function requestLogger(req, res, next) {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    // Avoid logging auth tokens
    const path = req.originalUrl || req.url;
    console.log(`${req.method} ${path} -> ${res.statusCode} (${ms}ms)`);
  });
  next();
};


