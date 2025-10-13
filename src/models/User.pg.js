import { Model, query, toUUID } from "@/lib/db/model.js";
import bcrypt from "bcryptjs";

class UserModel extends Model {
  constructor() {
    super("users");
  }

  // Override findOne to handle select with password and other sensitive fields
  async findOne(conditions, projection = null, options = {}) {
    let selectClause = '*';
    
    // Handle Mongoose-style projection as second parameter
    // Can be a string like "-password" or "+password"
    // Or an options object like { select: "-password" }
    let selectStr = null;
    if (typeof projection === 'string') {
      selectStr = projection;
    } else if (projection && typeof projection === 'object' && projection.select) {
      selectStr = projection.select;
    } else if (options.select) {
      selectStr = options.select;
    }
    
    if (selectStr) {
      // Check if we're including password or other sensitive fields
      if (selectStr.includes('+password')) {
        selectClause = '*'; // Include all fields including password
      } else if (selectStr.startsWith('+')) {
        selectClause = '*';
      } else {
        // Normal field selection
        selectClause = this._buildSelectClause(selectStr);
      }
    }
    
    const { whereClause, values } = this._buildWhereClause(conditions);
    
    const result = await query(
      `SELECT ${selectClause} FROM ${this.tableName} ${whereClause} LIMIT 1`,
      values
    );
    
    if (!result.rows[0]) return null;
    return this._addMethods(this._transformRow(result.rows[0]));
  }

  async findById(id, projection = null, options = {}) {
    const uuid = toUUID(id);
    let selectClause = '*';
    
    // Handle Mongoose-style projection as second parameter
    // Can be a string like "-password" or "+password"
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
      if (selectString.includes('+password')) {
        selectClause = '*';
      } else {
        selectClause = this._buildSelectClause(selectString);
      }
    }
    
    const result = await query(
      `SELECT ${selectClause} FROM ${this.tableName} WHERE id = $1`,
      [uuid]
    );
    
    if (!result.rows[0]) return null;
    return this._addMethods(this._transformRow(result.rows[0]));
  }

  async create(data) {
    // Hash password before saving
    if (data.password) {
      const salt = await bcrypt.genSalt(12);
      data.password = await bcrypt.hash(data.password, salt);
    }

    const result = await super.create(data);
    return this._addMethods(result);
  }

  async save(doc) {
    const id = doc._id || doc.id;
    
    // Check if password is modified and needs hashing
    if (doc._passwordModified && doc.password) {
      const salt = await bcrypt.genSalt(12);
      doc.password = await bcrypt.hash(doc.password, salt);
      delete doc._passwordModified;
    }

    if (id) {
      // Update existing
      const updateData = { ...doc };
      delete updateData._id;
      delete updateData.id;
      delete updateData._methods;
      delete updateData.comparePassword;
      delete updateData.save;
      delete updateData.isModified;
      
      await this.updateOne({ id: toUUID(id) }, { $set: updateData });
      return this._addMethods(doc);
    } else {
      // Create new
      return await this.create(doc);
    }
  }

  _addMethods(user) {
    if (!user) return null;

    // Add comparePassword method
    user.comparePassword = async function (candidatePassword) {
      try {
        if (!candidatePassword) {
          throw new Error("Password is required");
        }
        if (!this.password) {
          throw new Error("User password hash not found");
        }

        return await bcrypt.compare(candidatePassword, this.password);
      } catch (error) {
        console.error("Password comparison error:", error);
        throw new Error(`Password comparison failed: ${error.message}`);
      }
    };

    // Add save method
    user.save = async function () {
      return await UserModelInstance.save(this);
    };

    // Add isModified method
    user.isModified = function (field) {
      return this[`_${field}Modified`] === true;
    };

    // Make password setter mark as modified
    let passwordValue = user.password;
    Object.defineProperty(user, 'password', {
      get: function() { return passwordValue; },
      set: function(value) {
        passwordValue = value;
        this._passwordModified = true;
      },
      enumerable: true,
      configurable: true
    });

    return user;
  }
}

// Create singleton instance
const UserModelInstance = new UserModel();

export default UserModelInstance;
