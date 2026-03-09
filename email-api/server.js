// Load environment variables
require('dotenv').config();

// Import required packages
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const PDFDocument = require('pdfkit');
const nodemailer = require('nodemailer');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Create Express app
const app = express();
const PORT = process.env.PORT || 5001;
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-key-change-this';
const saltRounds = 10;

// ============ DATABASE CONNECTION ============
let pool;
if (process.env.NODE_ENV === 'production') {
    pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });
} else {
    pool = new Pool({
        user: process.env.DB_USER || 'postgres',
        host: process.env.DB_HOST || 'localhost',
        database: process.env.DB_NAME || 'geofaceattend',
        password: process.env.DB_PASSWORD || 'postgres',
        port: process.env.DB_PORT || 5432,
    });
}

// ============ DATABASE INITIALIZATION FUNCTION ============
async function initializeDatabase() {
    console.log('🔧 Checking database setup...');

    try {
        // Test connection
        await pool.query('SELECT NOW()');
        console.log('✅ Database connected');

        // Check if users table exists
        const tableCheck = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'users'
            );
        `);

        if (!tableCheck.rows[0].exists) {
            console.log('🔄 Tables not found. Running migrations...');

            // Run migration script
            const migrateScript = path.join(__dirname, 'scripts', 'migrate.js');
            if (fs.existsSync(migrateScript)) {
                execSync(`node ${migrateScript}`, { stdio: 'inherit' });
                console.log('✅ Migrations completed');
            } else {
                console.log('⚠️ Migration script not found, creating tables directly...');
                await createTablesDirectly();
            }

            // Run seed script
            console.log('🌱 Seeding database with sample data...');
            const seedScript = path.join(__dirname, 'scripts', 'seed.js');
            if (fs.existsSync(seedScript)) {
                execSync(`node ${seedScript}`, { stdio: 'inherit' });
                console.log('✅ Seeding completed');
            } else {
                console.log('⚠️ Seed script not found, creating default users directly...');
                await createDefaultUsersDirectly();
            }
        } else {
            console.log('✅ Database already initialized');

            // Check if default users exist
            const userCheck = await pool.query("SELECT COUNT(*) FROM users WHERE emp_id IN ('ADM001', 'EMP001')");
            if (parseInt(userCheck.rows[0].count) < 2) {
                console.log('🌱 Adding missing default users...');
                await createDefaultUsersDirectly();
            }
        }
    } catch (error) {
        console.error('❌ Database initialization error:', error);
    }
}

// Direct table creation if migrate.js doesn't exist
async function createTablesDirectly() {
    try {
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
        console.log('✅ Tables created successfully');
    } catch (error) {
        console.error('❌ Error creating tables:', error);
        throw error;
    }
}

// Direct user creation if seed.js doesn't exist
async function createDefaultUsersDirectly() {
    try {
        const adminPassword = await bcrypt.hash('admin123', saltRounds);
        const empPassword = await bcrypt.hash('emp123', saltRounds);

        // Insert admin if not exists
        await pool.query(`
            INSERT INTO users (emp_id, name, email, phone, password, department, position, join_date, role)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (emp_id) DO NOTHING
        `, ['ADM001', 'Admin User', 'admin@company.com', '+1234567890', adminPassword, 'Management', 'System Administrator', new Date().toISOString().split('T')[0], 'admin']);

        // Insert employee if not exists
        await pool.query(`
            INSERT INTO users (emp_id, name, email, phone, password, department, position, join_date, role)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (emp_id) DO NOTHING
        `, ['EMP001', 'John Employee', 'john@company.com', '+1234567891', empPassword, 'Engineering', 'Software Engineer', new Date().toISOString().split('T')[0], 'employee']);

        console.log('✅ Default users created successfully');
        console.log('   Admin: ADM001 / admin123');
        console.log('   Employee: EMP001 / emp123');
    } catch (error) {
        console.error('❌ Error creating default users:', error);
    }
}

// ============ GMAIL TRANSPORTER ============
const transporter = nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE || 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Verify email connection (don't let it crash the server)
transporter.verify((error, success) => {
    if (error) {
        console.log('⚠️ Email notifications disabled - Gmail configuration issue');
        console.log('   To enable emails, update your .env with correct Gmail credentials');
    } else {
        console.log('✅ Gmail transporter ready');
    }
});

// ============ HELPER FUNCTIONS ============

// Query helper
async function query(text, params) {
    try {
        const res = await pool.query(text, params);
        return res;
    } catch (err) {
        console.error('Query error:', err);
        throw err;
    }
}

// Authentication middleware
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ success: false, error: 'No token provided' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ success: false, error: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
}

// Admin authorization
function requireAdmin(req, res, next) {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ success: false, error: 'Admin access required' });
    }
    next();
}

// Send email function
async function sendEmail(to, subject, text) {
    try {
        const mailOptions = {
            from: `"${process.env.EMAIL_FROM_NAME || 'GeoFaceAttend'}" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
            to: to,
            subject: subject,
            text: text
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('✅ Email sent:', info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('❌ Email sending failed:', error);
        return { success: false, error: error.message };
    }
}

