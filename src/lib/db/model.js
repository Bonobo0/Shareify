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

// Query builder class for chainable query methods (Mongoose-like API)
class Query {
  constructor(model, conditions = {}) {
    this.model = model;
    this.conditions = conditions;
    this.options = {
      select: null,
      sort: null,
      skip: null,
      limit: null,
      lean: false,
      populate: []
    };
  }

  select(fields) {
    this.options.select = fields;
    return this;
  }

  sort(sortObj) {
    this.options.sort = sortObj;
    return this;
  }

  skip(count) {
    this.options.skip = count;
    return this;
  }

  limit(count) {
    this.options.limit = count;
    return this;
  }

  lean() {
    this.options.lean = true;
    return this;
  }

  populate(populateOptions) {
    // Store populate options for later processing
    // PostgreSQL will need to join tables or run separate queries
    this.options.populate.push(populateOptions);
    return this;
  }

  async exec() {
    // Execute the query with all accumulated options
    let results = await this.model._executeFindWithOptions(this.conditions, this.options);
    
    // Handle population (joining related data)
    if (this.options.populate.length > 0) {
      results = await this._handlePopulate(results);
    }
    
    return results;
  }

  async _handlePopulate(results) {
    // For PostgreSQL, we need to manually join or fetch related data
    // This is a simplified implementation that fetches related data separately
    
    if (!results || results.length === 0) return results;
    
    for (const populateOption of this.options.populate) {
      const path = typeof populateOption === 'string' ? populateOption : populateOption.path;
      const select = typeof populateOption === 'object' ? populateOption.select : null;
      const nestedPopulate = typeof populateOption === 'object' ? populateOption.populate : null;
      
      // Map field names to related models
      const relatedModelName = this._getRelatedModelName(path);
      if (!relatedModelName) continue;
      
      // Import the related model dynamically
      let relatedModel;
      try {
        if (relatedModelName === 'User') {
          const UserPG = await import('@/models/User.pg.js');
          relatedModel = UserPG.default;
        } else if (relatedModelName === 'Directory') {
          const DirectoryPG = await import('@/models/Directory.pg.js');
          relatedModel = DirectoryPG.default;
        } else if (relatedModelName === 'File') {
          const FilePG = await import('@/models/File.pg.js');
          relatedModel = FilePG.default;
        }
      } catch (e) {
        console.warn(`Could not load model ${relatedModelName}:`, e);
        continue;
      }
      
      if (!relatedModel) continue;
      
      // Handle nested paths (e.g., "shared.userId")
      const pathParts = path.split('.');
      
      if (pathParts.length > 1) {
        // Handle nested population (e.g., shared.userId)
        await this._populateNested(results, pathParts, relatedModel, select);
      } else {
        // Handle direct population
        await this._populateDirect(results, path, relatedModel, select, nestedPopulate);
      }
    }
    
    return results;
  }

  async _populateDirect(results, path, relatedModel, select, nestedPopulate) {
    // Collect all IDs to fetch
    const idsToFetch = new Set();
    
    for (const result of results) {
      const fieldValue = result[path] || result[this._toSnakeCase(path)];
      if (fieldValue) {
        idsToFetch.add(fieldValue);
      }
    }
    
    if (idsToFetch.size === 0) return;
    
    // Fetch related documents
    const relatedDocs = {};
    for (const id of idsToFetch) {
      try {
        const doc = await relatedModel.findById(id, select);
        if (doc) {
          relatedDocs[id] = doc;
        }
      } catch (e) {
        console.warn(`Error fetching related document ${id}:`, e);
      }
    }
    
    // Replace IDs with populated documents
    for (const result of results) {
      const fieldValue = result[path] || result[this._toSnakeCase(path)];
      if (fieldValue && relatedDocs[fieldValue]) {
        result[path] = relatedDocs[fieldValue];
        // Also update snake_case version if it exists
        const snakeKey = this._toSnakeCase(path);
        if (result[snakeKey]) {
          result[snakeKey] = relatedDocs[fieldValue];
        }
      }
    }
    
    // Handle nested populate
    if (nestedPopulate) {
      for (const result of results) {
        const populatedDoc = result[path];
        if (populatedDoc && typeof populatedDoc === 'object') {
          // Create a temporary query to handle nested population
          const tempQuery = new Query(relatedModel, {});
          tempQuery.options.populate = [nestedPopulate];
          await tempQuery._handlePopulate([populatedDoc]);
        }
      }
    }
  }

  async _populateNested(results, pathParts, relatedModel, select) {
    // Handle nested paths like "shared.userId"
    const [arrayField, idField] = pathParts;
    
    // Collect all IDs to fetch from nested arrays
    const idsToFetch = new Set();
    
    for (const result of results) {
      const arrayValue = result[arrayField] || result[this._toSnakeCase(arrayField)];
      if (Array.isArray(arrayValue)) {
        for (const item of arrayValue) {
          if (item && item[idField]) {
            idsToFetch.add(item[idField]);
          }
        }
      }
    }
    
    if (idsToFetch.size === 0) return;
    
    // Fetch related documents
    const relatedDocs = {};
    for (const id of idsToFetch) {
      try {
        const doc = await relatedModel.findById(id, select);
        if (doc) {
          relatedDocs[id] = doc;
        }
      } catch (e) {
        console.warn(`Error fetching nested related document ${id}:`, e);
      }
    }
    
    // Replace IDs with populated documents in nested arrays
    for (const result of results) {
      const arrayValue = result[arrayField] || result[this._toSnakeCase(arrayField)];
      if (Array.isArray(arrayValue)) {
        for (const item of arrayValue) {
          if (item && item[idField] && relatedDocs[item[idField]]) {
            item[idField] = relatedDocs[item[idField]];
          }
        }
      }
    }
  }

