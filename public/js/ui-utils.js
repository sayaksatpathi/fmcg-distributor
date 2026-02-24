/**
 * UI Utility Functions for better UX
 */

// Toast Notification System
const Toast = {
    container: null,

    init() {
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.className = 'toast-container';
            document.body.appendChild(this.container);
        }
    },

    show(options) {
        this.init();

        const { type = 'info', title, message, duration = 4000 } = options;

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        const icons = {
            success: '✓',
            error: '✕',
            warning: '⚠',
            info: 'ℹ'
        };

        toast.innerHTML = `
            <span class="toast-icon">${icons[type] || icons.info}</span>
            <div class="toast-content">
                ${title ? `<div class="toast-title">${title}</div>` : ''}
                <div class="toast-message">${message}</div>
            </div>
            <button class="toast-close" onclick="Toast.dismiss(this.parentElement)">&times;</button>
        `;

        this.container.appendChild(toast);

        if (duration > 0) {
            setTimeout(() => this.dismiss(toast), duration);
        }

        return toast;
    },

    dismiss(toast) {
        if (toast && toast.parentElement) {
            toast.classList.add('hiding');
            setTimeout(() => toast.remove(), 300);
        }
    },

    success(message, title = 'Success') {
        return this.show({ type: 'success', title, message });
    },

    error(message, title = 'Error') {
        return this.show({ type: 'error', title, message });
    },

    warning(message, title = 'Warning') {
        return this.show({ type: 'warning', title, message });
    },

    info(message, title = 'Info') {
        return this.show({ type: 'info', title, message });
    }
};

// Loading Overlay
const LoadingOverlay = {
    element: null,

    show(message = 'Loading...') {
        if (!this.element) {
            this.element = document.createElement('div');
            this.element.className = 'loading-overlay';
            this.element.innerHTML = `
                <div class="spinner"></div>
                <p>${message}</p>
            `;
            document.body.appendChild(this.element);
        } else {
            this.element.querySelector('p').textContent = message;
            this.element.style.display = 'flex';
        }
    },

    hide() {
        if (this.element) {
            this.element.style.display = 'none';
        }
    },

    update(message) {
        if (this.element) {
            this.element.querySelector('p').textContent = message;
        }
    }
};

// Skeleton Loader Generator
const Skeleton = {
    text(count = 3, container) {
        const html = Array(count).fill(0).map((_, i) =>
            `<div class="skeleton skeleton-text ${i === count - 1 ? 'short' : ''}"></div>`
        ).join('');

        if (container) {
            container.innerHTML = html;
        }
        return html;
    },

    tableRows(columns = 5, rows = 5, container) {
        const html = Array(rows).fill(0).map(() => `
            <tr>
                ${Array(columns).fill(0).map(() =>
            '<td><div class="skeleton skeleton-text"></div></td>'
        ).join('')}
            </tr>
        `).join('');

        if (container) {
            container.innerHTML = html;
        }
        return html;
    },

    cards(count = 3, container) {
        const html = Array(count).fill(0).map(() => `
            <div class="card">
                <div class="skeleton skeleton-text short"></div>
                <div class="skeleton skeleton-box"></div>
            </div>
        `).join('');

        if (container) {
            container.innerHTML = html;
        }
        return html;
    }
};

