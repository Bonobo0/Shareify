import { Pool } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL이 환경 변수에 설정되어 있지 않습니다.");
}

let pool = null;

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: DATABASE_URL,
      ssl: {
        rejectUnauthorized: false, // Neon requires SSL
      },
      max: 20, // Maximum number of clients in the pool
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    pool.on('error', (err) => {
      console.error('Unexpected error on idle PostgreSQL client', err);
    });

    console.log('PostgreSQL 연결 풀이 생성되었습니다!');
  }
  return pool;
}

export async function query(text, params) {
  const pool = getPool();
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    if (duration > 1000) {
      console.log('Slow query:', { text, duration, rows: res.rowCount });
    }
    return res;
  } catch (error) {
    console.error('Database query error:', { text, params, error: error.message });
    throw error;
  }
}

export async function getClient() {
  const pool = getPool();
  return await pool.connect();
}

export async function connectToDatabase() {
  const pool = getPool();
  try {
    // Test connection
    await pool.query('SELECT NOW()');
    console.log('PostgreSQL에 연결되었습니다!');
    return pool;
  } catch (error) {
    console.error('PostgreSQL 연결 오류:', error);
    throw error;
  }
}

// Transaction helper
export async function withTransaction(callback) {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export default {
  query,
  getClient,
  connectToDatabase,
  withTransaction,
};
