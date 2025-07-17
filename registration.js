const { Router } = require('express');
const axios = require('axios');
const pool = require('./db'); // Assumes db.js is in the same directory

const router = Router();

// --- Utility Functions ---

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
 * Generates a random 6-digit One-Time Password (OTP).
 * @returns {string} - The generated OTP.
 */
const generateOTP = () => {
    return Math.floor(1000 + Math.random() * 9000).toString();
};

// --- API Endpoint ---

/**
 * POST /api/register
 * Handles user registration by validating input and generating an OTP.
 * Responds with OTP and error details.
 */
router.post('/register', async (req, res) => {
    // 1. Header Validation
    const requiredHeaders = ['authorization', 'content-type', 'accepts', 'user-agent', 'x-timestamp'];
    const missingHeaders = requiredHeaders.filter(header => !req.headers[header]);

    if (missingHeaders.length > 0) {
        return res.status(400).json({
            otp: null,
            hasError: true,
            errorCode: 'REGH001',
            message: `Missing required headers: ${missingHeaders.join(', ')}`
        });
    }

    // 2. Body Validation
    const { emailAddress, mobileNumber } = req.body;

    if ((!emailAddress && !mobileNumber) || (emailAddress && mobileNumber)) {
        return res.status(400).json({
            otp: null,
            hasError: true,
            errorCode: 'REGB001',
            message: 'Request body must contain either mobileNumber or emailAddress, but not both.'
        });
    }


    const userIdentifier = mobileNumber || emailAddress;

    // 3. Format Validation
    if (mobileNumber && !isValidMobile(mobileNumber)) {
        return res.status(400).json({
            otp: null,
            hasError: true,
            errorCode: 'REGM001', // Format: XXXX001 for invalid mobile
            message: 'Invalid mobile number format.'
        });
    }

    if (emailAddress && !isValidEmail(emailAddress)) {
        return res.status(400).json({
            otp: null,
            hasError: true,
            errorCode: 'REME001',
            message: 'Invalid email address format.'
        });
    }

    try {
        const otp = generateOTP();

        // Asynchronously send the OTP to the webhook
        const webhookUrl = 'https://webhookbot.c-toss.com/api/bot/webhooks/f29494d5-7587-42cc-8255-8f44f25cfe8c';
        const message = `OTP for ${mobileNumber ? 'mobile number' : 'email address'} ${userIdentifier} is ${otp}.`;

        // Fire-and-forget the webhook call to avoid delaying the API response.
        // Errors are logged but do not cause the main request to fail.
        axios.post(webhookUrl, { text: message })
            .then(response => {
                console.log(`Successfully sent OTP to webhook for ${userIdentifier}. Status: ${response.status}`);
            })
            .catch(webhookError => {
                // In a production app, you might add this to a retry queue.
                console.error(
                    `Failed to send OTP to webhook for ${userIdentifier}:`,
                    webhookError.response ? webhookError.response.data : webhookError.message
                );
            });

        // Send success response immediately
        return res.status(200).json({
            otp: otp,
            hasError: false,
            errorCode: null,
            message: `OTP has been generated and sent to ${userIdentifier}.`
        });

    } catch (error) {
        console.error('Error during registration process:', error);
        return res.status(500).json({
            otp: null,
            hasError: true,
            errorCode: 'REGS001',
            message: 'An internal server error occurred. Please try again later.'
        });
    }
});

module.exports = router;
