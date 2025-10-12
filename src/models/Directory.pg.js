import { Model, query } from "@/lib/db/model.js";

class DirectoryModel extends Model {
  constructor() {
    super("directories");
  }

  // Custom method to handle complex queries with $or for shared directories
  async findWithOr(conditions, options = {}) {
    const { userId, parentId } = conditions;
    
    let sql = `
      SELECT * FROM directories 
      WHERE (
        owner_id = $1 
        OR shared @> $2::jsonb
      )
    `;
    
    const params = [userId, JSON.stringify([{ userId: userId }])];
    
    if (parentId !== undefined) {
      if (parentId === null) {
        sql += ` AND parent_id IS NULL`;
      } else {
        sql += ` AND parent_id = $${params.length + 1}`;
        params.push(parentId);
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

  // Check if user has permission on directory
  async hasPermission(directoryId, userId, requiredPermission = 'read') {
    const sql = `
      SELECT * FROM directories 
      WHERE id = $1 
      AND (
        owner_id = $2 
        OR shared @> $3::jsonb
      )
    `;
    
    const params = [
      directoryId, 
      userId, 
      JSON.stringify([{ userId: userId, permission: requiredPermission }])
    ];
    
    const result = await query(sql, params);
    return result.rows.length > 0;
  }
}

// Create singleton instance
const DirectoryModelInstance = new DirectoryModel();

export default DirectoryModelInstance;
