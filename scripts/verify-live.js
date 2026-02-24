const http = require('http');

// Configuration
const BASE_URL = 'http://localhost:3000';
let AUTH_TOKEN = '';

function makeRequest(path, method = 'GET', body = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: path,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': AUTH_TOKEN
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(JSON.parse(data));
                    } else {
                        console.log(`❌ Request failed: ${path} (${res.statusCode})`);
                        resolve(null);
                    }
                } catch {
                    resolve(data);
                }
            });
        });

        req.on('error', (e) => {
            console.error(`❌ Connection error: ${path} - ${e.message}`);
            resolve(null);
        });

        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

async function verifySystem() {
    console.log('🔍 Verifying System Elements...');

    // 1. Auth
    console.log('\n1. Checking Authentication...');
    const login = await makeRequest('/api/login', 'POST', { username: 'owner', password: 'admin123' });
    if (login && login.token) {
        AUTH_TOKEN = login.token;
        console.log('✅ Login Successful');
    } else {
        console.error('❌ Login Failed - Cannot proceed');
        return;
    }

    // 2. Dashboard
    console.log('\n2. Checking Dashboard...');
    const dashboard = await makeRequest('/api/dashboard'); // Correct endpoint
    if (dashboard) {
        console.log(`✅ Dashboard Data Retrieved`);
        console.log(`   - Today's Profit: ₹${dashboard.todayProfit}`);
        console.log(`   - Monthly Profit: ₹${dashboard.monthlyProfit}`);
        console.log(`   - Outstanding Credit: ₹${dashboard.outstandingCredit}`);

        // 5. Alerts (Checking here as it's part of dashboard)
        console.log('\n5. Checking Alerts (via Dashboard)...');
        if (dashboard.alerts && Array.isArray(dashboard.alerts)) {
            console.log(`✅ Retrieved ${dashboard.alerts.length} active alerts`);
            dashboard.alerts.slice(0, 3).forEach(a => console.log(`   - [${a.severity}] ${a.message}`));
        }
    }

    // 3. Retailers
    console.log('\n3. Checking Retailer List...');
    const retailers = await makeRequest('/api/retailers');
    if (retailers && Array.isArray(retailers)) {
        console.log(`✅ Retrieved ${retailers.length} retailers`);
        const overloaded = retailers.filter(r => r.days_outstanding > 30);
        console.log(`   - ${overloaded.length} retailers have >30 days outstanding`);
    }

    // 4. Sales
    console.log('\n4. Checking Sales Data...');
    const sales = await makeRequest('/api/profit/by-sku?start_date=2024-01-01&end_date=2026-12-31');
    if (sales && Array.isArray(sales)) {
        console.log(`✅ Retrieved Sales for ${sales.length} SKUs`);
        const topSku = sales.sort((a, b) => b.sales_revenue - a.sales_revenue)[0];
        if (topSku) console.log(`   - Top SKU: ${topSku.name} (Revenue: ₹${topSku.sales_revenue})`);
    }

    console.log('\n✅ System Verification Complete!');
}

verifySystem();
