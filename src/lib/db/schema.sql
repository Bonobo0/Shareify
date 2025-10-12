-- PostgreSQL Schema for Shareify
-- Compatible with PostgreSQL 17 and Neon

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  profile_image TEXT,
  storage_limit BIGINT DEFAULT 5368709120, -- 5GB in bytes
  storage_used BIGINT DEFAULT 0,
  is_verified BOOLEAN DEFAULT false,
  email_verification_token TEXT,
  email_verification_expires TIMESTAMP,
  password_reset_token TEXT,
  password_reset_expires TIMESTAMP,
  two_factor_enabled BOOLEAN DEFAULT false,
  two_factor_secret TEXT,
  two_factor_backup_codes JSONB DEFAULT '[]'::jsonb,
  role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  suspended BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for users
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_suspended ON users(suspended);

-- Directories table
CREATE TABLE IF NOT EXISTS directories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT DEFAULT '',
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES directories(id) ON DELETE CASCADE,
  hash VARCHAR(255) UNIQUE NOT NULL,
  path TEXT NOT NULL,
  shared JSONB DEFAULT '[]'::jsonb,
  share_links JSONB DEFAULT '[]'::jsonb,
  deleted BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for directories
CREATE INDEX IF NOT EXISTS idx_directories_owner ON directories(owner_id);
CREATE INDEX IF NOT EXISTS idx_directories_parent ON directories(parent_id);
CREATE INDEX IF NOT EXISTS idx_directories_hash ON directories(hash);
CREATE INDEX IF NOT EXISTS idx_directories_deleted ON directories(deleted);

-- Files table
CREATE TABLE IF NOT EXISTS files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  original_name VARCHAR(512) NOT NULL,
  file_name VARCHAR(512) NOT NULL,
  hash VARCHAR(255) UNIQUE NOT NULL,
  size BIGINT NOT NULL,
  mimetype VARCHAR(255) NOT NULL,
  path TEXT NOT NULL,
  is_public BOOLEAN DEFAULT false,
  uploaded BOOLEAN DEFAULT false,
  is_encrypted BOOLEAN DEFAULT false,
  original_size BIGINT,
  original_mimetype VARCHAR(255),
  shared JSONB DEFAULT '[]'::jsonb,
  parent_directory_id UUID REFERENCES directories(id) ON DELETE SET NULL,
  deleted BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for files
CREATE INDEX IF NOT EXISTS idx_files_owner ON files(owner_id);
CREATE INDEX IF NOT EXISTS idx_files_parent_directory ON files(parent_directory_id);
CREATE INDEX IF NOT EXISTS idx_files_hash ON files(hash);
CREATE INDEX IF NOT EXISTS idx_files_deleted ON files(deleted);

-- Rate limiting table
CREATE TABLE IF NOT EXISTS rate_limits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  identifier VARCHAR(255) NOT NULL,
  action_name VARCHAR(255) NOT NULL,
  count INTEGER DEFAULT 1,
  reset_time TIMESTAMP NOT NULL,
  first_request TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(identifier, action_name)
);

-- Create indexes for rate_limits
CREATE INDEX IF NOT EXISTS idx_rate_limits_identifier ON rate_limits(identifier);
CREATE INDEX IF NOT EXISTS idx_rate_limits_action ON rate_limits(action_name);
CREATE INDEX IF NOT EXISTS idx_rate_limits_reset_time ON rate_limits(reset_time);
CREATE INDEX IF NOT EXISTS idx_rate_limits_composite ON rate_limits(identifier, action_name);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_directories_updated_at BEFORE UPDATE ON directories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_files_updated_at BEFORE UPDATE ON files
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rate_limits_updated_at BEFORE UPDATE ON rate_limits
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to clean up expired rate limit records
CREATE OR REPLACE FUNCTION cleanup_expired_rate_limits()
RETURNS void AS $$
BEGIN
    DELETE FROM rate_limits WHERE reset_time < CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;
