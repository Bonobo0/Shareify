import { query, withTransaction } from './postgresql.js';
import { v4 as uuidv4, v5 as uuidv5 } from 'uuid';

// Namespace UUID for converting MongoDB ObjectIds to UUIDs
// This ensures consistent conversion of the same ObjectId to the same UUID
const MONGODB_OBJECTID_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

// Helper function to convert MongoDB-style ObjectId to UUID
export function toUUID(id) {
  if (!id) return null;
  
  // Convert to string if it's an object
  const idStr = (id && typeof id.toString === 'function') ? id.toString() : String(id);
  
  // If it's already a UUID format, return it
  if (idStr.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
    return idStr;
  }
  
  // If it's a MongoDB ObjectId (24 hex characters), convert to UUID v5
  if (idStr.match(/^[0-9a-f]{24}$/i)) {
    return uuidv5(idStr, MONGODB_OBJECTID_NAMESPACE);
  }
  
  // For any other format, return as-is (will likely fail on PostgreSQL, but preserves compatibility)
  return idStr;
}

// Helper to convert snake_case to camelCase
export function toCamelCase(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  
  if (Array.isArray(obj)) {
    return obj.map(toCamelCase);
  }
  
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    result[camelKey] = value && typeof value === 'object' ? toCamelCase(value) : value;
  }
  return result;
}

// Helper to convert camelCase to snake_case
export function toSnakeCase(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  
  if (Array.isArray(obj)) {
    return obj.map(toSnakeCase);
  }
  
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    result[snakeKey] = value && typeof value === 'object' && !(value instanceof Date) ? toSnakeCase(value) : value;
  }
  return result;
}

// Generic CRUD operations
export class Model {
  constructor(tableName) {
    this.tableName = tableName;
  }

  async findById(id, projection = null, options = {}) {
    const uuid = toUUID(id);
    let selectClause = '*';
    
    // Handle Mongoose-style projection as second parameter
    // Can be a string like "-password"
    // Or an options object like { select: "-password" }
    let selectString = null;
    if (typeof projection === 'string') {
      selectString = projection;
    } else if (projection && typeof projection === 'object' && projection.select) {
      selectString = projection.select;
    } else if (options.select) {
      selectString = options.select;
    }
    
    // Handle field selection (exclude fields with -)
    if (selectString) {
      const fields = selectString.split(' ');
      const includeFields = fields.filter(f => !f.startsWith('-'));
      const excludeFields = fields.filter(f => f.startsWith('-')).map(f => f.substring(1));
      
      if (includeFields.length > 0) {
        selectClause = includeFields.join(', ');
      } else if (excludeFields.length > 0) {
        // Get all columns except excluded ones
        const allColumnsResult = await query(
          `SELECT column_name FROM information_schema.columns WHERE table_name = $1`,
          [this.tableName]
        );
        const allColumns = allColumnsResult.rows.map(r => r.column_name);
        const selectedColumns = allColumns.filter(c => !excludeFields.includes(c));
        selectClause = selectedColumns.join(', ');
      }
    }
    
    const result = await query(
      `SELECT ${selectClause} FROM ${this.tableName} WHERE id = $1`,
      [uuid]
    );
    return result.rows[0] ? this._transformRow(result.rows[0]) : null;
  }

  async findOne(conditions, projection = null, options = {}) {
    const { whereClause, values } = this._buildWhereClause(conditions);
    let selectClause = '*';
    
    // Handle Mongoose-style projection as second parameter
    // Can be a string like "-password"
    // Or an options object like { select: "-password" }
    let selectString = null;
    if (typeof projection === 'string') {
      selectString = projection;
    } else if (projection && typeof projection === 'object' && projection.select) {
      selectString = projection.select;
    } else if (options.select) {
      selectString = options.select;
    }
    
    if (selectString) {
      selectClause = this._buildSelectClause(selectString);
    }
    
    const result = await query(
      `SELECT ${selectClause} FROM ${this.tableName} ${whereClause} LIMIT 1`,
      values
    );
    return result.rows[0] ? this._transformRow(result.rows[0]) : null;
  }

  async find(conditions = {}, options = {}) {
    const { whereClause, values } = this._buildWhereClause(conditions);
    let selectClause = '*';
    
    if (options.select) {
      selectClause = this._buildSelectClause(options.select);
    }
    
    let orderClause = '';
    if (options.sort) {
      orderClause = this._buildOrderClause(options.sort);
    }
    
    let limitClause = '';
    let offsetClause = '';
    if (options.limit) {
      limitClause = `LIMIT ${parseInt(options.limit)}`;
    }
    if (options.skip) {
      offsetClause = `OFFSET ${parseInt(options.skip)}`;
    }
    
    const sql = `SELECT ${selectClause} FROM ${this.tableName} ${whereClause} ${orderClause} ${limitClause} ${offsetClause}`.trim();
    const result = await query(sql, values);
    return result.rows.map(row => this._transformRow(row));
  }

  async create(data) {
    const snakeData = toSnakeCase(data);
    const id = uuidv4();
    snakeData.id = id;
    
    const fields = Object.keys(snakeData);
    const values = Object.values(snakeData);
    const placeholders = fields.map((_, i) => `$${i + 1}`);
    
    const result = await query(
      `INSERT INTO ${this.tableName} (${fields.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`,
      values
    );
    return this._transformRow(result.rows[0]);
  }