  _getRelatedModelName(path) {
    // Map field paths to model names
    const pathToModel = {
      'owner': 'User',
      'ownerId': 'User',
      'owner_id': 'User',
      'userId': 'User',
      'user_id': 'User',
      'shared.userId': 'User',
      'parentDirectory': 'Directory',
      'parent_directory_id': 'Directory',
      'parent': 'Directory'
    };
    
    return pathToModel[path] || null;
  }

  _toSnakeCase(str) {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }

  // Make the query thenable so it can be awaited directly
  then(resolve, reject) {
    return this.exec().then(resolve, reject);
  }

  catch(reject) {
    return this.exec().catch(reject);
  }
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

  find(conditions = {}, options = {}) {
    // If options is a complex object with select, sort, etc., execute directly
    // This maintains backward compatibility
    if (options && (options.select || options.sort || options.skip || options.limit || options.lean)) {
      return this._executeFindWithOptions(conditions, options);
    }
    
    // Otherwise, return a Query instance for chaining
    return new Query(this, conditions);
  }

  async _executeFindWithOptions(conditions = {}, options = {}) {
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
    // Basic aggregation support for PostgreSQL
    // This is a simplified version that handles common MongoDB aggregation patterns
    
    // Check if this is a simple $group aggregation for sum
    if (pipeline.length === 1 && pipeline[0].$group) {
      const groupStage = pipeline[0].$group;
      
      // Handle simple sum aggregations
      if (groupStage._id === null) {
        // Global aggregation (no grouping)
        const selectParts = [];
        const groupFields = Object.entries(groupStage).filter(([key]) => key !== '_id');
        
        for (const [resultKey, aggregation] of groupFields) {
          if (aggregation.$sum) {
            // Handle $sum with $ifNull
            if (typeof aggregation.$sum === 'object' && aggregation.$sum.$ifNull) {
              const [field, defaultValue] = aggregation.$sum.$ifNull;
              const snakeField = this._toSnakeCase(field.replace('$', ''));
              selectParts.push(`SUM(COALESCE(${snakeField}, ${defaultValue})) as ${this._toSnakeCase(resultKey)}`);
            } else if (typeof aggregation.$sum === 'string') {
              // Simple field sum
              const snakeField = this._toSnakeCase(aggregation.$sum.replace('$', ''));
              selectParts.push(`SUM(${snakeField}) as ${this._toSnakeCase(resultKey)}`);
            } else if (typeof aggregation.$sum === 'number') {
              // Count
              selectParts.push(`COUNT(*) * ${aggregation.$sum} as ${this._toSnakeCase(resultKey)}`);
            }
          } else if (aggregation.$avg) {
            const snakeField = this._toSnakeCase(aggregation.$avg.replace('$', ''));
            selectParts.push(`AVG(${snakeField}) as ${this._toSnakeCase(resultKey)}`);
          } else if (aggregation.$count) {
            selectParts.push(`COUNT(*) as ${this._toSnakeCase(resultKey)}`);
          }
        }
        
        if (selectParts.length > 0) {
          const sql = `SELECT ${selectParts.join(', ')} FROM ${this.tableName}`;
          const result = await query(sql);
          return result.rows.map(row => toCamelCase(row));
        }
      }
    }
    
    // For complex aggregations, throw an error with helpful message
    throw new Error('Complex aggregation not fully implemented. Please use custom SQL queries for complex aggregations.');
  }

  _toSnakeCase(str) {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
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
      } else if (typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date) && !(value instanceof RegExp)) {
        // Handle operators like $ne, $gt, $gte, $lt, $lte, $in, $regex
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
          } else if (op === '$regex') {
            // Handle regex search - convert to PostgreSQL ILIKE or ~*
            if (opValue instanceof RegExp) {
              const regexStr = opValue.source;
              const flags = opValue.flags;
              if (flags.includes('i')) {
                // Case-insensitive
                clauses.push(`${key} ~* $${paramIndex}`);
              } else {
                // Case-sensitive
                clauses.push(`${key} ~ $${paramIndex}`);
              }
              values.push(regexStr);
              paramIndex++;
            } else if (typeof opValue === 'string') {
              // Treat as case-insensitive LIKE pattern
              clauses.push(`${key} ILIKE $${paramIndex}`);
              values.push(`%${opValue}%`);
              paramIndex++;
            }
          } else if (op === '$elemMatch') {
            // Handle JSONB array element matching
            // e.g., shared @> [{"userId": "xxx", "permission": "admin"}]
            const jsonCondition = JSON.stringify([opValue]);
            clauses.push(`${key} @> $${paramIndex}::jsonb`);
            values.push(jsonCondition);
            paramIndex++;
          }
        }
      } else if (value instanceof RegExp) {
        // Handle direct RegExp value
        const regexStr = value.source;
        const flags = value.flags;
        if (flags.includes('i')) {
          // Case-insensitive
          clauses.push(`${key} ~* $${paramIndex}`);
        } else {
          // Case-sensitive
          clauses.push(`${key} ~ $${paramIndex}`);
        }
        values.push(regexStr);
        paramIndex++;
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
