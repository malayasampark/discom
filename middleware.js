const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');

// Rate limiting configurations
const createRateLimiter = (windowMs, max, message) => {
    return rateLimit({
        windowMs,
        max,
        message: {
            hasError: true,
            errorCode: 'RATE_LIMIT',
            message
        },
        standardHeaders: true,
        legacyHeaders: false,
    });
};

// General API rate limiter
const apiRateLimiter = createRateLimiter(
    parseInt(process.env.API_RATE_LIMIT_WINDOW_MINUTES || 15) * 60 * 1000, // 15 minutes
    parseInt(process.env.API_RATE_LIMIT_MAX_REQUESTS || 100), // 100 requests per window
    'Too many requests from this IP, please try again later.'
);

// OTP specific rate limiter (more restrictive)
const otpRateLimiter = createRateLimiter(
    parseInt(process.env.OTP_RATE_LIMIT_WINDOW_MINUTES || 1) * 60 * 1000, // 1 minute
    parseInt(process.env.OTP_RATE_LIMIT_MAX_REQUESTS || 3), // 3 requests per window
    'Too many OTP requests, please try again later.'
);

// Validation middleware
const validateRegistration = [
    body('emailAddress')
        .optional()
        .isEmail()
        .normalizeEmail()
        .withMessage('Invalid email address format'),
    body('mobileNumber')
        .optional()
        .matches(/^\d{10,15}$/)
        .withMessage('Invalid mobile number format'),
    body().custom((value, { req }) => {
        const { emailAddress, mobileNumber } = req.body;
        if ((!emailAddress && !mobileNumber) || (emailAddress && mobileNumber)) {
            throw new Error('Request body must contain either mobileNumber or emailAddress, but not both');
        }
        return true;
    })
];

const validateOTP = [
    body('emailAddress')
        .optional()
        .isEmail()
        .normalizeEmail()
        .withMessage('Invalid email address format'),
    body('mobileNumber')
        .optional()
        .matches(/^\d{10,15}$/)
        .withMessage('Invalid mobile number format'),
    body('otp')
        .matches(/^\d{6}$/)
        .withMessage('OTP must be a 6-digit number'),
    body().custom((value, { req }) => {
        const { emailAddress, mobileNumber } = req.body;
        if ((!emailAddress && !mobileNumber) || (emailAddress && mobileNumber)) {
            throw new Error('Request body must contain either mobileNumber or emailAddress, but not both');
        }
        return true;
    })
];

// Validation error handler
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            hasError: true,
            errorCode: 'VALIDATION_ERROR',
            message: errors.array()[0].msg,
            errors: errors.array()
        });
    }
    next();
};

// Header validation middleware
const validateHeaders = (req, res, next) => {
    const requiredHeaders = ['authorization', 'content-type', 'user-agent'];
    const missingHeaders = requiredHeaders.filter(header => !req.headers[header]);

    if (missingHeaders.length > 0) {
        return res.status(400).json({
            hasError: true,
            errorCode: 'REGH001',
            message: `Missing required headers: ${missingHeaders.join(', ')}`
        });
    }
    next();
};

// Global error handler
const errorHandler = (err, req, res, next) => {
    console.error('Error:', err);

    // Database errors
    if (err.code === '23505') { // Duplicate key error
        return res.status(409).json({
            hasError: true,
            errorCode: 'DUPLICATE_USER',
            message: 'User already exists'
        });
    }

    // Default error response
    res.status(500).json({
        hasError: true,
        errorCode: 'INTERNAL_ERROR',
        message: 'An internal server error occurred'
    });
};

module.exports = {
    apiRateLimiter,
    otpRateLimiter,
    validateRegistration,
    validateOTP,
    handleValidationErrors,
    validateHeaders,
    errorHandler
};
