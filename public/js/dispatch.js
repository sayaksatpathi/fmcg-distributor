// Expose functions globally for HTML onclicks
window.addItemRow = addItemRow;
window.removeItem = removeItem;
window.checkRetailerCredit = checkRetailerCredit;
window.resetForm = resetForm;
window.updateStockDisplay = updateStockDisplay;

let retailersList = [];
let skusList = [];

document.addEventListener('DOMContentLoaded', async () => {
    // checkAuth(); // Handled by auth.js

    // Set default date
    const dateInput = document.getElementById('dispatchDate');
    if (dateInput) {
        dateInput.valueAsDate = new Date();
    }

    await loadRetailers();
    await loadSKUs();
    await loadRecentDispatches();

    const form = document.getElementById('dispatchForm');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await saveDispatch();
        });
    }

    // Add event listeners to SKU dropdowns for stock display (delegation)
    document.getElementById('itemsContainer').addEventListener('change', (e) => {
        if (e.target.classList.contains('item-sku')) {
            updateStockDisplay(e.target);
        }
    });
});

async function loadRetailers() {
    try {
        const response = await apiRequest('/api/retailers');
        if (!response) return;

        retailersList = await response.json();
        const select = document.getElementById('dispatchRetailer');
        if (select) {
            const optionsHtml = '<option value="">Select Retailer</option>' +
                retailersList.map(r => `<option value="${r.id}">${escapeHtml(r.name)}</option>`).join('');
            select.innerHTML = optionsHtml;
        }
    } catch (error) {
        console.error('Error loading retailers:', error);
        if (window.Toast) Toast.error('Failed to load retailers');
    }
}

async function loadSKUs() {
    try {
        const response = await apiRequest('/api/skus');
        if (!response) return;

        skusList = await response.json();
        const data = skusList.skus || skusList; // Handle potential wrapper
        skusList = Array.isArray(data) ? data : [];
        updateSKUDropdowns();
    } catch (error) {
        console.error('Error loading SKUs:', error);
    }
}

function updateSKUDropdowns() {
    document.querySelectorAll('.item-sku').forEach(select => {
        const currentValue = select.value;
        const optionsHtml = '<option value="">Select SKU</option>' +
            skusList.map(s => `<option value="${s.id}" data-stock="${s.stock_in_hand}">${escapeHtml(s.name)} (${escapeHtml(s.brand_name)})</option>`).join('');
        select.innerHTML = optionsHtml;
        if (currentValue) select.value = currentValue;
    });
}

function addItemRow() {
    const container = document.getElementById('itemsContainer');
    const newRow = document.createElement('div');
    newRow.className = 'item-row';
    newRow.innerHTML = `
        <div class="form-row">
            <div class="form-group" style="flex: 2;">
                <label>SKU *</label>
                <select class="item-sku form-control" required onchange="updateStockDisplay(this)">
                    <option value="">Select SKU</option>
                </select>
            </div>
            <div class="form-group" style="flex: 1;">
                <label>Quantity *</label>
                <input type="number" class="item-quantity form-control" step="0.01" required min="0.01">
            </div>
            <div class="form-group" style="flex: 1;">
                <label>Stock Available</label>
                <input type="text" class="item-stock form-control" readonly>
            </div>
            <div class="form-group" style="flex: 0.5; align-self: flex-end;">
                <button type="button" class="btn-remove" onclick="removeItem(this)">✕ Remove</button>
            </div>
        </div>
    `;
    container.appendChild(newRow);

    // Populate dropdown for new row
    const newSelect = newRow.querySelector('.item-sku');
    const optionsHtml = '<option value="">Select SKU</option>' +
        skusList.map(s => `<option value="${s.id}" data-stock="${s.stock_in_hand}">${escapeHtml(s.name)} (${escapeHtml(s.brand_name)})</option>`).join('');
    newSelect.innerHTML = optionsHtml;
}

function removeItem(btn) {
    const itemRows = document.querySelectorAll('.item-row');
    if (itemRows.length > 1) {
        btn.closest('.item-row').remove();
    } else {
        if (window.Toast) Toast.warning('At least one item is required');
    }
}

function updateStockDisplay(select) {
    const selectedOption = select.options[select.selectedIndex];
    const stock = selectedOption.getAttribute('data-stock') || '0';
    const stockInput = select.closest('.form-row').querySelector('.item-stock');
    if (stockInput) {
        stockInput.value = formatNumber(stock);
    }
}

