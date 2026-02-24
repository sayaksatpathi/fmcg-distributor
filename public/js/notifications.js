/**
 * Shared Notification System
 * Handles fetching, displaying, and managing alerts across all pages
 */

(function () {
    'use strict';

    // State
    const state = {
        alerts: [],
        knownAlertIds: new Set(),
        isFirstLoad: true
    };

    /**
     * Initialize the notification system
     */
    async function init() {
        console.log('Initializing Notification System...');

        // Attach event listeners to global scope for HTML onclick handlers
        window.toggleNotifications = toggleNotifications;
        window.markAllRead = markAllRead;

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            const wrapper = document.querySelector('.notification-wrapper');
            const dropdown = document.getElementById('notificationDropdown');

            if (wrapper && !wrapper.contains(e.target) && dropdown && dropdown.classList.contains('active')) {
                dropdown.classList.remove('active');
            }
        });

        // Initial fetch
        await fetchNotifications();

        // Poll for updates every 60 seconds
        setInterval(fetchNotifications, 60000);
    }

    /**
     * Fetch alerts from the backend
     */
    async function fetchNotifications() {
        try {
            // Use apiRequest if available (from auth.js), otherwise fallback or fail gracefully
            if (typeof window.apiRequest !== 'function') {
                console.warn('Authentication system not loaded. Notification fetch skipped.');
                return;
            }

            const response = await window.apiRequest('/api/inventory-alerts');
            if (!response) return;

            const alerts = await response.json();

            // Filter only active alerts for the list (unless we want to show history)
            // Assuming endpoint returns active alerts as per previous analysis
            state.alerts = alerts;

            renderNotifications();
            checkNewAlerts();

        } catch (error) {
            console.error('Failed to fetch notifications:', error);
        }
    }

    /**
     * Render the badge and notification list
     */
    function renderNotifications() {
        const badge = document.getElementById('notificationBadge');
        const list = document.getElementById('notificationList');

        if (!list) return; // Notification center not present in DOM

        const count = state.alerts.length;

        // Update Badge
        if (badge) {
            if (count > 0) {
                badge.style.display = 'flex';
                badge.textContent = count > 9 ? '9+' : count;
            } else {
                badge.style.display = 'none';
            }
        }

        // Render List
        if (count === 0) {
            list.innerHTML = `
                <div class="notification-empty">
                    <div>No new notifications</div>
                    <div style="font-size: 12px; font-weight: 400; color: var(--text-light);">You're all caught up! 🌤️</div>
                </div>`;
        } else {
            list.innerHTML = state.alerts.map(alert => {
                const severityClass = alert.severity === 'red' ? 'critical' : 'warning';
                const icon = alert.severity === 'red' ? '⚡' : '⚠️';
                const timeAgo = alert.created_at ? formatRelativeTime(alert.created_at) : 'Just now';

                return `
                <div class="notification-item ${severityClass} unread">
                    <div class="icon-wrapper">
                        ${icon}
                    </div>
                    <div class="content">
                        <div class="title">${alert.alert_type ? alert.alert_type.replace(/_/g, ' ') : 'Alert'}</div>
                        <div class="message">${escapeHtml(alert.message)}</div>
                        <div class="time">${timeAgo}</div>
                    </div>
                </div>
            `}).join('');
        }
    }

    /**
     * Check for new alerts to show toast popups
     */
    function checkNewAlerts() {
        if (!state.isFirstLoad && window.Toast) {
            state.alerts.forEach(alert => {
                if (!state.knownAlertIds.has(alert.id)) {
                    const type = alert.severity === 'red' ? 'error' : 'warning';
                    const title = alert.severity === 'red' ? 'Critical Alert' : 'Warning';

                    window.Toast.show({
                        type: type,
                        title: title,
                        message: alert.message,
                        duration: 5000
                    });
                }
            });
        }

        // Update known set
        state.knownAlertIds = new Set(state.alerts.map(a => a.id));
        state.isFirstLoad = false;
    }

    /**
     * Toggle dropdown visibility
     */
    function toggleNotifications() {
        const dropdown = document.getElementById('notificationDropdown');
        if (dropdown) dropdown.classList.toggle('active');
    }

    /**
     * Mark all notifications as read
     */
    async function markAllRead() {
        try {
            const response = await window.apiRequest('/api/inventory-alerts/mark-all-read', { method: 'POST' });
            if (response && response.ok) {
                if (window.Toast) window.Toast.success('All notifications dismissed');

                // Clear local state immediately for responsiveness
                state.alerts = [];
                renderNotifications();
            }
        } catch (e) {
            console.error('Failed to mark read', e);
            if (window.Toast) window.Toast.error('Failed to dismiss notifications');
        }
    }

    // Utilities
    function formatRelativeTime(dateString) {
        if (!dateString) return 'Just now';
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return 'Just now';

        const now = new Date();
        const diffInSeconds = Math.floor((now - date) / 1000);

        if (diffInSeconds < 60) return 'Just now';
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
        return `${Math.floor(diffInSeconds / 86400)}d ago`;
    }

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Expose public API
    window.NotificationSystem = {
        init,
        fetch: fetchNotifications,
        update: (alerts) => {
            // Allows external modules (like dashboard config) to push data
            state.alerts = alerts;
            renderNotifications();
            checkNewAlerts();
        }
    };

})();
