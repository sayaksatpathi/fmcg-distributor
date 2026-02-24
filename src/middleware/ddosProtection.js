/**
 * DDoS Protection Middleware
 * Multi-layer defense against Distributed Denial of Service attacks
 */

const config = require('../config');

// ============================================
// CONFIGURATION
// ============================================
const DDOS_CONFIG = {
  // Connection limits
  maxConnectionsPerIP: 50,           // Max simultaneous connections per IP
  connectionWindowMs: 60 * 1000,      // 1 minute window
  
  // Request rate limits (per IP)
  requestsPerSecond: 10,              // Burst limit
  requestsPerMinute: 200,             // Sustained limit
  requestsPerHour: 5000,              // Long-term limit
  
  // Request size limits
  maxRequestSize: 10 * 1024 * 1024,   // 10MB max
  maxUrlLength: 2048,                 // Max URL length
  maxHeaderSize: 8192,                // 8KB max headers
  
  // Slowloris protection
  headerTimeout: 10000,               // 10 seconds to send headers
  bodyTimeout: 30000,                 // 30 seconds to send body
  
  // Suspicious behavior thresholds
  suspiciousRequestThreshold: 50,     // Requests that trigger monitoring
  banThreshold: 100,                  // Requests that trigger temporary ban
  banDurationMs: 15 * 60 * 1000,      // 15 minute ban
  
  // Auto-scaling thresholds
  globalRequestsPerSecond: 1000,      // Global rate limit
  emergencyMode: false,               // Activated during attack
  
  // Whitelist (trusted IPs)
  whitelist: [
    '127.0.0.1',
    '::1',
    'localhost'
  ],
  
  // Blacklist (permanently blocked)
  blacklist: []
};

