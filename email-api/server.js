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

// Test database connection
pool.connect((err, client, release) => {
    if (err) {
        console.error('❌ Database connection error:', err.stack);
        return;
    }
    console.log('✅ Database connected successfully');
    release();
});

// ============ GMAIL TRANSPORTER ============
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    },
    tls: {
        rejectUnauthorized: false
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

// ============ LEAVE MANAGEMENT ============
app.post('/api/leaves/:id/approve', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const leaveId = req.params.id;

        // Get leave details with employee info
        const leaveResult = await query(`
            SELECT lr.*, u.name, u.email, u.emp_id 
            FROM leave_requests lr
            JOIN users u ON lr.emp_id = u.emp_id
            WHERE lr.id = $1
        `, [leaveId]);

        if (leaveResult.rows.length === 0) {
            return res.status(404).json({ error: 'Leave request not found' });
        }

        const leave = leaveResult.rows[0];

        // Update leave status
        await query(
            `UPDATE leave_requests 
             SET status = 'approved', 
                 approved_by = $1, 
                 approved_on = CURRENT_TIMESTAMP
             WHERE id = $2`,
            [req.user.empId, leaveId]
        );

        // Calculate duration
        const start = new Date(leave.start_date);
        const end = new Date(leave.end_date);
        const diffTime = Math.abs(end - start);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

        // Send email notification
        if (leave.email) {
            const emailBody = `Hello ${leave.name},

Your leave request has been APPROVED.

━━━━━━━━━━━━━━━━━━━━━━
📅 From: ${leave.start_date}
📅 To: ${leave.end_date}
📊 Duration: ${diffDays} days
📝 Type: ${leave.leave_type}
📋 Reason: ${leave.reason}
━━━━━━━━━━━━━━━━━━━━━━

Best regards,
GeoFaceAttend Team`;

            await sendEmail(leave.email, '✅ LEAVE APPROVED', emailBody);
        }

        res.json({ success: true, message: 'Leave approved and email sent' });

    } catch (error) {
        console.error('Error approving leave:', error);
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

        // Get leave details with employee info
        const leaveResult = await query(`
            SELECT lr.*, u.name, u.email 
            FROM leave_requests lr
            JOIN users u ON lr.emp_id = u.emp_id
            WHERE lr.id = $1
        `, [id]);

        if (leaveResult.rows.length === 0) {
            return res.status(404).json({ error: 'Leave request not found' });
        }

        const leave = leaveResult.rows[0];

        // Update leave status
        await query(
            `UPDATE leave_requests 
             SET status = 'rejected', 
                 rejection_reason = $1,
                 reviewed_by = $2,
                 reviewed_at = CURRENT_TIMESTAMP
             WHERE id = $3`,
            [reason, req.user.empId, id]
        );

        // Calculate duration
        const start = new Date(leave.start_date);
        const end = new Date(leave.end_date);
        const diffTime = Math.abs(end - start);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

        // Send email notification
        if (leave.email) {
            const emailBody = `Hello ${leave.name},

Your leave request has been REJECTED.

━━━━━━━━━━━━━━━━━━━━━━
📅 From: ${leave.start_date}
📅 To: ${leave.end_date}
📊 Duration: ${diffDays} days
📝 Type: ${leave.leave_type}
❌ Reason: ${reason}
━━━━━━━━━━━━━━━━━━━━━━

Please contact your manager for more information.

Best regards,
GeoFaceAttend Team`;

            await sendEmail(leave.email, '❌ LEAVE REJECTED', emailBody);
        }

        res.json({ success: true, message: 'Leave rejected and email sent' });

    } catch (error) {
        console.error('Error rejecting leave:', error);
        res.status(500).json({ error: 'Failed to reject leave' });
    }
});

// ============ ATTENDANCE STATS ============
app.get('/api/attendance/stats', authenticateToken, async (req, res) => {
    try {
        // Get today's stats
        const todayResult = await query(`
            SELECT 
                COUNT(*) as checked_in,
                SUM(CASE WHEN is_late THEN 1 ELSE 0 END) as late
            FROM attendance 
            WHERE date = CURRENT_DATE
        `);

        // Get weekly data
        const weeklyResult = await query(`
            SELECT 
                EXTRACT(DOW FROM date) as day_of_week,
                COUNT(*) as count
            FROM attendance 
            WHERE date >= CURRENT_DATE - INTERVAL '7 days'
            GROUP BY EXTRACT(DOW FROM date)
            ORDER BY day_of_week
        `);

        // Get department distribution
        const deptResult = await query(`
            SELECT 
                department,
                COUNT(*) as count
            FROM users
            WHERE role = 'employee'
            GROUP BY department
        `);

        res.json({
            today: todayResult.rows[0] || { checked_in: 0, late: 0 },
            weekly: weeklyResult.rows,
            departments: deptResult.rows
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

        const result = await query(`
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

        // Summary
        doc.moveDown();
        doc.moveDown();
        doc.font('Helvetica-Bold');
        doc.text(`Total Employees: ${result.rows.length}`);
        doc.text(`Generated on: ${new Date().toLocaleString()}`);

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

// ============ EMPLOYEE ENDPOINTS ============
app.get('/api/employees', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const result = await query(
            'SELECT id, emp_id, name, email, phone, department, role FROM users WHERE role = $1 ORDER BY name',
            ['employee']
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching employees:', error);
        res.status(500).json({ error: 'Failed to fetch employees' });
    }
});

// ============ LEAVE REQUESTS ENDPOINTS ============
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
        console.error('Error fetching leaves:', error);
        res.status(500).json({ error: 'Failed to fetch leave requests' });
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
app.listen(PORT, () => {
    console.log(`\n🔒 GeoFaceAttend Secure API`);
    console.log(`📡 Running on: http://localhost:${PORT}`);
    console.log(`✅ Database connected`);
    console.log(`✅ Gmail transporter ready`);
    console.log(`✅ JWT authentication enabled`);
    console.log(`✅ PDF reports ready`);
    console.log(`\n🚀 Server ready!\n`);
});

module.exports = app;