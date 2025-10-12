// Database Router - Selects between MongoDB and PostgreSQL based on environment variable and settings
// This allows for gradual migration and testing

import { getEffectiveDBType } from './settings.js';

let cachedDBType = null;

// Determine which database to use
async function determineDBType() {
  if (cachedDBType) {
    return cachedDBType;
  }

  try {
    cachedDBType = await getEffectiveDBType();
    return cachedDBType;
  } catch (error) {
    console.error("Error determining DB type, falling back to environment variables:", error);
    // Fallback to environment variable logic
    const USE_POSTGRESQL = process.env.USE_POSTGRESQL === 'true' || process.env.DATABASE_URL !== undefined;
    cachedDBType = USE_POSTGRESQL ? 'postgresql' : 'mongodb';
    return cachedDBType;
  }
}

export async function getDBType() {
  const dbType = await determineDBType();
  return dbType === 'none' ? 'mongodb' : dbType; // Default to mongodb if nothing configured
}

export async function isUsingPostgreSQL() {
  const dbType = await determineDBType();
  return dbType === 'postgresql';
}

export async function isUsingMongoDB() {
  const dbType = await determineDBType();
  return dbType === 'mongodb';
}

// Clear cache to force re-evaluation (useful after settings change)
export function clearDBTypeCache() {
  cachedDBType = null;
}

// Re-export connection functions based on database type
export async function connectToDatabase() {
  const dbType = await determineDBType();
  if (dbType === 'postgresql') {
    const { connectToDatabase: pgConnect } = await import('./postgresql.js');
    return pgConnect();
  } else {
    const { connectToDatabase: mongoConnect } = await import('./mongodb.js');
    return mongoConnect();
  }
}

// Model loader - returns appropriate model based on database type
export async function getModel(modelName) {
  const dbType = await determineDBType();
  if (dbType === 'postgresql') {
    // Load PostgreSQL models
    switch(modelName) {
      case 'User':
        const UserPG = await import('@/models/User.pg.js');
        return UserPG.default;
      case 'File':
        const FilePG = await import('@/models/File.pg.js');
        return FilePG.default;
      case 'Directory':
        const DirectoryPG = await import('@/models/Directory.pg.js');
        return DirectoryPG.default;
      case 'RateLimit':
        const RateLimitPG = await import('@/models/RateLimit.pg.js');
        return RateLimitPG.default;
      default:
        throw new Error(`Unknown model: ${modelName}`);
    }
  } else {
    // Load MongoDB/Mongoose models
    switch(modelName) {
      case 'User':
        const User = await import('@/models/User.js');
        return User.default;
      case 'File':
        const File = await import('@/models/File.js');
        return File.default;
      case 'Directory':
        const Directory = await import('@/models/Directory.js');
        return Directory.default;
      case 'RateLimit':
        const RateLimit = await import('@/models/RateLimit.js');
        return RateLimit.default;
      default:
        throw new Error(`Unknown model: ${modelName}`);
    }
  }
}

export default {
  getDBType,
  isUsingPostgreSQL,
  isUsingMongoDB,
  connectToDatabase,
  getModel,
  clearDBTypeCache,
};
