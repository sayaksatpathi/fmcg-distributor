const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'fmcg.db');
const db = new sqlite3.Database(dbPath);

console.log('Starting to seed test data...');

// Sample data
const retailers = [
    { name: 'Sharma General Store', area: 'Rohini', phone: '9876543210', credit_limit: 150000, credit_class: 'A', outstanding_amount: 45000, days_outstanding: 12, monthly_profit: 25000 },
    { name: 'Gupta Traders', area: 'Pitampura', phone: '9876543211', credit_limit: 100000, credit_class: 'B', outstanding_amount: 85000, days_outstanding: 35, monthly_profit: 18000 },
    { name: 'Kumar Store', area: 'Model Town', phone: '9876543212', credit_limit: 75000, credit_class: 'B', outstanding_amount: 30000, days_outstanding: 8, monthly_profit: 15000 },
    { name: 'Raj Departmental Store', area: 'Shalimar Bagh', phone: '9876543213', credit_limit: 50000, credit_class: 'C', outstanding_amount: 55000, days_outstanding: 45, monthly_profit: 12000, credit_frozen: 1 },
    { name: 'Singh Mart', area: 'Ashok Vihar', phone: '9876543214', credit_limit: 120000, credit_class: 'A', outstanding_amount: 20000, days_outstanding: 5, monthly_profit: 22000 },
    { name: 'Verma Store', area: 'Rohini Sector 7', phone: '9876543215', credit_limit: 0, credit_class: 'D', outstanding_amount: 0, days_outstanding: 0, monthly_profit: 8000 },
    { name: 'Jain Traders', area: 'Shalimar Bagh', phone: '9876543216', credit_limit: 90000, credit_class: 'B', outstanding_amount: 65000, days_outstanding: 25, monthly_profit: 16000 },
    { name: 'Mehta General Store', area: 'Pitampura', phone: '9876543217', credit_limit: 0, credit_class: 'D', outstanding_amount: 0, days_outstanding: 0, monthly_profit: 5000 },
    { name: 'Agarwal Mart', area: 'Model Town', phone: '9876543218', credit_limit: 60000, credit_class: 'C', outstanding_amount: 15000, days_outstanding: 18, monthly_profit: 10000 },
    { name: 'Bansal Store', area: 'Rohini Sector 10', phone: '9876543219', credit_limit: 130000, credit_class: 'A', outstanding_amount: 40000, days_outstanding: 10, monthly_profit: 28000 }
];

const brands = [
    { name: 'Amul', margin_percent: 8 },
    { name: 'Britannia', margin_percent: 12 },
    { name: 'Parle', margin_percent: 10 },
    { name: 'ITC', margin_percent: 15 },
    { name: 'Nestle', margin_percent: 14 },
    { name: 'Haldiram', margin_percent: 18 },
    { name: 'Mother Dairy', margin_percent: 9 }
];

const skus = [
    { brand_id: 1, name: 'Amul Butter 500g', purchase_price: 240, selling_price: 260, current_stock: 50 },
    { brand_id: 1, name: 'Amul Milk 1L', purchase_price: 55, selling_price: 60, current_stock: 100 },
    { brand_id: 1, name: 'Amul Cheese 200g', purchase_price: 115, selling_price: 125, current_stock: 30 },
    { brand_id: 2, name: 'Good Day 100g', purchase_price: 28, selling_price: 32, current_stock: 200 },
    { brand_id: 2, name: 'Marie Gold 250g', purchase_price: 35, selling_price: 40, current_stock: 150 },
    { brand_id: 2, name: 'Milk Bikis 200g', purchase_price: 32, selling_price: 36, current_stock: 120 },
    { brand_id: 3, name: 'Parle G 100g', purchase_price: 10, selling_price: 12, current_stock: 500 },
    { brand_id: 3, name: 'Monaco 75g', purchase_price: 15, selling_price: 18, current_stock: 300 },
    { brand_id: 3, name: 'Hide & Seek 100g', purchase_price: 30, selling_price: 35, current_stock: 180 },
    { brand_id: 4, name: 'Sunfeast Yippee 280g', purchase_price: 52, selling_price: 60, current_stock: 90 },
    { brand_id: 4, name: 'Bingo Chips 100g', purchase_price: 18, selling_price: 22, current_stock: 250 },
    { brand_id: 5, name: 'Maggi 280g', purchase_price: 48, selling_price: 56, current_stock: 150 },
    { brand_id: 5, name: 'KitKat 37g', purchase_price: 28, selling_price: 35, current_stock: 100 },
    { brand_id: 6, name: 'Haldiram Bhujia 200g', purchase_price: 55, selling_price: 65, current_stock: 80 },
    { brand_id: 6, name: 'Haldiram Namkeen 150g', purchase_price: 42, selling_price: 50, current_stock: 120 },
    { brand_id: 7, name: 'Mother Dairy Milk 1L', purchase_price: 52, selling_price: 58, current_stock: 80 }
];

