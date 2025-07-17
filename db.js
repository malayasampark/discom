const { Pool } = require('pg');

// Configure your PostgreSQL connection details
// It's recommended to use environment variables for sensitive data
const pool = new Pool({
  user: process.env.DB_USER || 'your_db_user', // Default to 'your_db_user' if not set
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'your_db_name',
  password: process.env.DB_PASSWORD || 'your_db_password',
  port: process.env.DB_PORT || 5432,
  max: 20, // Max number of clients in the pool
  idleTimeoutMillis: 30000, // How long a client is allowed to remain idle before being closed
  connectionTimeoutMillis: 2000, // How long to wait for a connection to be established
});

// Optional: Add an event listener for errors on idle clients
pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1); // Or handle more gracefully
});

console.log('Database connection pool created.');

// Export the pool instance directly
module.exports = pool;