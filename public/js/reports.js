document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    // Set default dates (This Month)
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    document.getElementById('startDate').valueAsDate = firstDay;
    document.getElementById('endDate').valueAsDate = now;

    switchReport('sales');
});

let currentReport = 'sales';

function switchReport(type) {
    currentReport = type;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    event && event.target.classList.add('active');

    // Toggle date filters
    const showDates = ['sales', 'profit'].includes(type);
    document.getElementById('dateFilters').style.display = showDates ? 'flex' : 'none';

    loadCurrentReport();
}

async function loadCurrentReport() {
    const container = document.getElementById('reportContent');

    // Skeleton State
    container.innerHTML = `
        <div class="data-grid">
            <div class="stat-box"><div class="skeleton skeleton-text" style="width: 50%; height: 32px;"></div><div class="skeleton skeleton-text" style="width: 30%;"></div></div>
            <div class="stat-box"><div class="skeleton skeleton-text" style="width: 50%; height: 32px;"></div><div class="skeleton skeleton-text" style="width: 30%;"></div></div>
            <div class="stat-box"><div class="skeleton skeleton-text" style="width: 50%; height: 32px;"></div><div class="skeleton skeleton-text" style="width: 30%;"></div></div>
        </div>
        <div style="margin-top: 32px;">
            <div class="skeleton skeleton-text" style="width: 200px; height: 24px; margin-bottom: 16px;"></div>
            <div class="skeleton" style="width: 100%; height: 200px; border-radius: 8px;"></div>
        </div>
    `;

    const start = document.getElementById('startDate').value;
    const end = document.getElementById('endDate').value;
    const query = `start_date=${start}&end_date=${end}`;

    try {
        // Artificial delay for smooth skeleton effect
        // await new Promise(r => setTimeout(r, 600));

        const response = await apiRequest(`/api/reports/${currentReport}?${query}`);
        if (!response) return;
        const data = await response.json();
        renderReport(currentReport, data);
    } catch (e) {
        console.error(e);
        container.innerHTML = `
            <div class="text-center p-5">
                <div style="font-size: 40px; margin-bottom: 16px;">⚠️</div>
                <h4 class="text-secondary">Failed to load report</h4>
                <p class="text-light">${e.message}</p>
            </div>`;
    }
}

function renderReport(type, data) {
    const container = document.getElementById('reportContent');
    const summary = data.summary || {};

    // Generic renderer or specific based on type
    if (type === 'sales') {
        container.innerHTML = `
            <div class="data-grid">
                <div class="stat-box">
                    <div class="stat-value">${formatCurrency(summary.totalSales)}</div>
                    <div class="stat-label">Total Revenue</div>
                </div>
                <div class="stat-box">
                    <div class="stat-value">${formatCurrency(summary.totalProfit)}</div>
                    <div class="stat-label">Gross Profit</div>
                </div>
                <div class="stat-box">
                    <div class="stat-value">${summary.transactionCount}</div>
                    <div class="stat-label">Transactions</div>
                </div>
            </div>
            
            <h4 style="margin: 32px 0 16px 0; padding-left: 8px; border-left: 4px solid var(--primary-color);">Recent Transactions</h4>
            <div class="table-responsive">
                <table class="premium-table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Retailer</th>
                            <th>Amount</th>
                            <th>Profit</th>
                            <th>Type</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${(data.data || []).slice(0, 50).map(row => `
                            <tr>
                                <td>
                                    <div style="font-weight: 500;">${formatDate(row.date)}</div>
                                </td>
                                <td>${escapeHtml(row.retailer_name)}</td>
                                <td style="font-family: 'Inter', sans-serif; font-weight: 600;">${formatCurrency(row.total_amount)}</td>
                                <td style="color: #10b981; font-weight: 500;">+${formatCurrency(row.gross_profit)}</td>
                                <td><span style="font-size: 11px; text-transform: uppercase; padding: 2px 6px; background: #f1f5f9; border-radius: 4px; font-weight: 600;">${row.payment_type}</span></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    } else if (type === 'inventory') {
        container.innerHTML = `
            <div class="data-grid">
                <div class="stat-box">
                    <div class="stat-value">${summary.totalSKUs}</div>
                    <div class="stat-label">Total SKUs</div>
                </div>
                <div class="stat-box">
                    <div class="stat-value">${formatCurrency(summary.totalStockValue)}</div>
                    <div class="stat-label">Stock Value</div>
                </div>
                <div class="stat-box" style="border-color: #fecaca; background: #fef2f2;">
                    <div class="stat-value" style="color: #ef4444; -webkit-text-fill-color: #ef4444;">${summary.outOfStock}</div>
                    <div class="stat-label" style="color: #b91c1c;">Out of Stock</div>
                </div>
            </div>

            <h4 style="margin: 32px 0 16px 0; padding-left: 8px; border-left: 4px solid var(--secondary-color);">Inventory Details</h4>
            <div class="table-responsive">
                <table class="premium-table">
                    <thead>
                        <tr>
                            <th>Product</th>
                            <th>Stock</th>
                            <th>Value</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>${(data.data || []).map(r => `
                        <tr>
                            <td style="font-weight: 500;">${escapeHtml(r.sku_name)}</td>
                            <td>
                                <span style="font-weight: 600; ${r.stock_in_hand < 10 ? 'color: #ef4444;' : ''}">
                                    ${r.stock_in_hand}
                                </span>
                            </td>
                            <td>${formatCurrency(r.stock_value)}</td>
                            <td>
                                <span class="status-badge ${r.stock_in_hand === 0 ? 'cancelled' : (r.stock_in_hand < 10 ? 'pending' : 'completed')}">
                                    ${r.status || (r.stock_in_hand === 0 ? 'Out of Stock' : (r.stock_in_hand < 10 ? 'Low Stock' : 'In Stock'))}
                                </span>
                            </td>
                        </tr>`).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }
    else {
        container.innerHTML = `<pre style="background: rgba(0,0,0,0.03); padding: 20px; border-radius: 8px;">${JSON.stringify(summary, null, 2)}</pre>`;
    }
}

async function exportReport() {
    const start = document.getElementById('startDate').value;
    const end = document.getElementById('endDate').value;
    alert(`Export feature would generate a PDF for ${currentReport} from ${start} to ${end}. (Backend export endpoint exists at /api/reports/export/${currentReport})`);
    // In real impl, we'd window.open the export URL or fetch blob
}
