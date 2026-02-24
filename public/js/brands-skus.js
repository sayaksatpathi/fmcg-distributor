// Expose globally
window.switchTab = switchTab;
window.openBrandModal = openBrandModal;
window.closeBrandModal = closeBrandModal;
window.deleteBrand = deleteBrand;
window.openSKUModal = openSKUModal;
window.closeSKUModal = closeSKUModal;
window.deleteSKU = deleteSKU;
window.editSKU = editSKU;
window.saveBrand = saveBrand;
window.saveSKU = saveSKU;
window.filterSKUs = filterSKUs;
window.calculateSKUMargin = calculateSKUMargin;

let brandsData = [];
let skusData = [];

document.addEventListener('DOMContentLoaded', async () => {
    // Check perm
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');
    if (userData.role === 'owner' || userData.role === 'accountant') {
        const brandBtn = document.getElementById('addBrandBtn');
        const skuBtn = document.getElementById('addSKUBtn');
        if (brandBtn) brandBtn.style.display = 'inline-flex';
        if (skuBtn) skuBtn.style.display = 'inline-flex';
    }

    // Load initial tab
    await loadBrands();
    // Preload SKUs but don't show yet to speed up tab switch
    loadSKUs();

    const brandForm = document.getElementById('brandForm');
    if (brandForm) {
        brandForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await saveBrand();
        });
    }

    const skuForm = document.getElementById('skuForm');
    if (skuForm) {
        skuForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await saveSKU();
        });
    }
});

function switchTab(tab) {
    const tabs = document.querySelectorAll('.pill-tab');
    const panels = document.querySelectorAll('.tab-panel');

    tabs.forEach(t => t.classList.remove('active'));
    panels.forEach(p => p.classList.add('hidden'));

    if (tab === 'brands') {
        tabs[0].classList.add('active');
        document.getElementById('brandsTab').classList.remove('hidden');
    } else {
        tabs[1].classList.add('active');
        document.getElementById('skusTab').classList.remove('hidden');
        // Ensure SKUs are loaded/refreshed
        if (skusData.length === 0) loadSKUs();
    }
}

async function loadBrands() {
    const tbody = document.getElementById('brandsTableBody');
    if (!tbody) return;

    // Skeleton
    tbody.innerHTML = Array(3).fill(0).map(() => `
        <tr>
            <td><div class="skeleton" style="width: 120px; height: 20px;"></div></td>
            <td><div class="skeleton" style="width: 60px; height: 20px;"></div></td>
            <td><div class="skeleton" style="width: 100px; height: 20px;"></div></td>
            <td><div class="skeleton" style="width: 100px; height: 20px;"></div></td>
            <td><div class="skeleton" style="width: 80px; height: 20px;"></div></td>
            <td><div class="skeleton" style="width: 60px; height: 20px;"></div></td>
        </tr>
    `).join('');

    try {
        const response = await apiRequest('/api/brands');
        if (!response) return;

        brandsData = await response.json();

        // Initial Render
        displayBrands(brandsData);

        // Fetch Extra Data Async
        const newBrandsData = [...brandsData];
        for (const brand of newBrandsData) {
            try {
                const profitResponse = await apiRequest(`/api/profit/by-brand?start_date=${getMonthStart()}&end_date=${getToday()}`);
                if (profitResponse) {
                    const profitData = await profitResponse.json();
                    const brandProfit = profitData.find(p => p.id === brand.id);
                    if (brandProfit) {
                        brand.monthly_profit = brandProfit.profit;
                        brand.capital_invested = brandProfit.capital_invested;
                        brand.capital_roi = brandProfit.roi;
                    }
                }
            } catch (err) {
                // Ignore profit load errors for UI smoothness
            }
        }
        displayBrands(newBrandsData);

    } catch (error) {
        console.error('Error loading brands:', error);
        if (window.Toast) Toast.error('Failed to load brands');
    }
}

