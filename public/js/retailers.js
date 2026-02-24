// Expose functions globally
window.editRetailer = editRetailer;
window.deleteRetailer = deleteRetailer;
window.openRetailerModal = openRetailerModal;
window.closeRetailerModal = closeRetailerModal;
window.saveRetailer = saveRetailer;
window.filterRetailers = filterRetailers;

let retailersData = [];

document.addEventListener('DOMContentLoaded', async () => {
    // checkAuth(); // Handled by auth.js

    // Check permissions
    try {
        const userData = JSON.parse(localStorage.getItem('userData') || '{}');
        if (userData.role === 'owner' || userData.role === 'accountant') {
            const btn = document.getElementById('addRetailerBtn');
            if (btn) btn.style.display = 'inline-flex';
        }
    } catch (e) { console.error(e); }

    await loadRetailers();

    const form = document.getElementById('retailerForm');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await saveRetailer();
        });
    }
});

async function loadRetailers() {
    const tbody = document.getElementById('retailersTableBody');
    if (!tbody) return;

    // Skeleton State
    tbody.innerHTML = Array(6).fill(0).map(() => `
        <tr>
            <td><div class="skeleton" style="width: 120px; height: 20px;"></div></td>
            <td><div class="skeleton" style="width: 80px; height: 20px;"></div></td>
            <td><div class="skeleton" style="width: 100px; height: 20px;"></div></td>
            <td><div class="skeleton" style="width: 80px; height: 20px;"></div></td>
            <td><div class="skeleton" style="width: 32px; height: 24px; border-radius: 6px;"></div></td>
            <td><div class="skeleton" style="width: 80px; height: 20px;"></div></td>
            <td><div class="skeleton" style="width: 60px; height: 20px;"></div></td>
            <td><div class="skeleton" style="width: 100px; height: 20px;"></div></td>
            <td><div class="skeleton" style="width: 80px; height: 20px;"></div></td>
            <td><div class="skeleton" style="width: 60px; height: 20px;"></div></td>
        </tr>
    `).join('');

    try {
        const response = await apiRequest('/api/retailers');
        if (!response) {
            tbody.innerHTML = '<tr><td colspan="10" class="text-center text-danger">Failed to load data</td></tr>';
            return;
        }

        retailersData = await response.json();
        displayRetailers(retailersData);
    } catch (error) {
        console.error('Error loading retailers:', error);
        if (window.Toast) Toast.error('Failed to load retailers');
    }
}

