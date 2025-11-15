/**
 * Simple in-memory cache for frequently accessed data
 * This helps reduce database queries for commonly requested information
 */

class SimpleCache {
  constructor(ttl = 60000) {
    // Default TTL: 60 seconds
    this.cache = new Map();
    this.ttl = ttl;
  }

  /**
   * Get value from cache
   * @param {string} key - Cache key
   * @returns {any|null} Cached value or null if not found/expired
   */
  get(key) {
    const item = this.cache.get(key);

    if (!item) {
      return null;
    }

    // Check if item has expired
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }

    return item.value;
  }

  /**
   * Set value in cache
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   * @param {number} ttl - Time to live in milliseconds (optional)
   */
  set(key, value, ttl = null) {
    const expiry = Date.now() + (ttl || this.ttl);
    this.cache.set(key, { value, expiry });
  }

  /**
   * Delete value from cache
   * @param {string} key - Cache key
   */
  delete(key) {
    this.cache.delete(key);
  }

  /**
   * Clear all cached values
   */
  clear() {
    this.cache.clear();
  }

  /**
   * Get all keys in cache
   * @returns {string[]} Array of cache keys
   */
  keys() {
    return Array.from(this.cache.keys());
  }

  /**
   * Clean up expired entries
   */
  cleanup() {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiry) {
        this.cache.delete(key);
      }
    }
  }
}

// Global cache instances for different data types
// Storage info cache - 30 seconds TTL (frequently accessed, changes slowly)
export const storageInfoCache = new SimpleCache(30000);

// User info cache - 60 seconds TTL
export const userInfoCache = new SimpleCache(60000);

// Directory breadcrumbs cache - 60 seconds TTL
export const breadcrumbsCache = new SimpleCache(60000);

// Periodically clean up expired entries (every 5 minutes)
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    storageInfoCache.cleanup();
    userInfoCache.cleanup();
    breadcrumbsCache.cleanup();
  }, 5 * 60 * 1000);
}

export default SimpleCache;
