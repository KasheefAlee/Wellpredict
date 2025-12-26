const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

/**
 * Railway commonly provides DATABASE_URL. Prefer it when present.
 * Render + managed Postgres often requires SSL. We enable SSL automatically when:
 * - NODE_ENV=production OR
 * - PGSSLMODE=require OR
 * - DATABASE_URL is provided (safe default for cloud providers)
 */
const shouldUseSSL =
  process.env.NODE_ENV === 'production' ||
  String(process.env.PGSSLMODE || '').toLowerCase() === 'require' ||
  !!process.env.DATABASE_URL;

const poolConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ...(shouldUseSSL ? { ssl: { rejectUnauthorized: false } } : {}),
      max: 20,
      idleTimeoutMillis: 30000,
      // Cloud DBs (Railway/Render) can take a few seconds to establish a new connection.
      connectionTimeoutMillis: 10000,
    }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'wellbeing_db',
      user: process.env.DB_USER || 'postgres',
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      ...(shouldUseSSL ? { ssl: { rejectUnauthorized: false } } : {}),
    };

// Ensure password, if provided, is always a string (avoids pg SCRAM type errors).
if (!process.env.DATABASE_URL && process.env.DB_PASSWORD !== undefined) {
  poolConfig.password = String(process.env.DB_PASSWORD);
}

const pool = new Pool(poolConfig);

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

module.exports = pool;