function checkRetailerCredit() {
    const retailerId = document.getElementById('dispatchRetailer').value;
    const paymentType = document.getElementById('paymentType').value;
    const infoDiv = document.getElementById('retailerCreditInfo');

    if (!retailerId) {
        infoDiv.textContent = '';
        infoDiv.style.display = 'none';
        return;
    }

    const retailer = retailersList.find(r => r.id == retailerId);
    if (retailer) {
        infoDiv.style.display = 'block';
        if (paymentType === 'credit') {
            if (retailer.credit_frozen) {
                infoDiv.innerHTML = '<strong>❄️ Credit FROZEN</strong> for this retailer. Cannot dispatch on credit.';
                infoDiv.style.borderLeftColor = 'var(--danger-color)';
                infoDiv.style.color = 'var(--danger-color)';
            } else {
                const available = retailer.credit_limit - retailer.outstanding_amount;
                const isCritical = available <= 0;
                infoDiv.innerHTML = `
                    <div style="display:flex; justify-content:space-between;">
                        <span>Outstanding: <strong>${formatCurrency(retailer.outstanding_amount)}</strong></span>
                        <span>Limit: <strong>${formatCurrency(retailer.credit_limit)}</strong></span>
                    </div>
                    <div style="margin-top:4px; font-weight:600; color: ${isCritical ? 'var(--danger-color)' : 'var(--success-color)'}">
                        Available Credit: ${formatCurrency(available)}
                    </div>
                `;
                infoDiv.style.borderLeftColor = isCritical ? 'var(--danger-color)' : 'var(--success-color)';
            }
        } else {
            infoDiv.innerHTML = '<span style="color: var(--success-color);">Cash Payment Selected</span>';
            infoDiv.style.borderLeftColor = 'var(--success-color)';
        }
    }
}

async function saveDispatch() {
    const date = document.getElementById('dispatchDate').value;
    const retailerId = document.getElementById('dispatchRetailer').value;
    const paymentType = document.getElementById('paymentType').value;
    const btn = document.querySelector('.btn-submit');

    const items = [];
    const itemRows = document.querySelectorAll('.item-row');

    for (const row of itemRows) {
        const skuId = row.querySelector('.item-sku').value;
        const quantity = parseFloat(row.querySelector('.item-quantity').value);

        if (skuId && quantity > 0) {
            items.push({ sku_id: parseInt(skuId), quantity: quantity });
        }
    }

    if (items.length === 0) {
        if (window.Toast) Toast.error('Please add at least one valid item');
        return;
    }

    // Client-side credit check
    if (paymentType === 'credit') {
        const retailer = retailersList.find(r => r.id == retailerId);
        if (retailer && retailer.credit_frozen) {
            if (window.Toast) Toast.error('Credit is frozen for this retailer!');
            return;
        }
    }

    const dispatchData = {
        date: date,
        retailer_id: parseInt(retailerId),
        payment_type: paymentType,
        items: items
    };

    setLoading(btn, true, 'Saving...');

    try {
        const response = await apiRequest('/api/sales', {
            method: 'POST',
            body: JSON.stringify(dispatchData)
        });

        if (!response) {
            throw new Error('Network error');
        }

        const data = await response.json();

        if (response.ok) {
            if (window.Toast) Toast.success(`Dispatch saved! Profit: ${formatCurrency(data.total_profit)}`);
            resetForm();
            loadRecentDispatches();
            // Refresh dashboard data if on same session
            if (window.parent && window.parent.loadDashboard) {
                window.parent.loadDashboard();
            }
        } else {
            throw new Error(data.error || 'Failed to save dispatch');
        }
    } catch (error) {
        console.error(error);
        if (window.Toast) Toast.error(error.message || 'Error saving dispatch');
    } finally {
        setLoading(btn, false, '<span>💾</span> Save Dispatch');
    }
}

function resetForm() {
    document.getElementById('dispatchForm').reset();
    document.getElementById('dispatchDate').valueAsDate = new Date(); // Reset date to today

    // Reset items to one row
    const container = document.getElementById('itemsContainer');
    container.innerHTML = ''; // basic clear
    addItemRow(); // add one empty row

    document.getElementById('retailerCreditInfo').style.display = 'none';
}

