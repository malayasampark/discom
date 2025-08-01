const pool = require('./db');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads', 'complaints');
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

async function generateComplaintNumber() {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();

    const result = await pool.query(
        "SELECT COUNT(*) FROM cis.complaints WHERE complaint_number LIKE $1",
        [`CRN${month}${year}%`]
    );

    const count = parseInt(result.rows[0].count, 10) + 1;
    const serial = String(count).padStart(5, '0');

    return `CRN${month}${year}${serial}`;
}

const createNewComplaint = async (req, res) => {
    const { consumer_number, subject, description, complaint_type, priority, status } = req.body;
    const attachment = req.file;

    if (!consumer_number || !subject || !description) {
        return res.status(400).json({ error: 'consumer_number, subject, and description are required.' });
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

        const complaint_number = await generateComplaintNumber();
        const attachment_id = attachment ? attachment.filename : null;

        const newComplaint = await pool.query(
            `INSERT INTO cis.complaints (complaint_number, consumer_number, subject, description, complaint_type, priority, status, attachment_id, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             RETURNING *`,
            [complaint_number, consumer_number, subject, description, complaint_type, priority || 'medium', status || 'open', attachment_id, consumer_number]
        );

        res.status(201).json({
            hasError: false,
            message: 'Complaint created successfully',
            complaint_number: complaint_number
        });
    } catch (error) {
        console.error('Error creating new complaint:', error);
        res.status(500).json({
            hasError: true,
            message: 'Internal server error',
            error: error.message
        });
    }
};

module.exports = {
    createNewComplaint,
    upload
};
