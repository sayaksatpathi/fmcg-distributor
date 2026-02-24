let productTests = [];

document.addEventListener('DOMContentLoaded', async () => {
    await loadProductTests();
    
    document.getElementById('testForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveProductTest();
    });
    
    document.getElementById('performanceForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await updatePerformance();
    });
});

async function loadProductTests() {
    try {
        const response = await apiRequest('/api/product-tests');
        if (!response) return;
        
        productTests = await response.json();
        displayProductTests(productTests);
    } catch (error) {
        console.error('Error loading product tests:', error);
    }
}

function displayProductTests(tests) {
    const tbody = document.getElementById('productTestsBody');
    if (!tbody) return;
    
    if (tests.length === 0) {
        setInnerHtmlSafe(tbody, '<tr><td colspan="10" class="text-center">No product tests found</td></tr>');
        return;
    }
    
    const rowsHtml = tests.map(test => {
        const unitCost = test.batch_size > 0 ? test.total_cost / test.batch_size : 0;
        const actualMargin = test.selling_price > 0 ? ((test.selling_price - unitCost) / test.selling_price * 100).toFixed(2) : test.actual_margin;
        
        let recommendationBadge = '';
        if (test.recommendation === 'CONTINUE') {
            recommendationBadge = '<span class="badge badge-green">CONTINUE</span>';
        } else if (test.recommendation === 'KILL') {
            recommendationBadge = '<span class="badge badge-red">KILL</span>';
        } else {
            recommendationBadge = '<span class="badge badge-yellow">PENDING</span>';
        }
        
        const createdDate = new Date(test.created_at);
        const daysSince = Math.floor((new Date() - createdDate) / (1000 * 60 * 60 * 24));
        const canUpdatePerformance = daysSince >= 30 && !test.recommendation;
        
        return `
            <tr>
                <td><strong>${escapeHtml(test.product_name)}</strong></td>
                <td>${formatNumber(test.batch_size)}</td>
                <td>${formatCurrency(test.total_cost)}</td>
                <td>${formatCurrency(test.selling_price)}</td>
                <td>${test.expected_margin ? test.expected_margin + '%' : '-'}</td>
                <td>${actualMargin}%</td>
                <td>${formatNumber(test.sales_quantity || 0)}</td>
                <td>${formatCurrency(test.sales_revenue || 0)}</td>
                <td>${recommendationBadge}</td>
                <td>
                    ${canUpdatePerformance ? `<button class="btn btn-sm btn-primary" onclick="openPerformanceModal(${test.id})">Update Performance</button>` : '-'}
                </td>
            </tr>
        `;
    }).join('');

    setInnerHtmlSafe(tbody, rowsHtml);
}

function calculateTestMargin() {
    const batchSize = parseFloat(document.getElementById('batchSize').value) || 0;
    const totalCost = parseFloat(document.getElementById('totalCost').value) || 0;
    const sellingPrice = parseFloat(document.getElementById('sellingPrice').value) || 0;
    
    if (batchSize > 0 && sellingPrice > 0) {
        const unitCost = totalCost / batchSize;
        const margin = ((sellingPrice - unitCost) / sellingPrice * 100).toFixed(2);
        document.getElementById('actualMargin').value = margin + '%';
    } else {
        document.getElementById('actualMargin').value = '';
    }
}

function openTestModal() {
    document.getElementById('testModal').classList.add('active');
    document.getElementById('testForm').reset();
    document.getElementById('actualMargin').value = '';
}

function closeTestModal() {
    document.getElementById('testModal').classList.remove('active');
}

async function saveProductTest() {
    const test = {
        product_name: document.getElementById('productName').value,
        batch_size: parseFloat(document.getElementById('batchSize').value),
        total_cost: parseFloat(document.getElementById('totalCost').value),
        selling_price: parseFloat(document.getElementById('sellingPrice').value),
        expected_margin: parseFloat(document.getElementById('expectedMargin').value) || null
    };
    
    const errorDiv = document.getElementById('testFormError');
    
    try {
        const response = await apiRequest('/api/product-tests', {
            method: 'POST',
            body: JSON.stringify(test)
        });
        
        if (!response) return;
        
        const data = await response.json();
        if (response.ok) {
            closeTestModal();
            await loadProductTests();
        } else {
            errorDiv.textContent = data.error || 'Error saving product test';
            errorDiv.style.display = 'block';
        }
    } catch (error) {
        errorDiv.textContent = 'Error saving product test';
        errorDiv.style.display = 'block';
    }
}

function openPerformanceModal(testId) {
    document.getElementById('performanceModal').classList.add('active');
    document.getElementById('performanceTestId').value = testId;
    document.getElementById('performanceForm').reset();
}

function closePerformanceModal() {
    document.getElementById('performanceModal').classList.remove('active');
}

async function updatePerformance() {
    const testId = document.getElementById('performanceTestId').value;
    const performance = {
        sales_quantity: parseFloat(document.getElementById('salesQuantity').value),
        sales_revenue: parseFloat(document.getElementById('salesRevenue').value),
        recommendation: document.getElementById('recommendation').value
    };
    
    const errorDiv = document.getElementById('performanceFormError');
    
    try {
        const response = await apiRequest(`/api/product-tests/${testId}/performance`, {
            method: 'PUT',
            body: JSON.stringify(performance)
        });
        
        if (!response) return;
        
        const data = await response.json();
        if (response.ok) {
            closePerformanceModal();
            await loadProductTests();
        } else {
            errorDiv.textContent = data.error || 'Error updating performance';
            errorDiv.style.display = 'block';
        }
    } catch (error) {
        errorDiv.textContent = 'Error updating performance';
        errorDiv.style.display = 'block';
    }
}