async function loadRecentDispatches() {
    const tbody = document.getElementById('recentDispatchesBody');
    if (!tbody) return;

    // Skeleton
    tbody.innerHTML = Array(5).fill(0).map(() => `
        <tr>
            <td><div class="skeleton" style="width: 100px; height: 20px;"></div></td>
            <td><div class="skeleton" style="width: 150px; height: 20px;"></div></td>
            <td><div class="skeleton" style="width: 200px; height: 20px;"></div></td>
            <td><div class="skeleton" style="width: 80px; height: 20px;"></div></td>
            <td><div class="skeleton" style="width: 100px; height: 20px;"></div></td>
        </tr>
    `).join('');

    try {
        const response = await apiRequest('/api/sales?limit=20');
        if (!response) return;

        const data = await response.json();
        const sales = data.sales || data; // Handle pagination wrapper if exists

        if (!Array.isArray(sales) || sales.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center">
                        <div style="padding: 40px; color: var(--text-light);">
                            <div style="font-size: 32px; margin-bottom: 12px; opacity: 0.5;">📦</div>
                            <p>No recent dispatches found</p>
                        </div>
                    </td>
                </tr>`;
            return;
        }

        // Grouping logic if API returns flat items, assuming API returns flat sales items
        // Simplified display: if API returns transactions, display them.
        // Assuming API returns transaction objects with items array or joined string

        tbody.innerHTML = sales.map(sale => `
            <tr>
                <td>
                    <div style="font-weight: 500;">${formatDate(sale.date)}</div>
                    <div style="font-size: 11px; color: var(--text-light);">${formatRelativeTime ? formatRelativeTime(sale.date) : ''}</div>
                </td>
                <td><strong>${escapeHtml(sale.retailer_name)}</strong></td>
                <td>
                     <div style="max-width: 300px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" 
                          title="${escapeHtml(sale.items_summary || sale.sku_name)}">
                        ${escapeHtml(sale.items_summary || (sale.sku_name ? `${sale.sku_name} (x${sale.quantity})` : 'Multiple Items'))}
                    </div>
                </td>
                <td>
                    <span class="payment-badge ${sale.payment_type === 'cash' ? 'cash' : 'credit'}">
                        ${sale.payment_type === 'cash' ? '💵 CASH' : '💳 CREDIT'}
                    </span>
                </td>
                <td style="font-weight: 600; color: var(--success-color);">
                    +${formatCurrency(sale.gross_profit || sale.total_profit)}
                </td>
            </tr>
        `).join('');

    } catch (error) {
        console.error('Error loading recent dispatches:', error);
        tbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger">Failed to load data</td></tr>`;
    }
}

async function loadRetailers() {
    try {
        const response = await apiRequest('/api/retailers');
        if (!response) return;

        retailersList = await response.json();
        const select = document.getElementById('dispatchRetailer');
        const optionsHtml = '<option value="">Select Retailer</option>' +
            retailersList.map(r => `<option value="${r.id}">${escapeHtml(r.name)}</option>`).join('');
        setInnerHtmlSafe(select, optionsHtml);
    } catch (error) {
        console.error('Error loading retailers:', error);
    }
}

async function loadSKUs() {
    try {
        const response = await apiRequest('/api/skus');
        if (!response) return;

        skusList = await response.json();
        updateSKUDropdowns();
    } catch (error) {
        console.error('Error loading SKUs:', error);
    }
}

function updateSKUDropdowns() {
    document.querySelectorAll('.item-sku').forEach(select => {
        const currentValue = select.value;
        const optionsHtml = '<option value="">Select SKU</option>' +
            skusList.map(s => `<option value="${s.id}" data-stock="${s.stock_in_hand}">${escapeHtml(s.name)} (${escapeHtml(s.brand_name)})</option>`).join('');
        setInnerHtmlSafe(select, optionsHtml);
        if (currentValue) select.value = currentValue;
    });
}

function addItemRow() {
    const container = document.getElementById('itemsContainer');
    const newRow = document.createElement('div');
    newRow.className = 'item-row';
    newRow.innerHTML = `
        <div class="form-row">
            <div class="form-group" style="flex: 2;">
                <label>SKU *</label>
                <select class="item-sku" required>
                    <option value="">Select SKU</option>
                </select>
            </div>
            <div class="form-group" style="flex: 1;">
                <label>Quantity *</label>
                <input type="number" class="item-quantity" step="0.01" required min="0.01">
            </div>
            <div class="form-group" style="flex: 1;">
                <label>Stock Available</label>
                <input type="text" class="item-stock" readonly style="background: #f1f5f9;">
            </div>
            <div class="form-group" style="flex: 0.5; align-self: flex-end;">
                <button type="button" class="btn btn-danger" onclick="removeItem(this)">Remove</button>
            </div>
        </div>
    `;
    container.appendChild(newRow);
    updateSKUDropdowns();
}

function removeItem(btn) {
    const itemRows = document.querySelectorAll('.item-row');
    if (itemRows.length > 1) {
        btn.closest('.item-row').remove();
    } else {
        alert('At least one item is required');
    }
}

function updateStockDisplay(select) {
    const selectedOption = select.options[select.selectedIndex];
    const stock = selectedOption.getAttribute('data-stock') || '0';
    const stockInput = select.closest('.form-row').querySelector('.item-stock');
    if (stockInput) {
        stockInput.value = formatNumber(stock);
    }
}

async function checkRetailerCredit() {
    const retailerId = document.getElementById('dispatchRetailer').value;
    const paymentType = document.getElementById('paymentType').value;
    const infoDiv = document.getElementById('retailerCreditInfo');

    if (!retailerId) {
        infoDiv.textContent = '';
        return;
    }

    const retailer = retailersList.find(r => r.id == retailerId);
    if (retailer) {
        if (paymentType === 'credit') {
            if (retailer.credit_frozen) {
                infoDiv.textContent = '⚠ Credit FROZEN for this retailer';
                infoDiv.style.color = 'var(--danger-color)';
            } else {
                const available = retailer.credit_limit - retailer.outstanding_amount;
                infoDiv.textContent = `Outstanding: ${formatCurrency(retailer.outstanding_amount)} | Available: ${formatCurrency(available)} | Limit: ${formatCurrency(retailer.credit_limit)}`;
                infoDiv.style.color = available > 0 ? 'var(--text-light)' : 'var(--danger-color)';
            }
        } else {
            infoDiv.textContent = '';
        }
    }
}

async function saveDispatch() {
    const date = document.getElementById('dispatchDate').value;
    const retailerId = document.getElementById('dispatchRetailer').value;
    const paymentType = document.getElementById('paymentType').value;
    const form = document.getElementById('dispatchForm');
    const submitBtn = form.querySelector('button[type="submit"]');

    const items = [];
    const itemRows = document.querySelectorAll('.item-row');

    for (const row of itemRows) {
        const skuId = row.querySelector('.item-sku').value;
        const quantity = parseFloat(row.querySelector('.item-quantity').value);

        if (!skuId || !quantity || quantity <= 0) {
            continue;
        }

        items.push({ sku_id: parseInt(skuId), quantity: quantity });
    }

    if (items.length === 0) {
        showError('Please add at least one item');
        return;
    }

    const dispatchData = {
        date: date,
        retailer_id: parseInt(retailerId),
        payment_type: paymentType,
        items: items
    };

    const errorDiv = document.getElementById('dispatchFormError');
    const successDiv = document.getElementById('dispatchFormSuccess');

    setLoading(submitBtn, true, 'Processing...');

    try {
        const response = await apiRequest('/api/sales', {
            method: 'POST',
            body: JSON.stringify(dispatchData)
        });

        if (!response) throw new Error('Network error');

        const data = await response.json();

        if (response.ok) {
            successDiv.textContent = `Dispatch saved successfully! Gross Profit: ${formatCurrency(data.total_profit)}`;
            successDiv.style.display = 'block';
            errorDiv.style.display = 'none';
            resetForm();
            await loadRecentDispatches();

            // Refresh dashboard data if on same session
            if (window.parent && window.parent.loadDashboard) {
                window.parent.loadDashboard();
            }
        } else {
            showError(data.error || 'Error saving dispatch');
        }
    } catch (error) {
        showError('Error saving dispatch');
    } finally {
        setLoading(submitBtn, false, 'Internal Dispatch');
    }
}

function showError(message) {
    const errorDiv = document.getElementById('dispatchFormError');
    const successDiv = document.getElementById('dispatchFormSuccess');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    successDiv.style.display = 'none';
}

function resetForm() {
    document.getElementById('dispatchForm').reset();
    document.getElementById('dispatchDate').value = new Date().toISOString().split('T')[0];

    const container = document.getElementById('itemsContainer');
    const html = `
        <div class="item-row">
            <div class="form-row">
                <div class="form-group" style="flex: 2;">
                    <label>SKU *</label>
                    <select class="item-sku" required>
                        <option value="">Select SKU</option>
                    </select>
                </div>
                <div class="form-group" style="flex: 1;">
                    <label>Quantity *</label>
                    <input type="number" class="item-quantity" step="0.01" required min="0.01">
                </div>
                <div class="form-group" style="flex: 1;">
                    <label>Stock Available</label>
                    <input type="text" class="item-stock" readonly style="background: #f1f5f9;">
                </div>
                <div class="form-group" style="flex: 0.5; align-self: flex-end;">
                    <button type="button" class="btn btn-danger" onclick="removeItem(this)">Remove</button>
                </div>
            </div>
        </div>
    `;
    setInnerHtmlSafe(container, html);
    updateSKUDropdowns();
    document.getElementById('retailerCreditInfo').textContent = '';
}

async function loadRecentDispatches() {
    const tbody = document.getElementById('recentDispatchesBody');
    if (tbody) {
        tbody.innerHTML = Array(5).fill(0).map(() => `
            <tr>
                <td><div class="skeleton" style="width: 100px; height: 20px;"></div></td>
                <td><div class="skeleton" style="width: 150px; height: 20px;"></div></td>
                <td><div class="skeleton" style="width: 200px; height: 20px;"></div></td>
                <td><div class="skeleton" style="width: 80px; height: 20px;"></div></td>
                <td><div class="skeleton" style="width: 100px; height: 20px;"></div></td>
            </tr>
        `).join('');
    }

    try {
        const response = await apiRequest('/api/sales?limit=50');
        if (!response) return;

        const sales = await response.json();
        await displayRecentDispatches(sales.slice(0, 50));
    } catch (error) {
        console.error('Error loading recent dispatches:', error);
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger">Error loading data</td></tr>`;
        }
    }
}

