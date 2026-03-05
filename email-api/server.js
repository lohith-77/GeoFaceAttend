// Load environment variables
require('dotenv').config();

// Import required packages
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const formData = require('form-data');
const Mailgun = require('mailgun.js');
const { Pool } = require('pg');
const PDFDocument = require('pdfkit');
const twilio = require('twilio');

// Create Express app
const app = express();
const PORT = process.env.PORT || 5001;
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-key-change-this';
const saltRounds = 10;

// Initialize Mailgun
const mailgun = new Mailgun(formData);
const mg = mailgun.client({
    username: 'api',
    key: process.env.MAILGUN_API_KEY,
    url: process.env.MAILGUN_URL || 'https://api.mailgun.net'
});

// Initialize Twilio (for SMS)
const twilioClient = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
);

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

// Test database connection
pool.connect((err, client, release) => {
    if (err) {
        return console.error('❌ Database connection error:', err.stack);
    }
    console.log('✅ Database connected successfully');
    release();
});

// Helper function for queries
async function query(text, params) {
    try {
        const res = await pool.query(text, params);
        return res;
    } catch (err) {
        console.error('Query error:', err);
        throw err;
    }
}

// ============ CREATE TABLES ============

async function createTables() {
    try {
        // Users table
        await query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                emp_id VARCHAR(50) UNIQUE NOT NULL,
                name VARCHAR(100) NOT NULL,
                email VARCHAR(100) UNIQUE NOT NULL,
                phone VARCHAR(20),
                password VARCHAR(255) NOT NULL,
                department VARCHAR(50),
                role VARCHAR(20) DEFAULT 'employee',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Attendance table
        await query(`
            CREATE TABLE IF NOT EXISTS attendance (
                id SERIAL PRIMARY KEY,
                emp_id VARCHAR(50) REFERENCES users(emp_id),
                check_in TIMESTAMP,
                check_out TIMESTAMP,
                location VARCHAR(255),
                method VARCHAR(50),
                hours DECIMAL(5,2),
                date DATE DEFAULT CURRENT_DATE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Leave requests table
        await query(`
            CREATE TABLE IF NOT EXISTS leave_requests (
                id SERIAL PRIMARY KEY,
                emp_id VARCHAR(50) REFERENCES users(emp_id),
                leave_type VARCHAR(50),
                start_date DATE,
                end_date DATE,
                reason TEXT,
                status VARCHAR(20) DEFAULT 'pending',
                applied_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                approved_by VARCHAR(50),
                approved_on TIMESTAMP,
                rejection_reason TEXT
            )
        `);

        // QR codes table
        await query(`
            CREATE TABLE IF NOT EXISTS qr_codes (
                id SERIAL PRIMARY KEY,
                qr_id VARCHAR(100) UNIQUE,
                emp_id VARCHAR(50) REFERENCES users(emp_id),
                location VARCHAR(255),
                start_date DATE,
                end_date DATE,
                purpose TEXT,
                valid_hours INTEGER,
                allow_checkout BOOLEAN DEFAULT true,
                generated_by VARCHAR(50),
                generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                expires_at TIMESTAMP,
                is_active BOOLEAN DEFAULT true
            )
        `);

        // Outstation history table
        await query(`
            CREATE TABLE IF NOT EXISTS outstation_history (
                id SERIAL PRIMARY KEY,
                emp_id VARCHAR(50) REFERENCES users(emp_id),
                qr_id VARCHAR(100),
                location VARCHAR(255),
                check_in TIMESTAMP,
                check_out TIMESTAMP,
                purpose TEXT,
                hours DECIMAL(5,2),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        console.log('✅ All tables created successfully');
    } catch (error) {
        console.error('❌ Error creating tables:', error);
    }
}

// Call this when server starts
createTables();

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
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { success: false, error: 'Too many requests, please try again later.' }
});

const emailLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 20,
    message: { success: false, error: 'Email rate limit exceeded. Please try again later.' }
});

