# Performance Optimization Quick Reference

## For Developers: How to Use New Utilities

### 1. Query Optimization Helpers

Import and use the query helpers for consistent, optimized queries:

```javascript
import {
  buildFileAccessFilter,
  buildDirectoryAccessFilter,
  buildSortOptions,
  buildPaginationOptions,
  filePopulateOptions,
  directoryPopulateOptions
} from '@/lib/queryOptimization';

// Example: Get files with optimized query
const filter = buildFileAccessFilter(userId, directoryId);
const sortOptions = buildSortOptions('createdAt', 'desc');
const { skip, limit } = buildPaginationOptions(page, 10);

const files = await File.find(filter)
  .populate(filePopulateOptions)
  .sort(sortOptions)
  .skip(skip)
  .limit(limit)
  .lean();
```

### 2. Caching Layer

Use the caching layer for frequently accessed data:

```javascript
import { storageInfoCache, userInfoCache, breadcrumbsCache } from '@/lib/cache';

// Check cache first
const cachedInfo = storageInfoCache.get(`storage_${userId}`);
if (cachedInfo) {
  return cachedInfo;
}

// If not in cache, fetch from DB and cache it
const info = await getStorageInfoFromDB(userId);
storageInfoCache.set(`storage_${userId}`, info, 30000); // 30s TTL
return info;
```

### 3. React Component Optimization

Use memoization for better performance:

```javascript
import { useCallback, useMemo } from 'react';

// Memoize callbacks
const handleClick = useCallback(() => {
  doSomething(param);
}, [param]); // Only recreate if param changes

// Memoize expensive calculations
const expensiveValue = useMemo(() => {
  return computeExpensiveValue(data);
}, [data]); // Only recompute if data changes

// Memoize context values
const contextValue = useMemo(() => ({
  user,
  loading,
  login,
  logout
}), [user, loading]); // Only recreate if dependencies change
```

## For Code Reviewers: What to Look For

### ✅ Good Practices

1. **Database Queries**
   - Uses indexes (check model for indexed fields)
   - Uses `.lean()` for read-only queries
   - Uses `.select()` to limit returned fields
   - Uses `.populate()` instead of multiple queries

2. **React Components**
   - Uses `useCallback` for event handlers
   - Uses `useMemo` for expensive calculations
   - Proper dependency arrays in hooks
   - Avoids inline function creation in JSX

3. **Performance**
   - Batch operations when possible
   - Limit concurrent operations
   - Cache frequently accessed data
   - Avoid N+1 query patterns

### ❌ Anti-Patterns to Avoid

1. **Database**
   ```javascript
   // ❌ Bad: N+1 query
   const files = await File.find({});
   for (const file of files) {
     file.owner = await User.findById(file.owner);
   }
   
   // ✅ Good: Use populate
   const files = await File.find({}).populate('owner');
   ```

2. **React**
   ```javascript
   // ❌ Bad: Inline function creation
   <button onClick={() => handleClick(id)}>Click</button>
   
   // ✅ Good: Memoized callback
   const handleClick = useCallback(() => {
     doSomething(id);
   }, [id]);
   <button onClick={handleClick}>Click</button>
   ```

3. **Caching**
   ```javascript
   // ❌ Bad: No cache invalidation
   cache.set('user', userData); // Never expires
   
   // ✅ Good: Set appropriate TTL
   cache.set('user', userData, 60000); // 60s TTL
   ```

## Common Performance Issues and Solutions

### Issue: Slow File Listing
**Solution**: Ensure queries use indexes
- Check that `owner`, `parentDirectory`, `deleted` fields are indexed
- Use `.lean()` for read-only queries
- Limit number of populated fields

### Issue: Multiple Re-renders
**Solution**: Add memoization
- Use `useCallback` for event handlers
- Use `useMemo` for computed values
- Use `React.memo` for pure components

### Issue: Slow Authentication
**Solution**: Already optimized
- bcrypt rounds reduced to 10 (still secure)
- JWT verification is fast
- Consider caching user sessions

### Issue: Memory Issues on Bulk Downloads
**Solution**: Already implemented
- Downloads limited to 5 concurrent
- Uses batch processing
- Properly cleans up resources

## Performance Checklist

When adding new features, consider:

- [ ] Will this query run frequently? → Add appropriate indexes
- [ ] Does this involve multiple DB calls? → Consider combining or caching
- [ ] Does this component re-render often? → Add memoization
- [ ] Does this involve large data? → Implement pagination/batching
- [ ] Is this data frequently accessed? → Consider caching
- [ ] Does this have network requests? → Add proper error handling and timeouts

## Monitoring Performance

### Server-Side
```javascript
// Time database queries
const start = Date.now();
const result = await SomeModel.find({});
console.log(`Query took ${Date.now() - start}ms`);
```

### Client-Side
```javascript
// Use React DevTools Profiler
// Check for unnecessary renders
// Monitor component mount/update times
```

## Need Help?

- See `PERFORMANCE_OPTIMIZATION.md` for detailed documentation
- See `PERFORMANCE_SUMMARY.md` for overview of all changes
- Check existing optimized code for examples
- Ask team members for code review

## Resources

- [MongoDB Indexing Best Practices](https://docs.mongodb.com/manual/indexes/)
- [React Performance Optimization](https://react.dev/learn/render-and-commit)
- [Node.js Performance Best Practices](https://nodejs.org/en/docs/guides/simple-profiling/)
