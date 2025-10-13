# PostgreSQL Model Compatibility Layer

## Overview

This document explains the MongoDB/Mongoose API compatibility layer implemented for PostgreSQL models in Shareify. This allows the application to use the same query syntax for both MongoDB and PostgreSQL databases.

## Features

### 1. Chainable Query API

The PostgreSQL Model now supports Mongoose-style chainable queries:

```javascript
const files = await File.find({ deleted: false })
  .populate({ path: 'owner', select: 'name email' })
  .populate({ path: 'parentDirectory' })
  .sort({ createdAt: -1 })
  .skip(10)
  .limit(50)
  .lean();
```

### 2. Backward Compatible Options API

Existing code using direct options still works:

```javascript
const users = await User.find({}, {
  select: 'name email role',
  sort: { createdAt: -1 },
  skip: 0,
  limit: 50,
  lean: true
});
```

### 3. Population (Joins)

Population automatically fetches and joins related documents:

**Direct Population:**
```javascript
.populate('owner')  // Fetches owner user
.populate({ path: 'owner', select: 'name email' })  // With field selection
```

**Nested Path Population:**
```javascript
.populate('shared.userId')  // Populates userId in shared array
```

**Nested Population:**
```javascript
.populate({
  path: 'parentDirectory',
  select: 'name owner',
  populate: {
    path: 'owner',
    select: 'name email'
  }
})
```

### 4. Query Operators

Supports MongoDB query operators translated to PostgreSQL:

**Comparison:**
```javascript
{ age: { $gt: 18, $lte: 65 } }          // WHERE age > 18 AND age <= 65
{ status: { $ne: 'deleted' } }          // WHERE status != 'deleted'
{ role: { $in: ['user', 'admin'] } }    // WHERE role = ANY(ARRAY['user', 'admin'])
```

**Text Search:**
```javascript
{ name: { $regex: /john/i } }           // WHERE name ~* 'john' (case-insensitive)
{ email: { $regex: /test/ } }           // WHERE email ~ 'test' (case-sensitive)
```

**JSONB Arrays:**
```javascript
{ 
  shared: { 
    $elemMatch: { userId: '123' } 
  } 
}
// WHERE shared @> '[{"userId": "123"}]'::jsonb
```

**Logical:**
```javascript
{
  $or: [
    { owner: userId },
    { shared: { $elemMatch: { userId: userId } } }
  ]
}
// WHERE (owner_id = '...' OR shared @> '[{"userId": "..."}]'::jsonb)
```

### 5. Aggregation

Basic aggregation pipeline support:

```javascript
const stats = await User.aggregate([
  {
    $group: {
      _id: null,
      totalUsed: { $sum: { $ifNull: ['$storageUsed', 0] } },
      totalLimit: { $sum: '$storageLimit' },
      avgUsed: { $avg: '$storageUsed' }
    }
  }
]);
```

Translates to:
```sql
SELECT 
  SUM(COALESCE(storage_used, 0)) as total_used,
  SUM(storage_limit) as total_limit,
  AVG(storage_used) as avg_used
FROM users
```

### 6. Additional Methods

**Update Methods:**
```javascript
// Update by ID
await User.findByIdAndUpdate(userId, {
  $set: { name: 'New Name' },
  $inc: { storageUsed: 1024 }
});

// Update first match
await File.findOneAndUpdate(
  { hash: fileHash },
  { $set: { uploaded: true } }
);
```

**Delete Methods:**
```javascript
await User.findByIdAndDelete(userId);
await File.deleteOne({ hash: fileHash });
```

## Implementation Details

### Query Class

The `Query` class provides the chainable interface:

- Stores conditions and options
- Accumulates chaining method calls
- Executes query when awaited (thenable)
- Handles population after main query

### Model Class Extensions

Extended the base `Model` class with:

- `find()` - Returns Query instance or executes directly
- `findByIdAndUpdate()` - Update document by ID
- `findOneAndUpdate()` - Update first matching document  
- `findByIdAndDelete()` - Delete document by ID
- `aggregate()` - Basic aggregation support

### Field Transformation

Automatically handles field name conversion:

- **camelCase to snake_case** for queries
- **snake_case to camelCase** for results
- Adds `_id` alias for `id` (MongoDB compatibility)

## Usage Examples

### File Listing with Population

```javascript
const files = await File.find({ 
  parentDirectory: directoryId,
  deleted: { $ne: true }
})
  .populate({ path: 'owner', select: 'name email' })
  .populate({ 
    path: 'parentDirectory',
    populate: { path: 'owner' }
  })
  .sort({ createdAt: -1 })
  .skip((page - 1) * limit)
  .limit(limit)
  .lean();
```

### User Search

```javascript
const users = await User.find({
  $or: [
    { name: { $regex: new RegExp(query, 'i') } },
    { email: { $regex: new RegExp(query, 'i') } }
  ]
}, {
  select: 'name email role',
  limit: 20
});
```

### Storage Statistics

```javascript
const stats = await User.aggregate([
  {
    $group: {
      _id: null,
      totalUsed: { $sum: { $ifNull: ['$storageUsed', 0] } },
      totalLimit: { $sum: { $ifNull: ['$storageLimit', 5368709120] } }
    }
  }
]);
```

## Limitations

1. **Complex Aggregations**: Only basic `$group` with `$sum`, `$avg`, `$count` is supported
2. **Transaction Support**: Not yet implemented in compatibility layer
3. **Virtual Fields**: Not supported
4. **Middleware/Hooks**: Not implemented in base Model class

## Performance Considerations

- **Population**: Performs separate queries for each relation (N+1 pattern)
  - Consider using dedicated join queries for complex scenarios
- **Aggregations**: Translated to efficient PostgreSQL queries
- **Indexing**: Ensure proper indexes on frequently queried fields

## Future Enhancements

Potential improvements for the compatibility layer:

1. **Optimized Population**: Use SQL JOINs instead of separate queries
2. **Advanced Aggregation**: Support more pipeline stages
3. **Transaction Support**: Add transaction methods
4. **Query Optimization**: Implement query batching and caching

## Testing

The compatibility layer has been tested with:

- ✅ Query chaining API
- ✅ Backward compatibility with options
- ✅ All query operators
- ✅ Population (direct, nested, nested path)
- ✅ Aggregation (basic)
- ✅ Update and delete methods

## Migration Notes

When migrating from MongoDB to PostgreSQL:

1. **No Code Changes Required**: Existing action files work as-is
2. **Database Configuration**: Set `DATABASE_URL` instead of `MONGODB_URI`
3. **Schema**: Run PostgreSQL schema creation script
4. **Data Migration**: Use migration tools to transfer data

See `MIGRATION.md` for detailed migration instructions.
