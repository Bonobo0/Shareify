import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';

const DATABASE_URL = process.env.DATABASE_URL;

let pool = null;
let schemaInitialized = false;

function getPool() {
  if (!DATABASE_URL) {
    throw new Error("DATABASE_URL이 환경 변수에 설정되어 있지 않습니다.");
  }

  if (!pool) {
    try {
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
    } catch (error) {
      console.error('PostgreSQL 연결 풀 생성 실패:', error.message);
      throw error;
    }
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

// Check if schema tables exist
async function checkSchemaExists() {
  try {
    const result = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      AND table_name IN ('users', 'files', 'directories', 'rate_limits')
    `);
    return result.rows.length >= 4; // All 4 core tables should exist
  } catch (error) {
    console.error('Error checking schema:', error);
    return false;
  }
}

// Initialize schema from schema.sql file
async function initializeSchema() {
  if (schemaInitialized) {
    return;
  }

  try {
    console.log('🔧 Initializing PostgreSQL schema...');
    
    // Read schema file
    const schemaPath = path.join(process.cwd(), 'src/lib/db/schema.sql');
    
    if (!fs.existsSync(schemaPath)) {
      console.error('❌ Schema file not found at:', schemaPath);
      return;
    }

    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    
    // Split by semicolons and execute each statement
    const statements = schemaSql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    console.log(`📝 Executing ${statements.length} SQL statements...`);
    
    for (const statement of statements) {
      try {
        await query(statement);
      } catch (error) {
        // Ignore errors for CREATE IF NOT EXISTS and extensions
        if (!error.message.includes('already exists')) {
          console.error('⚠️  Error executing statement:', statement.substring(0, 100), error.message);
        }
      }
    }
    
    schemaInitialized = true;
    console.log('✅ PostgreSQL schema initialized successfully');
  } catch (error) {
    console.error('❌ Schema initialization error:', error);
    // Don't throw - let the app continue, it might fail later with specific errors
  }
}

export async function connectToDatabase() {
  const pool = getPool();
  try {
    // Test connection
    await pool.query('SELECT NOW()');
    console.log('PostgreSQL에 연결되었습니다!');
    
    // Check if schema exists, initialize if not
    const schemaExists = await checkSchemaExists();
    if (!schemaExists) {
      console.log('⚠️  Database tables not found, initializing schema...');
      await initializeSchema();
    }
    
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
