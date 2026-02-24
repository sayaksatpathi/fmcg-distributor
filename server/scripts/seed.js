require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const Brand = require('../models/Brand');
const SKU = require('../models/SKU');
const Retailer = require('../models/Retailer');

async function seed() {
  const uri = `mongodb+srv://${process.env.MONGO_USER}:${process.env.MONGO_PASS}@cluster0.g9ecxr4.mongodb.net/fmcg_db?retryWrites=true&w=majority&appName=Cluster0`;
  await mongoose.connect(uri, { tlsAllowInvalidCertificates: true });
  console.log('Connected to MongoDB');

  // Clear existing data
  await User.deleteMany({});
  await Brand.deleteMany({});
  await SKU.deleteMany({});
  await Retailer.deleteMany({});

  // Create admin user
  const admin = await User.create({
    name: 'Owner', username: 'admin', password: 'admin123', role: 'owner'
  });
  console.log('✅ Admin user created: admin / admin123');

  // Brands
  const brands = await Brand.insertMany([
    { name: 'Amul', company: 'GCMMF', category: 'Dairy' },
    { name: 'Britannia', company: 'Britannia Industries', category: 'Bakery' },
    { name: 'Dabur', company: 'Dabur India', category: 'FMCG' },
    { name: 'HUL', company: 'Hindustan Unilever', category: 'FMCG' },
    { name: 'Nestle', company: 'Nestle India', category: 'Food & Beverage' },
  ]);
  console.log('✅ Brands seeded');

  // SKUs
  await SKU.insertMany([
    { name: 'Amul Butter 100g', code: 'AMB100', brand: brands[0]._id, mrp: 52, sellingPrice: 48, purchasePrice: 40, stock: 200, minStock: 20, unit: 'pcs' },
    { name: 'Amul Gold Milk 1L', code: 'AMG1L', brand: brands[0]._id, mrp: 62, sellingPrice: 60, purchasePrice: 52, stock: 150, minStock: 30, unit: 'pcs' },
    { name: 'Britannia Good Day 200g', code: 'BGD200', brand: brands[1]._id, mrp: 45, sellingPrice: 42, purchasePrice: 35, stock: 300, minStock: 50, unit: 'pcs' },
    { name: 'Dabur Honey 500g', code: 'DBH500', brand: brands[2]._id, mrp: 185, sellingPrice: 175, purchasePrice: 140, stock: 5, minStock: 15, unit: 'pcs' },
    { name: 'Dove Soap 75g', code: 'DVS75', brand: brands[3]._id, mrp: 50, sellingPrice: 46, purchasePrice: 38, stock: 0, minStock: 25, unit: 'pcs' },
    { name: 'Maggi 2-Min 70g', code: 'MG70', brand: brands[4]._id, mrp: 14, sellingPrice: 13, purchasePrice: 10, stock: 500, minStock: 100, unit: 'pcs' },
  ]);
  console.log('✅ SKUs seeded');

  // Retailers
  await Retailer.insertMany([
    { name: 'Sharma General Store', contactPerson: 'Ram Sharma', phone: '9876543210', area: 'Sector 12', city: 'Delhi', creditLimit: 50000, outstandingBalance: 12500 },
    { name: 'Kumar Kirana', contactPerson: 'Suresh Kumar', phone: '9876543211', area: 'MG Road', city: 'Bangalore', creditLimit: 30000, outstandingBalance: 8000 },
    { name: 'Patel Grocery', contactPerson: 'Mahesh Patel', phone: '9876543212', area: 'Station Road', city: 'Ahmedabad', creditLimit: 40000, outstandingBalance: 0 },
    { name: 'Singh Super Mart', contactPerson: 'Gurpreet Singh', phone: '9876543213', area: 'Model Town', city: 'Ludhiana', creditLimit: 60000, outstandingBalance: 25000, status: 'active' },
    { name: 'Reddy Mini Mart', contactPerson: 'Rajesh Reddy', phone: '9876543214', area: 'Banjara Hills', city: 'Hyderabad', creditLimit: 35000, outstandingBalance: 0 },
  ]);
  console.log('✅ Retailers seeded');

  console.log('\n🎉 Database seeded successfully!');
  console.log('Login with: admin / admin123');
  await mongoose.disconnect();
}

seed().catch(err => { console.error(err); process.exit(1); });