  async updateOne(conditions, update) {
    const { whereClause, values: whereValues } = this._buildWhereClause(conditions);
    
    // Handle $set operator
    const updateData = update.$set || update;
    const snakeData = toSnakeCase(updateData);
    
    const fields = Object.keys(snakeData);
    const setClause = fields.map((field, i) => `${field} = $${i + 1}`).join(', ');
    const allValues = [...Object.values(snakeData), ...whereValues];
    
    const result = await query(
      `UPDATE ${this.tableName} SET ${setClause} ${whereClause} RETURNING *`,
      allValues
    );
    return { modifiedCount: result.rowCount, acknowledged: true };
  }

  async deleteOne(conditions) {
    const { whereClause, values } = this._buildWhereClause(conditions);
    const result = await query(
      `DELETE FROM ${this.tableName} ${whereClause}`,
      values
    );
    return { deletedCount: result.rowCount, acknowledged: true };
  }

  async countDocuments(conditions = {}) {
    const { whereClause, values } = this._buildWhereClause(conditions);
    const result = await query(
      `SELECT COUNT(*) as count FROM ${this.tableName} ${whereClause}`,
      values
    );
    return parseInt(result.rows[0].count);
  }

  async aggregate(pipeline) {
    // Basic aggregation support
    // This is a simplified version - full MongoDB aggregation would require more work
    throw new Error('Aggregation not fully implemented yet. Use custom queries.');
  }

  _buildWhereClause(conditions) {
    if (!conditions || Object.keys(conditions).length === 0) {
      return { whereClause: '', values: [] };
    }
    
    const snakeConditions = toSnakeCase(conditions);
    const clauses = [];
    const values = [];
    let paramIndex = 1;
    
    for (const [key, value] of Object.entries(snakeConditions)) {
      // Handle $or operator
      if (key === '$or') {
        const orClauses = [];
        for (const orCondition of value) {
          const { whereClause: subWhere, values: subValues } = this._buildWhereClause(orCondition);
          // Extract the WHERE part
          const clause = subWhere.replace('WHERE ', '');
          if (clause) {
            orClauses.push(`(${clause})`);
            // Adjust param indices and add values
            for (const v of subValues) {
              values.push(v);
              paramIndex++;
            }
          }
        }
        if (orClauses.length > 0) {
          clauses.push(`(${orClauses.join(' OR ')})`);
        }
      } else if (value === null) {
        clauses.push(`${key} IS NULL`);
      } else if (typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
        // Handle operators like $ne, $gt, $gte, $lt, $lte, $in
        for (const [op, opValue] of Object.entries(value)) {
          if (op === '$ne') {
            clauses.push(`${key} != $${paramIndex}`);
            values.push(opValue);
            paramIndex++;
          } else if (op === '$gt') {
            clauses.push(`${key} > $${paramIndex}`);
            values.push(opValue);
            paramIndex++;
          } else if (op === '$gte') {
            clauses.push(`${key} >= $${paramIndex}`);
            values.push(opValue);
            paramIndex++;
          } else if (op === '$lt') {
            clauses.push(`${key} < $${paramIndex}`);
            values.push(opValue);
            paramIndex++;
          } else if (op === '$lte') {
            clauses.push(`${key} <= $${paramIndex}`);
            values.push(opValue);
            paramIndex++;
          } else if (op === '$in') {
            clauses.push(`${key} = ANY($${paramIndex})`);
            values.push(opValue);
            paramIndex++;
          } else if (op === '$elemMatch') {
            // Handle JSONB array element matching
            // e.g., shared @> [{"userId": "xxx", "permission": "admin"}]
            const jsonCondition = JSON.stringify([opValue]);
            clauses.push(`${key} @> $${paramIndex}::jsonb`);
            values.push(jsonCondition);
            paramIndex++;
          }
        }
      } else {
        clauses.push(`${key} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    }
    
    return {
      whereClause: clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '',
      values
    };
  }

  _buildSelectClause(select) {
    if (select.startsWith('+')) {
      // Include specific fields that are normally excluded
      // For now, just return all fields
      return '*';
    }
    
    const fields = select.split(' ');
    const includeFields = fields.filter(f => !f.startsWith('-') && !f.startsWith('+'));
    const excludeFields = fields.filter(f => f.startsWith('-')).map(f => f.substring(1));
    
    if (includeFields.length > 0) {
      return includeFields.map(f => toSnakeCase({ [f]: true })).map(obj => Object.keys(obj)[0]).join(', ');
    } else {
      return '*'; // Handle exclusion in the query if needed
    }
  }

  _buildOrderClause(sort) {
    const snakeSort = toSnakeCase(sort);
    const orderParts = [];
    
    for (const [key, value] of Object.entries(snakeSort)) {
      const direction = value === 1 || value === 'asc' ? 'ASC' : 'DESC';
      orderParts.push(`${key} ${direction}`);
    }
    
    return orderParts.length > 0 ? `ORDER BY ${orderParts.join(', ')}` : '';
  }

  _transformRow(row) {
    if (!row) return null;
    
    const camelRow = toCamelCase(row);
    
    // Add _id as alias for id (MongoDB compatibility)
    if (camelRow.id) {
      camelRow._id = camelRow.id;
    }
    
    return camelRow;
  }

  async save(doc) {
    // This method simulates mongoose save behavior
    // It's called on an instance, but we need to handle it here
    const id = doc._id || doc.id;
    
    if (id) {
      // Update existing
      const updateData = { ...doc };
      delete updateData._id;
      delete updateData.id;
      
      await this.updateOne({ id }, { $set: updateData });
      return doc;
    } else {
      // Create new
      return await this.create(doc);
    }
  }
}

export default Model;
export { query, withTransaction };
