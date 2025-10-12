"use server";

import { connectToDatabase as connectToPostgreSQL, query, withTransaction } from "@/lib/db/postgresql.js";
import { SCHEMA_SQL } from "@/lib/db/schemaContent.js";
import { toUUID } from "@/lib/db/model.js";
import mongoose from "mongoose";
import { getEffectiveDBType } from "@/lib/db/settings.js";

const MONGODB_URI = process.env.MONGODB_URI;
const DATABASE_URL = process.env.DATABASE_URL;

// Helper to connect to MongoDB for migration without affecting the main app connection
async function connectToMongoForMigration() {
  // Check if mongoose is already connected to avoid creating duplicate connections
  if (mongoose.connection.readyState === 1) {
    // Already connected, reuse the connection
    return { connection: mongoose.connection, shouldDisconnect: false };
  }
  
  // Create new connection
  const connection = await mongoose.connect(MONGODB_URI);
  return { connection, shouldDisconnect: true };
}

// Helper to safely disconnect only if we created the connection
async function disconnectMongoIfNeeded(shouldDisconnect) {
  if (shouldDisconnect && mongoose.connection.readyState === 1) {
    // Check if app is still using MongoDB before disconnecting
    try {
      const effectiveDB = await getEffectiveDBType();
      if (effectiveDB !== 'mongodb') {
        // Safe to disconnect since app is not using MongoDB
        await mongoose.disconnect();
      }
      // Otherwise, leave it connected for the app to use
    } catch (error) {
      console.error("Error checking DB type:", error);
      // On error, don't disconnect to be safe
    }
  }
}

// Initialize PostgreSQL schema
export async function initializePostgreSQLSchema() {
  try {
    await connectToPostgreSQL();
    
    // Use inlined schema content instead of reading from file
    const schemaSql = SCHEMA_SQL;
    
    // Split by semicolons and execute each statement
    const statements = schemaSql
      .split(";")
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith("--"));
    
    for (const statement of statements) {
      try {
        await query(statement);
      } catch (error) {
        // Ignore errors for CREATE IF NOT EXISTS and extensions
        if (!error.message.includes("already exists")) {
          console.error("Error executing statement:", statement.substring(0, 100), error.message);
        }
      }
    }
    
    return { success: true, message: "PostgreSQL 스키마가 초기화되었습니다." };
  } catch (error) {
    console.error("Schema initialization error:", error);
    return { error: `스키마 초기화 실패: ${error.message}` };
  }
}