// ============ SECURITY MIDDLEWARE ============
app.use(helmet());

const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : ['http://localhost:3000', 'http://127.0.0.1:3000', 'https://geofaceattend-1.onrender.com'];

app.use(cors({
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) === -1) {
            const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
            return callback(new Error(msg), false);
        }
        return callback(null, true);
    },
    credentials: true
}));

app.use(express.json({ limit: '10mb' }));

// ============ RATE LIMITING ============
const generalLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    message: { success: false, error: 'Too many requests, please try again later.' }
});

const emailLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: parseInt(process.env.EMAIL_RATE_LIMIT_MAX) || 20,
    message: { success: false, error: 'Email rate limit exceeded. Please try again later.' }
});

app.use(generalLimiter);
app.use('/send-email', emailLimiter);

// ============ TEST ENDPOINTS ============
app.get('/test', (req, res) => {
    res.json({ success: true, message: '✅ Server is running!', time: new Date() });
});

app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        time: new Date(),
        version: '2.0.0',
        database: 'connected',
        email: 'configured'
    });
});

// ============ TEST EMAIL ENDPOINT (No Auth Required for Testing) ============
app.get('/test-email-simple', async (req, res) => {
    try {
        const testEmail = req.query.email || 'lohith7780@gmail.com';

        const result = await sendEmail(
            testEmail,
            '📧 Test Email from GeoFaceAttend',
            `Hello,

This is a test email to verify Gmail integration is working correctly.

If you received this, email notifications are working!

Sent at: ${new Date().toLocaleString()}

Best regards,
GeoFaceAttend Team`
        );

        if (result.success) {
            res.json({
                success: true,
                message: `✅ Test email sent to ${testEmail}!`,
                messageId: result.messageId
            });
        } else {
            res.status(500).json({
                success: false,
                error: result.error
            });
        }
    } catch (error) {
        console.error('Test email error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ============ AUTH ENDPOINTS ============
app.post('/login', async (req, res) => {
    try {
        const { empId, password } = req.body;

        if (!empId || !password) {
            return res.status(400).json({ success: false, error: 'Missing employee ID or password' });
        }

        const result = await query('SELECT * FROM users WHERE emp_id = $1', [empId]);
        const user = result.rows[0];

        if (!user) {
            return res.status(401).json({ success: false, error: 'Invalid credentials' });
        }

        const match = await bcrypt.compare(password, user.password);

        if (!match) {
            return res.status(401).json({ success: false, error: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { id: user.id, empId: user.emp_id, name: user.name, role: user.role },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        const userData = {
            id: user.id,
            empId: user.emp_id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            department: user.department,
            role: user.role
        };

        res.json({ success: true, token, user: userData });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, error: 'Login failed' });
    }
});

app.post('/register', async (req, res) => {
    try {
        const { name, email, empId, phone, password, department, position, joinDate } = req.body;

        // Check if user already exists
        const existing = await query(
            'SELECT * FROM users WHERE emp_id = $1 OR email = $2',
            [empId, email]
        );

        if (existing.rows.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'User with this Employee ID or Email already exists'
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Insert new user
        const result = await query(
            `INSERT INTO users 
             (emp_id, name, email, phone, password, department, position, join_date, role, 
              leave_balance_annual, leave_balance_sick, leave_balance_personal)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
             RETURNING id, emp_id, name, email, department, role`,
            [
                empId,
                name,
                email,
                phone || null,
                hashedPassword,
                department,
                position || null,
                joinDate || new Date().toISOString().split('T')[0],
                'employee',
                15, 10, 5
            ]
        );

        const newUser = result.rows[0];
        res.json({ success: true, message: 'Registration successful', user: newUser });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ success: false, error: 'Registration failed' });
    }
});

// ============ USER PROFILE ENDPOINT ============
app.get('/api/users/profile', authenticateToken, async (req, res) => {
    try {
        const result = await query(
            `SELECT id, emp_id, name, email, phone, department, position, join_date, role,
                    leave_balance_annual, leave_balance_sick, leave_balance_personal,
                    to_char(created_at, 'YYYY-MM-DD') as created_at,
                    to_char(last_login, 'YYYY-MM-DD HH24:MI:SS') as last_login
             FROM users WHERE emp_id = $1`,
            [req.user.empId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = result.rows[0];
        res.json({
            success: true,
            profile: {
                id: user.id,
                empId: user.emp_id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                department: user.department,
                position: user.position,
                joinDate: user.join_date,
                role: user.role,
                leaveBalance: {
                    annual: user.leave_balance_annual,
                    sick: user.leave_balance_sick,
                    personal: user.leave_balance_personal
                },
                createdAt: user.created_at,
                lastLogin: user.last_login
            }
        });

    } catch (error) {
        console.error('Profile fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
});

// ============ EMPLOYEE ENDPOINTS (Admin only) ============
app.get('/api/employees', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const result = await query(
            `SELECT id, emp_id, name, email, phone, department, position, join_date, role,
                    leave_balance_annual, leave_balance_sick, leave_balance_personal,
                    to_char(created_at, 'YYYY-MM-DD') as created_at,
                    is_active
             FROM users 
             ORDER BY created_at DESC`
        );

        res.json(result.rows);

    } catch (error) {
        console.error('Employee fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch employees' });
    }
});

// ============ ATTENDANCE ENDPOINTS ============
app.post('/api/attendance/checkin', authenticateToken, async (req, res) => {
    try {
        const { location, lat, lng, method, faceConfidence } = req.body;
        const empId = req.user.empId;
        const now = new Date();
        const today = now.toISOString().split('T')[0];

        // Check if already checked in today
        const existing = await query(
            'SELECT * FROM attendance WHERE emp_id = $1 AND date = $2 AND check_out IS NULL',
            [empId, today]
        );

        if (existing.rows.length > 0) {
            return res.status(400).json({ error: 'Already checked in today' });
        }

        // Determine if late (after 9:15 AM)
        const lateThreshold = new Date();
        lateThreshold.setHours(9, 15, 0, 0);
        const isLate = now > lateThreshold;

        // Insert check-in record
        const result = await query(
            `INSERT INTO attendance 
             (emp_id, check_in, check_in_location, check_in_lat, check_in_lng, method, face_confidence, is_late, date)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             RETURNING *`,
            [empId, now.toISOString(), location, lat, lng, method, faceConfidence, isLate, today]
        );

        res.json({ success: true, attendance: result.rows[0] });

    } catch (error) {
        console.error('Check-in error:', error);
        res.status(500).json({ error: 'Failed to check in' });
    }
});

app.post('/api/attendance/checkout', authenticateToken, async (req, res) => {
    try {
        const { location, lat, lng } = req.body;
        const empId = req.user.empId;
        const today = new Date().toISOString().split('T')[0];

        // Find active check-in
        const active = await query(
            'SELECT * FROM attendance WHERE emp_id = $1 AND date = $2 AND check_out IS NULL',
            [empId, today]
        );

        if (active.rows.length === 0) {
            return res.status(400).json({ error: 'No active check-in found' });
        }

        const checkIn = new Date(active.rows[0].check_in);
        const now = new Date();
        const hoursWorked = (now - checkIn) / (1000 * 60 * 60);

        // Update check-out
        const result = await query(
            `UPDATE attendance 
             SET check_out = $1, check_out_location = $2, check_out_lat = $3, check_out_lng = $4,
                 hours_worked = $5
             WHERE id = $6
             RETURNING *`,
            [now.toISOString(), location, lat, lng, hoursWorked, active.rows[0].id]
        );

        res.json({ success: true, attendance: result.rows[0] });

    } catch (error) {
        console.error('Check-out error:', error);
        res.status(500).json({ error: 'Failed to check out' });
    }
});

app.get('/api/attendance/stats', authenticateToken, async (req, res) => {
    try {
        const empId = req.user.empId;

        // Get today's stats
        const todayResult = await query(
            `SELECT 
                COUNT(*) as checked_in,
                SUM(CASE WHEN is_late THEN 1 ELSE 0 END) as late
             FROM attendance 
             WHERE emp_id = $1 AND date = CURRENT_DATE`,
            [empId]
        );

        // Get weekly stats
        const weeklyResult = await query(
            `SELECT 
                EXTRACT(DOW FROM date) as day_of_week,
                COUNT(*) as count
             FROM attendance 
             WHERE emp_id = $1 
               AND date >= CURRENT_DATE - INTERVAL '7 days'
             GROUP BY EXTRACT(DOW FROM date)
             ORDER BY day_of_week`,
            [empId]
        );

        // Get department stats for admin
        let departmentStats = [];
        if (req.user.role === 'admin') {
            const deptResult = await query(
                `SELECT 
                    department,
                    COUNT(*) as count
                 FROM users
                 WHERE role = 'employee'
                 GROUP BY department`
            );
            departmentStats = deptResult.rows;
        }

        res.json({
            today: todayResult.rows[0] || { checked_in: 0, late: 0 },
            weekly: weeklyResult.rows,
            departments: departmentStats
        });

    } catch (error) {
        console.error('Stats fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch statistics' });
    }
});

// ============ LEAVE ENDPOINTS ============
app.post('/api/leaves/apply', authenticateToken, async (req, res) => {
    try {
        const { leaveType, startDate, endDate, reason, contact } = req.body;
        const empId = req.user.empId;

        // Calculate days
        const start = new Date(startDate);
        const end = new Date(endDate);
        const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

        // Create leave request
        const result = await query(
            `INSERT INTO leave_requests 
             (emp_id, leave_type, start_date, end_date, days, reason, contact_during_leave)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [empId, leaveType, startDate, endDate, days, reason, contact]
        );

        res.json({ success: true, leave: result.rows[0] });

    } catch (error) {
        console.error('Leave application error:', error);
        res.status(500).json({ error: 'Failed to apply for leave' });
    }
});

app.get('/api/leaves/my', authenticateToken, async (req, res) => {
    try {
        const result = await query(
            'SELECT * FROM leave_requests WHERE emp_id = $1 ORDER BY applied_on DESC',
            [req.user.empId]
        );

        res.json({ success: true, leaves: result.rows });

    } catch (error) {
        console.error('My leaves fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch leave requests' });
    }
});

app.get('/api/leaves/all', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const result = await query(`
            SELECT lr.*, u.name as employee_name, u.department 
            FROM leave_requests lr
            JOIN users u ON lr.emp_id = u.emp_id
            ORDER BY lr.applied_on DESC
        `);

        res.json(result.rows);

    } catch (error) {
        console.error('All leaves fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch leave requests' });
    }
});

app.post('/api/leaves/:id/approve', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        await query(
            `UPDATE leave_requests 
             SET status = 'approved', 
                 approved_by = $1, 
                 approved_on = CURRENT_TIMESTAMP
             WHERE id = $2`,
            [req.user.empId, id]
        );

        res.json({ success: true, message: 'Leave approved' });

    } catch (error) {
        console.error('Leave approval error:', error);
        res.status(500).json({ error: 'Failed to approve leave' });
    }
});

app.post('/api/leaves/:id/reject', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        if (!reason) {
            return res.status(400).json({ error: 'Rejection reason is required' });
        }

        await query(
            `UPDATE leave_requests 
             SET status = 'rejected', 
                 rejection_reason = $1,
                 reviewed_by = $2,
                 reviewed_at = CURRENT_TIMESTAMP
             WHERE id = $3`,
            [reason, req.user.empId, id]
        );

        res.json({ success: true, message: 'Leave rejected' });

    } catch (error) {
        console.error('Leave rejection error:', error);
        res.status(500).json({ error: 'Failed to reject leave' });
    }
});

// ============ QR CODE ENDPOINTS ============
app.post('/api/qr/generate', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { empId, location, startDate, endDate, purpose, validHours, allowCheckout } = req.body;

        // Generate unique QR ID
        const qrId = `QR-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;

        // Calculate expiry
        const expiresAt = new Date(endDate);
        expiresAt.setHours(23, 59, 59, 999);

        // Insert QR code record
        const result = await query(
            `INSERT INTO qr_codes 
             (qr_id, emp_id, location, purpose, start_date, end_date, valid_hours, allow_checkout, generated_by, expires_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             RETURNING *`,
            [qrId, empId, location, purpose, startDate, endDate, validHours || 12, allowCheckout !== false, req.user.empId, expiresAt]
        );

        res.json({ success: true, qr: result.rows[0] });

    } catch (error) {
        console.error('QR generation error:', error);
        res.status(500).json({ error: 'Failed to generate QR code' });
    }
});

app.get('/api/qr/active', authenticateToken, async (req, res) => {
    try {
        let queryText = `
            SELECT q.*, u.name as employee_name 
            FROM qr_codes q
            JOIN users u ON q.emp_id = u.emp_id
            WHERE q.is_active = true 
              AND q.expires_at > CURRENT_TIMESTAMP
        `;
        const params = [];

        // If employee, only show their QR codes
        if (req.user.role !== 'admin') {
            queryText += ` AND q.emp_id = $1`;
            params.push(req.user.empId);
        }

        queryText += ` ORDER BY q.generated_at DESC`;

        const result = await query(queryText, params);
        res.json(result.rows);

    } catch (error) {
        console.error('Active QR fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch QR codes' });
    }
});

// ============ PDF REPORT ENDPOINT ============
app.get('/api/reports/attendance/pdf', authenticateToken, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        const result = await query(`
            SELECT 
                u.name,
                u.emp_id,
                u.department,
                COUNT(a.id) as present_days,
                COALESCE(SUM(a.hours_worked), 0) as total_hours
            FROM users u
            LEFT JOIN attendance a ON u.emp_id = a.emp_id 
                AND a.date BETWEEN $1 AND $2
            WHERE u.role = 'employee'
            GROUP BY u.id, u.name, u.emp_id, u.department
        `, [startDate, endDate]);

        // Create PDF
        const doc = new PDFDocument();
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=attendance-report-${startDate}-to-${endDate}.pdf`);
        doc.pipe(res);

        // Add content
        doc.fontSize(20).text('GeoFaceAttend - Attendance Report', { align: 'center' });
        doc.moveDown();
        doc.fontSize(12).text(`Period: ${startDate} to ${endDate}`, { align: 'center' });
        doc.moveDown();
        doc.moveDown();

        // Table headers
        doc.fontSize(10).font('Helvetica-Bold');
        doc.text('Employee', 50, doc.y);
        doc.text('ID', 200, doc.y);
        doc.text('Dept', 300, doc.y);
        doc.text('Present', 380, doc.y);
        doc.text('Hours', 450, doc.y);
        doc.moveDown();

        // Table rows
        doc.font('Helvetica');
        result.rows.forEach(row => {
            doc.text(row.name, 50, doc.y);
            doc.text(row.emp_id, 200, doc.y);
            doc.text(row.department, 300, doc.y);
            doc.text(row.present_days.toString(), 380, doc.y);
            doc.text(parseFloat(row.total_hours).toFixed(1), 450, doc.y);
            doc.moveDown();
        });

        doc.end();

    } catch (error) {
        console.error('Error generating PDF:', error);
        res.status(500).json({ error: 'Failed to generate PDF' });
    }
});

// ============ EMAIL SENDING ENDPOINT ============
app.post('/send-email', authenticateToken, async (req, res) => {
    try {
        const { to, subject, text } = req.body;

        if (!to || !subject || !text) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }

        const result = await sendEmail(to, subject, text);

        if (result.success) {
            res.json({ success: true, messageId: result.messageId });
        } else {
            res.status(500).json({ success: false, error: result.error });
        }

    } catch (error) {
        console.error('Email endpoint error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============ ERROR HANDLING ============
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        requestedUrl: req.url
    });
});

app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
});

// ============ START SERVER ============
app.listen(PORT, async () => {
    console.log(`\n🔒 GeoFaceAttend Secure API`);
    console.log(`📡 Running on: http://localhost:${PORT}`);

    // Initialize database on startup
    await initializeDatabase();

    console.log(`\n🚀 Server ready!\n`);
});

module.exports = app;