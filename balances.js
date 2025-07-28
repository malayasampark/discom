const pool = require('./db');

const getConsumerBalance = async (req, res) => {
    const { consumer_number } = req.params;

    if (!consumer_number) {
        return res.status(400).json({
            hasError: true,
            message: 'consumer_number is required',
            data: null
        });
    }

    try {
        // First, get the account_id from consumer_accounts table using consumer_number
        const accountQuery = await pool.query(
            "SELECT account_id FROM cis.consumer_accounts WHERE consumer_number = $1",
            [consumer_number]
        );

        if (accountQuery.rows.length === 0) {
            return res.status(404).json({
                hasError: true,
                message: 'Consumer account not found',
                data: null
            });
        }

        const account_id = accountQuery.rows[0].account_id;

        // Get prepaid balance information using account_id
        const balanceQuery = await pool.query(
            `SELECT 
                balance_id,
                account_id,
                current_balance,
                minimum_balance_threshold,
                low_balance_alert_threshold,
                balance_status,
                tariff_rate,
                billing_cycle,
                last_balance_updated_on,
                created_on,
                updated_on
             FROM cis.prepaid_balances 
             WHERE account_id = $1`,
            [account_id]
        );

        if (balanceQuery.rows.length === 0) {
            return res.status(404).json({
                hasError: true,
                message: 'Prepaid balance not found for this consumer',
                data: null
            });
        }

        const balanceData = balanceQuery.rows[0];

        res.status(200).json({
            hasError: false,
            message: 'Balance retrieved successfully',
            data: {
                consumer_number: consumer_number,
                account_id: balanceData.account_id,
                current_balance: parseFloat(balanceData.current_balance),
                balance_status: balanceData.balance_status,
                tariff_rate: parseFloat(balanceData.tariff_rate),
                billing_cycle: balanceData.billing_cycle,
                last_balance_updated_on: balanceData.last_balance_updated_on,
                created_on: balanceData.created_on,
                updated_on: balanceData.updated_on

            }
        });

    } catch (error) {
        console.error('Error retrieving balance:', error);
        res.status(500).json({
            hasError: true,
            message: 'Internal server error',
            error: error.message
        });
    }
};

module.exports = {
    getConsumerBalance
};
