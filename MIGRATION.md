# MongoDB to PostgreSQL Migration Guide

This guide explains how to migrate your Shareify application from MongoDB to PostgreSQL 17 (Neon-compatible).

## Prerequisites

- PostgreSQL 17 database (Neon or self-hosted)
- Existing MongoDB database with data (optional)
- Admin access to Shareify application

## Environment Configuration

### Step 1: Update Environment Variables

Add your PostgreSQL connection string to `.env`:

```bash
# PostgreSQL Configuration (Neon compatible)
DATABASE_URL=postgresql://user:password@hostname:5432/database?sslmode=require

# Optional: Keep MongoDB for migration
MONGODB_URI=mongodb://localhost:27017/shareify
```

**Important**: 
- When `DATABASE_URL` is set, the application will use PostgreSQL
- Keep `MONGODB_URI` during migration to enable data transfer
- After migration is complete, you can remove `MONGODB_URI`

### Neon-specific Configuration

For Neon PostgreSQL:
1. Create a new Neon project at https://neon.tech
2. Copy the connection string (format: `postgresql://user:password@ep-xxx.region.aws.neon.tech/database?sslmode=require`)
3. Add it as `DATABASE_URL` in your `.env` file

## Migration Process

### Option 1: Automatic Migration (Recommended)

1. **Access Admin Panel**
   - Log in as administrator
   - Navigate to `/admin/migration`

2. **Run Automatic Migration**
   - Click "자동 전체 마이그레이션" (Automatic Full Migration)
   - Wait for completion (this may take several minutes for large databases)
   - Verify the result shows success

3. **Verify Migration**
   - Check the status panel shows matching counts between MongoDB and PostgreSQL
   - Click "새로고침" (Refresh) to update counts

### Option 2: Manual Step-by-Step Migration

1. **Initialize Schema**
   - Click "스키마 초기화" (Initialize Schema)
   - This creates all necessary tables and indexes in PostgreSQL

2. **Migrate Users** (Step 2)
   - Click "사용자 마이그레이션" (Migrate Users)
   - Wait for completion

3. **Migrate Directories** (Step 3)
   - Click "디렉토리 마이그레이션" (Migrate Directories)
   - This requires users to be migrated first

4. **Migrate Files** (Step 4)
   - Click "파일 마이그레이션" (Migrate Files)
   - This requires users and directories to be migrated first

5. **Migrate Rate Limits** (Step 5)
   - Click "Rate Limit 마이그레이션" (Migrate Rate Limits)
   - This is independent and can run anytime

## Database Schema Differences

### User Table
- MongoDB `_id` (ObjectId) → PostgreSQL `id` (UUID)
- `twoFactorBackupCodes` (Array) → `two_factor_backup_codes` (JSONB)
- Automatic timestamp triggers replace Mongoose hooks

### Files Table
- `owner` (ObjectId ref) → `owner_id` (UUID FK)
- `parentDirectory` → `parent_directory_id` (UUID FK)
- `shared` (Array) → `shared` (JSONB)

### Directories Table
- `owner` (ObjectId ref) → `owner_id` (UUID FK)
- `parent` → `parent_id` (UUID FK)
- `shared` (Array) → `shared` (JSONB)
- `shareLinks` (Array) → `share_links` (JSONB)

### Rate Limits Table
- MongoDB TTL index → PostgreSQL cleanup function
- Composite unique index on `(identifier, action_name)`

## Features and Compatibility

### Supported Query Operations
- `find`, `findOne`, `findById`
- `create`, `updateOne`, `deleteOne`
- `countDocuments`
- `$or`, `$and` logical operators
- `$gt`, `$gte`, `$lt`, `$lte` comparison operators
- `$in`, `$ne` operators
- `$elemMatch` for JSONB arrays

### Automatic Conversions
- camelCase ↔ snake_case field names
- MongoDB ObjectId ↔ PostgreSQL UUID
- Mongoose `_id` ↔ PostgreSQL `id`
- Array fields → JSONB

