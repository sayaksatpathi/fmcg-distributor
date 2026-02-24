/**
 * IDOR (Insecure Direct Object Reference) Protection
 * Prevents users from accessing resources that don't belong to them
 */

/**
 * Middleware factory to check resource ownership
 * Use this to protect endpoints that access user-specific resources
 * 
 * @param {Function} getResourceOwnerId - Function to get the owner ID of the resource
 * @param {Object} options - Configuration options
 */
function ownershipGuard(getResourceOwnerId, options = {}) {
  const {
    allowRoles = ['owner', 'admin'], // Roles that can bypass ownership check
    resourceName = 'resource',
    idParam = 'id'
  } = options;
  
  return async (req, res, next) => {
    try {
      const resourceId = req.params[idParam] || req.query[idParam] || req.body?.[idParam];
      
      if (!resourceId) {
        return next(); // No specific resource requested
      }
      
      // Admin/Owner roles can access all resources
      if (req.user && allowRoles.includes(req.user.role)) {
        return next();
      }
      
      // Get the owner of the resource
      const ownerId = await getResourceOwnerId(resourceId, req);
      
      if (ownerId === null) {
        return res.status(404).json({ 
          error: `${resourceName} not found`,
          code: 'RESOURCE_NOT_FOUND'
        });
      }
      
      // Check ownership
      if (!req.user || ownerId !== req.user.id) {
        console.warn(`[SECURITY] IDOR attempt: User ${req.user?.id} tried to access ${resourceName} ${resourceId} owned by ${ownerId}`);
        
        return res.status(403).json({
          error: 'Access denied',
          code: 'IDOR_BLOCKED'
        });
      }
      
      next();
    } catch (error) {
      console.error('[SECURITY] Ownership check error:', error);
      next(error);
    }
  };
}

/**
 * Check if user owns the resource (direct check)
 */
function checkOwnership(resource, userId, userRole, allowedRoles = ['owner', 'admin']) {
  // Admin roles can access everything
  if (allowedRoles.includes(userRole)) {
    return true;
  }
  
  // Check direct ownership
  if (resource.user_id === userId || resource.userId === userId || resource.created_by === userId) {
    return true;
  }
  
  return false;
}

/**
 * Filter array to only include owned resources
 */
function filterOwnedResources(resources, userId, userRole, allowedRoles = ['owner', 'admin']) {
  // Admin roles see everything
  if (allowedRoles.includes(userRole)) {
    return resources;
  }
  
  return resources.filter(resource => 
    resource.user_id === userId || 
    resource.userId === userId || 
    resource.created_by === userId
  );
}

/**
 * Add ownership filter to SQL query
 */
function addOwnershipFilter(baseQuery, userId, userRole, allowedRoles = ['owner', 'admin']) {
  // Admin roles don't need filtering
  if (allowedRoles.includes(userRole)) {
    return { query: baseQuery, params: [] };
  }
  
  // Add WHERE clause for ownership
  const hasWhere = baseQuery.toLowerCase().includes('where');
  const connector = hasWhere ? ' AND ' : ' WHERE ';
  
  return {
    query: baseQuery + connector + '(user_id = ? OR created_by = ?)',
    params: [userId, userId]
  };
}

/**
 * Middleware to automatically filter list endpoints by ownership
 */
function autoOwnershipFilter(options = {}) {
  const { allowRoles = ['owner', 'admin'] } = options;
  
  return (req, res, next) => {
    // Store original json function
    const originalJson = res.json.bind(res);
    
    // Override json to filter results
    res.json = (data) => {
      // Only filter arrays of resources
      if (Array.isArray(data)) {
        if (req.user && !allowRoles.includes(req.user.role)) {
          data = filterOwnedResources(data, req.user.id, req.user.role, allowRoles);
        }
      } else if (data && typeof data === 'object') {
        // Check for common list response patterns
        for (const key of ['data', 'results', 'items', 'records']) {
          if (Array.isArray(data[key])) {
            if (req.user && !allowRoles.includes(req.user.role)) {
              data[key] = filterOwnedResources(data[key], req.user.id, req.user.role, allowRoles);
            }
            break;
          }
        }
      }
      
      return originalJson(data);
    };
    
    next();
  };
}

module.exports = {
  ownershipGuard,
  checkOwnership,
  filterOwnedResources,
  addOwnershipFilter,
  autoOwnershipFilter
};
