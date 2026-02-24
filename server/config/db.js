const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const uri = (process.env.MONGO_USER && process.env.MONGO_PASS)
      ? `mongodb+srv://${process.env.MONGO_USER}:${process.env.MONGO_PASS}@cluster0.g9ecxr4.mongodb.net/fmcg_db?retryWrites=true&w=majority&appName=Cluster0`
      : process.env.MONGO_URI;
    const conn = await mongoose.connect(uri, {
      tlsAllowInvalidCertificates: process.env.NODE_ENV !== 'production',
    });
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  }
};

module.exports = connectDB;
