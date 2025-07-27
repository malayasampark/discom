require('dotenv').config(); // Load environment variables from .env file
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const registrationRouter = require('./registration');
const { createNewComplaint, upload } = require('./handleComplaints');
const { createNewRequest, upload: uploadRequest } = require('./handleRequests');
const { getConsumerBalance } = require('./balances');
const log4js = require('log4js');
const { pool } = require('./db');
const { apiRateLimiter, errorHandler } = require('./middleware');

// --- Logger Configuration ---
log4js.configure({
    appenders: {
        console: { type: 'console' },
        file: { type: 'file', filename: 'logs/app.log' }
    },
    categories: {
        default: { appenders: ['console', 'file'], level: process.env.NODE_ENV === 'production' ? 'warn' : 'debug' },
    },
});
const logger = log4js.getLogger('app');

// --- Express App Setup ---
const app = express();
const PORT = process.env.PORT || 3000;

// --- Security Middleware ---
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
        },
    },
    crossOriginEmbedderPolicy: false
}));

// CORS configuration
app.use(cors({
    origin: process.env.NODE_ENV === 'production'
        ? ['https://yourdomain.com'] // Replace with your production domain
        : ['http://localhost:3000', 'http://localhost:3001'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'User-Agent', 'X-Timestamp']
}));

// --- Rate Limiting ---
app.use('/api', apiRateLimiter);

// --- Body Parsing Middleware ---
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// --- Request Logging ---
app.use((req, res, next) => {
    logger.info(`${req.method} ${req.path} - ${req.ip}`);
    next();
});

// --- Health Check Route ---
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0'
    });
});

// --- Routes ---
app.use('/api', registrationRouter);
app.post('/api/newComplaint', upload.single('attachment'), createNewComplaint);
app.post('/api/newRequest', uploadRequest.single('attachment'), createNewRequest);
app.get('/api/balance/:consumer_number', getConsumerBalance);

// --- 404 Handler ---
app.use('*', (req, res) => {
    res.status(404).json({
        hasError: true,
        errorCode: 'NOT_FOUND',
        message: 'Endpoint not found'
    });
});

// --- Error Handling Middleware ---
app.use(errorHandler);

// --- Server Start ---
const server = app.listen(PORT, () => {
    logger.info(`Server is running on http://localhost:${PORT}`);
    logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// --- Graceful Shutdown ---
const gracefulShutdown = async (signal) => {
    logger.info(`${signal} signal received: closing HTTP server and database pool.`);

    server.close(async () => {
        logger.info('HTTP server closed.');

        try {
            await pool.end();
            logger.info('Database pool closed.');
            process.exit(0);
        } catch (error) {
            logger.error('Error during graceful shutdown:', error);
            process.exit(1);
        }
    });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// --- Uncaught Exception Handler ---
process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});