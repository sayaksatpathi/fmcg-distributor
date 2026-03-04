// Vercel serverless entry point
// Imports the Express app from server/ and exports it for @vercel/node
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../server/.env') });
module.exports = require('../server/server');
