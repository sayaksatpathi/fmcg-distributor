// Dashboard functionality
document.addEventListener('DOMContentLoaded', async () => {
    updateGreeting();
    await loadDashboard();

    // Refresh loop
    setInterval(loadDashboard, 60000);

    // Update greeting every hour
    setInterval(updateGreeting, 3600000);
});

function updateGreeting() {
    const hours = new Date().getHours();
    const titleEl = document.getElementById('dashboardTitle');
    let greeting = 'Owner Dashboard';

    if (hours < 12) greeting = 'Good Morning, Owner';
    else if (hours < 18) greeting = 'Good Afternoon, Owner';
    else greeting = 'Good Evening, Owner';

    if (titleEl) titleEl.textContent = greeting;
}

// Global chart instances registry for cleanup
window.dashboardCharts = {
    sales: null,
    brand: null,
    inventory: null,
    target: null
};

async function loadDashboard() {
    try {
        const response = await apiRequest('/api/dashboard');
        if (!response) return;

        const data = await response.json();

        // 1. Remove Skeletons & Update Data
        updateWidget('todayProfit', data.todayProfit, true);
        updateWidget('monthlyProfit', data.monthlyProfit, true);
        updateWidget('outstandingCredit', data.outstandingCredit, true);
        updateWidget('capitalLocked', data.capitalLocked, true);

        // Special handling for Amul %
        const amulEl = document.getElementById('amulCapitalPercent');
        if (amulEl) {
            amulEl.classList.remove('skeleton', 'skeleton-text');
            amulEl.textContent = `${data.amulCapitalPercent}%`;
            amulEl.style.color = data.amulCapitalPercent > 40 ? 'var(--danger-color)' : 'var(--text-color)';
        }

        // 2. Update Notifications - Handled by notifications.js

        // 3. Auto-generate alerts
        await checkAndGenerateAlerts(data);

        // 4. Update Time
        const timeEl = document.getElementById('lastUpdated');
        if (timeEl) timeEl.textContent = 'Last updated: ' + new Date().toLocaleTimeString('en-IN');

    } catch (error) {
        console.error('Error loading dashboard:', error);
        if (window.Toast) Toast.error('Failed to load dashboard data');
    }
}

// Auto-generate client-side alerts based on dashboard data
async function checkAndGenerateAlerts(data) {
    try {
        // Call the backend to auto-generate inventory alerts
        const response = await apiRequest('/api/inventory-alerts/auto-generate', {
            method: 'POST'
        });
        // Silently fail if not authorized or endpoint unavailable
        if (response && response.ok) {
            console.log('Inventory alerts checked successfully');
        }
    } catch (error) {
        // Silently handle - this is a background task
        console.debug('Alert generation skipped:', error.message);
    }
}


function updateWidget(id, value, isCurrency = false) {
    const el = document.getElementById(id);
    if (!el) return;

    // Remove skeleton class
    el.classList.remove('skeleton', 'skeleton-text');

    // Update value
    el.textContent = isCurrency ? formatCurrency(value) : value;
}

// Notification Center Logic handled by notifications.js
// Toggle and Mark Read handled by notifications.js