async function displayRecentDispatches(sales) {
    const tbody = document.getElementById('recentDispatchesBody');
    if (!tbody) return;

    // Simulate slight delay for skeleton to show (optional, removed for speed)
    // await new Promise(resolve => setTimeout(resolve, 500));

    if (sales.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center">
                    <div style="padding: 40px; color: var(--text-light);">
                        <div style="font-size: 48px; margin-bottom: 16px;">📦</div>
                        <p>No recent dispatches found</p>
                    </div>
                </td>
            </tr>`;
        return;
    }

    // Group sales by date and retailer
    const grouped = {};
    sales.forEach(sale => {
        const key = `${sale.date}_${sale.retailer_id}_${sale.created_at || ''}`; // Improve grouping key uniqueness if needed
        if (!grouped[key]) {
            grouped[key] = {
                date: sale.date,
                retailer_name: sale.retailer_name,
                payment_type: sale.payment_type || 'cash',
                items: [],
                total_profit: 0
            };
        }
        grouped[key].items.push(`${sale.sku_name} (${formatNumber(sale.quantity)})`);
        grouped[key].total_profit += parseFloat(sale.gross_profit || 0);
    });

    const rowsHtml = Object.values(grouped).map(group => `
        <tr>
            <td style="font-weight: 500; color: var(--text-light);">${formatDate(group.date)}</td>
            <td><strong>${escapeHtml(group.retailer_name)}</strong></td>
            <td>
                <div style="max-width: 300px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHtml(group.items.join(', '))}">
                    ${escapeHtml(group.items.join(', '))}
                </div>
            </td>
            <td>
                <span class="payment-badge ${group.payment_type === 'cash' ? 'cash' : 'credit'}">
                    ${group.payment_type === 'cash' ? '💵 CASH' : '💳 CREDIT'}
                </span>
            </td>
            <td style="font-weight: 600; color: var(--success-color);">
                +${formatCurrency(group.total_profit)}
            </td>
        </tr>
    `).join('');

    tbody.innerHTML = rowsHtml;
}

