import { Model, query } from "@/lib/db/model.js";

class FileModel extends Model {
  constructor() {
    super("files");
  }

  // Custom method to handle complex queries with $or
  async findWithOr(conditions, options = {}) {
    // Handle complex OR queries for file sharing
    const { userId, directoryId } = conditions;
    
    let sql = `
      SELECT * FROM files 
      WHERE (
        owner_id = $1 
        OR shared @> $2::jsonb
      )
    `;
    
    const params = [userId, JSON.stringify([{ userId: userId }])];
    
    if (directoryId !== undefined) {
      if (directoryId === null) {
        sql += ` AND parent_directory_id IS NULL`;
      } else {
        sql += ` AND parent_directory_id = $${params.length + 1}`;
        params.push(directoryId);
      }
    }
    
    if (options.deleted !== undefined) {
      sql += ` AND deleted = $${params.length + 1}`;
      params.push(options.deleted);
    }
    
    if (options.sort) {
      const sortKey = Object.keys(options.sort)[0];
      const sortDir = options.sort[sortKey] === 1 ? 'ASC' : 'DESC';
      sql += ` ORDER BY ${sortKey} ${sortDir}`;
    }
    
    if (options.limit) {
      sql += ` LIMIT ${parseInt(options.limit)}`;
    }
    
    if (options.skip) {
      sql += ` OFFSET ${parseInt(options.skip)}`;
    }
    
    const result = await query(sql, params);
    return result.rows.map(row => this._transformRow(row));
  }

  async updateStorageUsed(userId, delta) {
    // Update user's storage used
    const sql = `
      UPDATE users 
      SET storage_used = storage_used + $1 
      WHERE id = $2 
      RETURNING storage_used
    `;
    const result = await query(sql, [delta, userId]);
    return result.rows[0];
  }
}

// Create singleton instance
const FileModelInstance = new FileModel();

export default FileModelInstance;
