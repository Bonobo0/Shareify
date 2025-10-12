# Schema Deployment Guide

## Issue Background

In Vercel's serverless deployment environment, the application was encountering the following error:

```
스키마 초기화 실패: ENOENT: no such file or directory, open '/var/task/src/lib/db/schema.sql'
```

## Root Cause

The application was using `fs.readFileSync()` to read the `schema.sql` file at runtime. In serverless environments like Vercel:

1. The file system structure differs from local development
2. Files may not be included in the deployment bundle by default
3. The working directory (`process.cwd()`) returns `/var/task/` instead of the project root
4. Dynamic file reads may not work as expected in lambda functions

## Solution

We implemented an **inlined schema approach** that eliminates file system dependencies:

### Files Changed

1. **`src/lib/db/schemaContent.js`** (NEW)
   - Contains the complete SQL schema as an exported string constant
   - Source of truth for runtime schema initialization
   - No file system dependencies

2. **`src/lib/db/postgresql.js`** (MODIFIED)
   - Removed `fs` and `path` imports
   - Imports `SCHEMA_SQL` from `schemaContent.js`
   - Uses inlined schema in `initializeSchema()` function

3. **`src/lib/db/migration.js`** (MODIFIED)
   - Removed `fs` and `path` imports
   - Imports `SCHEMA_SQL` from `schemaContent.js`
   - Uses inlined schema in `initializePostgreSQLSchema()` function

### Original Schema File Preserved

The original `src/lib/db/schema.sql` file is **intentionally kept** for:
- Version control and change tracking
- Documentation and reference
- Easier schema updates (edit SQL file, then sync to schemaContent.js)

## Advantages

✅ **Universal Compatibility**: Works in all environments (local, Vercel, AWS Lambda, etc.)
✅ **No Runtime Dependencies**: No file system operations needed
✅ **Better Performance**: No I/O overhead during initialization
✅ **Reliable Deployment**: Guaranteed to work in serverless environments
✅ **Easy Maintenance**: Keep original SQL file for version control

## Updating the Schema

When you need to update the database schema:

1. **Edit** `src/lib/db/schema.sql` with your changes
2. **Copy** the entire content of `schema.sql`
3. **Update** the `SCHEMA_SQL` constant in `src/lib/db/schemaContent.js`
4. **Test** locally to ensure the schema initializes correctly
5. **Commit** both files together

### Example Update Process

```bash
# 1. Edit the schema
nano src/lib/db/schema.sql

# 2. Update the inlined version
# Copy the content and paste into schemaContent.js

# 3. Test locally
npm run dev

# 4. Commit changes
git add src/lib/db/schema.sql src/lib/db/schemaContent.js
git commit -m "Update database schema"
```

## Verification

To verify the schema is correctly inlined:

```javascript
// Test import
import { SCHEMA_SQL } from '@/lib/db/schemaContent.js';

// Check content
console.log('Schema length:', SCHEMA_SQL.length);
console.log('Contains users table:', SCHEMA_SQL.includes('CREATE TABLE IF NOT EXISTS users'));
```

## Deployment Checklist

Before deploying to Vercel or other platforms:

- [ ] Verify `schemaContent.js` is in sync with `schema.sql`
- [ ] Test schema initialization locally
- [ ] Run build process successfully (`npm run build`)
- [ ] Verify no file system errors in logs
- [ ] Test on staging environment before production

## Alternative Approaches Considered

1. **Webpack Raw Loader**: Would require Next.js configuration changes
2. **Public Folder**: Would expose schema publicly (security concern)
3. **Database Migrations**: Adds complexity and external dependencies
4. **Build-time Generation**: Requires custom build scripts

The inlined approach was chosen for its simplicity, reliability, and zero configuration requirements.

## Troubleshooting

### Schema Not Initializing

Check that:
- `DATABASE_URL` environment variable is set
- Database is accessible from the deployment environment
- PostgreSQL version is compatible (17+ or Neon)
- Schema syntax is valid SQL

### Schema Mismatch

If you see "table already exists" errors after updating:
- The schema uses `CREATE TABLE IF NOT EXISTS` to be idempotent
- Manually drop and recreate tables if schema structure changed
- Or use database migrations for production environments

## Related Files

- `src/lib/db/postgresql.js` - PostgreSQL connection and schema initialization
- `src/lib/db/migration.js` - Database migration utilities
- `src/lib/db/schema.sql` - Original SQL schema (for reference)
- `src/lib/db/schemaContent.js` - Inlined schema (for runtime)

## Support

For issues related to schema deployment:
1. Check Vercel deployment logs
2. Verify environment variables are set
3. Test locally with production build (`npm run build && npm start`)
4. Review this documentation for common solutions