function displayBrands(brands) {
    const tbody = document.getElementById('brandsTableBody');
    if (!tbody) return;

    if (brands.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 40px; color: var(--text-light);">No brands found. Add one to get started!</td></tr>`;
        return;
    }

    tbody.innerHTML = brands.map(brand => `
        <tr>
            <td><div style="font-weight: 600; color: var(--text-color);">${escapeHtml(brand.name)}</div></td>
            <td>${brand.margin_slab ? brand.margin_slab + '%' : '-'}</td>
            <td>${formatCurrency(brand.capital_invested || 0)}</td>
            <td><strong style="color: var(--success-color);">${formatCurrency(brand.monthly_profit || 0)}</strong></td>
            <td>${brand.capital_roi ? brand.capital_roi.toFixed(1) + '%' : '-'}</td>
            <td>
                <button class="btn btn-sm" style="background: rgba(239, 68, 68, 0.1); color: var(--danger-color); border:none;" onclick="deleteBrand(${brand.id})" title="Delete">🗑️</button>
            </td>
        </tr>
    `).join('');
}

async function loadSKUs() {
    const tbody = document.getElementById('skusTableBody');
    if (!tbody) return;

    // Only show skeleton if empty
    if (skusData.length === 0) {
        tbody.innerHTML = Array(6).fill(0).map(() => `
            <tr>
                <td><div class="skeleton" style="width: 150px; height: 20px;"></div></td>
                <td><div class="skeleton" style="width: 80px; height: 20px;"></div></td>
                <td><div class="skeleton" style="width: 80px; height: 20px;"></div></td>
                <td><div class="skeleton" style="width: 80px; height: 20px;"></div></td>
                <td><div class="skeleton" style="width: 60px; height: 20px;"></div></td>
                <td><div class="skeleton" style="width: 60px; height: 20px;"></div></td>
                <td><div class="skeleton" style="width: 80px; height: 20px;"></div></td>
                <td><div class="skeleton" style="width: 80px; height: 20px;"></div></td>
                <td><div class="skeleton" style="width: 80px; height: 20px;"></div></td>
                <td><div class="skeleton" style="width: 60px; height: 20px;"></div></td>
            </tr>
        `).join('');
    }

    try {
        const response = await apiRequest('/api/skus');
        if (!response) return;

        skusData = await response.json();

        // Process status logic
        skusData.forEach(sku => {
            if (sku.avg_monthly_sale > 0) {
                sku.days_of_inventory = ((sku.stock_in_hand / sku.avg_monthly_sale) * 30).toFixed(0);
            } else {
                sku.days_of_inventory = sku.stock_in_hand > 0 ? 999 : 0;
            }

            if (sku.days_of_inventory > 90) sku.status = 'DEAD';
            else if (sku.days_of_inventory > 45) sku.status = 'SLOW';
            else sku.status = 'FAST';
        });

        displaySKUs(skusData);
        populateBrandDropdown();
    } catch (error) {
        console.error('Error loading SKUs:', error);
    }
}

