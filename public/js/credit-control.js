// Expose functions globally
window.toggleFreezeCredit = toggleFreezeCredit;
window.adjustCreditLimit = adjustCreditLimit;
window.openCreditLimitModal = openCreditLimitModal;
window.closeCreditLimitModal = closeCreditLimitModal;
window.updateCreditLimit = updateCreditLimit;

document.addEventListener('DOMContentLoaded', async () => {
    // checkAuth(); // Handled by auth.js
    await loadCreditControl();

    const form = document.getElementById('creditLimitForm');
    if (form) {
        form.addEventListener('submit', updateCreditLimit);
    }
});

async function loadCreditControl() {
    try {
        const response = await apiRequest('/api/credit-control');
        if (!response) return;

        const buckets = await response.json();
        displayAgingBuckets(buckets);
        displayRiskRetailers(buckets);

        // Load cash-only retailers
        await loadCashOnlyRetailers();
    } catch (error) {
        console.error('Error loading credit control:', error);
        if (window.Toast) Toast.error('Failed to load credit control data');
    }
}

function displayAgingBuckets(buckets) {
    const container = document.getElementById('agingBuckets');
    if (!container) return;

    const totals = {
        '0-7': buckets['0-7']?.reduce((sum, r) => sum + (r.outstanding_amount || 0), 0) || 0,
        '8-15': buckets['8-15']?.reduce((sum, r) => sum + (r.outstanding_amount || 0), 0) || 0,
        '16-30': buckets['16-30']?.reduce((sum, r) => sum + (r.outstanding_amount || 0), 0) || 0,
        '30+': buckets['30+']?.reduce((sum, r) => sum + (r.outstanding_amount || 0), 0) || 0
    };

    const html = `
        <div class="aging-bucket">
            <div class="aging-label">0-7 Days</div>
            <div class="aging-value" style="color: var(--success-color);">${formatCurrency(totals['0-7'])}</div>
            <small style="color: var(--text-light); display: block; margin-top: 4px;">${buckets['0-7']?.length || 0} retailers</small>
        </div>
        <div class="aging-bucket">
            <div class="aging-label">8-15 Days</div>
            <div class="aging-value" style="color: var(--warning-color);">${formatCurrency(totals['8-15'])}</div>
            <small style="color: var(--text-light); display: block; margin-top: 4px;">${buckets['8-15']?.length || 0} retailers</small>
        </div>
        <div class="aging-bucket">
            <div class="aging-label">16-30 Days</div>
            <div class="aging-value" style="color: #f59e0b;">${formatCurrency(totals['16-30'])}</div>
            <small style="color: var(--text-light); display: block; margin-top: 4px;">${buckets['16-30']?.length || 0} retailers</small>
        </div>
        <div class="aging-bucket overdue" style="background: rgba(239, 68, 68, 0.05); border-color: rgba(239, 68, 68, 0.2);">
            <div class="aging-label" style="color: #dc2626;">30+ Days</div>
            <div class="aging-value" style="color: #dc2626;">${formatCurrency(totals['30+'])}</div>
            <small style="color: #ef4444; display: block; margin-top: 4px;">${buckets['30+']?.length || 0} retailers</small>
        </div>
    `;
    container.innerHTML = html;
}

