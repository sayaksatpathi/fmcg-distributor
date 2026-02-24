let excelData = [];
let columnMapping = {};
let importType = '';

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('importType').addEventListener('change', (e) => {
        if (e.target.value) {
            document.getElementById('uploadCard').style.display = 'block';
        } else {
            document.getElementById('uploadCard').style.display = 'none';
        }
    });
});

function resetImport() {
    excelData = [];
    columnMapping = {};
    document.getElementById('excelFile').value = '';
    document.getElementById('uploadCard').style.display = 'none';
    document.getElementById('mappingCard').style.display = 'none';
    document.getElementById('importResults').style.display = 'none';
}

function uploadFile() {
    const fileInput = document.getElementById('excelFile');
    const file = fileInput.files[0];
    importType = document.getElementById('importType').value;

    if (!file || !importType) {
        alert('Please select both import type and file');
        return;
    }

    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            excelData = XLSX.utils.sheet_to_json(worksheet);

            if (excelData.length === 0) {
                alert('Excel file is empty');
                return;
            }

            showColumnMapping();
        } catch (error) {
            alert('Error reading Excel file: ' + error.message);
        }
    };
    reader.readAsArrayBuffer(file);
}

function showColumnMapping() {
    const container = document.getElementById('mappingContainer');
    const requiredFields = getRequiredFields(importType);

    const columns = Object.keys(excelData[0] || {});

    let html = '<table style="width: 100%;">';
    html += '<thead><tr><th>System Field</th><th>Excel Column</th></tr></thead><tbody>';

    requiredFields.forEach(field => {
        html += `<tr>
            <td>${escapeHtml(field.label)} ${field.required ? '<span style="color: red;">*</span>' : ''}</td>
            <td>
                <select class="column-mapping" data-field="${escapeAttr(field.name)}" ${field.required ? 'required' : ''}>
                    <option value="">Select Column</option>
                    ${columns.map(col => `<option value="${escapeAttr(col)}">${escapeHtml(col)}</option>`).join('')}
                </select>
            </td>
        </tr>`;
    });

    html += '</tbody></table>';
    html += `<div style="margin-top: 15px; padding: 15px; background: var(--bg-color); border-radius: 4px;">
        <strong>Preview:</strong> ${excelData.length} rows found
    </div>`;

    setInnerHtmlSafe(container, html);
    document.getElementById('mappingCard').style.display = 'block';
}

function getRequiredFields(type) {
    const fields = {
        retailers: [
            { name: 'name', label: 'Retailer Name', required: true },
            { name: 'area', label: 'Area / Beat', required: false },
            { name: 'phone', label: 'Phone', required: false },
            { name: 'credit_limit', label: 'Credit Limit', required: true },
            { name: 'credit_class', label: 'Credit Class (A/B/C/D)', required: false }
        ],
        skus: [
            { name: 'name', label: 'SKU Name', required: true },
            { name: 'brand', label: 'Brand Name', required: true },
            { name: 'purchase_price', label: 'Purchase Price', required: true },
            { name: 'selling_price', label: 'Selling Price', required: true },
            { name: 'stock_in_hand', label: 'Stock in Hand', required: false }
        ],
        outstanding: [
            { name: 'retailer_name', label: 'Retailer Name', required: true },
            { name: 'outstanding_amount', label: 'Outstanding Amount', required: true },
            { name: 'days_outstanding', label: 'Days Outstanding', required: false }
        ],
        stock: [
            { name: 'sku_name', label: 'SKU Name', required: true },
            { name: 'stock_in_hand', label: 'Stock in Hand', required: true }
        ]
    };

    return fields[type] || [];
}

