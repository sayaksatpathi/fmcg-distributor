// Expose globally
window.openCreateTargetModal = openCreateTargetModal;
window.closeTargetModal = closeTargetModal;
window.saveTarget = saveTarget;

document.addEventListener('DOMContentLoaded', () => {
    // checkAuth(); // Handled by auth.js

    // Check Permissions
    try {
        const userData = JSON.parse(localStorage.getItem('userData') || '{}');
        // Show create button for owners/accountants
        if (userData.role === 'owner' || userData.role === 'accountant') {
            const btn = document.getElementById('createTargetBtn');
            if (btn) btn.style.display = 'block'; // Make visible
        }
    } catch (e) { console.error('Error checking permissions', e); }

    loadSummary();
    loadTargets();
    loadLeaderboard();

    const form = document.getElementById('targetForm');
    if (form) form.addEventListener('submit', saveTarget);
});

async function loadTargets() {
    const container = document.getElementById('targetsContainer');
    if (!container) return;

    // Skeleton
    container.innerHTML = Array(3).fill(0).map(() => `
        <div class="target-card">
            <div class="skeleton" style="width: 50%; height: 24px; margin-bottom: 12px; border-radius: 6px;"></div>
            <div class="skeleton" style="width: 30%; height: 16px; margin-bottom: 24px; border-radius: 4px;"></div>
            <div class="skeleton" style="width: 100%; height: 12px; border-radius: 6px;"></div>
        </div>
    `).join('');

    try {
        const response = await apiRequest('/api/sales-targets/current');
        if (!response) throw new Error('Network error');

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error || `Server error: ${response.status}`);
        }

        const targets = await response.json();

        if (!Array.isArray(targets) || targets.length === 0) {
            container.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--text-light);">
                    <div style="font-size: 48px; margin-bottom: 16px;">🎯</div>
                    <h3>No Active Targets</h3>
                    <p>There are no active sales targets for this month.</p>
                </div>`;
            return;
        }

        container.innerHTML = targets.map(t => {
            const percent = Math.min(Math.round(t.achievement_percentage || 0), 100);
            const isCompleted = percent >= 100;
            const progressColor = isCompleted ? '#22c55e' : 'var(--primary-color)';

            return `
            <div class="target-card" style="border-left: 4px solid ${progressColor};">
                <div class="target-header">
                    <div>
                        <span class="target-name">${escapeHtml(t.name)}</span>
                        <span class="target-meta">Ends in ${t.days_remaining} days</span>
                    </div>
                     ${isCompleted ? '<span style="font-size: 20px;">🎉</span>' : ''}
                </div>
                
                <div class="target-stats">
                    <span class="current-amount">${formatCurrency(t.achieved_amount)}</span>
                    <span class="target-total">/ ${formatCurrency(t.target_amount)}</span>
                </div>

                <div class="progress-bar-bg">
                    <div class="progress-bar-fill" style="width: ${percent}%; background: ${progressColor};"></div>
                </div>
                <div class="achievement-badge" style="color: ${progressColor};">
                    ${t.achievement_percentage}% Achieved
                </div>
            </div>
        `}).join('');
    } catch (e) {
        console.error('loadTargets error:', e);
        container.innerHTML = `<div class="text-center text-danger" style="grid-column: 1/-1;">Error loading targets: ${escapeHtml(e.message)}</div>`;
    }
}

async function loadLeaderboard() {
    const tbody = document.getElementById('leaderboardBody');
    if (!tbody) return;

    // Show skeleton loaders first
    tbody.innerHTML = Array(5).fill(0).map(() => `
        <tr>
            <td><div class="skeleton" style="width: 32px; height: 32px; border-radius: 50%;"></div></td>
            <td><div class="skeleton" style="width: 120px; height: 18px;"></div></td>
            <td><div class="skeleton" style="width: 80px; height: 18px;"></div></td>
            <td><div class="skeleton" style="width: 60px; height: 24px; border-radius: 99px;"></div></td>
        </tr>
    `).join('');

    try {
        const response = await apiRequest('/api/sales-targets/leaderboard?period=monthly');
        if (!response) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center" style="padding: 24px; color: var(--text-light);">Unable to load leaderboard data</td></tr>';
            return;
        }
        const data = await response.json();

        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center" style="padding: 24px; color: var(--text-light);">No leaderboard data available</td></tr>';
            return;
        }

        tbody.innerHTML = data.map((u, index) => {
            const rank = index + 1;
            let rankClass = '';
            if (rank === 1) rankClass = 'rank-1';
            if (rank === 2) rankClass = 'rank-2';
            if (rank === 3) rankClass = 'rank-3';

            return `
            <tr>
                <td><span class="rank-badge ${rankClass}">${rank}</span></td>
                <td style="font-weight: 600;">${escapeHtml(u.username)}</td>
                <td style="font-family: 'Inter', sans-serif; font-weight: 700;">${formatCurrency(u.total_revenue)}</td>
                <td>
                    <span style="padding: 4px 10px; border-radius: 99px; background: ${u.achievement_percentage >= 100 ? '#dcfce7' : '#e0e7ff'}; color: ${u.achievement_percentage >= 100 ? '#166534' : '#4338ca'}; font-weight: 600; font-size: 12px;">
                        ${(u.achievement_percentage || 0).toFixed(1)}%
                    </span>
                </td>
            </tr>
        `}).join('');
    } catch (e) {
        console.error('Leaderboard error:', e);
        tbody.innerHTML = '<tr><td colspan="4" class="text-center" style="padding: 24px; color: var(--danger-color);">Error loading leaderboard</td></tr>';
    }
}

async function loadSummary() {
    try {
        const response = await apiRequest('/api/sales-targets/summary');
        if (!response) return;
        const data = await response.json();

        const summaryDiv = document.getElementById('targetSummary');
        if (summaryDiv) {
            summaryDiv.innerHTML = `
                <div class="widget">
                    <div class="widget-header">Total Target</div>
                    <div class="widget-value">${formatCurrency(data.totalTarget || 0)}</div>
                </div>
                 <div class="widget">
                    <div class="widget-header">Total Achieved</div>
                    <div class="widget-value">${formatCurrency(data.totalAchieved || 0)}</div>
                </div>
                 <div class="widget">
                    <div class="widget-header">Overall Progress</div>
                    <div class="widget-value" style="color: ${(data.overallPercentage || 0) >= 100 ? '#22c55e' : 'inherit'}">
                        ${(data.overallPercentage || 0).toFixed(1)}%
                    </div>
                </div>
            `;
        }
    } catch (e) { console.error(e); }
}

// Modal Logic
let usersList = [];

async function loadUsers() {
    try {
        const response = await apiRequest('/api/users');
        if (response && response.ok) {
            usersList = await response.json();
            const select = document.getElementById('assignedTo');
            if (select) {
                // Filter for sales staff only later if needed
                select.innerHTML = '<option value="">Overall Company Target</option>' +
                    usersList.map(u => `<option value="${u.id}">${escapeHtml(u.username)} (${u.role})</option>`).join('');
            }
        }
    } catch (e) { console.error('Failed to load users for targets', e); }
}

function openCreateTargetModal() {
    const modal = document.getElementById('targetModal');
    const form = document.getElementById('targetForm');
    if (!modal || !form) return;

    form.reset();
    document.getElementById('targetId').value = '';
    document.getElementById('modalTitle').textContent = 'Set Sales Target';

    // Default dates (This Month)
    const now = new Date();
    // YYYY-MM-DD local format
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    // Simple ISO for input value
    const formatDate = (d) => {
        return d.toLocaleDateString('en-CA'); // Gets YYYY-MM-DD
    };

    document.getElementById('startDate').value = formatDate(start);
    document.getElementById('endDate').value = formatDate(end);
    document.getElementById('targetName').value = `Goal - ${now.toLocaleString('default', { month: 'long' })} ${now.getFullYear()}`;

    modal.style.display = 'block';

    // Load users if not loaded
    if (usersList.length === 0) loadUsers();
}

function closeTargetModal() {
    const modal = document.getElementById('targetModal');
    if (modal) modal.style.display = 'none';
}

async function saveTarget(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    setLoading(btn, true);

    const id = document.getElementById('targetId').value;
    const assignedTo = document.getElementById('assignedTo').value;

    const target = {
        name: document.getElementById('targetName').value,
        target_amount: parseFloat(document.getElementById('targetAmount').value),
        start_date: document.getElementById('startDate').value,
        end_date: document.getElementById('endDate').value,
        target_type: assignedTo ? 'salesperson' : 'overall',
        assigned_to: assignedTo ? parseInt(assignedTo) : null,
        period: 'monthly'
    };

    try {
        const url = id ? `/api/sales-targets/${id}` : '/api/sales-targets';
        const method = id ? 'PUT' : 'POST';

        const response = await apiRequest(url, {
            method: method,
            body: JSON.stringify(target)
        });

        if (response && response.ok) {
            Toast.success('Target Saved Successfully');
            closeTargetModal();
            loadTargets();
            loadSummary();
        } else {
            const err = await response.json();
            throw new Error(err.error || 'Failed to save target');
        }
    } catch (error) {
        Toast.error(error.message);
    } finally {
        setLoading(btn, false);
    }
}