function displaySKUs(skus) {
    const tbody = document.getElementById('skusTableBody');
    if (!tbody) return;

    if (skus.length === 0) {
        tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding: 40px; color: var(--text-light);">No SKUs found.</td></tr>`;
        return;
    }

    tbody.innerHTML = skus.map(sku => {
        let statusBadge = 'status-pill pending'; // Default
        if (sku.status === 'FAST') statusBadge = 'status-pill active';
        else if (sku.status === 'DEAD') statusBadge = 'status-pill cancelled';

        let marginClass = 'medium';
        if (sku.margin_percent > 30) marginClass = 'high';
        if (sku.margin_percent < 15) marginClass = 'low';

        return `
            <tr>
                <td><div style="font-weight: 600; color: var(--text-color);">${escapeHtml(sku.name)}</div></td>
                <td>${escapeHtml(sku.brand_name)}</td>
                <td>${formatCurrency(sku.purchase_price)}</td>
                <td>${formatCurrency(sku.selling_price)}</td>
                <td><span class="margin-badge ${marginClass}">${sku.margin_percent}%</span></td>
                <td>${formatNumber(sku.stock_in_hand)}</td>
                <td>${formatNumber(sku.avg_monthly_sale || 0)}</td>
                <td>${sku.days_of_inventory === 999 ? '999+' : sku.days_of_inventory} days</td>
                <td><span class="${statusBadge}">${sku.status}</span></td>
                <td>
                    <div class="action-btns">
                        <button class="btn btn-sm" style="background:var(--bg-color); color:var(--text-color); border:1px solid var(--border-color);" onclick="editSKU(${sku.id})" title="Edit">✎</button>
                        <button class="btn btn-sm" style="background:rgba(239, 68, 68, 0.1); color:var(--danger-color); border:none;" onclick="deleteSKU(${sku.id})" title="Delete">🗑️</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function openBrandModal() {
    const modal = document.getElementById('brandModal');
    if (modal) {
        document.getElementById('brandForm').reset();
        modal.style.display = 'block';
    }
}

function closeBrandModal() {
    const modal = document.getElementById('brandModal');
    if (modal) modal.style.display = 'none';
}

async function saveBrand() {
    const btn = document.querySelector('#brandForm button[type="submit"]');
    setLoading(btn, true);

    const brand = {
        name: document.getElementById('brandName').value,
        margin_slab: parseFloat(document.getElementById('marginSlab').value) || null
    };

    try {
        const response = await apiRequest('/api/brands', {
            method: 'POST',
            body: JSON.stringify(brand)
        });

        if (response && response.ok) {
            if (window.Toast) Toast.success('Brand Created');
            closeBrandModal();
            loadBrands();
        } else {
            const data = await response.json();
            throw new Error(data.error || 'Failed to save brand');
        }
    } catch (e) {
        if (window.Toast) Toast.error(e.message);
    } finally {
        setLoading(btn, false);
    }
}

async function deleteBrand(id) {
    if (!confirm('Delete this Brand? SKUs will remain but may need update.')) return;
    try {
        const response = await apiRequest(`/api/brands/${id}`, { method: 'DELETE' });
        if (response && response.ok) {
            if (window.Toast) Toast.success('Brand deleted');
            loadBrands();
        } else {
            if (window.Toast) Toast.error('Failed to delete Brand');
        }
    } catch (e) {
        if (window.Toast) Toast.error('Error deleting brand');
    }
}

// SKU MODAL
function populateBrandDropdown() {
    const select = document.getElementById('skuBrand');
    if (select) {
        const optionsHtml = '<option value="">Select Brand</option>' +
            brandsData.map(b => `<option value="${b.id}">${escapeHtml(b.name)}</option>`).join('');
        select.innerHTML = optionsHtml;
    }
}

function openSKUModal(skuId = null) {
    const modal = document.getElementById('skuModal');
    const form = document.getElementById('skuForm');
    const title = document.getElementById('skuModalTitle');

    if (!modal || !form) return;

    form.reset();
    document.getElementById('skuId').value = '';
    populateBrandDropdown();

    if (skuId) {
        const sku = skusData.find(s => s.id == skuId);
        if (sku) {
            title.textContent = 'Edit SKU';
            document.getElementById('skuId').value = sku.id;
            document.getElementById('skuName').value = sku.name;
            document.getElementById('skuBrand').value = sku.brand_id;
            document.getElementById('purchasePrice').value = sku.purchase_price;
            document.getElementById('sellingPrice').value = sku.selling_price;
            document.getElementById('marginPercent').value = sku.margin_percent;
            document.getElementById('stockInHand').value = sku.stock_in_hand;
        }
    } else {
        title.textContent = 'Add SKU';
    }

    modal.style.display = 'block';
}

function closeSKUModal() {
    const modal = document.getElementById('skuModal');
    if (modal) modal.style.display = 'none';
}

function editSKU(id) {
    openSKUModal(id);
}

function calculateSKUMargin() {
    const purchase = parseFloat(document.getElementById('purchasePrice').value) || 0;
    const selling = parseFloat(document.getElementById('sellingPrice').value) || 0;

    if (selling > 0) {
        const margin = ((selling - purchase) / selling * 100).toFixed(2);
        document.getElementById('marginPercent').value = margin;
    } else {
        document.getElementById('marginPercent').value = '';
    }
}

async function saveSKU() {
    const btn = document.querySelector('#skuForm button[type="submit"]');
    setLoading(btn, true);

    const id = document.getElementById('skuId').value;
    const sku = {
        name: document.getElementById('skuName').value,
        brand_id: parseInt(document.getElementById('skuBrand').value),
        purchase_price: parseFloat(document.getElementById('purchasePrice').value),
        selling_price: parseFloat(document.getElementById('sellingPrice').value),
        stock_in_hand: parseFloat(document.getElementById('stockInHand').value)
    };

    try {
        const url = id ? `/api/skus/${id}` : '/api/skus';
        const method = id ? 'PUT' : 'POST';

        const response = await apiRequest(url, {
            method: method,
            body: JSON.stringify(sku)
        });

        if (response && response.ok) {
            if (window.Toast) Toast.success(id ? 'SKU Updated' : 'SKU Created');
            closeSKUModal();
            loadSKUs();
        } else {
            const data = await response.json();
            throw new Error(data.error || 'Failed to save SKU');
        }
    } catch (e) {
        if (window.Toast) Toast.error(e.message);
    } finally {
        setLoading(btn, false);
    }
}

async function deleteSKU(id) {
    if (!confirm('Are you sure you want to delete this SKU?')) return;
    try {
        const response = await apiRequest(`/api/skus/${id}`, { method: 'DELETE' });
        if (response && response.ok) {
            if (window.Toast) Toast.success('SKU Deleted');
            loadSKUs();
        } else {
            if (window.Toast) Toast.error('Failed to delete SKU');
        }
    } catch (e) {
        if (window.Toast) Toast.error('Error deleting SKU');
    }
}

// Helpers
function filterSKUs() {
    const search = document.getElementById('searchSKU').value.toLowerCase();
    const filtered = skusData.filter(s =>
        s.name.toLowerCase().includes(search) ||
        s.brand_name.toLowerCase().includes(search)
    );
    displaySKUs(filtered);
}

function getMonthStart() {
    const date = new Date();
    return new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0];
}

function getToday() {
    return new Date().toISOString().split('T')[0];
}

function switchTab(tab) {
    document.querySelectorAll('.pill-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(c => c.classList.add('hidden'));

    if (tab === 'brands') {
        document.querySelectorAll('.pill-tab')[0].classList.add('active');
        document.getElementById('brandsTab').classList.remove('hidden');
    } else {
        document.querySelectorAll('.pill-tab')[1].classList.add('active');
        document.getElementById('skusTab').classList.remove('hidden');
    }
}

async function loadBrands() {
    const tbody = document.getElementById('brandsTableBody');
    // Skeleton (3 rows)
    tbody.innerHTML = Array(3).fill(0).map(() => `
        <tr>
            <td><div class="skeleton skeleton-text" style="width: 120px;"></div></td>
            <td><div class="skeleton skeleton-text" style="width: 60px;"></div></td>
            <td><div class="skeleton skeleton-text" style="width: 100px;"></div></td>
            <td><div class="skeleton skeleton-text" style="width: 100px;"></div></td>
            <td><div class="skeleton skeleton-text" style="width: 80px;"></div></td>
            <td><div class="skeleton skeleton-text" style="width: 60px;"></div></td>
        </tr>
    `).join('');

    try {
        const response = await apiRequest('/api/brands');
        if (!response) return;

        brandsData = await response.json();

        // Load KPIs asynchronously to show rendering fast
        displayBrands(brandsData); // First render basic data

        // Calculate brand-level KPIs
        const newBrandsData = [...brandsData];
        for (const brand of newBrandsData) {
            const response = await apiRequest(`/api/profit/by-brand?start_date=${getMonthStart()}&end_date=${getToday()}`);
            if (response) {
                const profitData = await response.json();
                const brandProfit = profitData.find(p => p.id === brand.id);
                if (brandProfit) {
                    brand.monthly_profit = brandProfit.profit;
                    brand.capital_invested = brandProfit.capital_invested;
                    brand.capital_roi = brandProfit.roi;
                }
            }
        }
        displayBrands(newBrandsData); // Re-render with KPIs

    } catch (error) {
        console.error('Error loading brands:', error);
    }
}

function displayBrands(brands) {
    const tbody = document.getElementById('brandsTableBody');
    if (!tbody) return;

    if (brands.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 40px;">No brands found</td></tr>`;
        return;
    }

    const rowsHtml = brands.map(brand => `
        <tr>
            <td><div style="font-weight: 600; color: var(--text-color);">${escapeHtml(brand.name)}</div></td>
            <td>${brand.margin_slab ? brand.margin_slab + '%' : '-'}</td>
            <td>${formatCurrency(brand.capital_invested || 0)}</td>
            <td>${formatCurrency(brand.monthly_profit || 0)}</td>
            <td>${brand.capital_roi ? brand.capital_roi.toFixed(2) + '%' : '-'}</td>
            <td>
                <div class="action-btns">
                    <button class="btn btn-sm btn-danger" onclick="deleteBrand(${brand.id})" title="Delete">🗑️</button>
                </div>
            </td>
        </tr>
    `).join('');

    tbody.innerHTML = rowsHtml;
}

async function deleteBrand(id) {
    if (!confirm('Delete this Brand? SKUs associated with this brand will NOT be deleted, but may need reassignment.')) return;
    try {
        const response = await apiRequest(`/api/brands/${id}`, { method: 'DELETE' });
        if (response && response.ok) {
            if (window.Toast) Toast.success('Brand deleted');
            loadBrands();
        } else {
            if (window.Toast) Toast.error('Failed to delete Brand');
        }
    } catch (e) {
        console.error(e);
        if (window.Toast) Toast.error('Error deleting brand');
    }
}

async function loadSKUs() {
    const tbody = document.getElementById('skusTableBody');
    // Skeleton
    tbody.innerHTML = Array(6).fill(0).map(() => `
        <tr>
            <td><div class="skeleton skeleton-text" style="width: 150px;"></div></td>
            <td><div class="skeleton skeleton-text" style="width: 80px;"></div></td>
            <td><div class="skeleton skeleton-text" style="width: 80px;"></div></td>
            <td><div class="skeleton skeleton-text" style="width: 80px;"></div></td>
            <td><div class="skeleton skeleton-text" style="width: 60px;"></div></td>
            <td><div class="skeleton skeleton-text" style="width: 60px;"></div></td>
            <td><div class="skeleton skeleton-text" style="width: 80px;"></div></td>
            <td><div class="skeleton skeleton-text" style="width: 80px;"></div></td>
            <td><div class="skeleton skeleton-text" style="width: 80px;"></div></td>
            <td><div class="skeleton skeleton-text" style="width: 60px;"></div></td>
        </tr>
    `).join('');

    try {
        const response = await apiRequest('/api/skus');
        if (!response) return;

        skusData = await response.json();

        // Update SKU status logic check
        skusData.forEach(sku => {
            // Calculate days of inventory
            if (sku.avg_monthly_sale > 0) {
                sku.days_of_inventory = ((sku.stock_in_hand / sku.avg_monthly_sale) * 30).toFixed(0);
            } else {
                sku.days_of_inventory = sku.stock_in_hand > 0 ? '999+' : '0';
            }

            // Status logic override
            if (sku.days_of_inventory > 90) sku.status = 'DEAD';
            else if (sku.days_of_inventory > 45) sku.status = 'SLOW';
            else sku.status = 'FAST';
        });

        displaySKUs(skusData);
        populateBrandDropdown();
    } catch (error) {
        console.error('Error loading SKUs:', error);
    }
}

function displaySKUs(skus) {
    const tbody = document.getElementById('skusTableBody');
    if (!tbody) return;

    if (skus.length === 0) {
        tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding: 40px;">No SKUs found</td></tr>`;
        return;
    }

    const rowsHtml = skus.map(sku => {
        let statusBadge = 'status-pill inactive';
        if (sku.status === 'FAST') statusBadge = 'status-pill active';
        else if (sku.status === 'DEAD') statusBadge = 'status-pill cancelled'; // Reuse cancelled style
        else if (sku.status === 'SLOW') statusBadge = 'status-pill pending'; // Reuse pending style

        // Margin Badge
        let marginClass = 'medium';
        if (sku.margin_percent > 30) marginClass = 'high';
        if (sku.margin_percent < 15) marginClass = 'low';

        return `
            <tr>
                <td><div style="font-weight: 600;">${escapeHtml(sku.name)}</div></td>
                <td>${escapeHtml(sku.brand_name)}</td>
                <td>${formatCurrency(sku.purchase_price)}</td>
                <td>${formatCurrency(sku.selling_price)}</td>
                <td><span class="margin-badge ${marginClass}">${sku.margin_percent}%</span></td>
                <td>${formatNumber(sku.stock_in_hand)}</td>
                <td>${formatNumber(sku.avg_monthly_sale || 0)}</td>
                <td>${sku.days_of_inventory} days</td>
                <td><span class="${statusBadge}" style="display:inline-block;">${sku.status}</span></td>
                <td>
                    <div class="action-btns">
                        <button class="btn btn-sm btn-secondary" onclick="editSKU(${sku.id})" title="Edit">✎</button>
                        <button class="btn btn-sm btn-danger" onclick="deleteSKU(${sku.id})" title="Delete">🗑️</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    tbody.innerHTML = rowsHtml;
}

async function deleteSKU(id) {
    if (!confirm('Delete this SKU? Inventory and sales history will be preserved but archived.')) return;
    try {
        const response = await apiRequest(`/api/skus/${id}`, { method: 'DELETE' });
        if (response && response.ok) {
            if (window.Toast) Toast.success('SKU deleted');
            loadSKUs();
        } else {
            if (window.Toast) Toast.error('Failed to delete SKU');
        }
    } catch (e) { console.error(e); }
}

function filterSKUs() {
    const search = document.getElementById('searchSKU').value.toLowerCase();
    const filtered = skusData.filter(s =>
        s.name.toLowerCase().includes(search) ||
        s.brand_name.toLowerCase().includes(search)
    );
    displaySKUs(filtered);
}

function populateBrandDropdown() {
    const select = document.getElementById('skuBrand');
    const optionsHtml = '<option value="">Select Brand</option>' +
        brandsData.map(b => `<option value="${b.id}">${escapeHtml(b.name)}</option>`).join('');
    setInnerHtmlSafe(select, optionsHtml);
}

function openBrandModal() {
    document.getElementById('brandModal').classList.add('active');
    document.getElementById('brandForm').reset();
}

function closeBrandModal() {
    document.getElementById('brandModal').classList.remove('active');
}

async function saveBrand() {
    const brand = {
        name: document.getElementById('brandName').value,
        margin_slab: parseFloat(document.getElementById('marginSlab').value) || null
    };

    const errorDiv = document.getElementById('brandFormError');

    try {
        const response = await apiRequest('/api/brands', {
            method: 'POST',
            body: JSON.stringify(brand)
        });

        if (!response) return;

        const data = await response.json();
        if (response.ok) {
            closeBrandModal();
            await loadBrands();
            await loadSKUs(); // Reload to update brand dropdown
        } else {
            errorDiv.textContent = data.error || 'Error saving brand';
            errorDiv.style.display = 'block';
        }
    } catch (error) {
        errorDiv.textContent = 'Error saving brand';
        errorDiv.style.display = 'block';
    }
}

function openSKUModal(skuId = null) {
    const modal = document.getElementById('skuModal');
    const form = document.getElementById('skuForm');
    const title = document.getElementById('skuModalTitle');

    form.reset();
    document.getElementById('skuId').value = '';
    populateBrandDropdown();

    if (skuId) {
        const sku = skusData.find(s => s.id === skuId);
        if (sku) {
            title.textContent = 'Edit SKU';
            document.getElementById('skuId').value = sku.id;
            document.getElementById('skuName').value = sku.name;
            document.getElementById('skuBrand').value = sku.brand_id;
            document.getElementById('purchasePrice').value = sku.purchase_price;
            document.getElementById('sellingPrice').value = sku.selling_price;
            document.getElementById('marginPercent').value = sku.margin_percent;
            document.getElementById('stockInHand').value = sku.stock_in_hand;
        }
    } else {
        title.textContent = 'Add SKU';
    }

    modal.classList.add('active');
}

function closeSKUModal() {
    document.getElementById('skuModal').classList.remove('active');
}

function calculateSKUMargin() {
    const purchase = parseFloat(document.getElementById('purchasePrice').value) || 0;
    const selling = parseFloat(document.getElementById('sellingPrice').value) || 0;

    if (selling > 0) {
        const margin = ((selling - purchase) / selling * 100).toFixed(2);
        document.getElementById('marginPercent').value = margin;
    } else {
        document.getElementById('marginPercent').value = '';
    }
}

async function saveSKU() {
    const id = document.getElementById('skuId').value;
    const sku = {
        name: document.getElementById('skuName').value,
        brand_id: parseInt(document.getElementById('skuBrand').value),
        purchase_price: parseFloat(document.getElementById('purchasePrice').value),
        selling_price: parseFloat(document.getElementById('sellingPrice').value),
        stock_in_hand: parseFloat(document.getElementById('stockInHand').value)
    };

    const errorDiv = document.getElementById('skuFormError');

    try {
        const url = id ? `/api/skus/${id}` : '/api/skus';
        const method = id ? 'PUT' : 'POST';

        const response = await apiRequest(url, {
            method: method,
            body: JSON.stringify(sku)
        });

        if (!response) return;

        const data = await response.json();
        if (response.ok) {
            closeSKUModal();
            await loadSKUs();
        } else {
            errorDiv.textContent = data.error || 'Error saving SKU';
            errorDiv.style.display = 'block';
        }
    } catch (error) {
        errorDiv.textContent = 'Error saving SKU';
        errorDiv.style.display = 'block';
    }
}

function editSKU(id) {
    openSKUModal(id);
}

function getMonthStart() {
    const date = new Date();
    return new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0];
}

function getToday() {
    return new Date().toISOString().split('T')[0];
}

