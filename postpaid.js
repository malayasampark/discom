const pool = require('./db');

const getPostpaidBills = async (req, res) => {
    const { consumer_number, month, year } = req.query;

    if (!consumer_number || !month || !year) {
        return res.status(400).json({
            hasError: true,
            message: 'consumer_number, month, and year are required',
            data: null
        });
    }

    // Validate month (1-12)
    const monthNum = parseInt(month);
    const yearNum = parseInt(year);

    if (monthNum < 1 || monthNum > 12) {
        return res.status(400).json({
            hasError: true,
            message: 'Month must be between 1 and 12',
            data: null
        });
    }

    if (yearNum < 1900 || yearNum > 3000) {
        return res.status(400).json({
            hasError: true,
            message: 'Invalid year provided',
            data: null
        });
    }

    try {
        // First, check if consumer exists
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

        // Query to find bills where the provided month-year falls within bill_period_start and bill_period_end
        const billsQuery = await pool.query(
            `SELECT * FROM cis.bills 
             WHERE consumer_number = $1 
             AND EXTRACT(YEAR FROM bill_period_start) <= $2 
             AND EXTRACT(MONTH FROM bill_period_start) <= $3
             AND EXTRACT(YEAR FROM bill_period_end) >= $2 
             AND EXTRACT(MONTH FROM bill_period_end) >= $3
             ORDER BY bill_period_start DESC`,
            [consumer_number, yearNum, monthNum]
        );

        if (billsQuery.rows.length === 0) {
            return res.status(404).json({
                hasError: true,
                message: `No bills found for consumer ${consumer_number} in ${month}/${year}`,
                data: null
            });
        }

        res.status(200).json({
            hasError: false,
            message: 'Bills retrieved successfully',
            data: billsQuery.rows[0]
        });

    } catch (error) {
        console.error('Error retrieving postpaid bills:', error);
        res.status(500).json({
            hasError: true,
            message: 'Internal server error',
            error: error.message
        });
    }
};

module.exports = {
    getPostpaidBills
};