function displayRetailers(retailers) {
    const tbody = document.getElementById('retailersTableBody');
    if (!tbody) return;

    if (!Array.isArray(retailers) || retailers.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="10" style="text-align: center; padding: 60px;">
                    <div style="font-size: 40px; margin-bottom: 12px; opacity: 0.5;">👥</div>
                    <h4 style="color: var(--text-color);">No Retailers Found</h4>
                    <p style="color: var(--text-light);">Add your first retailer to get started.</p>
                </td>
            </tr>`;
        return;
    }

    // Sort by profit
    const sortedByProfit = [...retailers].sort((a, b) => (b.monthly_profit || 0) - (a.monthly_profit || 0));

    const rowsHtml = retailers.map((retailer) => {
        const profitRank = sortedByProfit.findIndex(r => r.id === retailer.id) + 1;
        const daysOut = retailer.days_outstanding || 0;
        let statusClass = 'credit-green';

        if (daysOut > 30) statusClass = 'credit-red';
        else if (daysOut > 15) statusClass = 'credit-yellow';

        const userData = JSON.parse(localStorage.getItem('userData') || '{}');
        // Simple permission check
        const canEdit = userData.role === 'owner' || userData.role === 'accountant';

        return `
            <tr>
                <td>
                    <div style="font-weight: 600; color: var(--text-color);">${escapeHtml(retailer.name)}</div>
                </td>
                <td>${escapeHtml(retailer.area || '-')}</td>
                <td><span style="font-family: monospace; letter-spacing: 0.5px; font-weight: 600;">${escapeHtml(retailer.phone || '-')}</span></td>
                <td>${formatCurrency(retailer.credit_limit || 0)}</td>
                <td><span class="credit-class ${retailer.credit_class || 'C'}">${retailer.credit_class || 'C'}</span></td>
                <td>
                    <span style="font-weight: 600; ${retailer.outstanding_amount > 0 ? 'color: var(--danger-color);' : ''}">
                        ${formatCurrency(retailer.outstanding_amount || 0)}
                    </span>
                </td>
                <td>
                    <span class="${statusClass}">${daysOut} days</span>
                </td>
                <td>
                    <div style="font-weight: 600; color: var(--success-color);">${formatCurrency(retailer.monthly_profit || 0)}</div>
                    <div style="font-size: 11px; color: var(--text-light);">Rank #${profitRank}</div>
                </td>
                <td>
                    ${retailer.credit_frozen ?
                '<span class="status-badge" style="background:rgba(239, 68, 68, 0.1); color:#ef4444; border:1px solid rgba(239, 68, 68, 0.2);">FROZEN</span>' :
                '<span class="status-badge" style="background:rgba(34, 197, 94, 0.1); color:#22c55e; border:1px solid rgba(34, 197, 94, 0.2);">Active</span>'}
                </td>
                <td>
                    ${canEdit ? `
                        <div class="action-btns">
                            <button class="btn btn-sm" style="background: var(--bg-color); color: var(--text-color); border: 1px solid var(--border-color);" onclick="editRetailer(${retailer.id})" title="Edit">✎</button>
                            <button class="btn btn-sm" style="background: rgba(239, 68, 68, 0.1); color: var(--danger-color); border: none;" onclick="deleteRetailer(${retailer.id})" title="Delete">🗑️</button>
                        </div>
                    ` : '-'}
                </td>
            </tr>
        `;
    }).join('');

    tbody.innerHTML = rowsHtml;
}

// BUGFIX: Handle ID type correctly (string vs number)
function editRetailer(id) {
    // Force ID to number if possible, or keep as is to match
    const retailer = retailersData.find(r => r.id == id); // Loose equality to catch string '1' vs number 1
    if (retailer) {
        openRetailerModal(retailer);
    } else {
        if (window.Toast) Toast.error('Retailer not found!');
    }
}

function openRetailerModal(retailerData = null) {
    const modal = document.getElementById('retailerModal');
    const form = document.getElementById('retailerForm');
    const title = document.getElementById('modalTitle');

    if (!modal || !form) return;

    form.reset();
    const idInput = document.getElementById('retailerId');
    if (idInput) idInput.value = '';

    if (retailerData) {
        title.textContent = 'Edit Retailer';
        document.getElementById('retailerId').value = retailerData.id;
        document.getElementById('retailerName').value = retailerData.name;
        document.getElementById('retailerArea').value = retailerData.area || '';
        document.getElementById('retailerPhone').value = retailerData.phone || '';
        document.getElementById('creditLimit').value = retailerData.credit_limit || 0;
        document.getElementById('creditClass').value = retailerData.credit_class || 'C';

        // Handle checkbox
        const frozenCheck = document.getElementById('creditFrozen');
        if (frozenCheck) frozenCheck.checked = !!retailerData.credit_frozen;
    } else {
        title.textContent = 'Add Retailer';
    }

    modal.classList.add('active');
}


function closeRetailerModal() {
    const modal = document.getElementById('retailerModal');
    if (modal) modal.classList.remove('active');
}

async function saveRetailer() {
    const btn = document.querySelector('#retailerForm button[type="submit"]');
    setLoading(btn, true);

    const id = document.getElementById('retailerId').value;
    const retailer = {
        name: document.getElementById('retailerName').value,
        area: document.getElementById('retailerArea').value,
        phone: document.getElementById('retailerPhone').value,
        credit_limit: parseFloat(document.getElementById('creditLimit').value),
        credit_class: document.getElementById('creditClass').value,
        credit_frozen: document.getElementById('creditFrozen').checked ? 1 : 0
    };

    try {
        const url = id ? `/api/retailers/${id}` : '/api/retailers';
        const method = id ? 'PUT' : 'POST';

        const response = await apiRequest(url, {
            method: method,
            body: JSON.stringify(retailer)
        });

        if (!response) throw new Error('Network error');

        const data = await response.json();

        if (response.ok) {
            if (window.Toast) Toast.success(id ? 'Retailer updated' : 'Retailer added');
            closeRetailerModal();
            await loadRetailers();
        } else {
            throw new Error(data.error || 'Failed to save retailer');
        }
    } catch (error) {
        console.error(error);
        if (window.Toast) Toast.error(error.message || 'Error saving retailer');
    } finally {
        setLoading(btn, false);
    }
}

async function deleteRetailer(id) {
    if (!confirm('Are you sure you want to delete this retailer? This action cannot be undone.')) return;

    try {
        const response = await apiRequest(`/api/retailers/${id}`, { method: 'DELETE' });
        if (response && response.ok) {
            if (window.Toast) Toast.success('Retailer deleted');
            await loadRetailers();
        } else {
            const data = await response.json();
            if (window.Toast) Toast.error(data.error || 'Failed to delete retailer. They may have related records.');
        }
    } catch (error) {
        console.error(error);
        if (window.Toast) Toast.error('Error deleting retailer');
    }
}

function filterRetailers() {
    const search = document.getElementById('searchRetailer').value.toLowerCase();
    const filtered = retailersData.filter(r =>
        r.name.toLowerCase().includes(search) ||
        (r.area && r.area.toLowerCase().includes(search)) ||
        (r.phone && r.phone.includes(search))
    );
    displayRetailers(filtered);
}
