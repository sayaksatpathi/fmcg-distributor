document.addEventListener('DOMContentLoaded', () => {
    // Wait for dates to be set
    setTimeout(() => {
        loadProfitData();
    }, 100);
});

function switchTab(tab) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    
    if (tab === 'brand') {
        document.querySelectorAll('.tab')[0].classList.add('active');
        document.getElementById('brandTab').classList.add('active');
    } else if (tab === 'retailer') {
        document.querySelectorAll('.tab')[1].classList.add('active');
        document.getElementById('retailerTab').classList.add('active');
    } else {
        document.querySelectorAll('.tab')[2].classList.add('active');
        document.getElementById('skuTab').classList.add('active');
    }
    
    loadProfitData();
}

async function loadProfitData() {
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    
    await loadBrandProfit(startDate, endDate);
    await loadRetailerProfit(startDate, endDate);
    await loadSKUProfit(startDate, endDate);
}

async function loadBrandProfit(startDate, endDate) {
    try {
        const response = await apiRequest(`/api/profit/by-brand?start_date=${startDate}&end_date=${endDate}`);
        if (!response) return;
        
        const data = await response.json();
        displayBrandProfit(data);
    } catch (error) {
        console.error('Error loading brand profit:', error);
    }
}

function displayBrandProfit(data) {
    const tbody = document.getElementById('brandProfitBody');
    if (!tbody) return;
    
    // Sort by profit descending
    const sorted = [...data].sort((a, b) => (b.profit || 0) - (a.profit || 0));
    
    if (sorted.length === 0) {
        setInnerHtmlSafe(tbody, '<tr><td colspan="5" class="text-center">No data available</td></tr>');
        return;
    }
    
    const rowsHtml = sorted.map((item, index) => {
        const profit = parseFloat(item.profit || 0);
        const lossClass = profit < 0 ? 'credit-red' : '';
        
        return `
            <tr>
                <td>#${index + 1}</td>
                <td><strong>${escapeHtml(item.name)}</strong></td>
                <td class="${lossClass}">${formatCurrency(profit)}</td>
                <td>${formatCurrency(item.capital_invested || 0)}</td>
                <td>${item.roi ? item.roi.toFixed(2) + '%' : '-'}</td>
            </tr>
        `;
    }).join('');

    setInnerHtmlSafe(tbody, rowsHtml);
}

async function loadRetailerProfit(startDate, endDate) {
    try {
        const response = await apiRequest(`/api/profit/by-retailer?start_date=${startDate}&end_date=${endDate}`);
        if (!response) return;
        
        const data = await response.json();
        displayRetailerProfit(data);
    } catch (error) {
        console.error('Error loading retailer profit:', error);
    }
}

function displayRetailerProfit(data) {
    const tbody = document.getElementById('retailerProfitBody');
    if (!tbody) return;
    
    const sorted = [...data].sort((a, b) => (b.profit || 0) - (a.profit || 0));
    
    if (sorted.length === 0) {
        setInnerHtmlSafe(tbody, '<tr><td colspan="3" class="text-center">No data available</td></tr>');
        return;
    }
    
    const rowsHtml = sorted.map((item, index) => {
        const profit = parseFloat(item.profit || 0);
        const lossClass = profit < 0 ? 'credit-red' : '';
        
        return `
            <tr>
                <td>#${index + 1}</td>
                <td><strong>${escapeHtml(item.name)}</strong></td>
                <td class="${lossClass}">${formatCurrency(profit)}</td>
            </tr>
        `;
    }).join('');

    setInnerHtmlSafe(tbody, rowsHtml);
}

async function loadSKUProfit(startDate, endDate) {
    try {
        const response = await apiRequest(`/api/profit/by-sku?start_date=${startDate}&end_date=${endDate}`);
        if (!response) return;
        
        const data = await response.json();
        displaySKUProfit(data);
    } catch (error) {
        console.error('Error loading SKU profit:', error);
    }
}

function displaySKUProfit(data) {
    const tbody = document.getElementById('skuProfitBody');
    if (!tbody) return;
    
    const sorted = [...data].sort((a, b) => (b.profit || 0) - (a.profit || 0));
    
    if (sorted.length === 0) {
        setInnerHtmlSafe(tbody, '<tr><td colspan="5" class="text-center">No data available</td></tr>');
        return;
    }
    
    const rowsHtml = sorted.map((item, index) => {
        const profit = parseFloat(item.profit || 0);
        const lossClass = profit < 0 ? 'credit-red' : '';
        
        return `
            <tr>
                <td>#${index + 1}</td>
                <td><strong>${escapeHtml(item.name)}</strong></td>
                <td>${escapeHtml(item.brand_name)}</td>
                <td class="${lossClass}">${formatCurrency(profit)}</td>
                <td>${formatNumber(item.quantity_sold || 0)}</td>
            </tr>
        `;
    }).join('');

    setInnerHtmlSafe(tbody, rowsHtml);
}