// Migrate users from MongoDB to PostgreSQL
export async function migrateUsers() {
  if (!MONGODB_URI) {
    return { error: "MONGODB_URI가 설정되지 않았습니다." };
  }

  let shouldDisconnect = false;
  try {
    // Connect to MongoDB
    const { connection: mongoConnection, shouldDisconnect: needsDisconnect } = await connectToMongoForMigration();
    shouldDisconnect = needsDisconnect;
    const db = mongoConnection.connection.db;
    
    // Get users collection
    const users = await db.collection("users").find({}).toArray();
    
    if (users.length === 0) {
      await disconnectMongoIfNeeded(shouldDisconnect);
      return { success: true, message: "마이그레이션할 사용자가 없습니다.", count: 0 };
    }
    
    // Connect to PostgreSQL
    await connectToPostgreSQL();
    
    let migratedCount = 0;
    const errors = [];
    
    for (const user of users) {
      try {
        const userData = {
          id: toUUID(user._id.toString()), // Convert MongoDB ObjectId to UUID
          email: user.email,
          password: user.password,
          name: user.name,
          profileImage: user.profileImage,
          storageLimit: user.storageLimit || 5368709120,
          storageUsed: user.storageUsed || 0,
          isVerified: user.isVerified || false,
          emailVerificationToken: user.emailVerificationToken,
          emailVerificationExpires: user.emailVerificationExpires,
          passwordResetToken: user.passwordResetToken,
          passwordResetExpires: user.passwordResetExpires,
          twoFactorEnabled: user.twoFactorEnabled || false,
          twoFactorSecret: user.twoFactorSecret,
          twoFactorBackupCodes: JSON.stringify(user.twoFactorBackupCodes || []),
          role: user.role || 'user',
          suspended: user.suspended || false,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        };
        
        // Use INSERT ... ON CONFLICT to handle duplicates
        await query(
          `INSERT INTO users (
            id, email, password, name, profile_image, storage_limit, storage_used,
            is_verified, email_verification_token, email_verification_expires,
            password_reset_token, password_reset_expires, two_factor_enabled,
            two_factor_secret, two_factor_backup_codes, role, suspended,
            created_at, updated_at
          ) VALUES (
            $1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::jsonb, $16, $17, $18, $19
          ) ON CONFLICT (id) DO UPDATE SET
            email = EXCLUDED.email,
            password = EXCLUDED.password,
            name = EXCLUDED.name,
            profile_image = EXCLUDED.profile_image,
            storage_limit = EXCLUDED.storage_limit,
            storage_used = EXCLUDED.storage_used,
            is_verified = EXCLUDED.is_verified,
            email_verification_token = EXCLUDED.email_verification_token,
            email_verification_expires = EXCLUDED.email_verification_expires,
            password_reset_token = EXCLUDED.password_reset_token,
            password_reset_expires = EXCLUDED.password_reset_expires,
            two_factor_enabled = EXCLUDED.two_factor_enabled,
            two_factor_secret = EXCLUDED.two_factor_secret,
            two_factor_backup_codes = EXCLUDED.two_factor_backup_codes,
            role = EXCLUDED.role,
            suspended = EXCLUDED.suspended,
            updated_at = EXCLUDED.updated_at
          `,
          Object.values(userData)
        );
        
        migratedCount++;
      } catch (error) {
        console.error(`Error migrating user ${user.email}:`, error);
        errors.push({ email: user.email, error: error.message });
      }
    }
    
    await disconnectMongoIfNeeded(shouldDisconnect);
    
    return {
      success: true,
      message: `${migratedCount}명의 사용자가 마이그레이션되었습니다.`,
      count: migratedCount,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error) {
    console.error("User migration error:", error);
    await disconnectMongoIfNeeded(shouldDisconnect);
    return { error: `사용자 마이그레이션 실패: ${error.message}` };
  }
}

// Migrate directories
export async function migrateDirectories() {
  if (!MONGODB_URI) {
    return { error: "MONGODB_URI가 설정되지 않았습니다." };
  }

  let shouldDisconnect = false;
  try {
    const { connection: mongoConnection, shouldDisconnect: needsDisconnect } = await connectToMongoForMigration();
    shouldDisconnect = needsDisconnect;
    const db = mongoConnection.connection.db;
    
    const directories = await db.collection("directories").find({}).toArray();
    
    if (directories.length === 0) {
      await disconnectMongoIfNeeded(shouldDisconnect);
      return { success: true, message: "마이그레이션할 디렉토리가 없습니다.", count: 0 };
    }
    
    await connectToPostgreSQL();
    
    let migratedCount = 0;
    const errors = [];
    
    for (const dir of directories) {
      try {
        const dirData = {
          id: toUUID(dir._id.toString()),
          name: dir.name,
          description: dir.description || '',
          ownerId: toUUID(dir.owner.toString()),
          parentId: dir.parent ? toUUID(dir.parent.toString()) : null,
          hash: dir.hash,
          path: dir.path,
          shared: JSON.stringify(dir.shared || []),
          shareLinks: JSON.stringify(dir.shareLinks || []),
          deleted: dir.deleted || false,
          createdAt: dir.createdAt,
          updatedAt: dir.updatedAt,
        };
        
        await query(
          `INSERT INTO directories (
            id, name, description, owner_id, parent_id, hash, path,
            shared, share_links, deleted, created_at, updated_at
          ) VALUES (
            $1::uuid, $2, $3, $4::uuid, $5::uuid, $6, $7, $8::jsonb, $9::jsonb, $10, $11, $12
          ) ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            description = EXCLUDED.description,
            owner_id = EXCLUDED.owner_id,
            parent_id = EXCLUDED.parent_id,
            hash = EXCLUDED.hash,
            path = EXCLUDED.path,
            shared = EXCLUDED.shared,
            share_links = EXCLUDED.share_links,
            deleted = EXCLUDED.deleted,
            updated_at = EXCLUDED.updated_at
          `,
          Object.values(dirData)
        );
        
        migratedCount++;
      } catch (error) {
        console.error(`Error migrating directory ${dir.name}:`, error);
        errors.push({ name: dir.name, error: error.message });
      }
    }
    
    await disconnectMongoIfNeeded(shouldDisconnect);
    
    return {
      success: true,
      message: `${migratedCount}개의 디렉토리가 마이그레이션되었습니다.`,
      count: migratedCount,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error) {
    console.error("Directory migration error:", error);
    await disconnectMongoIfNeeded(shouldDisconnect);
    return { error: `디렉토리 마이그레이션 실패: ${error.message}` };
  }
}

// Migrate files
export async function migrateFiles() {
  if (!MONGODB_URI) {
    return { error: "MONGODB_URI가 설정되지 않았습니다." };
  }

  let shouldDisconnect = false;
  try {
    const { connection: mongoConnection, shouldDisconnect: needsDisconnect } = await connectToMongoForMigration();
    shouldDisconnect = needsDisconnect;
    const db = mongoConnection.connection.db;
    
    const files = await db.collection("files").find({}).toArray();
    
    if (files.length === 0) {
      await disconnectMongoIfNeeded(shouldDisconnect);
      return { success: true, message: "마이그레이션할 파일이 없습니다.", count: 0 };
    }
    
    await connectToPostgreSQL();
    
    let migratedCount = 0;
    const errors = [];
    
    for (const file of files) {
      try {
        const fileData = {
          id: toUUID(file._id.toString()),
          ownerId: toUUID(file.owner.toString()),
          originalName: file.originalName,
          fileName: file.fileName,
          hash: file.hash,
          size: file.size,
          mimetype: file.mimetype,
          path: file.path,
          isPublic: file.isPublic || false,
          uploaded: file.uploaded || false,
          isEncrypted: file.isEncrypted || false,
          originalSize: file.originalSize,
          originalMimetype: file.originalMimetype,
          shared: JSON.stringify(file.shared || []),
          parentDirectoryId: file.parentDirectory ? toUUID(file.parentDirectory.toString()) : null,
          deleted: file.deleted || false,
          createdAt: file.createdAt,
          updatedAt: file.updatedAt,
        };
        
        await query(
          `INSERT INTO files (
            id, owner_id, original_name, file_name, hash, size, mimetype, path,
            is_public, uploaded, is_encrypted, original_size, original_mimetype,
            shared, parent_directory_id, deleted, created_at, updated_at
          ) VALUES (
            $1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb, $15::uuid, $16, $17, $18
          ) ON CONFLICT (id) DO UPDATE SET
            owner_id = EXCLUDED.owner_id,
            original_name = EXCLUDED.original_name,
            file_name = EXCLUDED.file_name,
            hash = EXCLUDED.hash,
            size = EXCLUDED.size,
            mimetype = EXCLUDED.mimetype,
            path = EXCLUDED.path,
            is_public = EXCLUDED.is_public,
            uploaded = EXCLUDED.uploaded,
            is_encrypted = EXCLUDED.is_encrypted,
            original_size = EXCLUDED.original_size,
            original_mimetype = EXCLUDED.original_mimetype,
            shared = EXCLUDED.shared,
            parent_directory_id = EXCLUDED.parent_directory_id,
            deleted = EXCLUDED.deleted,
            updated_at = EXCLUDED.updated_at
          `,
          Object.values(fileData)
        );
        
        migratedCount++;
      } catch (error) {
        console.error(`Error migrating file ${file.originalName}:`, error);
        errors.push({ name: file.originalName, error: error.message });
      }
    }
    
    await disconnectMongoIfNeeded(shouldDisconnect);
    
    return {
      success: true,
      message: `${migratedCount}개의 파일이 마이그레이션되었습니다.`,
      count: migratedCount,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error) {
    console.error("File migration error:", error);
    await disconnectMongoIfNeeded(shouldDisconnect);
    return { error: `파일 마이그레이션 실패: ${error.message}` };
  }
}

// Migrate rate limits
export async function migrateRateLimits() {
  if (!MONGODB_URI) {
    return { error: "MONGODB_URI가 설정되지 않았습니다." };
  }

  let shouldDisconnect = false;
  try {
    const { connection: mongoConnection, shouldDisconnect: needsDisconnect } = await connectToMongoForMigration();
    shouldDisconnect = needsDisconnect;
    const db = mongoConnection.connection.db;
    
    const rateLimits = await db.collection("ratelimits").find({}).toArray();
    
    if (rateLimits.length === 0) {
      await disconnectMongoIfNeeded(shouldDisconnect);
      return { success: true, message: "마이그레이션할 rate limit이 없습니다.", count: 0 };
    }
    
    await connectToPostgreSQL();
    
    let migratedCount = 0;
    const errors = [];
    
    for (const limit of rateLimits) {
      try {
        const limitData = {
          id: limit._id.toString(),
          identifier: limit.identifier,
          actionName: limit.actionName,
          count: limit.count || 1,
          resetTime: limit.resetTime,
          firstRequest: limit.firstRequest,
          createdAt: limit.createdAt,
          updatedAt: limit.updatedAt,
        };
        
        await query(
          `INSERT INTO rate_limits (
            id, identifier, action_name, count, reset_time, first_request, created_at, updated_at
          ) VALUES (
            $1::uuid, $2, $3, $4, $5, $6, $7, $8
          ) ON CONFLICT (identifier, action_name) DO UPDATE SET
            count = EXCLUDED.count,
            reset_time = EXCLUDED.reset_time,
            first_request = EXCLUDED.first_request,
            updated_at = EXCLUDED.updated_at
          `,
          Object.values(limitData)
        );
        
        migratedCount++;
      } catch (error) {
        console.error(`Error migrating rate limit:`, error);
        errors.push({ identifier: limit.identifier, error: error.message });
      }
    }
    
    await disconnectMongoIfNeeded(shouldDisconnect);
    
    return {
      success: true,
      message: `${migratedCount}개의 rate limit이 마이그레이션되었습니다.`,
      count: migratedCount,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error) {
    console.error("Rate limit migration error:", error);
    await disconnectMongoIfNeeded(shouldDisconnect);
    return { error: `Rate limit 마이그레이션 실패: ${error.message}` };
  }
}

// Full migration (all data)
export async function migrateAllData() {
  const results = {
    schema: null,
    users: null,
    directories: null,
    files: null,
    rateLimits: null,
  };

  // Initialize schema first
  results.schema = await initializePostgreSQLSchema();
  if (results.schema.error) {
    return { error: "스키마 초기화 실패", results };
  }

  // Migrate users first (they are referenced by other tables)
  results.users = await migrateUsers();
  
  // Then directories (they reference users)
  results.directories = await migrateDirectories();
  
  // Then files (they reference users and directories)
  results.files = await migrateFiles();
  
  // Finally rate limits
  results.rateLimits = await migrateRateLimits();

  const totalMigrated = 
    (results.users?.count || 0) + 
    (results.directories?.count || 0) + 
    (results.files?.count || 0) + 
    (results.rateLimits?.count || 0);

  return {
    success: true,
    message: `전체 마이그레이션 완료: ${totalMigrated}개 항목`,
    results,
  };
}

// Check migration status
export async function getMigrationStatus() {
  try {
    let pgStats = { users: 0, directories: 0, files: 0, rate_limits: 0 };
    let pgError = null;

    // Try to get PostgreSQL stats
    if (DATABASE_URL) {
      try {
        await connectToPostgreSQL();
        const pgResult = await query(`
          SELECT 
            (SELECT COUNT(*) FROM users) as users,
            (SELECT COUNT(*) FROM directories) as directories,
            (SELECT COUNT(*) FROM files) as files,
            (SELECT COUNT(*) FROM rate_limits) as rate_limits
        `);
        pgStats = pgResult.rows[0];
      } catch (error) {
        console.error("Error getting PostgreSQL stats:", error);
        pgError = error.message;
      }
    }
    
    let mongoStats = { users: 0, directories: 0, files: 0, rateLimits: 0 };
    let mongoError = null;
    
    if (MONGODB_URI) {
      let shouldDisconnect = false;
      try {
        const { connection: mongoConnection, shouldDisconnect: needsDisconnect } = await connectToMongoForMigration();
        shouldDisconnect = needsDisconnect;
        const db = mongoConnection.connection.db;
        
        mongoStats = {
          users: await db.collection("users").countDocuments(),
          directories: await db.collection("directories").countDocuments(),
          files: await db.collection("files").countDocuments(),
          rateLimits: await db.collection("ratelimits").countDocuments(),
        };
        
        await disconnectMongoIfNeeded(shouldDisconnect);
      } catch (error) {
        console.error("Error getting MongoDB stats:", error);
        mongoError = error.message;
        await disconnectMongoIfNeeded(shouldDisconnect);
      }
    }
    
    return {
      success: true,
      postgresql: pgStats,
      postgresqlError: pgError,
      mongodb: mongoStats,
      mongodbError: mongoError,
      databaseUrl: DATABASE_URL ? '설정됨' : '미설정',
      mongodbUri: MONGODB_URI ? '설정됨' : '미설정',
    };
  } catch (error) {
    console.error("Error getting migration status:", error);
    return { error: `상태 조회 실패: ${error.message}` };
  }
}