async function importData() {
    const mappings = {};
    document.querySelectorAll('.column-mapping').forEach(select => {
        if (select.value) {
            mappings[select.dataset.field] = select.value;
        }
    });

    // Validate required fields
    const requiredFields = getRequiredFields(importType).filter(f => f.required);
    const missing = requiredFields.filter(f => !mappings[f.name]);

    if (missing.length > 0) {
        alert('Please map all required fields: ' + missing.map(f => f.label).join(', '));
        return;
    }

    // Transform data
    const transformedData = excelData.map(row => {
        const item = {};
        Object.keys(mappings).forEach(field => {
            const excelCol = mappings[field];
            let value = row[excelCol];

            // Type conversion
            if (['credit_limit', 'purchase_price', 'selling_price', 'stock_in_hand', 'outstanding_amount'].includes(field)) {
                value = parseFloat(value) || 0;
            } else if (['days_outstanding'].includes(field)) {
                value = parseInt(value) || 0;
            }

            item[field] = value;
        });
        return item;
    });

    // Import data
    const resultsDiv = document.getElementById('importResults');
    resultsDiv.innerHTML = '<div class="alert alert-green">Importing data... Please wait.</div>';
    resultsDiv.style.display = 'block';

    try {
        await performImport(importType, transformedData);
        resultsDiv.innerHTML = '';
        const alert = document.createElement('div');
        alert.className = 'alert alert-green';
        alert.textContent = `Successfully imported ${transformedData.length} records!`;
        resultsDiv.appendChild(alert);
    } catch (error) {
        resultsDiv.innerHTML = '';
        const alert = document.createElement('div');
        alert.className = 'alert alert-red';
        alert.textContent = `Import failed: ${error.message}`; // safe assignment
        resultsDiv.appendChild(alert);
    }
}
}

async function performImport(type, data) {
    // This is a simplified import - in production, you'd want to validate and handle errors better
    for (const item of data) {
        try {
            if (type === 'retailers') {
                await apiRequest('/api/retailers', {
                    method: 'POST',
                    body: JSON.stringify({
                        name: item.name,
                        area: item.area || '',
                        phone: item.phone || '',
                        credit_limit: item.credit_limit || 0,
                        credit_class: item.credit_class || 'C'
                    })
                });
            } else if (type === 'skus') {
                // First, get or create brand
                const brandsResponse = await apiRequest('/api/brands');
                if (brandsResponse) {
                    const brands = await brandsResponse.json();
                    let brand = brands.find(b => b.name.toLowerCase() === item.brand.toLowerCase());

                    if (!brand) {
                        const createBrandResponse = await apiRequest('/api/brands', {
                            method: 'POST',
                            body: JSON.stringify({ name: item.brand })
                        });
                        if (createBrandResponse) {
                            const newBrand = await createBrandResponse.json();
                            brand = { id: newBrand.id };
                        }
                    }

                    if (brand) {
                        await apiRequest('/api/skus', {
                            method: 'POST',
                            body: JSON.stringify({
                                name: item.name,
                                brand_id: brand.id,
                                purchase_price: item.purchase_price,
                                selling_price: item.selling_price,
                                stock_in_hand: item.stock_in_hand || 0
                            })
                        });
                    }
                }
            } else if (type === 'outstanding') {
                // Update retailer outstanding
                const retailersResponse = await apiRequest('/api/retailers');
                if (retailersResponse) {
                    const retailers = await retailersResponse.json();
                    const retailer = retailers.find(r => r.name.toLowerCase() === item.retailer_name.toLowerCase());
                    if (retailer) {
                        // This would need a special endpoint to update outstanding directly
                        // For now, we'll skip this as it requires payment entry
                    }
                }
            } else if (type === 'stock') {
                // Update SKU stock
                const skusResponse = await apiRequest('/api/skus');
                if (skusResponse) {
                    const skus = await skusResponse.json();
                    const sku = skus.find(s => s.name.toLowerCase() === item.sku_name.toLowerCase());
                    if (sku) {
                        await apiRequest(`/api/skus/${sku.id}`, {
                            method: 'PUT',
                            body: JSON.stringify({
                                name: sku.name,
                                purchase_price: sku.purchase_price,
                                selling_price: sku.selling_price,
                                stock_in_hand: item.stock_in_hand
                            })
                        });
                    }
                }
            }
        } catch (error) {
            console.error('Error importing item:', item, error);
            // Continue with next item
        }
    }
}

