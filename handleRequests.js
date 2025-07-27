const pool = require('./db');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads', 'requests');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadsDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        // Allow common file types
        const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|txt/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only images, PDFs, and documents are allowed'));
        }
    }
});

async function generateRequestNumber() {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();

    const result = await pool.query(
        "SELECT COUNT(*) FROM cis.requests WHERE request_number LIKE $1",
        [`SRN${month}${year}%`]
    );

    const count = parseInt(result.rows[0].count, 10) + 1;
    const serial = String(count).padStart(5, '0');

    return `SRN${month}${year}${serial}`;
}

const createNewRequest = async (req, res) => {
    const { consumer_number, category, subject, description, priority, status } = req.body;
    const attachment = req.file;

    if (!consumer_number || !category || !subject || !description || !priority || !status) {
        return res.status(400).json({
            hasError: true,
            message: 'consumer_number, category, subject, description, priority, and status are required.',
            data: null
        });
    }

    try {
        // Check if consumer exists
        const consumerCheck = await pool.query(
            "SELECT consumer_number FROM cis.consumers WHERE consumer_number = $1",
            [consumer_number]
        );

        if (consumerCheck.rows.length === 0) {
            return res.status(404).json({
                hasError: true,
                message: 'Consumer does not exist',
                data: null
            });
        }

        const request_number = await generateRequestNumber();
        const attachment_id = attachment ? attachment.filename : null;

        await pool.query(
            `INSERT INTO cis.requests (request_number, consumer_number, category, subject, description, priority, status, attachment_id, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [request_number, consumer_number, category, subject, description, priority, status, attachment_id, consumer_number]
        );

        res.status(201).json({
            hasError: false,
            message: 'Request created successfully',
            data: {
                request_number: request_number
            }
        });
    } catch (error) {
        console.error('Error creating new request:', error);
        res.status(500).json({
            hasError: true,
            message: 'Internal server error',
            error: error.message
        });
    }
};

module.exports = {
    createNewRequest,
    upload
};
