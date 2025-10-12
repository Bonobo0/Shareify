// User Model Router - Automatically selects MongoDB or PostgreSQL based on environment
const USE_POSTGRESQL = process.env.USE_POSTGRESQL === 'true' || (process.env.DATABASE_URL && !process.env.FORCE_MONGODB);

let UserModel;

if (USE_POSTGRESQL && process.env.DATABASE_URL) {
  // Use PostgreSQL
  const { default: UserPG } = await import('./User.pg.js');
  UserModel = UserPG;
  console.log('Using PostgreSQL User model');
} else {
  // Use MongoDB
  const { default: UserMongo } = await import('./User.js');
  UserModel = UserMongo;
  console.log('Using MongoDB User model');
}

export default UserModel;
