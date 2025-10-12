import { Model, query } from "@/lib/db/model.js";

class RateLimitModel extends Model {
  constructor() {
    super("rate_limits");
  }

  async findOneAndUpdate(conditions, update, options = {}) {
    const { identifier, actionName } = conditions;
    const { $set, $inc, $setOnInsert } = update;
    
    // Try to update existing record
    let sql = `
      UPDATE rate_limits 
      SET count = count + $1
    `;
    
    const params = [($inc && $inc.count) || 1];
    let paramIndex = 2;
    
    if ($set) {
      const setFields = Object.entries($set).map(([key, value]) => {
        params.push(value);
        const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
        return `${snakeKey} = $${paramIndex++}`;
      });
      sql += `, ${setFields.join(', ')}`;
    }
    
    sql += ` WHERE identifier = $${paramIndex} AND action_name = $${paramIndex + 1} RETURNING *`;
    params.push(identifier, actionName);
    
    let result = await query(sql, params);
    
    // If no record was updated and upsert is true, insert new record
    if (result.rows.length === 0 && options.upsert) {
      const insertData = {
        identifier,
        actionName,
        count: ($inc && $inc.count) || 1,
        ...($set || {}),
        ...($setOnInsert || {}),
      };
      
      result = await this.create(insertData);
      return this._transformRow(result);
    }
    
    return result.rows[0] ? this._transformRow(result.rows[0]) : null;
  }

  async deleteExpired() {
    const sql = `DELETE FROM rate_limits WHERE reset_time < NOW()`;
    const result = await query(sql);
    return result.rowCount;
  }
}

// Create singleton instance
const RateLimitModelInstance = new RateLimitModel();

export default RateLimitModelInstance;