// ============================================
// IN-MEMORY STORES
// ============================================
const ipTracker = new Map();          // Track requests per IP
const bannedIPs = new Map();          // Temporarily banned IPs
const connectionTracker = new Map();  // Track active connections
const globalStats = {
  requestsThisSecond: 0,
  requestsThisMinute: 0,
  lastSecondReset: Date.now(),
  lastMinuteReset: Date.now(),
  underAttack: false,
  attackStarted: null
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get client IP address (handles proxies)
 */
function getClientIP(req) {
  // Check for proxy headers
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  const realIp = req.headers['x-real-ip'];
  if (realIp) {
    return realIp;
  }
  
  return req.ip || req.connection?.remoteAddress || 'unknown';
}

/**
 * Check if IP is whitelisted
 */
function isWhitelisted(ip) {
  return DDOS_CONFIG.whitelist.some(w => 
    ip === w || ip.includes(w) || (w.includes('/') && isInSubnet(ip, w))
  );
}

/**
 * Check if IP is in subnet (basic CIDR check)
 */
function isInSubnet(ip, cidr) {
  // Simplified - for production use a proper CIDR library
  const [subnet, bits] = cidr.split('/');
  return ip.startsWith(subnet.split('.').slice(0, Math.floor(parseInt(bits) / 8)).join('.'));
}

/**
 * Check if IP is blacklisted
 */
function isBlacklisted(ip) {
  return DDOS_CONFIG.blacklist.includes(ip);
}

/**
 * Check if IP is temporarily banned
 */
function isBanned(ip) {
  const ban = bannedIPs.get(ip);
  if (!ban) return false;
  
  if (Date.now() > ban.expiresAt) {
    bannedIPs.delete(ip);
    return false;
  }
  
  return true;
}

/**
 * Ban an IP temporarily
 */
function banIP(ip, reason, durationMs = DDOS_CONFIG.banDurationMs) {
  console.warn(`🚫 [DDoS] Banning IP ${ip} for ${durationMs/1000}s - Reason: ${reason}`);
  bannedIPs.set(ip, {
    reason,
    bannedAt: Date.now(),
    expiresAt: Date.now() + durationMs
  });
}

/**
 * Track request from IP
 */
function trackRequest(ip) {
  const now = Date.now();
  
  if (!ipTracker.has(ip)) {
    ipTracker.set(ip, {
      requestsThisSecond: 0,
      requestsThisMinute: 0,
      requestsThisHour: 0,
      lastSecondReset: now,
      lastMinuteReset: now,
      lastHourReset: now,
      suspicious: false,
      totalRequests: 0
    });
  }
  
  const tracker = ipTracker.get(ip);
  
  // Reset counters if windows have passed
  if (now - tracker.lastSecondReset >= 1000) {
    tracker.requestsThisSecond = 0;
    tracker.lastSecondReset = now;
  }
  
  if (now - tracker.lastMinuteReset >= 60000) {
    tracker.requestsThisMinute = 0;
    tracker.lastMinuteReset = now;
  }
  
  if (now - tracker.lastHourReset >= 3600000) {
    tracker.requestsThisHour = 0;
    tracker.lastHourReset = now;
  }
  
  // Increment counters
  tracker.requestsThisSecond++;
  tracker.requestsThisMinute++;
  tracker.requestsThisHour++;
  tracker.totalRequests++;
  
  return tracker;
}

/**
 * Check if request should be blocked
 */
function shouldBlock(ip, tracker) {
  // Check per-second limit (burst protection)
  if (tracker.requestsThisSecond > DDOS_CONFIG.requestsPerSecond) {
    return { block: true, reason: 'Burst rate limit exceeded' };
  }
  
  // Check per-minute limit
  if (tracker.requestsThisMinute > DDOS_CONFIG.requestsPerMinute) {
    return { block: true, reason: 'Minute rate limit exceeded' };
  }
  
  // Check per-hour limit
  if (tracker.requestsThisHour > DDOS_CONFIG.requestsPerHour) {
    return { block: true, reason: 'Hourly rate limit exceeded' };
  }
  
  // Check for ban threshold
  if (tracker.requestsThisMinute > DDOS_CONFIG.banThreshold) {
    banIP(ip, 'Exceeded ban threshold');
    return { block: true, reason: 'IP temporarily banned' };
  }
  
  // Mark as suspicious if threshold exceeded
  if (tracker.requestsThisMinute > DDOS_CONFIG.suspiciousRequestThreshold) {
    tracker.suspicious = true;
  }
  
  return { block: false };
}

/**
 * Update global stats
 */
function updateGlobalStats() {
  const now = Date.now();
  
  if (now - globalStats.lastSecondReset >= 1000) {
    globalStats.requestsThisSecond = 0;
    globalStats.lastSecondReset = now;
  }
  
  if (now - globalStats.lastMinuteReset >= 60000) {
    globalStats.requestsThisMinute = 0;
    globalStats.lastMinuteReset = now;
  }
  
  globalStats.requestsThisSecond++;
  globalStats.requestsThisMinute++;
  
  // Detect attack
  if (globalStats.requestsThisSecond > DDOS_CONFIG.globalRequestsPerSecond) {
    if (!globalStats.underAttack) {
      console.error('🚨 [DDoS] ATTACK DETECTED! Enabling emergency mode');
      globalStats.underAttack = true;
      globalStats.attackStarted = now;
      DDOS_CONFIG.emergencyMode = true;
    }
  } else if (globalStats.underAttack && now - globalStats.attackStarted > 60000) {
    console.log('✅ [DDoS] Attack subsided. Disabling emergency mode');
    globalStats.underAttack = false;
    DDOS_CONFIG.emergencyMode = false;
  }
}

// ============================================
// CLEANUP ROUTINE
// ============================================
setInterval(() => {
  const now = Date.now();
  
  // Clean up IP tracker (entries older than 1 hour)
  for (const [ip, data] of ipTracker.entries()) {
    if (now - data.lastHourReset > 3600000) {
      ipTracker.delete(ip);
    }
  }
  
  // Clean up expired bans
  for (const [ip, data] of bannedIPs.entries()) {
    if (now > data.expiresAt) {
      bannedIPs.delete(ip);
    }
  }
  
  // Log stats
  if (ipTracker.size > 0 || bannedIPs.size > 0) {
    console.log(`📊 [DDoS] Active IPs: ${ipTracker.size}, Banned: ${bannedIPs.size}, Emergency: ${DDOS_CONFIG.emergencyMode}`);
  }
}, 60000); // Every minute

// ============================================
// MIDDLEWARE
// ============================================

/**
 * Main DDoS protection middleware
 */
const ddosProtection = (options = {}) => {
  // Merge options
  Object.assign(DDOS_CONFIG, options);
  
  return (req, res, next) => {
    const ip = getClientIP(req);
    const startTime = Date.now();
    
    // 1. Check whitelist
    if (isWhitelisted(ip)) {
      return next();
    }
    
    // 2. Check blacklist
    if (isBlacklisted(ip)) {
      console.warn(`🚫 [DDoS] Blocked blacklisted IP: ${ip}`);
      return res.status(403).json({ 
        error: 'Access denied',
        code: 'BLACKLISTED'
      });
    }
    
    // 3. Check if banned
    if (isBanned(ip)) {
      const ban = bannedIPs.get(ip);
      const remainingMs = ban.expiresAt - Date.now();
      
      res.set('Retry-After', Math.ceil(remainingMs / 1000));
      return res.status(429).json({
        error: 'Temporarily blocked due to suspicious activity',
        code: 'TEMP_BANNED',
        retryAfter: Math.ceil(remainingMs / 1000)
      });
    }
    
    // 4. Check request size
    const contentLength = parseInt(req.headers['content-length'] || '0');
    if (contentLength > DDOS_CONFIG.maxRequestSize) {
      return res.status(413).json({
        error: 'Request too large',
        code: 'PAYLOAD_TOO_LARGE'
      });
    }
    
    // 5. Check URL length
    if (req.url.length > DDOS_CONFIG.maxUrlLength) {
      return res.status(414).json({
        error: 'URL too long',
        code: 'URI_TOO_LONG'
      });
    }
    
    // 6. Update global stats
    updateGlobalStats();
    
    // 7. Emergency mode - stricter limits
    if (DDOS_CONFIG.emergencyMode) {
      const tracker = trackRequest(ip);
      
      // In emergency mode, reduce limits by 50%
      if (tracker.requestsThisSecond > DDOS_CONFIG.requestsPerSecond / 2) {
        return res.status(503).json({
          error: 'Server under heavy load. Please try again later.',
          code: 'EMERGENCY_MODE'
        });
      }
    }
    
    // 8. Track and check limits
    const tracker = trackRequest(ip);
    const blockResult = shouldBlock(ip, tracker);
    
    if (blockResult.block) {
      console.warn(`🚫 [DDoS] Blocked ${ip}: ${blockResult.reason}`);
      
      res.set('X-RateLimit-Limit', DDOS_CONFIG.requestsPerMinute);
      res.set('X-RateLimit-Remaining', 0);
      res.set('Retry-After', 60);
      
      return res.status(429).json({
        error: blockResult.reason,
        code: 'RATE_LIMITED'
      });
    }
    
    // 9. Set rate limit headers
    res.set('X-RateLimit-Limit', DDOS_CONFIG.requestsPerMinute);
    res.set('X-RateLimit-Remaining', Math.max(0, DDOS_CONFIG.requestsPerMinute - tracker.requestsThisMinute));
    
    // 10. Track response time (detect slowloris on response)
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      if (duration > 30000) {
        console.warn(`⚠️ [DDoS] Slow request from ${ip}: ${duration}ms`);
      }
    });
    
    next();
  };
};

