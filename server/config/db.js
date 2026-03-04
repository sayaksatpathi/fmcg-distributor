const mongoose = require('mongoose');

let cachedConnection = null;

const connectDB = async () => {
  if (cachedConnection && mongoose.connection.readyState === 1) {
    return cachedConnection;
  }
  try {
    // Build URI from parts if provided, otherwise use full MONGO_URI
    const uri = (process.env.MONGO_USER && process.env.MONGO_PASS && process.env.MONGO_CLUSTER)
      ? `mongodb+srv://${process.env.MONGO_USER}:${process.env.MONGO_PASS}@${process.env.MONGO_CLUSTER}/fmcg_db?retryWrites=true&w=majority&appName=Cluster0`
      : process.env.MONGO_URI;
    if (!uri) throw new Error('No MongoDB URI configured. Set MONGO_URI or MONGO_USER/MONGO_PASS/MONGO_CLUSTER in .env');
    cachedConnection = await mongoose.connect(uri, {
      tlsAllowInvalidCertificates: process.env.NODE_ENV !== 'production',
    });
    console.log(`✅ MongoDB Connected: ${cachedConnection.connection.host}`);
    return cachedConnection;
  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message);
    cachedConnection = null;
    if (require.main === module) process.exit(1);
    throw err;
  }
};

module.exports = connectDB;