// Confirm Dialog
const ConfirmDialog = {
    show(options) {
        return new Promise((resolve) => {
            const { title = 'Confirm', message, confirmText = 'Confirm', cancelText = 'Cancel', type = 'primary' } = options;

            const modal = document.createElement('div');
            modal.className = 'modal active';
            modal.innerHTML = `
                <div class="modal-content" style="max-width: 400px;">
                    <div class="modal-header">
                        <h2>${title}</h2>
                        <button class="modal-close" data-action="cancel">&times;</button>
                    </div>
                    <p style="margin-bottom: 20px;">${message}</p>
                    <div style="display: flex; gap: 10px; justify-content: flex-end;">
                        <button class="btn btn-secondary" data-action="cancel">${cancelText}</button>
                        <button class="btn btn-${type}" data-action="confirm">${confirmText}</button>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);

            modal.addEventListener('click', (e) => {
                const action = e.target.dataset.action;
                if (action === 'confirm') {
                    resolve(true);
                    modal.remove();
                } else if (action === 'cancel' || e.target === modal) {
                    resolve(false);
                    modal.remove();
                }
            });
        });
    }
};

// Format numbers with Indian currency format
function formatCurrency(amount) {
    if (typeof amount !== 'number') amount = parseFloat(amount) || 0;
    return '₹' + amount.toLocaleString('en-IN', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
    });
}

// Format plain numbers with locale
function formatNumber(num) {
    if (num === null || num === undefined) return '0';
    if (typeof num !== 'number') num = parseFloat(num) || 0;
    return num.toLocaleString('en-IN', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
    });
}

// Format numbers with abbreviation (K, L, Cr)
function formatNumberShort(num) {
    if (num >= 10000000) return '₹' + (num / 10000000).toFixed(2) + ' Cr';
    if (num >= 100000) return '₹' + (num / 100000).toFixed(2) + ' L';
    if (num >= 1000) return '₹' + (num / 1000).toFixed(1) + 'K';
    return '₹' + num.toFixed(0);
}

// Format date relative to now
function formatRelativeTime(date) {
    const now = new Date();
    const diff = now - new Date(date);
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return new Date(date).toLocaleDateString('en-IN');
}

// Debounce function for search inputs
function debounce(func, wait = 300) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Throttle function for scroll events
function throttle(func, limit = 100) {
    let inThrottle;
    return function (...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// Copy to clipboard with feedback
async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        Toast.success('Copied to clipboard!');
        return true;
    } catch (err) {
        Toast.error('Failed to copy');
        return false;
    }
}

// Smooth scroll to element
function scrollToElement(selector, offset = 80) {
    const element = document.querySelector(selector);
    if (element) {
        const top = element.getBoundingClientRect().top + window.pageYOffset - offset;
        window.scrollTo({ top, behavior: 'smooth' });
    }
}

// Initialize dropdown menus
function initDropdowns() {
    document.addEventListener('click', (e) => {
        const dropdown = e.target.closest('.dropdown');

        // Close all dropdowns
        document.querySelectorAll('.dropdown.active').forEach(d => {
            if (d !== dropdown) d.classList.remove('active');
        });

        // Toggle clicked dropdown
        if (dropdown) {
            dropdown.classList.toggle('active');
        }
    });
}

// Initialize tooltips (if data-tooltip attribute exists)
function initTooltips() {
    document.querySelectorAll('[data-tooltip]').forEach(el => {
        if (!el.classList.contains('tooltip')) {
            el.classList.add('tooltip');
        }
    });
}

// Empty state generator
function showEmptyState(container, { icon = '📭', title = 'No data', message = '', buttonText = '', buttonAction = null } = {}) {
    container.innerHTML = `
        <div class="empty-state">
            <div class="empty-state-icon">${icon}</div>
            <h3>${title}</h3>
            <p>${message}</p>
            ${buttonText ? `<button class="btn btn-primary" onclick="${buttonAction}">${buttonText}</button>` : ''}
        </div>
    `;
}

// Table sorting helper
function initSortableTable(table) {
    const headers = table.querySelectorAll('th.sortable');

    headers.forEach(header => {
        header.addEventListener('click', () => {
            const column = header.cellIndex;
            const tbody = table.querySelector('tbody');
            const rows = Array.from(tbody.querySelectorAll('tr'));
            const isAsc = header.classList.contains('asc');

            // Remove sort classes from all headers
            headers.forEach(h => h.classList.remove('asc', 'desc'));

            // Add sort class to clicked header
            header.classList.add(isAsc ? 'desc' : 'asc');

            // Sort rows
            rows.sort((a, b) => {
                const aVal = a.cells[column].textContent.trim();
                const bVal = b.cells[column].textContent.trim();

                // Check if numeric
                const aNum = parseFloat(aVal.replace(/[₹,]/g, ''));
                const bNum = parseFloat(bVal.replace(/[₹,]/g, ''));

                if (!isNaN(aNum) && !isNaN(bNum)) {
                    return isAsc ? bNum - aNum : aNum - bNum;
                }

                return isAsc ? bVal.localeCompare(aVal) : aVal.localeCompare(bVal);
            });

            // Re-append sorted rows
            rows.forEach(row => tbody.appendChild(row));
        });
    });
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    initDropdowns();
    initTooltips();

    // Initialize sortable tables
    document.querySelectorAll('table').forEach(table => {
        if (table.querySelector('th.sortable')) {
            initSortableTable(table);
        }
    });
});

// Mobile menu toggle
function initMobileMenu() {
    const menuBtn = document.querySelector('.mobile-menu-btn');
    const navLinks = document.getElementById('navLinks');

    if (menuBtn && navLinks) {
        // Toggle menu on button click
        menuBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent document click from immediately closing it
            navLinks.classList.toggle('active');
        });

        // Close menu when clicking links
        navLinks.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                navLinks.classList.remove('active');
            });
        });
    }

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
        if (navLinks && navLinks.classList.contains('active')) {
            if (!navLinks.contains(e.target)) {
                navLinks.classList.remove('active');
            }
        }
    });
}

// Make sure it runs on load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMobileMenu);
} else {
    initMobileMenu();
}

// Keep global for safety, though event listener is preferred
window.toggleMobileMenu = function () {
    const navLinks = document.getElementById('navLinks');
    if (navLinks) navLinks.classList.toggle('active');
};

// Button Loading State Helper
function setLoading(btn, isLoading, text = null) {
    if (!btn) return;
    if (isLoading) {
        btn.dataset.originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true" style="width: 1rem; height: 1rem; border-width: 0.15em; display: inline-block; vertical-align: text-bottom; border: 2px solid currentColor; border-right-color: transparent; border-radius: 50%; animation: spin 0.75s linear infinite;"></span> ${text || 'Saving...'}`;

        // Add keyframes if not exists
        if (!document.getElementById('spinner-style')) {
            const style = document.createElement('style');
            style.id = 'spinner-style';
            style.innerHTML = `@keyframes spin { 100% { transform: rotate(360deg); } }`;
            document.head.appendChild(style);
        }
    } else {
        btn.innerHTML = btn.dataset.originalText || (text || 'Save');
        btn.disabled = false;
    }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Toast, LoadingOverlay, Skeleton, ConfirmDialog, formatCurrency, formatNumberShort, formatRelativeTime, debounce, throttle, toggleMobileMenu };
}