// Generate sales data for last 30 days
function generateSales() {
    const sales = [];
    const today = new Date();
    
    for (let i = 0; i < 50; i++) {
        const daysAgo = Math.floor(Math.random() * 30);
        const saleDate = new Date(today);
        saleDate.setDate(saleDate.getDate() - daysAgo);
        
        const retailerId = Math.floor(Math.random() * 10) + 1;
        const skuId = Math.floor(Math.random() * 16) + 1;
        const quantity = Math.floor(Math.random() * 20) + 1;
        const paymentType = Math.random() > 0.6 ? 'credit' : 'cash';
        
        sales.push({
            date: saleDate.toISOString().split('T')[0],
            retailer_id: retailerId,
            sku_id: skuId,
            quantity: quantity,
            payment_type: paymentType
        });
    }
    
    return sales;
}

// Create user
db.serialize(() => {
    // Clear existing data
    console.log('Clearing existing data...');
    db.run('DELETE FROM sales');
    db.run('DELETE FROM skus');
    db.run('DELETE FROM brands');
    db.run('DELETE FROM retailers');
    db.run('DELETE FROM users WHERE username != "owner"');
    
    // Insert test user if not exists
    db.run(`INSERT OR IGNORE INTO users (username, password, role, name) VALUES 
        ('owner', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'owner', 'Test Owner')`, 
        (err) => {
            if (err) console.error('User creation error:', err);
            else console.log('✓ Test user created (username: owner, password: password)');
    });
    
    // Insert retailers
    console.log('\nInserting retailers...');
    const retailerStmt = db.prepare(`INSERT INTO retailers 
        (name, area, phone, credit_limit, credit_class, outstanding_amount, days_outstanding, monthly_profit, credit_frozen) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    
    retailers.forEach(r => {
        retailerStmt.run(r.name, r.area, r.phone, r.credit_limit, r.credit_class, 
            r.outstanding_amount, r.days_outstanding, r.monthly_profit, r.credit_frozen || 0);
    });
    retailerStmt.finalize(() => console.log(`✓ Inserted ${retailers.length} retailers`));
    
    // Insert brands
    console.log('\nInserting brands...');
    const brandStmt = db.prepare('INSERT INTO brands (name, margin_percent) VALUES (?, ?)');
    brands.forEach(b => {
        brandStmt.run(b.name, b.margin_percent);
    });
    brandStmt.finalize(() => console.log(`✓ Inserted ${brands.length} brands`));
    
    // Insert SKUs
    console.log('\nInserting SKUs...');
    const skuStmt = db.prepare(`INSERT INTO skus 
        (brand_id, name, purchase_price, selling_price, current_stock) 
        VALUES (?, ?, ?, ?, ?)`);
    
    skus.forEach(s => {
        skuStmt.run(s.brand_id, s.name, s.purchase_price, s.selling_price, s.current_stock);
    });
    skuStmt.finalize(() => console.log(`✓ Inserted ${skus.length} SKUs`));
    
    // Insert sales
    console.log('\nInserting sales...');
    
    // Get SKU prices first
    db.all('SELECT id, purchase_price, selling_price FROM skus', (err, skuPrices) => {
        if (err) {
            console.error('Error fetching SKU prices:', err);
            return;
        }
        
        const priceMap = {};
        skuPrices.forEach(sku => {
            priceMap[sku.id] = {
                purchase: sku.purchase_price,
                selling: sku.selling_price
            };
        });
        
        const sales = generateSales();
        const salesStmt = db.prepare(`INSERT INTO sales 
            (date, retailer_id, sku_id, quantity, unit_price, gross_profit, payment_type) 
            VALUES (?, ?, ?, ?, ?, ?, ?)`);
        
        sales.forEach(s => {
            const prices = priceMap[s.sku_id];
            const unitPrice = prices.selling;
            const grossProfit = (prices.selling - prices.purchase) * s.quantity;
            
            salesStmt.run(s.date, s.retailer_id, s.sku_id, s.quantity, unitPrice, grossProfit, s.payment_type);
        });
        salesStmt.finalize(() => {
            console.log(`✓ Inserted ${sales.length} sales records`);
            
            console.log('\n✅ Test data seeding completed!');
            console.log('\nYou can now login with:');
            console.log('  Username: owner');
            console.log('  Password: password');
            console.log('\nDatabase: fmcg.db');
            
            db.close();
        });
});
