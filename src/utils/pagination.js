/**
 * Pagination and Query Security Utilities
 * Implements secure pagination to prevent DoS and improve performance
 */

// Default pagination settings
const PAGINATION_DEFAULTS = {
  defaultLimit: 20,
  maxLimit: 100,
  defaultPage: 1
};

/**
 * Parse and validate pagination parameters
 */
function parsePagination(query, options = {}) {
  const defaults = { ...PAGINATION_DEFAULTS, ...options };
  
  let page = parseInt(query.page) || defaults.defaultPage;
  let limit = parseInt(query.limit) || defaults.defaultLimit;
  
  // Enforce bounds
  page = Math.max(1, page);
  limit = Math.max(1, Math.min(limit, defaults.maxLimit));
  
  const offset = (page - 1) * limit;
  
  return {
    page,
    limit,
    offset
  };
}

/**
 * Build pagination response
 */
function buildPaginationResponse(data, pagination, totalCount) {
  const { page, limit } = pagination;
  const totalPages = Math.ceil(totalCount / limit);
  
  return {
    data,
    pagination: {
      page,
      limit,
      totalCount,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1
    }
  };
}

/**
 * Middleware to parse pagination from query
 */
const paginationMiddleware = (options = {}) => {
  return (req, res, next) => {
    req.pagination = parsePagination(req.query, options);
    next();
  };
};

/**
 * Safe sort parameter parsing
 */
function parseSortParams(query, allowedFields = []) {
  const sortBy = query.sortBy || query.sort_by;
  const sortOrder = query.sortOrder || query.sort_order || 'ASC';
  
  // Validate sort field against whitelist
  if (sortBy && !allowedFields.includes(sortBy)) {
    return null;
  }
  
  // Validate sort order
  const order = sortOrder.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
  
  if (sortBy) {
    return { field: sortBy, order };
  }
  
  return null;
}

/**
 * Safe date range parsing
 */
function parseDateRange(query) {
  const startDate = query.start_date || query.startDate;
  const endDate = query.end_date || query.endDate;
  
  const result = {};
  
  if (startDate) {
    const parsed = new Date(startDate);
    if (!isNaN(parsed.getTime())) {
      result.startDate = parsed.toISOString().split('T')[0];
    }
  }
  
  if (endDate) {
    const parsed = new Date(endDate);
    if (!isNaN(parsed.getTime())) {
      result.endDate = parsed.toISOString().split('T')[0];
    }
  }
  
  return result;
}

/**
 * Build safe SQL query with pagination
 * Uses parameterized queries ONLY
 */
function buildPaginatedQuery(baseQuery, params, pagination, sortConfig = null) {
  let query = baseQuery;
  const queryParams = [...params];
  
  // Add sorting if provided
  if (sortConfig) {
    // Field name is validated against whitelist, so safe to interpolate
    query += ` ORDER BY ${sortConfig.field} ${sortConfig.order}`;
  }
  
  // Add pagination
  query += ' LIMIT ? OFFSET ?';
  queryParams.push(pagination.limit, pagination.offset);
  
  return { query, params: queryParams };
}

/**
 * Build count query for pagination
 */
function buildCountQuery(baseQuery) {
  // Remove any existing ORDER BY, LIMIT, OFFSET
  let countQuery = baseQuery
    .replace(/ORDER BY[\s\S]*$/i, '')
    .replace(/LIMIT[\s\S]*$/i, '')
    .replace(/OFFSET[\s\S]*$/i, '');
  
  // Wrap in COUNT
  return `SELECT COUNT(*) as total FROM (${countQuery})`;
}

/**
 * Execute paginated query helper
 */
function executePaginatedQuery(db, baseQuery, params, pagination, options = {}) {
  return new Promise((resolve, reject) => {
    const { allowedSortFields = [], defaultSort = null } = options;
    
    // Build count query
    const countQuery = buildCountQuery(baseQuery);
    
    // Get sort config
    let sortConfig = defaultSort;
    if (options.query) {
      const parsedSort = parseSortParams(options.query, allowedSortFields);
      if (parsedSort) sortConfig = parsedSort;
    }
    
    // Get total count
    db.get(countQuery, params, (err, countResult) => {
      if (err) return reject(err);
      
      const totalCount = countResult?.total || 0;
      
      // Build paginated query
      const { query, params: queryParams } = buildPaginatedQuery(
        baseQuery,
        params,
        pagination,
        sortConfig
      );
      
      // Execute main query
      db.all(query, queryParams, (err, rows) => {
        if (err) return reject(err);
        
        resolve(buildPaginationResponse(rows || [], pagination, totalCount));
      });
    });
  });
}

/**
 * Search term sanitization
 */
function sanitizeSearchTerm(term, options = {}) {
  if (!term || typeof term !== 'string') return '';
  
  let sanitized = term.trim();
  
  // Limit length
  const maxLength = options.maxLength || 100;
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }
  
  // Escape SQL LIKE special characters
  sanitized = sanitized
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_');
  
  return sanitized;
}

/**
 * Build LIKE clause for search
 */
function buildSearchClause(searchTerm, fields) {
  if (!searchTerm || fields.length === 0) {
    return { clause: '', params: [] };
  }
  
  const sanitized = sanitizeSearchTerm(searchTerm);
  if (!sanitized) {
    return { clause: '', params: [] };
  }
  
  const conditions = fields.map(field => `${field} LIKE ? ESCAPE '\\'`);
  const params = fields.map(() => `%${sanitized}%`);
  
  return {
    clause: `(${conditions.join(' OR ')})`,
    params
  };
}

module.exports = {
  PAGINATION_DEFAULTS,
  parsePagination,
  buildPaginationResponse,
  paginationMiddleware,
  parseSortParams,
  parseDateRange,
  buildPaginatedQuery,
  buildCountQuery,
  executePaginatedQuery,
  sanitizeSearchTerm,
  buildSearchClause
};