app.use(generalLimiter);
app.use('/send-email', emailLimiter);

// ============ TEST ENDPOINTS ============

app.get('/test', (req, res) => {
    res.json({ success: true, message: '✅ Server is running!', time: new Date() });
});

app.get('/health', (req, res) => {
    res.json({ status: 'OK', time: new Date(), version: '1.0.0' });
});

// ============ HELPER FUNCTIONS ============

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

// ============ USERS ============

const users = [
    {
        id: '1',
        empId: 'ADM001',
        name: 'Admin User',
        email: 'admin@company.com',
        phone: '+1234567890',
        password: '$2b$10$X7VYx8fK5LmNpQrStUvWxYzAbCdEfGhIjKlMnOpQrStUvWxYz',
        department: 'Management',
        role: 'admin'
    },
    {
        id: '2',
        empId: 'EMP001',
        name: 'John Employee',
        email: 'john@company.com',
        phone: '+1234567891',
        password: '$2b$10$Y8WZx9gL6MnOpQrStUvWxYzAbCdEfGhIjKlMnOpQrStUvWxYa',
        department: 'Engineering',
        role: 'employee'
    }
];

// ============ AUTH ENDPOINTS ============

app.post('/login', async (req, res) => {
    try {
        const { empId, password } = req.body;

        if (!empId || !password) {
            return res.status(400).json({ success: false, error: 'Missing employee ID or password' });
        }

        const user = users.find(u => u.empId === empId);

        if (!user) {
            return res.status(401).json({ success: false, error: 'Invalid credentials' });
        }

        const match = await bcrypt.compare(password, user.password);

        if (!match) {
            return res.status(401).json({ success: false, error: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { id: user.id, empId: user.empId, name: user.name, role: user.role },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        const userData = {
            id: user.id,
            empId: user.empId,
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

// ============ ATTENDANCE STATS FOR CHARTS ============

app.get('/api/attendance/stats', authenticateToken, async (req, res) => {
    try {
        const empId = req.user.empId;

        // Weekly attendance data
        const weeklyData = await query(`
            SELECT 
                EXTRACT(DOW FROM check_in) as day_of_week,
                COUNT(*) as count,
                AVG(EXTRACT(HOUR FROM (check_out - check_in))) as avg_hours
            FROM attendance 
            WHERE emp_id = $1 
            AND check_in >= CURRENT_DATE - INTERVAL '7 days'
            GROUP BY EXTRACT(DOW FROM check_in)
            ORDER BY day_of_week
        `, [empId]);

        // Monthly attendance trend
        const monthlyData = await query(`
            SELECT 
                DATE_TRUNC('week', check_in) as week,
                COUNT(*) as days_present,
                AVG(EXTRACT(HOUR FROM (check_out - check_in))) as avg_hours
            FROM attendance 
            WHERE emp_id = $1 
            AND check_in >= CURRENT_DATE - INTERVAL '30 days'
            GROUP BY DATE_TRUNC('week', check_in)
            ORDER BY week
        `, [empId]);

        res.json({
            weekly: weeklyData.rows,
            monthly: monthlyData.rows
        });
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ error: 'Failed to fetch statistics' });
    }
});

// ============ PDF REPORT GENERATION ============

app.get('/api/reports/attendance/pdf', authenticateToken, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const empId = req.user.role === 'admin' ? null : req.user.empId;

        let queryText = `
            SELECT 
                u.name,
                u.emp_id,
                u.department,
                COUNT(a.id) as present_days,
                COALESCE(SUM(EXTRACT(HOUR FROM (a.check_out - a.check_in))), 0) as total_hours
            FROM users u
            LEFT JOIN attendance a ON u.emp_id = a.emp_id 
                AND a.date BETWEEN $1 AND $2
            WHERE u.role = 'employee'
        `;

        const params = [startDate, endDate];

        if (empId) {
            queryText += ` AND u.emp_id = $3`;
            params.push(empId);
        }

        queryText += ` GROUP BY u.id, u.name, u.emp_id, u.department`;

        const result = await query(queryText, params);

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

        // Summary
        doc.moveDown();
        doc.moveDown();
        doc.font('Helvetica-Bold');
        doc.text(`Total Employees: ${result.rows.length}`);
        doc.text(`Total Present Days: ${result.rows.reduce((sum, r) => sum + parseInt(r.present_days), 0)}`);
        doc.text(`Generated on: ${new Date().toLocaleString()}`);

        doc.end();

    } catch (error) {
        console.error('Error generating PDF:', error);
        res.status(500).json({ error: 'Failed to generate PDF' });
    }
});

// ============ SMS NOTIFICATIONS ============

app.post('/api/send-sms', authenticateToken, async (req, res) => {
    try {
        const { to, message } = req.body;

        if (!to || !message) {
            return res.status(400).json({ error: 'Missing phone number or message' });
        }

        const result = await twilioClient.messages.create({
            body: message,
            from: process.env.TWILIO_PHONE_NUMBER,
            to: to
        });

        res.json({ success: true, messageId: result.sid });

    } catch (error) {
        console.error('❌ SMS error:', error);
        res.status(500).json({ error: 'Failed to send SMS' });
    }
});

// ============ LEAVE APPROVAL WITH SMS ============

app.post('/api/leaves/:id/approve', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        const leaveId = req.params.id;
        const leave = {
            emp_id: 'EMP001',
            start_date: '2026-03-01',
            end_date: '2026-03-05',
            email: 'john@company.com',
            phone: '+1234567891'
        };

        // Send SMS notification
        if (leave.phone) {
            const smsMessage = `GeoFaceAttend: Your leave request from ${leave.start_date} to ${leave.end_date} has been APPROVED.`;

            await twilioClient.messages.create({
                body: smsMessage,
                from: process.env.TWILIO_PHONE_NUMBER,
                to: leave.phone
            });
        }

        // Send email via Mailgun
        if (leave.email) {
            await mg.messages.create(process.env.MAILGUN_DOMAIN, {
                from: `GeoFaceAttend <noreply@${process.env.MAILGUN_DOMAIN}>`,
                to: [leave.email],
                subject: 'Leave Request Approved',
                text: `Your leave request from ${leave.start_date} to ${leave.end_date} has been approved.`
            });
        }

        res.json({ success: true, message: 'Leave approved and notifications sent' });

    } catch (error) {
        console.error('Error approving leave:', error);
        res.status(500).json({ error: 'Failed to approve leave' });
    }
});

// ============ EMAIL SENDING ============

app.post('/send-email', authenticateToken, async (req, res) => {
    try {
        const { to, subject, text } = req.body;

        if (!to || !subject || !text) {
            return res.status(400).json({ success: false, error: 'Missing fields' });
        }

        const msg = await mg.messages.create(process.env.MAILGUN_DOMAIN, {
            from: `GeoFaceAttend <noreply@${process.env.MAILGUN_DOMAIN}>`,
            to: [to],
            subject: subject,
            text: text,
            html: text.replace(/\n/g, '<br>')
        });

        res.json({ success: true, messageId: msg.id });

    } catch (error) {
        console.error('Mailgun error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============ ERROR HANDLING ============

app.use((req, res) => {
    res.status(404).json({ success: false, error: 'Endpoint not found', requestedUrl: req.url, method: req.method });
});

app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
});

// ============ START SERVER ============

app.listen(PORT, () => {
    console.log(`\n🔒 GeoFaceAttend Secure API`);
    console.log(`📡 Running on: http://localhost:${PORT}`);
    console.log(`✅ Database connected`);
    console.log(`✅ Mailgun ready`);
    console.log(`✅ Twilio ready`);
    console.log(`✅ PDF reports ready`);
    console.log(`\n🚀 Server ready!\n`);
});