function displayRiskRetailers(buckets) {
    const tbody = document.getElementById('riskRetailersBody');
    if (!tbody) return;

    // Combine all buckets and sort by risk
    const allRetailers = [
        ...(buckets['30+'] || []),
        ...(buckets['16-30'] || []),
        ...(buckets['8-15'] || []),
        ...(buckets['0-7'] || [])
    ].sort((a, b) => {
        // Sort by days outstanding first, then by amount
        if (b.days_outstanding !== a.days_outstanding) {
            return b.days_outstanding - a.days_outstanding;
        }
        return b.outstanding_amount - a.outstanding_amount;
    });

    if (allRetailers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center" style="padding: 30px;">✅ No retailers with outstanding credit</td></tr>';
        return;
    }

    const userData = JSON.parse(localStorage.getItem('userData') || '{}');
    const canEdit = userData.role === 'owner' || userData.role === 'accountant';

    const rowsHtml = allRetailers.slice(0, 10).map(retailer => {
        const daysOut = retailer.days_outstanding || 0;
        let daysClass = '';
        if (daysOut > 30) daysClass = 'days-critical';
        else if (daysOut > 15) daysClass = 'days-warning';

        const limitExceeded = retailer.outstanding_amount > retailer.credit_limit;
        const creditClass = retailer.credit_class || 'D';

        return `
            <tr>
                <td>
                    <strong>${escapeHtml(retailer.name)}</strong>
                    ${retailer.credit_frozen ? '<span style="display: inline-block; margin-left: 8px; padding: 2px 8px; background: rgba(239, 68, 68, 0.1); color: #dc2626; border-radius: 4px; font-size: 11px; font-weight: 600;">❄️ FROZEN</span>' : ''}
                </td>
                <td style="font-weight: 600; color: var(--text-color);">${formatCurrency(retailer.outstanding_amount)}</td>
                <td>
                    ${formatCurrency(retailer.credit_limit)}
                    ${limitExceeded ? '<span style="display: inline-block; margin-left: 8px; color: #dc2626;" title="Limit Exceeded">⚠️</span>' : ''}
                </td>
                <td>
                    <span class="days-badge ${daysClass}">${daysOut} days</span>
                </td>
                <td>
                    <span class="credit-class credit-${creditClass.toUpperCase()}">${escapeHtml(creditClass)}</span>
                </td>
                <td>
                    ${canEdit ? `
                        <div style="display: flex; gap: 8px;">
                            <button class="action-btn ${retailer.credit_frozen ? '' : 'freeze'}" 
                                    onclick="toggleFreezeCredit(${retailer.id}, ${retailer.credit_frozen ? 0 : 1})"
                                    title="${retailer.credit_frozen ? 'Unfreeze Credit' : 'Freeze Credit'}">
                                ${retailer.credit_frozen ? '✓' : '❄️'}
                            </button>
                            <button class="action-btn limit" 
                                    onclick="openCreditLimitModal(${retailer.id}, '${escapeHtml(retailer.name)}', ${retailer.credit_limit})"
                                    title="Edit Credit Limit">
                                ✎
                            </button>
                        </div>
                    ` : '-'}
                </td>
            </tr>
        `;
    }).join('');

    tbody.innerHTML = rowsHtml;
}

async function loadCashOnlyRetailers() {
    const tbody = document.getElementById('cashOnlyBody');
    if (!tbody) return;

    try {
        // This might be heavy if lots of retailers, but okay for prototype
        const response = await apiRequest('/api/retailers');
        if (!response) return;

        const retailers = await response.json();
        const cashOnly = retailers.filter(r => (r.credit_limit || 0) === 0);

        if (cashOnly.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" class="text-center" style="padding: 20px;">No cash-only retailers</td></tr>';
            return;
        }

        const rowsHtml = cashOnly.slice(0, 10).map(r => `
            <tr>
                <td><strong>${escapeHtml(r.name)}</strong></td>
                <td>${escapeHtml(r.area || '-')}</td>
                <td style="color: var(--success-color); font-weight: 600;">Monthly Profit Coming Soon</td>
            </tr>
        `).join('');

        tbody.innerHTML = rowsHtml;
    } catch (error) {
        console.error('Error loading cash-only retailers:', error);
    }
}

async function toggleFreezeCredit(retailerId, freeze) {
    if (!confirm(`Are you sure you want to ${freeze ? 'freeze' : 'unfreeze'} credit for this retailer?`)) {
        return;
    }

    try {
        const response = await apiRequest(`/api/retailers/${retailerId}`, {
            method: 'PUT',
            body: JSON.stringify({ credit_frozen: freeze })
        });

        if (response && response.ok) {
            if (window.Toast) Toast.success(`Credit ${freeze ? 'frozen' : 'unfrozen'} successfully`);
            await loadCreditControl();
        } else {
            if (window.Toast) Toast.error('Failed to update credit status');
        }
    } catch (error) {
        if (window.Toast) Toast.error('Error updating credit status');
    }
}

// Modal handling
function openCreditLimitModal(id, name, currentLimit) {
    const modal = document.getElementById('creditLimitModal');
    if (modal) {
        document.getElementById('limitRetailerId').value = id;
        document.getElementById('limitRetailerName').value = name;
        document.getElementById('newCreditLimit').value = currentLimit;
        modal.style.display = 'block';
    }
}

function closeCreditLimitModal() {
    const modal = document.getElementById('creditLimitModal');
    if (modal) modal.style.display = 'none';
}

