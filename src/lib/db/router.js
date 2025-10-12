// Database Router - Selects between MongoDB and PostgreSQL based on environment variable
// This allows for gradual migration and testing

const USE_POSTGRESQL = process.env.USE_POSTGRESQL === 'true' || process.env.DATABASE_URL !== undefined;

export function getDBType() {
  return USE_POSTGRESQL ? 'postgresql' : 'mongodb';
}

export function isUsingPostgreSQL() {
  return USE_POSTGRESQL;
}

export function isUsingMongoDB() {
  return !USE_POSTGRESQL;
}

// Re-export connection functions based on database type
export async function connectToDatabase() {
  if (USE_POSTGRESQL) {
    const { connectToDatabase: pgConnect } = await import('./postgresql.js');
    return pgConnect();
  } else {
    const { connectToDatabase: mongoConnect } = await import('./mongodb.js');
    return mongoConnect();
  }
}

// Model loader - returns appropriate model based on database type
export async function getModel(modelName) {
  if (USE_POSTGRESQL) {
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
};
