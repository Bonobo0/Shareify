import { Model, query, toUUID } from "@/lib/db/model.js";
import bcrypt from "bcryptjs";

class UserModel extends Model {
  constructor() {
    super("users");
  }

  // Override findOne to handle select with password
  async findOne(conditions, options = {}) {
    const result = await super.findOne(conditions, options);
    if (!result) return null;

    // Add methods to the user object
    return this._addMethods(result);
  }

  async findById(id, options = {}) {
    const result = await super.findById(id, options);
    if (!result) return null;

    return this._addMethods(result);
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
