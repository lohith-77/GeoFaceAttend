// Database migration script
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');

async function migrate() {
    console.log('🔄 Running database migrations...');

    let pool;
    try {
        DATABASE_URL = postgresql://geofaceattend_user:EUUAXZGNo4Dxc6BZMUWiss6wSSyhUHqY@dpg-d6kifj1aae7s73ae34d0-a/attendance_db_shr2
        let poolConfig;

        if (process.env.DATABASE_URL) {
            console.log('📊 Using DATABASE_URL for connection');
            poolConfig = {
                connectionString: process.env.DATABASE_URL,
                ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
            };
        } else {
            console.log('📊 Using individual connection parameters');
            poolConfig = {
                user: process.env.DB_USER || 'postgres',
                host: process.env.DB_HOST || 'localhost',
                database: process.env.DB_NAME || 'geofaceattend',
                password: String(process.env.DB_PASSWORD || 'postgres'),
                port: parseInt(process.env.DB_PORT || '5432'),
            };
        }

        console.log('🔌 Connecting...');
        pool = new Pool(poolConfig);

        // Test connection
        const testResult = await pool.query('SELECT NOW()');
        console.log('✅ Database connected at:', testResult.rows[0].now);

        // Create tables if they don't exist
        await pool.query(`
            -- Users table
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                emp_id VARCHAR(50) UNIQUE NOT NULL,
                name VARCHAR(100) NOT NULL,
                email VARCHAR(100) UNIQUE NOT NULL,
                phone VARCHAR(20),
                password VARCHAR(255) NOT NULL,
                department VARCHAR(50),
                position VARCHAR(100),
                join_date DATE,
                role VARCHAR(20) DEFAULT 'employee',
                leave_balance_annual INTEGER DEFAULT 15,
                leave_balance_sick INTEGER DEFAULT 10,
                leave_balance_personal INTEGER DEFAULT 5,
                profile_image TEXT,
                last_login TIMESTAMP,
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            -- Attendance table
            CREATE TABLE IF NOT EXISTS attendance (
                id SERIAL PRIMARY KEY,
                emp_id VARCHAR(50) REFERENCES users(emp_id) ON DELETE CASCADE,
                check_in TIMESTAMP NOT NULL,
                check_out TIMESTAMP,
                check_in_location VARCHAR(255),
                check_out_location VARCHAR(255),
                check_in_lat DECIMAL(10, 8),
                check_in_lng DECIMAL(11, 8),
                check_out_lat DECIMAL(10, 8),
                check_out_lng DECIMAL(11, 8),
                method VARCHAR(50) DEFAULT 'face',
                face_confidence DECIMAL(5, 2),
                hours_worked DECIMAL(5, 2),
                is_late BOOLEAN DEFAULT false,
                is_overtime BOOLEAN DEFAULT false,
                notes TEXT,
                date DATE DEFAULT CURRENT_DATE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            -- Leave requests table
            CREATE TABLE IF NOT EXISTS leave_requests (
                id SERIAL PRIMARY KEY,
                emp_id VARCHAR(50) REFERENCES users(emp_id) ON DELETE CASCADE,
                leave_type VARCHAR(50) NOT NULL,
                start_date DATE NOT NULL,
                end_date DATE NOT NULL,
                days INTEGER NOT NULL,
                reason TEXT,
                contact_during_leave VARCHAR(50),
                status VARCHAR(20) DEFAULT 'pending',
                applied_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                approved_by VARCHAR(50),
                approved_on TIMESTAMP,
                rejection_reason TEXT
            );

            -- QR codes table
            CREATE TABLE IF NOT EXISTS qr_codes (
                id SERIAL PRIMARY KEY,
                qr_id VARCHAR(100) UNIQUE NOT NULL,
                emp_id VARCHAR(50) REFERENCES users(emp_id) ON DELETE CASCADE,
                location VARCHAR(255) NOT NULL,
                purpose TEXT,
                start_date DATE NOT NULL,
                end_date DATE NOT NULL,
                valid_hours INTEGER DEFAULT 12,
                allow_checkout BOOLEAN DEFAULT true,
                generated_by VARCHAR(50),
                generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                expires_at TIMESTAMP,
                is_active BOOLEAN DEFAULT true
            );

            -- Outstation history table
            CREATE TABLE IF NOT EXISTS outstation_history (
                id SERIAL PRIMARY KEY,
                emp_id VARCHAR(50) REFERENCES users(emp_id) ON DELETE CASCADE,
                qr_id VARCHAR(100) REFERENCES qr_codes(qr_id),
                location VARCHAR(255),
                purpose TEXT,
                check_in TIMESTAMP NOT NULL,
                check_out TIMESTAMP,
                check_in_lat DECIMAL(10, 8),
                check_in_lng DECIMAL(11, 8),
                check_out_lat DECIMAL(10, 8),
                check_out_lng DECIMAL(11, 8),
                hours_worked DECIMAL(5, 2),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            -- Create indexes
            CREATE INDEX IF NOT EXISTS idx_users_emp_id ON users(emp_id);
            CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
            CREATE INDEX IF NOT EXISTS idx_attendance_emp_id ON attendance(emp_id);
            CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);
            CREATE INDEX IF NOT EXISTS idx_leave_emp_id ON leave_requests(emp_id);
            CREATE INDEX IF NOT EXISTS idx_qr_id ON qr_codes(qr_id);
            CREATE INDEX IF NOT EXISTS idx_outstation_emp_id ON outstation_history(emp_id);
        `);

        console.log('✅ All tables created successfully');

    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    } finally {
        if (pool) await pool.end();
    }
}

// Run migrations
migrate().then(() => {
    console.log('🎉 Database setup complete');
    process.exit(0);
});