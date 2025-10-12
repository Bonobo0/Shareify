"use server";

import fs from "fs";
import path from "path";

const SETTINGS_FILE = path.join(process.cwd(), ".db-settings.json");

// Default settings
const DEFAULT_SETTINGS = {
  preferredDatabase: "auto", // 'auto', 'postgresql', 'mongodb'
  lastUpdated: new Date().toISOString(),
};

// Read settings from file
export async function getDBSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const content = fs.readFileSync(SETTINGS_FILE, "utf8");
      return JSON.parse(content);
    }
    return DEFAULT_SETTINGS;
  } catch (error) {
    console.error("Error reading DB settings:", error);
    return DEFAULT_SETTINGS;
  }
}

// Write settings to file
export async function setDBSettings(settings) {
  try {
    const currentSettings = await getDBSettings();
    const newSettings = {
      ...currentSettings,
      ...settings,
      lastUpdated: new Date().toISOString(),
    };
    
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(newSettings, null, 2), "utf8");
    return { success: true, settings: newSettings };
  } catch (error) {
    console.error("Error writing DB settings:", error);
    return { error: `설정 저장 실패: ${error.message}` };
  }
}

// Get effective database type based on settings and environment
export async function getEffectiveDBType() {
  const settings = await getDBSettings();
  const hasPostgreSQL = !!process.env.DATABASE_URL;
  const hasMongoDB = !!process.env.MONGODB_URI;

  if (settings.preferredDatabase === "postgresql" && hasPostgreSQL) {
    return "postgresql";
  } else if (settings.preferredDatabase === "mongodb" && hasMongoDB) {
    return "mongodb";
  } else if (settings.preferredDatabase === "auto") {
    // Auto mode: prefer PostgreSQL if available
    if (hasPostgreSQL) return "postgresql";
    if (hasMongoDB) return "mongodb";
    return "none";
  } else {
    // Fallback to environment-based detection
    if (hasPostgreSQL) return "postgresql";
    if (hasMongoDB) return "mongodb";
    return "none";
  }
}

// Get available databases
export async function getAvailableDatabases() {
  const hasPostgreSQL = !!process.env.DATABASE_URL;
  const hasMongoDB = !!process.env.MONGODB_URI;

  return {
    postgresql: {
      available: hasPostgreSQL,
      configured: hasPostgreSQL,
    },
    mongodb: {
      available: hasMongoDB,
      configured: hasMongoDB,
    },
  };
}
