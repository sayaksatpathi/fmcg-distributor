// Vercel serverless entry point
// Imports the Express app from server/ and exports it for @vercel/node
require('dotenv').config();
module.exports = require('../server/server');
