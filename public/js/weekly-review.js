document.addEventListener('DOMContentLoaded', async () => {
    await loadWeeklyReview();
});

async function loadWeeklyReview() {
    try {
        const response = await apiRequest('/api/weekly-review');
        if (!response) return;
        
        const data = await response.json();
        displayWeeklyReview(data);
    } catch (error) {
        console.error('Error loading weekly review:', error);
        if (error.message.includes('403')) {
            alert('Access denied. This page is for Owner only.');
            window.location.href = 'dashboard.html';
        }
    }
}

function displayWeeklyReview(data) {
    displayRiskyRetailers(data.riskyRetailers || []);
    displayDeadSkus(data.deadSkus || []);
    displayExpandBrands(data.expandBrands || []);
    displayCreditSummary(data.creditSummary || {});
}

function displayRiskyRetailers(retailers) {
    const tbody = document.getElementById('riskyRetailersBody');
    if (!tbody) return;
    
    if (retailers.length === 0) {
        setInnerHtmlSafe(tbody, '<tr><td colspan="5" class="text-center">No risky retailers identified</td></tr>');
        return;
    }
    
    const rowsHtml = retailers.map(r => {
        let action = 'WARN';
        if (r.days_outstanding > 45 || r.outstanding_amount > r.credit_limit * 1.2) {
            action = '<strong style="color: var(--danger-color);">STOP</strong>';
        }
        
        return `
            <tr>
                <td><strong>${escapeHtml(r.name)}</strong></td>
                <td class="credit-red">${formatCurrency(r.outstanding_amount)}</td>
                <td class="credit-red">${r.days_outstanding} days</td>
                <td>${formatCurrency(r.credit_limit)}</td>
                <td>${action}</td>
            </tr>
        `;
    }).join('');

    setInnerHtmlSafe(tbody, rowsHtml);
}

function displayDeadSkus(skus) {
    const tbody = document.getElementById('deadSkusBody');
    if (!tbody) return;
    
    if (skus.length === 0) {
        setInnerHtmlSafe(tbody, '<tr><td colspan="4" class="text-center">No dead SKUs identified</td></tr>');
        return;
    }
    
    const rowsHtml = skus.map(s => `
        <tr>
            <td><strong>${escapeHtml(s.name)}</strong></td>
            <td>${escapeHtml(s.brand_name)}</td>
            <td>${formatNumber(s.stock_in_hand)}</td>
            <td><span class="badge badge-red">${s.status}</span></td>
        </tr>
    `).join('');

    setInnerHtmlSafe(tbody, rowsHtml);
}

function displayExpandBrands(brands) {
    const tbody = document.getElementById('expandBrandsBody');
    if (!tbody) return;
    
    if (brands.length === 0) {
        setInnerHtmlSafe(tbody, '<tr><td colspan="5" class="text-center">No expansion opportunities identified</td></tr>');
        return;
    }
    
    const rowsHtml = brands.map(b => {
        const roi = b.capital_invested > 0 ? (b.monthly_profit / b.capital_invested * 100).toFixed(2) : 0;
        return `
            <tr>
                <td><strong>${escapeHtml(b.name)}</strong></td>
                <td>${formatCurrency(b.monthly_profit)}</td>
                <td>${formatCurrency(b.capital_invested)}</td>
                <td>${roi}%</td>
                <td><span class="badge badge-green">EXPAND</span></td>
            </tr>
        `;
    }).join('');

    setInnerHtmlSafe(tbody, rowsHtml);
}

function displayCreditSummary(summary) {
    const container = document.getElementById('creditSummaryBody');
    if (!container) return;
    
    const overduePercent = summary.total_outstanding > 0 
        ? ((summary.overdue_amount / summary.total_outstanding) * 100).toFixed(1)
        : 0;
    
    const html = `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px;">
            <div class="widget">
                <div class="widget-header">Total Retailers</div>
                <div class="widget-value">${summary.total_retailers || 0}</div>
            </div>
            <div class="widget">
                <div class="widget-header">Retailers with Credit</div>
                <div class="widget-value">${summary.retailers_with_credit || 0}</div>
            </div>
            <div class="widget">
                <div class="widget-header">Overdue Retailers</div>
                <div class="widget-value" style="color: ${summary.overdue_retailers > 0 ? 'var(--danger-color)' : 'var(--text-color)'};">${summary.overdue_retailers || 0}</div>
            </div>
            <div class="widget">
                <div class="widget-header">Total Outstanding</div>
                <div class="widget-value">${formatCurrency(summary.total_outstanding || 0)}</div>
            </div>
            <div class="widget">
                <div class="widget-header">Overdue Amount</div>
                <div class="widget-value" style="color: var(--danger-color);">${formatCurrency(summary.overdue_amount || 0)}</div>
            </div>
            <div class="widget">
                <div class="widget-header">Overdue %</div>
                <div class="widget-value" style="color: ${overduePercent > 10 ? 'var(--danger-color)' : 'var(--warning-color)'};">${overduePercent}%</div>
                <small style="color: var(--text-light);">Target: &lt;10%</small>
            </div>
        </div>
    `;

    setInnerHtmlSafe(container, html);
}

