// email-api/db.js
const { Pool } = require('pg');

let pool;

if (process.env.NODE_ENV === 'production') {
    // Use Render's PostgreSQL in production
    pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: {
            rejectUnauthorized: false
        }
    });
} else {
    // Use local PostgreSQL or SQLite for development
    // For now, we'll use a simple in-memory fallback
    console.log('⚠️ Using in-memory storage for development');
}

// Create tables if they don't exist
async function initDatabase() {
    if (!pool) return;

    try {
        await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        emp_id VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100),
        password VARCHAR(255) NOT NULL,
        department VARCHAR(50),
        role VARCHAR(20) DEFAULT 'employee',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

        await pool.query(`
      CREATE TABLE IF NOT EXISTS attendance (
        id SERIAL PRIMARY KEY,
        emp_id VARCHAR(50) NOT NULL,
        check_in_time TIMESTAMP,
        check_out_time TIMESTAMP,
        location VARCHAR(255),
        method VARCHAR(50),
        date DATE DEFAULT CURRENT_DATE,
        FOREIGN KEY (emp_id) REFERENCES users(emp_id) ON DELETE CASCADE
      );
    `);

        await pool.query(`
      CREATE TABLE IF NOT EXISTS leave_requests (
        id SERIAL PRIMARY KEY,
        emp_id VARCHAR(50) NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        reason TEXT,
        status VARCHAR(20) DEFAULT 'pending',
        applied_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (emp_id) REFERENCES users(emp_id) ON DELETE CASCADE
      );
    `);

        await pool.query(`
      CREATE TABLE IF NOT EXISTS outstation_history (
        id SERIAL PRIMARY KEY,
        emp_id VARCHAR(50) NOT NULL,
        qr_id VARCHAR(100),
        location VARCHAR(255),
        check_in_time TIMESTAMP,
        check_out_time TIMESTAMP,
        purpose TEXT,
        FOREIGN KEY (emp_id) REFERENCES users(emp_id) ON DELETE CASCADE
      );
    `);

        console.log('✅ Database tables created/verified');
    } catch (error) {
        console.error('❌ Database initialization error:', error);
    }
}

// Query helper function
async function query(text, params) {
    if (!pool) {
        console.log('⚠️ No database connection, using fallback');
        return { rows: [] };
    }
    try {
        const result = await pool.query(text, params);
        return result;
    } catch (error) {
        console.error('Database query error:', error);
        throw error;
    }
}

module.exports = { pool, initDatabase, query };