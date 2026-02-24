/**
 * Frontend Security Utilities
 * XSS Protection for client-side rendering
 */

// HTML Entity Map
const HTML_ENTITIES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
  '`': '&#x60;',
  '=': '&#x3D;'
};

/**
 * Escape HTML to prevent XSS attacks
 * Use this for ANY user-provided data rendered in HTML
 * 
 * @param {string} text - The text to escape
 * @returns {string} - HTML-safe string
 */
function escapeHtml(text) {
  if (text === null || text === undefined) {
    return '';
  }
  
  return String(text).replace(/[&<>"'`=\/]/g, char => HTML_ENTITIES[char]);
}

/**
 * Escape for use in HTML attributes
 * More aggressive escaping for attribute values
 * 
 * @param {string} text - The text to escape
 * @returns {string} - Attribute-safe string
 */
function escapeAttr(text) {
  if (text === null || text === undefined) {
    return '';
  }
  
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Escape for use in JavaScript strings
 * 
 * @param {string} text - The text to escape
 * @returns {string} - JS-safe string
 */
function escapeJs(text) {
  if (text === null || text === undefined) {
    return '';
  }
  
  return String(text)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
    .replace(/<\/script>/gi, '<\\/script>');
}

/**
 * Create safe HTML element with text content (not innerHTML)
 * 
 * @param {string} tag - HTML tag name
 * @param {string} text - Text content
 * @param {Object} attrs - Attributes object
 * @returns {HTMLElement}
 */
function createElement(tag, text, attrs = {}) {
  const el = document.createElement(tag);
  
  if (text !== undefined && text !== null) {
    el.textContent = text;
  }
  
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'className') {
      el.className = value;
    } else if (key === 'style' && typeof value === 'object') {
      Object.assign(el.style, value);
    } else if (key.startsWith('on')) {
      // Don't allow event handlers via attrs for security
      console.warn('Event handlers should not be set via createElement attrs');
    } else {
      el.setAttribute(key, value);
    }
  }
  
  return el;
}

/**
 * Safe innerHTML alternative - builds DOM from template
 * Escapes all interpolated values
 * 
 * Usage:
 * safeHtml`<div>${userInput}</div>` // userInput is auto-escaped
 * 
 * @param {TemplateStringsArray} strings - Template literal strings
 * @param {...any} values - Interpolated values
 * @returns {string} - Safe HTML string
 */
function safeHtml(strings, ...values) {
  let result = strings[0];
  
  for (let i = 0; i < values.length; i++) {
    result += escapeHtml(values[i]) + strings[i + 1];
  }
  
  return result;
}

/**
 * Sanitize URL to prevent javascript: and data: attacks
 * 
 * @param {string} url - URL to sanitize
 * @returns {string|null} - Safe URL or null if dangerous
 */
function sanitizeUrl(url) {
  if (!url || typeof url !== 'string') {
    return null;
  }
  
  const trimmed = url.trim().toLowerCase();
  
  // Block dangerous protocols
  if (trimmed.startsWith('javascript:') ||
      trimmed.startsWith('data:') ||
      trimmed.startsWith('vbscript:')) {
    console.warn('Blocked dangerous URL:', url);
    return null;
  }
  
  return url;
}

/**
 * Format currency safely
 * 
 * @param {number} amount - Amount to format
 * @returns {string} - Formatted currency string (escaped)
 */
function formatCurrencySafe(amount) {
  const num = parseFloat(amount) || 0;
  return '₹' + num.toLocaleString('en-IN', { 
    minimumFractionDigits: 2,
    maximumFractionDigits: 2 
  });
}

/**
 * Format date safely
 * 
 * @param {string|Date} date - Date to format
 * @returns {string} - Formatted date string (escaped)
 */
function formatDateSafe(date) {
  if (!date) return '-';
  
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('en-IN');
  } catch {
    return '-';
  }
}

/**
 * Build table row safely
 * 
 * @param {Array} cells - Array of cell contents
 * @param {Object} options - Row options
 * @returns {string} - Safe HTML string for table row
 */
function buildTableRow(cells, options = {}) {
  const { className = '', id = '', dataAttrs = {} } = options;
  
  let attrs = '';
  if (className) attrs += ` class="${escapeAttr(className)}"`;
  if (id) attrs += ` id="${escapeAttr(id)}"`;
  
  for (const [key, value] of Object.entries(dataAttrs)) {
    attrs += ` data-${escapeAttr(key)}="${escapeAttr(value)}"`;
  }
  
  const cellsHtml = cells.map(cell => {
    if (typeof cell === 'object' && cell.raw) {
      // Allow raw HTML for trusted content (badges, buttons, etc.)
      return `<td${cell.className ? ` class="${escapeAttr(cell.className)}"` : ''}>${cell.raw}</td>`;
    }
    if (typeof cell === 'object') {
      const tdClass = cell.className ? ` class="${escapeAttr(cell.className)}"` : '';
      return `<td${tdClass}>${escapeHtml(cell.text)}</td>`;
    }
    return `<td>${escapeHtml(cell)}</td>`;
  }).join('');
  
  return `<tr${attrs}>${cellsHtml}</tr>`;
}

/**
 * Set innerHTML safely - validates and sanitizes content
 * 
 * @param {HTMLElement} element - Target element
 * @param {string} html - HTML content (should already be escaped where needed)
 */
function setInnerHtmlSafe(element, html) {
  if (!element) return;
  
  // Remove any script tags as a safety measure
  const sanitized = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  
  // Remove dangerous event handlers but allow onclick for buttons
  // Block: onerror, onload, onmouseover, onfocus, etc.
  const dangerousEvents = /\s+on(error|load|mouseover|mouseout|focus|blur|change|input|keydown|keyup|keypress|submit|abort|beforeunload|contextmenu|copy|cut|paste|drag|dragstart|dragend|dragover|dragenter|dragleave|drop|dblclick|mousedown|mouseup|mousemove|mouseenter|mouseleave|scroll|wheel|touchstart|touchmove|touchend|touchcancel|pointerdown|pointerup|pointermove|pointerenter|pointerleave|pointercancel|gotpointercapture|lostpointercapture|animationstart|animationend|animationiteration|transitionend|message|storage|online|offline|popstate|hashchange)\s*=/gi;
  const cleaned = sanitized.replace(dangerousEvents, ' data-blocked-');
  
  element.innerHTML = cleaned;
}

// Export for use in other scripts
window.SecurityUtils = {
  escapeHtml,
  escapeAttr,
  escapeJs,
  createElement,
  safeHtml,
  sanitizeUrl,
  formatCurrencySafe,
  formatDateSafe,
  buildTableRow,
  setInnerHtmlSafe
};

// Also expose commonly used functions globally for convenience
window.escapeHtml = escapeHtml;
window.escapeAttr = escapeAttr;
window.safeHtml = safeHtml;
window.setInnerHtmlSafe = setInnerHtmlSafe;
