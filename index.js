require('dotenv').config(); // Load environment variables from .env file
const express = require('express');
const registrationRouter = require('./registration');
const log4js = require('log4js');
const pool = require('./db');

// --- Logger Configuration ---
// Using log4js since it's in your package.json
log4js.configure({
    appenders: {
        console: { type: 'console' },
    },
    categories: {
        default: { appenders: ['console'], level: 'info' },
    },
});
const logger = log4js.getLogger('app');

// --- Express App Setup ---
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON request bodies
app.use(express.json());

// --- Routes ---
app.use('/api', registrationRouter); // Prefix all registration routes with /api

// --- Server Start ---
app.listen(PORT, () => {
    logger.info(`Server is running on http://localhost:${PORT}`);
});

// Graceful shutdown for the database pool
process.on('SIGINT', async () => {
    logger.info('SIGINT signal received: closing database pool.');
    await pool.end();
    process.exit(0);
});