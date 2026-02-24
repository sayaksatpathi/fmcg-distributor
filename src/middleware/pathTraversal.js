/**
 * Path Traversal Protection Middleware
 * Prevents attackers from accessing files outside allowed directories
 */

const path = require('path');

// Allowed base directories for file operations
const ALLOWED_BASE_DIRS = [
  'uploads',
  'public',
  'exports'
];

/**
 * Sanitize and validate file paths
 * Prevents: ../../etc/passwd attacks
 */
function sanitizePath(inputPath) {
  if (!inputPath || typeof inputPath !== 'string') {
    return null;
  }
  
  // Remove null bytes
  let cleanPath = inputPath.replace(/\0/g, '');
  
  // Normalize path separators
  cleanPath = cleanPath.replace(/\\/g, '/');
  
  // Remove any attempt to traverse directories
  cleanPath = cleanPath.replace(/\.{2,}/g, '.'); // .. -> .
  
  // Remove leading slashes
  cleanPath = cleanPath.replace(/^[\/]+/, '');
  
  // Remove any remaining suspicious patterns
  cleanPath = cleanPath
    .replace(/%2e/gi, '.') // URL encoded .
    .replace(/%2f/gi, '/') // URL encoded /
    .replace(/%5c/gi, '/') // URL encoded \
    .replace(/%252e/gi, '.') // Double encoded .
    .replace(/%252f/gi, '/'); // Double encoded /
  
  return cleanPath;
}

/**
 * Validate that a path stays within allowed directory
 */
function isPathWithinBase(filePath, baseDir) {
  try {
    const resolvedBase = path.resolve(baseDir);
    const resolvedPath = path.resolve(baseDir, filePath);
    
    // Check if resolved path starts with base directory
    return resolvedPath.startsWith(resolvedBase + path.sep) || 
           resolvedPath === resolvedBase;
  } catch (e) {
    return false;
  }
}

/**
 * Get safe absolute path within a base directory
 */
function getSafePath(baseDir, userPath) {
  const sanitized = sanitizePath(userPath);
  
  if (!sanitized) {
    return null;
  }
  
  // Check if within allowed base
  if (!isPathWithinBase(sanitized, baseDir)) {
    return null;
  }
  
  return path.resolve(baseDir, sanitized);
}

/**
 * Middleware to protect file operations
 */
function pathTraversalGuard() {
  return (req, res, next) => {
    // Check common file path parameters
    const pathParams = ['file', 'filename', 'path', 'filepath', 'name', 'document'];
    
    for (const param of pathParams) {
      let pathValue = req.query[param] || req.body?.[param] || req.params?.[param];
      
      if (pathValue) {
        // Check for traversal attempts
        const suspicious = [
          '..', 
          '%2e%2e', 
          '....', 
          '/etc/',
          '/proc/',
          '/var/',
          'c:\\',
          'c:/',
          '\\windows',
          '/windows'
        ];
        
        const lowerPath = pathValue.toLowerCase();
        
        for (const pattern of suspicious) {
          if (lowerPath.includes(pattern)) {
            console.warn(`[SECURITY] Path traversal attempt blocked: ${pathValue} from IP: ${req.ip}`);
            
            return res.status(400).json({
              error: 'Invalid file path',
              code: 'PATH_TRAVERSAL_BLOCKED'
            });
          }
        }
      }
    }
    
    next();
  };
}

/**
 * Validate file extension
 */
function isAllowedExtension(filename, allowedExtensions) {
  if (!filename) return false;
  
  const ext = path.extname(filename).toLowerCase();
  return allowedExtensions.includes(ext);
}

/**
 * Safe file read helper
 */
function createSafeFileReader(baseDir) {
  return (filename) => {
    const safePath = getSafePath(baseDir, filename);
    
    if (!safePath) {
      throw new Error('Invalid file path');
    }
    
    return safePath;
  };
}

module.exports = {
  sanitizePath,
  isPathWithinBase,
  getSafePath,
  pathTraversalGuard,
  isAllowedExtension,
  createSafeFileReader,
  ALLOWED_BASE_DIRS
};