### Maintained Features
- Password hashing (bcrypt)
- 2FA backup codes (stored as JSONB)
- File sharing permissions (JSONB arrays)
- Directory sharing and links (JSONB)
- Rate limiting with automatic cleanup
- Timestamps with automatic updates

## Verification

### Check Migration Status

Access `/admin/migration` to see:
- Current record counts in both databases
- Migration progress and results
- Any errors that occurred

### Verify Data Integrity

```sql
-- Connect to PostgreSQL and run:

-- Check user count
SELECT COUNT(*) FROM users;

-- Check file count
SELECT COUNT(*) FROM files;

-- Check directory count
SELECT COUNT(*) FROM directories;

-- Verify a specific user
SELECT email, role, storage_used, storage_limit 
FROM users 
WHERE email = 'your@email.com';

-- Check JSONB data
SELECT email, two_factor_backup_codes 
FROM users 
WHERE two_factor_enabled = true 
LIMIT 1;
```

## Troubleshooting

### Migration Fails with "relation does not exist"
- Run "스키마 초기화" (Initialize Schema) first
- Check that `DATABASE_URL` is correct and accessible

### "MONGODB_URI not set" Error
- Keep `MONGODB_URI` in `.env` during migration
- This is only needed for data transfer, not for normal operation

### Duplicate Key Errors
- Safe to ignore - migrations are idempotent
- Uses `ON CONFLICT` to handle existing records

### UUID Format Errors
- Check that MongoDB ObjectIds are being properly converted
- Review migration logs for specific records causing issues

### Timeout Errors
- Large databases may take time to migrate
- Run manual step-by-step migration instead
- Consider migrating in batches (modify migration script)

## Post-Migration

### 1. Test Application
- Test user authentication
- Test file upload/download
- Test directory operations
- Test admin functions
- Verify 2FA functionality

### 2. Monitor Performance
- Check PostgreSQL query performance
- Review connection pool usage
- Monitor for any errors in logs

### 3. Cleanup (Optional)
- Remove `MONGODB_URI` from `.env` once migration is verified
- Keep MongoDB backup for safety period (30 days recommended)
- Eventually decommission MongoDB instance

## Rollback Plan

If issues arise:

1. **Keep MongoDB Running**
   - Don't delete MongoDB data immediately
   - Keep it as backup for 30+ days

2. **Switch Back to MongoDB**
   - Remove or comment out `DATABASE_URL` in `.env`
   - Restart application
   - Application will use MongoDB automatically

3. **Re-migrate if Needed**
   - Fix any issues
   - Re-run migration process
   - PostgreSQL migrations are idempotent (safe to re-run)

## Performance Tuning

### PostgreSQL Configuration

```sql
-- Increase work memory for better query performance
ALTER SYSTEM SET work_mem = '256MB';

-- Optimize for SSD storage
ALTER SYSTEM SET random_page_cost = 1.1;

-- Reload configuration
SELECT pg_reload_conf();
```

### Indexes

All necessary indexes are created automatically:
- Primary keys (UUID)
- Foreign keys
- Common query fields (email, owner_id, etc.)
- JSONB GIN indexes (if needed, can be added)

### Connection Pooling

The application uses connection pooling with:
- Max 20 connections
- 30s idle timeout
- 10s connection timeout

Adjust in `src/lib/db/postgresql.js` if needed.

## Support

For issues:
1. Check application logs
2. Review PostgreSQL logs
3. Check migration status at `/admin/migration`
4. Verify environment variables are correct

## Advanced: Manual SQL Migration

If the admin UI is unavailable, you can run SQL directly:

```bash
# Initialize schema
psql $DATABASE_URL -f src/lib/db/schema.sql

# Then use the migration functions in Node.js:
node -e "
const { migrateAllData } = require('./src/lib/db/migration.js');
migrateAllData().then(console.log).catch(console.error);
"
```
