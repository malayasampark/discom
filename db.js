const { Pool } = require('pg');

// Configure your PostgreSQL connection details
// It's recommended to use environment variables for sensitive data
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  max: 20, // Max number of clients in the pool
  idleTimeoutMillis: 30000, // How long a client is allowed to remain idle before being closed
  connectionTimeoutMillis: 2000, // How long to wait for a connection to be established
});

// Test the connection
const testConnection = async () => {
  try {
    const client = await pool.connect();
    console.log('Database connection successful');
    client.release();
  } catch (err) {
    console.error('Database connection failed:', err.message);
    // Don't exit, let the app handle the error gracefully
  }
};

// Optional: Add an event listener for errors on idle clients
pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client', err);
  // Log the error but don't exit the process
});

console.log('Database connection pool created.');

// Test connection on startup
testConnection();

// Database helper functions
const dbHelpers = {
  /**
   * Execute a query with parameters
   * @param {string} text - SQL query
   * @param {Array} params - Query parameters
   * @returns {Promise<Object>} - Query result
   */
  async query(text, params = []) {
    try {
      const result = await pool.query(text, params);
      return result;
    } catch (error) {
      console.error('Database query error:', error);
      throw error;
    }
  },

  /**
   * Get a client from the pool for transactions
   * @returns {Promise<Object>} - Database client
   */
  async getClient() {
    try {
      const client = await pool.connect();
      return client;
    } catch (error) {
      console.error('Failed to get database client:', error);
      throw error;
    }
  },

  /**
   * Close the database pool
   * @returns {Promise<void>}
   */
  async end() {
    try {
      await pool.end();
      console.log('Database pool closed.');
    } catch (error) {
      console.error('Error closing database pool:', error);
      throw error;
    }
  }
};

// Export the pool instance and helpers
module.exports = { pool, ...dbHelpers };