async function updateCreditLimit(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    setLoading(btn, true);

    const retailerId = document.getElementById('limitRetailerId').value;
    const newLimit = parseFloat(document.getElementById('newCreditLimit').value);

    try {
        const response = await apiRequest(`/api/retailers/${retailerId}`, {
            method: 'PUT',
            body: JSON.stringify({ credit_limit: newLimit })
        });

        if (response && response.ok) {
            if (window.Toast) Toast.success('Credit limit updated');
            closeCreditLimitModal();
            await loadCreditControl();
        } else {
            if (window.Toast) Toast.error('Failed to update limit');
        }
    } catch (e) {
        if (window.Toast) Toast.error('Error updating limit');
    } finally {
        setLoading(btn, false);
    }
}

// Keep the old prompt version as fallback if needed, but removing for now
function adjustCreditLimit(retailerId) {
    // Deprecated in favor of modal
    console.warn('adjustCreditLimit is deprecated, use openCreditLimitModal');
}

function displayAgingBuckets(buckets) {
    const container = document.getElementById('agingBuckets');
    if (!container) return;

    // Simulate loading if needed, or if already loaded, just render
    // If skeleton is already there, it will be replaced

    const totals = {
        '0-7': buckets['0-7']?.reduce((sum, r) => sum + (r.outstanding_amount || 0), 0) || 0,
        '8-15': buckets['8-15']?.reduce((sum, r) => sum + (r.outstanding_amount || 0), 0) || 0,
        '16-30': buckets['16-30']?.reduce((sum, r) => sum + (r.outstanding_amount || 0), 0) || 0,
        '30+': buckets['30+']?.reduce((sum, r) => sum + (r.outstanding_amount || 0), 0) || 0
    };

    // Calculate percentages for simple visual or just show counts

    const html = `
        <div class="aging-bucket">
            <div class="aging-label">0-7 Days</div>
            <div class="aging-value" style="color: var(--success-color);">${formatCurrency(totals['0-7'])}</div>
            <small style="color: var(--text-light); display: block; margin-top: 4px;">${buckets['0-7']?.length || 0} retailers</small>
        </div>
        <div class="aging-bucket">
            <div class="aging-label">8-15 Days</div>
            <div class="aging-value" style="color: var(--warning-color);">${formatCurrency(totals['8-15'])}</div>
            <small style="color: var(--text-light); display: block; margin-top: 4px;">${buckets['8-15']?.length || 0} retailers</small>
        </div>
        <div class="aging-bucket">
            <div class="aging-label">16-30 Days</div>
            <div class="aging-value" style="color: #f59e0b;">${formatCurrency(totals['16-30'])}</div>
            <small style="color: var(--text-light); display: block; margin-top: 4px;">${buckets['16-30']?.length || 0} retailers</small>
        </div>
        <div class="aging-bucket overdue" style="background: linear-gradient(135deg, rgba(254, 226, 226, 0.5) 0%, rgba(254, 202, 202, 0.5) 100%); border-color: rgba(239, 68, 68, 0.2);">
            <div class="aging-label" style="color: #dc2626;">30+ Days</div>
            <div class="aging-value" style="color: #dc2626;">${formatCurrency(totals['30+'])}</div>
            <small style="color: #ef4444; display: block; margin-top: 4px;">${buckets['30+']?.length || 0} retailers</small>
        </div>
    `;
    container.innerHTML = html;
}