/**
 * Connection limit middleware (for use with HTTP server)
 */
const connectionLimiter = (server) => {
  const connections = new Map();
  
  server.on('connection', (socket) => {
    const ip = socket.remoteAddress;
    
    if (!connections.has(ip)) {
      connections.set(ip, new Set());
    }
    
    const ipConnections = connections.get(ip);
    
    // Check connection limit
    if (ipConnections.size >= DDOS_CONFIG.maxConnectionsPerIP) {
      console.warn(`🚫 [DDoS] Too many connections from ${ip}`);
      socket.destroy();
      return;
    }
    
    ipConnections.add(socket);
    
    socket.on('close', () => {
      ipConnections.delete(socket);
      if (ipConnections.size === 0) {
        connections.delete(ip);
      }
    });
    
    // Slowloris protection - timeout for idle connections
    socket.setTimeout(DDOS_CONFIG.headerTimeout);
    socket.on('timeout', () => {
      console.warn(`⚠️ [DDoS] Connection timeout from ${ip}`);
      socket.destroy();
    });
  });
};

/**
 * Slowloris protection middleware
 */
const slowlorisProtection = (req, res, next) => {
  const ip = getClientIP(req);
  
  // Set request timeout
  req.setTimeout(DDOS_CONFIG.bodyTimeout, () => {
    console.warn(`⚠️ [DDoS] Request timeout from ${ip}`);
    res.status(408).json({
      error: 'Request timeout',
      code: 'REQUEST_TIMEOUT'
    });
  });
  
  next();
};

