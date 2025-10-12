#!/usr/bin/env node
/**
 * Test script for PostgreSQL connection and basic operations
 * Run with: node src/lib/db/test-pg.js
 * 
 * Requires: DATABASE_URL environment variable set
 */

import { connectToDatabase, query } from './postgresql.js';
import UserModel from '../../models/User.pg.js';

async function testPostgreSQLConnection() {
  console.log('🔍 Testing PostgreSQL Connection...\n');

  try {
    // Test 1: Basic Connection
    console.log('Test 1: Connecting to PostgreSQL...');
    await connectToDatabase();
    console.log('✅ Connection successful\n');

    // Test 2: Check if tables exist
    console.log('Test 2: Checking if tables exist...');
    const tablesResult = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    
    const tables = tablesResult.rows.map(r => r.table_name);
    console.log('Found tables:', tables.length > 0 ? tables.join(', ') : 'None');
    
    if (tables.length === 0) {
      console.log('⚠️  No tables found. Run schema initialization first.');
    } else {
      console.log('✅ Tables exist\n');
    }

    // Test 3: Check table counts
    if (tables.includes('users')) {
      console.log('Test 3: Checking data counts...');
      const counts = await query(`
        SELECT 
          (SELECT COUNT(*) FROM users) as users,
          (SELECT COUNT(*) FROM files) as files,
          (SELECT COUNT(*) FROM directories) as directories,
          (SELECT COUNT(*) FROM rate_limits) as rate_limits
      `);
      console.log('Data counts:', counts.rows[0]);
      console.log('✅ Count check complete\n');
    }

    // Test 4: Model operations
    if (tables.includes('users')) {
      console.log('Test 4: Testing User model operations...');
      
      // Test findOne (should return null if no users)
      const user = await UserModel.findOne({ email: 'nonexistent@example.com' });
      console.log('findOne test:', user === null ? '✅ Returns null for non-existent user' : '⚠️  Unexpected result');
      
      // Test countDocuments
      const count = await UserModel.countDocuments();
      console.log(`countDocuments test: ✅ Found ${count} users\n`);
    }

    console.log('🎉 All tests passed!\n');
    
    console.log('Next steps:');
    console.log('1. If tables don\'t exist, run schema initialization via /admin/migration');
    console.log('2. If MongoDB data exists, run migration via /admin/migration');
    console.log('3. Start the application with DATABASE_URL set\n');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('\nTroubleshooting:');
    console.error('1. Ensure DATABASE_URL is set in .env');
    console.error('2. Verify PostgreSQL server is accessible');
    console.error('3. Check network/firewall settings');
    console.error('4. Verify database credentials\n');
    process.exit(1);
  }
}

// Run tests
testPostgreSQLConnection()
  .then(() => {
    console.log('Test completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