function displayRiskRetailers(buckets) {
    const tbody = document.getElementById('riskRetailersBody');
    if (!tbody) return;

    // Combine all buckets and sort by risk
    const allRetailers = [
        ...(buckets['30+'] || []),
        ...(buckets['16-30'] || []),
        ...(buckets['8-15'] || []),
        ...(buckets['0-7'] || [])
    ].sort((a, b) => {
        // Sort by days outstanding first, then by amount
        if (b.days_outstanding !== a.days_outstanding) {
            return b.days_outstanding - a.days_outstanding;
        }
        return b.outstanding_amount - a.outstanding_amount;
    });

    if (allRetailers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center" style="padding: 30px;">✅ No retailers with outstanding credit</td></tr>';
        return;
    }

    const userData = JSON.parse(localStorage.getItem('userData') || '{}');
    const canEdit = userData.role === 'owner' || userData.role === 'accountant';

    const rowsHtml = allRetailers.slice(0, 10).map(retailer => {
        const daysOut = retailer.days_outstanding || 0;
        let daysClass = '';
        if (daysOut > 30) daysClass = 'days-critical';
        else if (daysOut > 15) daysClass = 'days-warning';

        const limitExceeded = retailer.outstanding_amount > retailer.credit_limit;

        const creditClass = retailer.credit_class || 'D';

        return `
            <tr>
                <td>
                    <strong>${escapeHtml(retailer.name)}</strong>
                    ${retailer.credit_frozen ? '<span style="display: inline-block; margin-left: 8px; padding: 2px 8px; background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%); color: #dc2626; border-radius: 4px; font-size: 11px; font-weight: 600;">❄️ FROZEN</span>' : ''}
                </td>
                <td style="font-weight: 600; color: var(--text-color);">${formatCurrency(retailer.outstanding_amount)}</td>
                <td>
                    ${formatCurrency(retailer.credit_limit)}
                    ${limitExceeded ? '<span style="display: inline-block; margin-left: 8px; padding: 2px 8px; background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%); color: #dc2626; border-radius: 4px; font-size: 11px; font-weight: 600;">⚠️</span>' : ''}
                </td>
                <td>
                    <span class="days-badge ${daysClass}">${daysOut} days</span>
                </td>
                <td>
                    <span class="credit-class credit-${creditClass.toUpperCase()}">${escapeHtml(creditClass)}</span>
                </td>
                <td>
                    ${canEdit ? `
                        <button class="action-btn ${retailer.credit_frozen ? '' : 'freeze'}" 
                                onclick="toggleFreezeCredit(${retailer.id}, ${retailer.credit_frozen ? 0 : 1})"
                                title="${retailer.credit_frozen ? 'Unfreeze Credit' : 'Freeze Credit'}">
                            ${retailer.credit_frozen ? '✓' : '❄️'}
                        </button>
                    ` : '-'}
                </td>
            </tr>
        `;
    }).join('');

    tbody.innerHTML = rowsHtml;
}

async function loadCashOnlyRetailers() {
    const tbody = document.getElementById('cashOnlyBody');
    if (tbody) {
        tbody.innerHTML = Array(3).fill(0).map(() => `
            <tr>
                <td><div class="skeleton" style="width: 150px; height: 20px;"></div></td>
                <td><div class="skeleton" style="width: 100px; height: 20px;"></div></td>
                <td><div class="skeleton" style="width: 100px; height: 20px;"></div></td>
            </tr>
        `).join('');
    }

    try {
        const response = await apiRequest('/api/retailers');
        if (!response) return;

        const retailers = await response.json();
        const cashOnly = retailers.filter(r => (r.credit_limit || 0) === 0);


        if (cashOnly.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" class="text-center">No cash-only retailers</td></tr>';
            return;
        }

        const rowsHtml = cashOnly.map(r => `
            <tr>
                <td><strong>${escapeHtml(r.name)}</strong></td>
                <td>${escapeHtml(r.area || '-')}</td>
                <td style="color: var(--success-color); font-weight: 600;">+${formatCurrency(r.monthly_profit || 0)}</td>
            </tr>
        `).join('');

        tbody.innerHTML = rowsHtml;
    } catch (error) {
        console.error('Error loading cash-only retailers:', error);
        if (tbody) tbody.innerHTML = '<tr><td colspan="3" class="text-center text-danger">Error loading data</td></tr>';
    }
}

async function toggleFreezeCredit(retailerId, freeze) {
    if (!confirm(`Are you sure you want to ${freeze ? 'freeze' : 'unfreeze'} credit for this retailer?`)) {
        return;
    }

    try {
        const response = await apiRequest(`/api/retailers/${retailerId}`, {
            method: 'PUT',
            body: JSON.stringify({ credit_frozen: freeze })
        });

        if (response && response.ok) {
            await loadCreditControl();
        } else {
            alert('Error updating credit status');
        }
    } catch (error) {
        alert('Error updating credit status');
    }
}

function adjustCreditLimit(retailerId) {
    const newLimit = prompt('Enter new credit limit (₹):');
    if (!newLimit || isNaN(newLimit)) return;

    const limit = parseFloat(newLimit);
    if (limit < 0) {
        alert('Credit limit must be positive');
        return;
    }

    apiRequest(`/api/retailers/${retailerId}`, {
        method: 'PUT',
        body: JSON.stringify({ credit_limit: limit })
    }).then(async (response) => {
        if (response && response.ok) {
            await loadCreditControl();
        } else {
            alert('Error updating credit limit');
        }
    }).catch(() => {
        alert('Error updating credit limit');
    });
}

