// Expose functions globally
window.openReturnModal = openReturnModal;
window.closeModal = closeModal;
window.loadReturns = loadReturns;
window.handleCreateReturn = handleCreateReturn;
window.approveReturn = approveReturn;
window.rejectReturn = rejectReturn;
window.processReturn = processReturn;

document.addEventListener('DOMContentLoaded', () => {
    // checkAuth(); // Removed - handled by auth.js
    loadReturns('pending');
    loadRetailers();
    loadSkus();

    const form = document.getElementById('createReturnForm');
    if (form) form.addEventListener('submit', handleCreateReturn);
});

async function loadReturns(status) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    // Find button with matching onclick
    const activeBtn = Array.from(document.querySelectorAll('.tab-btn')).find(b => b.getAttribute('onclick')?.includes(status));
    if (activeBtn) activeBtn.classList.add('active');

    const tbody = document.getElementById('returnsTableBody');
    if (!tbody) return;

    // Skeleton State
    tbody.innerHTML = Array(5).fill(0).map(() => `
        <tr>
            <td><div class="skeleton skeleton-text" style="width: 80px;"></div></td>
            <td><div class="skeleton skeleton-text" style="width: 100px;"></div></td>
            <td><div class="skeleton skeleton-text" style="width: 120px;"></div></td>
            <td><div class="skeleton skeleton-text" style="width: 150px;"></div></td>
            <td><div class="skeleton skeleton-text" style="width: 80px;"></div></td>
            <td><div class="skeleton skeleton-text" style="width: 80px;"></div></td>
            <td><div class="skeleton skeleton-text" style="width: 80px;"></div></td>
            <td><div class="skeleton skeleton-text" style="width: 60px;"></div></td>
        </tr>
    `).join('');

    try {
        const response = await apiRequest(`/api/returns?status=${status}&limit=50`);
        if (!response) return;
        const data = await response.json();
        const returns = data.returns || [];

        if (returns.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align: center; padding: 60px;">
                        <div style="font-size: 32px; margin-bottom: 12px; opacity: 0.7;">📦</div>
                        <h4 style="color: var(--text-color);">No returns found</h4>
                        <p style="color: var(--text-light); font-size: 14px;">There are no ${status} returns to show.</p>
                    </td>
                </tr>`;
            return;
        }

        tbody.innerHTML = returns.map(r => `
            <tr>
                <td><span class="po-number">#${escapeHtml(r.return_number)}</span></td>
                <td>
                    <div style="font-weight: 500;">${formatDate(r.return_date)}</div>
                    <div style="font-size: 11px; color: var(--text-light);">${formatRelativeTime ? formatRelativeTime(r.return_date) : ''}</div>
                </td>
                <td><div style="font-weight: 600;">${escapeHtml(r.retailer_name)}</div></td>
                <td>
                    <div style="font-weight: 500;">${escapeHtml(r.sku_name)}</div>
                    <div style="font-size: 12px; color: var(--text-light);">Qty: ${r.quantity}</div>
                </td>
                <td><span class="return-type-badge type-${r.return_type}">${r.return_type.replace(/_/g, ' ')}</span></td>
                <td style="font-family: 'Inter', sans-serif;">${formatCurrency(r.refund_amount)}</td>
                <td>
                    <span class="status-badge ${r.status}">
                        ${r.status}
                    </span>
                </td>
                <td>
                    ${r.status === 'pending' ? `
                        <div style="display: flex; gap: 8px;">
                            <button class="btn btn-sm btn-success" onclick="approveReturn(${r.id})" title="Approve">✓</button>
                            <button class="btn btn-sm btn-danger" onclick="rejectReturn(${r.id})" title="Reject">✕</button>
                        </div>
                    ` : ''}
                    ${r.status === 'approved' ? `
                         <button class="btn btn-sm btn-primary" onclick="processReturn(${r.id})">Process</button>
                    ` : ''}
                    ${r.status !== 'pending' && r.status !== 'approved' ? '<span class="text-muted" style="font-size: 12px;">-</span>' : ''}
                </td>
            </tr>
        `).join('');

    } catch (error) {
        console.error(error);
        if (window.Toast) Toast.error('Failed to load returns');
        tbody.innerHTML = '<tr><td colspan="8" class="text-center text-danger">Failed to load data</td></tr>';
    }
}

async function loadRetailers() {
    try {
        const response = await apiRequest('/api/retailers');
        if (!response) return;
        const data = await response.json();
        // Handle both array and object response formats
        const retailers = Array.isArray(data) ? data : (data.retailers || []);
        const select = document.getElementById('retailerSelect');
        if (select && retailers.length > 0) {
            select.innerHTML = '<option value="">Select Retailer...</option>' +
                retailers.map(r => `<option value="${r.id}">${escapeHtml(r.name)}</option>`).join('');
        }
    } catch (e) { console.error('Error loading retailers', e); }
}

async function loadSkus() {
    try {
        const response = await apiRequest('/api/skus');
        if (!response) return;
        const data = await response.json();
        // Handle both array and object response formats
        const items = Array.isArray(data) ? data : (data.skus || []);
        const select = document.getElementById('skuSelect');
        if (select && items.length > 0) {
            select.innerHTML = '<option value="">Select Product...</option>' +
                items.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');
        }
    } catch (e) { console.error('Error loading SKUs', e); }
}

async function handleCreateReturn(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    setLoading(btn, true);

    const formData = new FormData(e.target);
    const payload = Object.fromEntries(formData.entries());

    // Convert types
    payload.quantity = parseInt(payload.quantity);
    payload.retailer_id = parseInt(payload.retailer_id);
    payload.sku_id = parseInt(payload.sku_id);

    try {
        const response = await apiRequest('/api/returns', {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        if (response && response.ok) {
            Toast.success('Return Logged Successfully');
            closeModal('returnModal');
            e.target.reset();
            loadReturns('pending');
        } else {
            const err = await response.json();
            throw new Error(err.error || 'Failed');
        }
    } catch (error) {
        Toast.error(error.message || 'Failed to create return');
    } finally {
        setLoading(btn, false);
    }
}

async function approveReturn(id) {
    if (!confirm('Approve this return?')) return;
    try {
        const response = await apiRequest(`/api/returns/${id}/approve`, { method: 'PUT' });
        if (response.ok) {
            Toast.success('Return Approved');
            loadReturns('pending');
        }
    } catch (e) { Toast.error(e.message); }
}

async function rejectReturn(id) {
    if (!confirm('Reject this return?')) return;
    try {
        const response = await apiRequest(`/api/returns/${id}/reject`, { method: 'PUT' });
        if (response.ok) {
            Toast.success('Return Rejected');
            loadReturns('pending');
        }
    } catch (e) { Toast.error(e.message); }
}

async function processReturn(id) {
    if (!confirm('Process this return (Update stock/credits)?')) return;
    try {
        const response = await apiRequest(`/api/returns/${id}/process`, { method: 'PUT' });
        if (response.ok) {
            Toast.success('Return Processed');
            loadReturns('approved');
        }
    } catch (e) { Toast.error(e.message); }
}

function openReturnModal() {
    const modal = document.getElementById('returnModal');
    if (modal) modal.style.display = 'block';
}

function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.style.display = 'none';
}

// Duplicate functions removed - keeping only the first declarations above
