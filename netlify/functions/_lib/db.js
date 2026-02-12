const { Pool } = require('pg');

let pool = null;

function getDbPool(){
  if (pool) return pool;
  const connectionString = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;
  if (!connectionString){
    throw new Error('Missing NEON_DATABASE_URL or DATABASE_URL');
  }
  pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: 2,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 5000
  });
  return pool;
}

module.exports = { getDbPool };