/**
 * User-Agent validation (blocks empty/suspicious UAs)
 */
const userAgentValidation = (req, res, next) => {
  const ua = req.headers['user-agent'];
  
  // Block empty user agents in production
  if (!ua && process.env.NODE_ENV === 'production') {
    return res.status(403).json({
      error: 'Invalid request',
      code: 'MISSING_UA'
    });
  }
  
  // Block known bad bots
  const badBots = [
    'nikto',
    'sqlmap',
    'havij',
    'masscan',
    'nmap',
    'zgrab'
  ];
  
  if (ua && badBots.some(bot => ua.toLowerCase().includes(bot))) {
    console.warn(`🚫 [DDoS] Blocked bad bot: ${ua}`);
    return res.status(403).json({
      error: 'Access denied',
      code: 'BAD_BOT'
    });
  }
  
  next();
};

/**
 * Get current DDoS stats
 */
function getDDoSStats() {
  return {
    trackedIPs: ipTracker.size,
    bannedIPs: bannedIPs.size,
    globalRequestsPerSecond: globalStats.requestsThisSecond,
    globalRequestsPerMinute: globalStats.requestsThisMinute,
    underAttack: globalStats.underAttack,
    emergencyMode: DDOS_CONFIG.emergencyMode,
    bannedList: Array.from(bannedIPs.entries()).map(([ip, data]) => ({
      ip,
      reason: data.reason,
      expiresIn: Math.ceil((data.expiresAt - Date.now()) / 1000)
    }))
  };
}

/**
 * Manually ban an IP
 */
function manualBan(ip, reason = 'Manual ban', durationMs = DDOS_CONFIG.banDurationMs) {
  banIP(ip, reason, durationMs);
}

/**
 * Unban an IP
 */
function unbanIP(ip) {
  bannedIPs.delete(ip);
  console.log(`✅ [DDoS] Unbanned IP: ${ip}`);
}

/**
 * Add IP to whitelist
 */
function addToWhitelist(ip) {
  if (!DDOS_CONFIG.whitelist.includes(ip)) {
    DDOS_CONFIG.whitelist.push(ip);
  }
}

/**
 * Add IP to blacklist
 */
function addToBlacklist(ip) {
  if (!DDOS_CONFIG.blacklist.includes(ip)) {
    DDOS_CONFIG.blacklist.push(ip);
  }
}

module.exports = {
  ddosProtection,
  connectionLimiter,
  slowlorisProtection,
  userAgentValidation,
  getDDoSStats,
  manualBan,
  unbanIP,
  addToWhitelist,
  addToBlacklist,
  DDOS_CONFIG,
  getClientIP
};
