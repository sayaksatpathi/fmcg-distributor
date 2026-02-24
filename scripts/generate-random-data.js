const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./distributor.db');

const FIRST_NAMES = ['Aarav', 'Vihaan', 'Aditya', 'Sai', 'Arjun', 'Reyansh', 'Muhammad', 'Rohan', 'Krishna', 'Ishaan', 'Diya', 'Saanvi', 'Ananya', 'Aadhya', 'Pari', 'Kiara', 'Myra', 'Anika', 'Riya', 'Anya'];
const LAST_NAMES = ['Patel', 'Sharma', 'Gupta', 'Singh', 'Kumar', 'Verma', 'Khan', 'Reddy', 'Das', 'Nair', 'Mehta', 'Jain', 'Chopra', 'Malhotra', 'Saxena'];
const AREAS = ['Karol Bagh', 'Rohini', 'Dwarka', 'Pitampura', 'Janakpuri', 'Vikaspuri', 'Rajouri Garden', 'Tilak Nagar', 'Lajpat Nagar', 'Connaught Place', 'Saket', 'Vasant Kunj'];
const STORE_TYPES = ['Store', 'Mart', 'Traders', 'Enterprise', 'Shop', 'Bazaar', 'Supermarket', 'General Store'];

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomItem(arr) {
    return arr[randomInt(0, arr.length - 1)];
}

function generatePhone() {
    return '9' + Math.floor(Math.random() * 1000000000).toString().padStart(9, '0');
}

async function generateData() {
    console.log('🎲 Generating Random Data...');

    // 1. Generate Retailers
    console.log('Generating 20 random retailers...');
    const retailerIds = [];

    for (let i = 0; i < 20; i++) {
        const name = `${randomItem(LAST_NAMES)} ${randomItem(STORE_TYPES)}`;
        const area = randomItem(AREAS);
        const phone = generatePhone();
        const creditClasses = ['A', 'B', 'C', 'D'];
        const creditClass = randomItem(creditClasses);
        const creditLimit = creditClass === 'D' ? 0 : randomInt(50000, 200000);

        await new Promise((resolve, reject) => {
            db.run('INSERT INTO retailers (name, area, phone, credit_limit, credit_class, outstanding_amount, days_outstanding) VALUES (?, ?, ?, ?, ?, 0, 0)',
                [name, area, phone, creditLimit, creditClass],
                function (err) {
                    if (err) reject(err);
                    else {
                        retailerIds.push(this.lastID);
                        resolve();
                    }
                }
            );
        });
    }

    // 2. Get SKUs
    const skuIds = await new Promise((resolve, reject) => {
        db.all('SELECT id, selling_price, purchase_price FROM skus', (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });

    if (skuIds.length === 0) {
        console.error('No SKUs found! Run seed data first.');
        return;
    }

    // 3. Generate Sales
    console.log('Generating 100 random sales entries...');
    const today = new Date();

    for (let i = 0; i < 100; i++) {
        const retailerId = randomItem(retailerIds);
        const sku = randomItem(skuIds);
        const quantity = randomInt(5, 100);
        const unitPrice = sku.selling_price;
        const profit = (sku.selling_price - sku.purchase_price) * quantity;

        // Random date within last 30 days
        const date = new Date(today);
        date.setDate(date.getDate() - randomInt(0, 30));
        const dateStr = date.toISOString();

        await new Promise((resolve, reject) => {
            db.run('INSERT INTO sales (date, retailer_id, sku_id, quantity, unit_price, gross_profit, payment_type) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [dateStr, retailerId, sku.id, quantity, unitPrice, profit, 'credit'],
                function (err) {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });

        // Update retailer outstanding
        const totalAmount = quantity * unitPrice;
        await new Promise((resolve) => {
            db.run('UPDATE retailers SET outstanding_amount = outstanding_amount + ? WHERE id = ?',
                [totalAmount, retailerId],
                (err) => resolve()
            );
        });
    }

    // 4. Update Days Outstanding (Randomize some)
    console.log('Updating aging stats...');
    for (const rid of retailerIds) {
        if (Math.random() > 0.5) { // 50% chance of having old debt
            const days = randomInt(5, 60);
            await new Promise((resolve) => {
                db.run('UPDATE retailers SET days_outstanding = ? WHERE id = ?',
                    [days, rid],
                    () => resolve()
                );
            });

            // Auto-generate alerts if needed
            if (days > 45) {
                db.run("INSERT INTO alerts (message, severity, alert_type, status) VALUES (?, 'red', 'CREDIT', 'active')", [`Retailer #${rid} overdue by ${days} days`]);
            }
        }
    }

    console.log('✅ Random data generation complete!');
    db.close();
}

generateData().catch(console.error);
