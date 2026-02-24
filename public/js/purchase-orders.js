// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Auth is handled by auth.js auto-redirect
    // checkAuth(); removed
    loadPOs();
    loadSummary();
    setupEventListeners();
});

let skus = []; // Cache for SKU dropdowns

function setupEventListeners() {
    document.getElementById('statusFilter').addEventListener('change', () => loadPOs());
    document.getElementById('supplierSearch').addEventListener('input', debounce(() => loadPOs(), 500));

    document.getElementById('createPOForm').addEventListener('submit', handleCreatePO);
    document.getElementById('receivePOForm').addEventListener('submit', submitReceive);
}

// ------------------------------------------------------------------
// DATA LOADING
// ------------------------------------------------------------------

async function loadPOs() {
    const status = document.getElementById('statusFilter').value;
    const supplier = document.getElementById('supplierSearch').value;
    const tbody = document.getElementById('poTableBody');

    // Show Skeleton State
    tbody.innerHTML = Array(5).fill(0).map(() => `
        <tr>
            <td><div class="skeleton skeleton-text" style="width: 80px;"></div></td>
            <td><div class="skeleton skeleton-text" style="width: 100px;"></div></td>
            <td><div class="skeleton skeleton-text" style="width: 150px;"></div></td>
            <td><div class="skeleton skeleton-text" style="width: 60px;"></div></td>
            <td><div class="skeleton skeleton-text" style="width: 80px;"></div></td>
            <td><div class="skeleton skeleton-text" style="width: 90px;"></div></td>
            <td><div class="skeleton skeleton-text" style="width: 60px;"></div></td>
        </tr>
    `).join('');

    try {
        const queryParams = new URLSearchParams();
        if (status) queryParams.append('status', status);
        if (supplier) queryParams.append('supplier', supplier);

        const response = await apiRequest(`/api/purchase-orders?${queryParams}`);
        if (!response) return;

        const result = await response.json();
        const data = Array.isArray(result) ? result : (result.orders || result.purchaseOrders || []);

        if (!data || data.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 60px;">
                        <div style="font-size: 48px; margin-bottom: 16px;">📦</div>
                        <h3 style="color: var(--text-color); margin-bottom: 8px;">No Purchase Orders Found</h3>
                        <p style="color: var(--text-light);">Try adjusting your search or filters</p>
                    </td>
                </tr>`;
            return;
        }

        tbody.innerHTML = data.map(po => `
            <tr>
                <td><span class="po-number">#${escapeHtml(po.po_number)}</span></td>
                <td>
                    <div style="font-weight: 500;">${formatDate(po.order_date)}</div>
                    <div style="font-size: 11px; color: var(--text-light);">${formatRelativeTime ? formatRelativeTime(po.order_date) : ''}</div>
                </td>
                <td>
                    <div style="font-weight: 600;">${escapeHtml(po.supplier_name)}</div>
                </td>
                <td>
                    <span style="background: var(--bg-light); padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600;">
                        ${po.item_count} items
                    </span>
                </td>
                <td style="font-family: 'Inter', sans-serif; font-weight: 600;">
                    ${formatCurrency(po.total_amount)}
                </td>
                <td>
                    <span class="status-badge ${po.status.toLowerCase()}">
                        ${po.status.replace(/_/g, ' ')}
                    </span>
                </td>
                <td>
                    <div style="display: flex; gap: 8px;">
                        <button class="btn btn-sm btn-secondary" onclick="viewPO(${po.id})" title="View Details">👁️</button>
                        ${po.status !== 'completed' && po.status !== 'cancelled' ?
                `<button class="btn btn-sm btn-primary" onclick="receivePO(${po.id})" title="Receive Stock">📥</button>` : ''}
                    </div>
                </td>
            </tr>
        `).join('');

    } catch (error) {
        console.error('Error loading POs:', error);
        if (window.Toast) Toast.error('Failed to load purchase orders');
        tbody.innerHTML = `<tr><td colspan="7" class="text-center text-danger">Failed to load data</td></tr>`;
    }
}

async function loadSummary() {
    try {
        const response = await apiRequest('/api/purchase-orders/pending/summary');
        if (!response) return;
        const data = await response.json();
        const summary = data.summary || {};

        const container = document.getElementById('poSummary');
        if (!container) return; // Guard clause

        container.innerHTML = `
            <div class="widget">
                <div class="widget-icon yellow">⏳</div>
                <div class="widget-header">Pending Orders</div>
                <div class="widget-value"><span>${summary.total_pending || 0}</span></div>
            </div>
            <div class="widget">
                <div class="widget-icon blue">💰</div>
                <div class="widget-header">Pending Value</div>
                <div class="widget-value"><span>${formatCurrency(summary.total_value || 0)}</span></div>
            </div>
            <div class="widget">
                <div class="widget-icon green">📅</div>
                <div class="widget-header">Earliest Due</div>
                <div class="widget-value"><span style="font-size: 20px">${summary.earliest_expected ? formatDate(summary.earliest_expected) : '-'}</span></div>
            </div>
        `;
    } catch (error) {
        console.error('Error loading summary:', error);
    }
}

// ------------------------------------------------------------------
// VIEW PO DETAILS
// ------------------------------------------------------------------

async function viewPO(id) {
    const modal = document.getElementById('viewPOModal');
    const body = document.getElementById('viewPOBody');
    const title = document.getElementById('viewPOTitle');
    const receiveBtn = document.getElementById('viewPOReceiveBtn');

    // Show loading state
    body.innerHTML = '<div style="text-align:center; padding: 40px;"><div class="spinner"></div></div>';
    modal.style.display = 'block';

    try {
        const response = await apiRequest(`/api/purchase-orders/${id}`);
        if (!response) {
            modal.style.display = 'none';
            return;
        }

        const po = await response.json();

        title.textContent = `${po.po_number} Details`;

        // Show/Hide Receive Button based on status
        if (po.status !== 'completed' && po.status !== 'cancelled') {
            receiveBtn.style.display = 'inline-block';
            receiveBtn.onclick = () => {
                closeModal('viewPOModal');
                receivePO(id);
            };
        } else {
            receiveBtn.style.display = 'none';
        }

        body.innerHTML = `
            <div style="margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-start;">
                <div>
                    <h4 style="margin: 0;">${escapeHtml(po.supplier_name)}</h4>
                    <div class="text-secondary">Expected: ${po.expected_date ? formatDate(po.expected_date) : 'N/A'}</div>
                </div>
                <span class="status-badge ${po.status}">${po.status}</span>
            </div>
            
            <table class="premium-table">
                <thead>
                    <tr>
                        <th>Item</th>
                        <th>Qty Ordered</th>
                        <th>Qty Received</th>
                        <th>Unit Cost</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${po.items.map(item => `
                        <tr>
                            <td>
                                <strong>${escapeHtml(item.sku_name)}</strong>
                                <div style="font-size: 11px; color: var(--text-light);">${escapeHtml(item.brand_name || '')}</div>
                            </td>
                            <td>${item.quantity}</td>
                            <td>${item.received_quantity}</td>
                            <td>${formatCurrency(item.unit_price)}</td>
                            <td>
                                ${item.received_quantity >= item.quantity
                ? '<span style="color: var(--success-color);">✓ Done</span>'
                : `<span style="color: var(--warning-color);">${item.quantity - item.received_quantity} Pending</span>`}
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
                <tfoot>
                     <tr>
                        <td colspan="3" style="text-align: right; font-weight: 600;">Total:</td>
                        <td colspan="2" style="font-weight: 600;">${formatCurrency(po.total_amount)}</td>
                    </tr>
                </tfoot>
            </table>
            
            ${po.notes ? `<div style="margin-top: 15px; padding: 10px; background: #f8fafc; border-radius: 8px;">
                <small class="text-secondary">Notes:</small><br>${escapeHtml(po.notes)}
            </div>` : ''}
        `;

    } catch (error) {
        console.error(error);
        body.innerHTML = '<p class="text-danger">Failed to load details</p>';
    }
}

// ------------------------------------------------------------------
// RECEIVE ITEMS
// ------------------------------------------------------------------

async function receivePO(id) {
    const modal = document.getElementById('receivePOModal');
    const tbody = document.getElementById('receivePOItems');
    document.getElementById('receivePOId').value = id;

    // Show loading state
    tbody.innerHTML = '<tr><td colspan="4" class="text-center"><div class="spinner"></div></td></tr>';
    modal.style.display = 'block';

    try {
        const response = await apiRequest(`/api/purchase-orders/${id}`);
        if (!response) {
            modal.style.display = 'none';
            return;
        }

        const po = await response.json();

        // Filter only items that are not fully received
        const pendingItems = po.items.filter(item => item.received_quantity < item.quantity);

        if (pendingItems.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center">All items received!</td></tr>';
            return;
        }

        tbody.innerHTML = pendingItems.map(item => `
            <tr>
                <td>
                    <div style="font-weight: 600;">${escapeHtml(item.sku_name)}</div>
                    <div class="text-secondary" style="font-size: 11px;">${escapeHtml(item.brand_name)}</div>
                </td>
                <td>${item.quantity}</td>
                <td>${item.received_quantity}</td>
                <td>
                    <input type="hidden" name="item_id[]" value="${item.id}">
                    <input type="number" 
                           class="form-control" 
                           name="received_qty[]" 
                           min="0" 
                           max="${item.quantity - item.received_quantity}" 
                           value="${item.quantity - item.received_quantity}"
                           style="width: 100px;">
                </td>
            </tr>
        `).join('');

    } catch (error) {
        console.error(error);
        tbody.innerHTML = '<tr><td colspan="4" class="text-danger">Error loading items</td></tr>';
    }
}

async function submitReceive(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    setLoading(btn, true);

    const poId = document.getElementById('receivePOId').value;
    const itemIds = document.getElementsByName('item_id[]');
    const quantities = document.getElementsByName('received_qty[]');

    const itemsToReceive = [];

    for (let i = 0; i < itemIds.length; i++) {
        const qty = parseFloat(quantities[i].value) || 0;
        if (qty > 0) {
            itemsToReceive.push({
                item_id: parseInt(itemIds[i].value),
                received_quantity: qty
            });
        }
    }

    if (itemsToReceive.length === 0) {
        Toast.warning('Please enter quantity to receive');
        setLoading(btn, false);
        return;
    }

    try {
        const response = await apiRequest(`/api/purchase-orders/${poId}/receive`, {
            method: 'PUT',
            body: JSON.stringify({ items: itemsToReceive })
        });

        if (response && response.ok) {
            Toast.success('Stock Received Successfully');
            closeModal('receivePOModal');
            loadPOs();
            loadSummary();
        } else {
            const err = await response.json();
            throw new Error(err.error || 'Failed to receive items');
        }
    } catch (error) {
        Toast.error(error.message);
    } finally {
        setLoading(btn, false);
    }
}

// ------------------------------------------------------------------
// CREATE PO
// ------------------------------------------------------------------

async function openCreateModal() {
    if (skus.length === 0) {
        try {
            const response = await apiRequest('/api/skus');
            if (!response) return;
            const data = await response.json();
            skus = data.skus || data;
        } catch (e) {
            console.error(e);
            Toast.error('Failed to load products');
            return;
        }
    }

    document.getElementById('newPOItems').innerHTML = '';
    addPOItemRow();
    document.getElementById('newPOTotal').textContent = '0.00';
    document.getElementById('createPOForm').reset();
    document.getElementById('createModal').style.display = 'block';
}

function addPOItemRow() {
    const tbody = document.getElementById('newPOItems');
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td>
            <select class="form-control" name="sku_id[]" onchange="updateRowTotal(this)" required>
                <option value="">Select Product...</option>
                ${skus.map(s => `<option value="${s.id}" data-cost="${s.purchase_price}">${escapeHtml(s.name)}</option>`).join('')}
            </select>
        </td>
        <td><input type="number" class="form-control" name="quantity[]" min="1" value="1" onchange="updateRowTotal(this)" required></td>
        <td><input type="number" class="form-control" name="unit_price[]" step="0.01" onchange="updateRowTotal(this)" required></td>
        <td class="row-total">₹0.00</td>
        <td><button type="button" class="btn btn-sm btn-danger" onclick="this.closest('tr').remove(); calculateTotal()">×</button></td>
    `;
    tbody.appendChild(tr);
}

function updateRowTotal(input) {
    const row = input.closest('tr');
    const skuSelect = row.querySelector('select');
    const costInput = row.querySelector('input[name="unit_price[]"]');

    if (input === skuSelect) {
        const option = skuSelect.options[skuSelect.selectedIndex];
        if (option.dataset.cost) {
            costInput.value = option.dataset.cost;
        }
    }

    const qty = parseFloat(row.querySelector('input[name="quantity[]"]').value) || 0;
    const cost = parseFloat(costInput.value) || 0;
    row.querySelector('.row-total').textContent = formatCurrency(qty * cost);
    calculateTotal();
}

function calculateTotal() {
    let total = 0;
    document.querySelectorAll('#newPOItems tr').forEach(row => {
        const qty = parseFloat(row.querySelector('input[name="quantity[]"]').value) || 0;
        const cost = parseFloat(row.querySelector('input[name="unit_price[]"]').value) || 0;
        total += qty * cost;
    });
    document.getElementById('newPOTotal').textContent = total.toFixed(2);
}

async function handleCreatePO(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    setLoading(btn, true);

    const formData = new FormData(e.target);
    const items = [];

    const skuIds = formData.getAll('sku_id[]');
    const quantities = formData.getAll('quantity[]');
    const prices = formData.getAll('unit_price[]');

    for (let i = 0; i < skuIds.length; i++) {
        items.push({
            sku_id: skuIds[i],
            quantity: parseInt(quantities[i]),
            unit_price: parseFloat(prices[i])
        });
    }

    const payload = {
        supplier_name: formData.get('supplier_name'),
        expected_date: formData.get('expected_date'),
        notes: formData.get('notes'),
        items: items
    };

    try {
        const response = await apiRequest('/api/purchase-orders', {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        if (response && response.ok) {
            Toast.success('Purchase Order Created');
            closeModal('createModal');
            loadPOs();
            loadSummary();
        } else {
            const err = await response.json();
            throw new Error(err.error || 'Failed');
        }
    } catch (error) {
        Toast.error(error.message || 'Failed to create PO');
    } finally {
        setLoading(btn, false);
    }
}

function closeModal(id) {
    document.getElementById(id).style.display = 'none';
}

// Duplicate functions removed - all functions defined earlier in file

// Expose functions globally to ensure onclick works in HTML
window.openCreateModal = openCreateModal;
window.closeModal = closeModal;
window.addPOItemRow = addPOItemRow;
window.calculateTotal = calculateTotal;
window.updateRowTotal = updateRowTotal;
window.viewPO = viewPO;
window.receivePO = receivePO;
