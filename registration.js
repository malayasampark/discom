const { Router } = require('express');
const axios = require('axios');
const bcrypt = require('bcrypt');
const { query, getClient } = require('./db');
const {
    otpRateLimiter,
    validateRegistration,
    validateOTP,
    handleValidationErrors,
    validateHeaders
} = require('./middleware');
const {
    generateOTP,
    getOTPExpiryTime,
    sanitizeInput,
    generateRequestId
} = require('./utils');

const router = Router();

// --- Database Helper Functions ---

/**
 * Check if consumer exists in CIS
 * @param {string} identifier - Email or mobile number
 * @returns {Promise<Object|null>} - Consumer object or null
 */
const findConsumer = async (identifier) => {
    const result = await query(
        'SELECT * FROM cis.consumers WHERE email_address = $1 OR mobile_no = $1',
        [identifier]
    );
    console.log(`findConsumer: Query executed for identifier: ${identifier}`);
    return result.rows[0] || null;
};

/**
 * Get complete consumer details including smart meter and accounts
 * @param {string} identifier - Email address or mobile number
 * @returns {Promise<Object>} - Complete consumer details
 */
const getConsumerDetails = async (identifier) => {
    const client = await getClient();

    try {
        await client.query('BEGIN');

        // Get consumer information using email or mobile number
        const consumerResult = await client.query(
            'SELECT * FROM cis.consumers WHERE email_address = $1 OR mobile_no = $1',
            [identifier]
        );

        const consumer = consumerResult.rows[0];
        if (!consumer) {
            await client.query('ROLLBACK');
            return {
                consumer: null,
                smartMeter: null,
                accounts: []
            };
        }

        // Get consumer accounts using consumer number
        const accountResult = await client.query(
            'SELECT * FROM cis.consumer_accounts WHERE consumer_number = $1',
            [consumer.consumer_number]
        );

        const accounts = accountResult.rows || [];

        // Get smart meter information using meter number from consumer accounts
        let smartMeter = null;
        if (accounts.length > 0 && accounts[0].meter_number) {
            const meterResult = await client.query(
                'SELECT * FROM cis.smart_meters WHERE meter_number = $1',
                [accounts[0].meter_number]
            );
            smartMeter = meterResult.rows[0] || null;
        }

        await client.query('COMMIT');

        return {
            consumer: consumer,
            smartMeter: smartMeter,
            accounts: accounts
        };

    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

/**
 * Store OTP in the database
 * @param {string} consumerNumber - Consumer number
 * @param {string} mobileNumber - Mobile number (mandatory)
 * @param {string} otp - Generated OTP
 * @returns {Promise<Object>} - Created OTP record
 */
const storeOTP = async (consumerNumber, mobileNumber, otp) => {
    const expiresAt = getOTPExpiryTime();

    // Invalidate any existing OTPs for this consumer
    await query(
        'UPDATE cis.otp_verifications SET is_used = true WHERE consumer_number = $1 AND is_used = false',
        [consumerNumber]
    );

    const result = await query(
        'INSERT INTO cis.otp_verifications (consumer_number, user_identifier, otp_code, expires_at) VALUES ($1, $2, $3, $4) RETURNING *',
        [consumerNumber, mobileNumber, otp, expiresAt]
    );

    return result.rows[0];
};

/**
 * Verify OTP from the database
 * @param {string} consumerNumber - Consumer number
 * @param {string} otp - OTP to verify
 * @returns {Promise<Object|null>} - OTP record or null
 */
const verifyOTP = async (consumerNumber, otp) => {
    const result = await query(
        `SELECT * FROM cis.otp_verifications 
         WHERE consumer_number = $1 AND otp_code = $2 AND expires_at > NOW() AND is_used = false`,
        [consumerNumber, otp]
    );
    return result.rows[0] || null;
};

/**
 * Mark OTP as used
 * @param {number} otpId - OTP record ID
 * @returns {Promise<void>}
 */
const markOTPAsUsed = async (otpId) => {
    await query(
        'UPDATE cis.otp_verifications SET is_used = true WHERE id = $1',
        [otpId]
    );
};

/**
 * Generate a random password
 * @param {number} length - Password length (default: 12)
 * @returns {string} - Generated password
 */
const generateRandomPassword = (length = 12) => {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';

    // Ensure password has at least one character from each type
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    const symbols = '!@#$%^&*';

    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += symbols[Math.floor(Math.random() * symbols.length)];

    // Fill remaining length with random characters
    for (let i = password.length; i < length; i++) {
        password += charset[Math.floor(Math.random() * charset.length)];
    }

    // Shuffle the password to randomize character positions
    return password.split('').sort(() => 0.5 - Math.random()).join('');
};

/**
 * Create user in cis.users table
 * @param {string} consumerNumber - Consumer number (will be user_id)
 * @param {string} password - Plain text password
 * @returns {Promise<Object>} - Created user object
 */
const createUser = async (consumerNumber, password) => {
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const result = await query(
        `INSERT INTO cis.users (user_id, password_hash, user_type, status, created_by, created_on, modified_by, modified_on) 
         VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, $6, CURRENT_TIMESTAMP) 
         ON CONFLICT (user_id) 
         DO UPDATE SET 
            password_hash = EXCLUDED.password_hash,
            status = EXCLUDED.status,
            modified_by = EXCLUDED.modified_by,
            modified_on = CURRENT_TIMESTAMP
         RETURNING *`,
        [consumerNumber, passwordHash, 'CONSUMER', 'ACTIVE', 'SYSTEM', 'SYSTEM']
    );

    return result.rows[0];
};

/**
 * Send user credentials to webhook
 * @param {string} userId - User ID (consumer number)
 * @param {string} password - Plain text password
 * @param {string} requestId - Request tracking ID
 */
const sendCredentialsToWebhook = async (userId, password, requestId) => {
    try {
        const webhookUrl = process.env.WEBHOOK_URL;
        if (!webhookUrl) {
            console.error('WEBHOOK_URL not configured');
            return;
        }

        const message = `[${requestId}] User credentials created for Consumer: ${userId}\nUser ID: ${userId}\nPassword: ${password}\n\nPlease save these credentials securely.`;

        await axios.post(webhookUrl, { text: message }, {
            timeout: 5000,
            headers: {
                'Content-Type': 'application/json'
            }
        });

        console.log(`[${requestId}] Successfully sent credentials to webhook for user: ${userId}`);
    } catch (error) {
        console.error(`[${requestId}] Failed to send credentials to webhook:`, error.message);
        // Don't throw error - webhook failure shouldn't fail the main request
    }
};

/**
 * Send OTP to webhook
 * @param {string} userIdentifier - Email or mobile number
 * @param {string} otp - Generated OTP
 * @param {string} requestId - Request tracking ID
 */
const sendOTPToWebhook = async (userIdentifier, otp, requestId) => {
    try {
        const webhookUrl = process.env.WEBHOOK_URL;
        if (!webhookUrl) {
            console.error('WEBHOOK_URL not configured');
            return;
        }

        const message = `[${requestId}] OTP for ${userIdentifier.includes('@') ? 'email' : 'mobile'} ${userIdentifier} is ${otp}. Valid for ${process.env.OTP_EXPIRY_MINUTES || 5} minutes.`;

        await axios.post(webhookUrl, { text: message }, {
            timeout: 5000,
            headers: {
                'Content-Type': 'application/json'
            }
        });

        console.log(`[${requestId}] Successfully sent OTP to webhook for ${userIdentifier}`);
    } catch (error) {
        console.error(`[${requestId}] Failed to send OTP to webhook:`, error.message);
        // Don't throw error - webhook failure shouldn't fail the main request
    }
};

// --- API Endpoints ---

/**
 * POST /api/generateOTP
 * Generate OTP for consumer after validating against CIS
 */
router.post('/generateOTP',
    validateHeaders,
    otpRateLimiter,
    validateRegistration,
    handleValidationErrors,
    async (req, res) => {
        const requestId = generateRequestId();
        console.log(`[${requestId}] Generate OTP request received`);

        try {
            const { emailAddress, mobileNumber } = req.body;
            const userIdentifier = sanitizeInput(emailAddress || mobileNumber);

            // Check if consumer exists in CIS
            const consumer = await findConsumer(userIdentifier);
            if (!consumer) {
                return res.status(404).json({
                    hasError: true,
                    errorCode: 'CONSUMER_NOT_FOUND',
                    message: 'Consumer not found in CIS system'
                });
            }

            console.log(`[${requestId}] Consumer found: ${consumer.consumer_number}`);

            // Generate and store OTP (mobile number is mandatory)
            const otp = generateOTP();
            await storeOTP(consumer.consumer_number, consumer.mobile_no, otp);

            // Send OTP to webhook
            await sendOTPToWebhook(userIdentifier, otp, requestId);

            console.log(`[${requestId}] OTP generated and sent for consumer: ${consumer.consumer_number}`);

            // Return success message without consumer details
            return res.status(200).json({
                hasError: false,
                errorCode: null,
                message: `OTP has been sent to ${userIdentifier}. Please check your ${emailAddress ? 'email' : 'messages'}.`,
                requestId: requestId
            });

        } catch (error) {
            console.error(`[${requestId}] Error during OTP generation:`, error);
            return res.status(500).json({
                hasError: true,
                errorCode: 'OTP_GENERATION_ERROR',
                message: 'An internal server error occurred. Please try again later.'
            });
        }
    }
);

/**
 * POST /api/verifyOTP
 * Verifies the OTP for a consumer
 */
router.post('/verifyOTP',
    validateHeaders,
    otpRateLimiter,
    validateOTP,
    handleValidationErrors,
    async (req, res) => {
        const requestId = generateRequestId();
        console.log(`[${requestId}] OTP verification request received`);

        try {
            const { emailAddress, mobileNumber, otp } = req.body;
            const userIdentifier = sanitizeInput(emailAddress || mobileNumber);

            // Check if consumer exists in CIS
            const consumer = await findConsumer(userIdentifier);
            if (!consumer) {
                return res.status(404).json({
                    hasError: true,
                    errorCode: 'CONSUMER_NOT_FOUND',
                    message: 'Consumer not found in CIS system'
                });
            }

            // Verify OTP
            const otpRecord = await verifyOTP(consumer.consumer_number, otp);
            if (!otpRecord) {
                return res.status(400).json({
                    hasError: true,
                    errorCode: 'INVALID_OTP',
                    message: 'Invalid or expired OTP'
                });
            }

            // Mark OTP as used
            await markOTPAsUsed(otpRecord.id);

            // Generate random password and create user
            const password = generateRandomPassword();
            const user = await createUser(consumer.consumer_number, password);

            // Send credentials to webhook
            await sendCredentialsToWebhook(consumer.consumer_number, password, requestId);

            // Get complete consumer details using the identifier
            const consumerDetails = await getConsumerDetails(userIdentifier);

            console.log(`[${requestId}] OTP verified successfully for consumer: ${consumer.consumer_number}, user created: ${user.user_id}`);

            return res.status(200).json({
                hasError: false,
                errorCode: null,
                message: 'OTP verification successful',
                requestId: requestId,
                data: {
                    consumer: consumerDetails.consumer,
                    smartMeter: consumerDetails.smartMeter,
                    accounts: consumerDetails.accounts
                }
            });

        } catch (error) {
            console.error(`[${requestId}] Error during OTP verification:`, error);
            return res.status(500).json({
                hasError: true,
                errorCode: 'OTP_VERIFICATION_ERROR',
                message: 'An internal server error occurred. Please try again later.'
            });
        }
    }
);

module.exports = router;
