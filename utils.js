const crypto = require('crypto');

/**
 * A simple email format validator.
 * @param {string} email - The email to validate.
 * @returns {boolean} - True if the email format is valid.
 */
const isValidEmail = (email) => {
    if (!email || typeof email !== 'string') return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

/**
 * A simple mobile number format validator (10-15 digits).
 * @param {string} mobile - The mobile number to validate.
 * @returns {boolean} - True if the mobile format is valid.
 */
const isValidMobile = (mobile) => {
    if (!mobile || typeof mobile !== 'string') return false;
    return /^\d{10,15}$/.test(mobile);
};

/**
 * Generates a cryptographically secure random 6-digit OTP.
 * @returns {string} - The generated OTP.
 */
const generateOTP = () => {
    // Generate a cryptographically secure random number
    const randomBytes = crypto.randomBytes(4);
    const randomInt = randomBytes.readUInt32BE(0);

    // Convert to 6-digit OTP
    return (randomInt % 900000 + 100000).toString();
};

/**
 * Calculate OTP expiry time
 * @returns {Date} - Expiry timestamp
 */
const getOTPExpiryTime = () => {
    const expiryMinutes = parseInt(process.env.OTP_EXPIRY_MINUTES || 5);
    return new Date(Date.now() + expiryMinutes * 60 * 1000);
};

/**
 * Sanitize user input to prevent SQL injection
 * @param {string} input - Input string to sanitize
 * @returns {string} - Sanitized input
 */
const sanitizeInput = (input) => {
    if (!input || typeof input !== 'string') return '';
    return input.trim().replace(/[<>]/g, '');
};

/**
 * Generate a unique request ID for tracking
 * @returns {string} - Unique request ID
 */
const generateRequestId = () => {
    return crypto.randomUUID();
};

module.exports = {
    isValidEmail,
    isValidMobile,
    generateOTP,
    getOTPExpiryTime,
    sanitizeInput,
    generateRequestId
};
