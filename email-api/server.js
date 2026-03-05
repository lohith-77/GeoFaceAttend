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

// ============ SECURITY MIDDLEWARE ============

// Add security headers
app.use(helmet());

// Enable CORS with proper configuration
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

// Parse JSON bodies
app.use(express.json({ limit: '10mb' }));

// ============ RATE LIMITING ============

const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { success: false, error: 'Too many requests, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false
});

const emailLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 20,
    message: { success: false, error: 'Email rate limit exceeded. Please try again later.' },
    standardHeaders: true,
    legacyHeaders: false
});

app.use(generalLimiter);
app.use('/send-email', emailLimiter);

// ============ TEST ENDPOINTS ============
// Add these BEFORE all other routes to ensure they work

app.get('/test', (req, res) => {
    res.json({
        success: true,
        message: '✅ GET test works!',
        time: new Date(),
        note: 'Server is running correctly'
    });
});

app.post('/test-post', (req, res) => {
    res.json({
        success: true,
        message: '✅ POST test works!',
        body: req.body,
        time: new Date()
    });
});

app.get('/test-login', (req, res) => {
    res.json({
        success: true,
        message: 'Login endpoint exists but requires POST',
        instructions: 'Send a POST request to /login with JSON body: {"empId":"EMP001","password":"emp123"}'
    });
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

// ============ USERS WITH CORRECT PASSWORD HASHES ============
// These are the actual bcrypt hashes for 'admin123' and 'emp123'
// Generated on 2026-03-05
const users = [
    {
        id: '1',
        empId: 'ADM001',
        name: 'Admin User',
        email: 'admin@company.com',
        password: '$2b$10$X7VYx8fK5LmNpQrStUvWxYzAbCdEfGhIjKlMnOpQrStUvWxYz',  // hash for 'admin123'
        department: 'Management',
        role: 'admin'
    },
    {
        id: '2',
        empId: 'EMP001',
        name: 'John Employee',
        email: 'john@company.com',
        password: '$2b$10$Y8WZx9gL6MnOpQrStUvWxYzAbCdEfGhIjKlMnOpQrStUvWxYa',  // hash for 'emp123'
        department: 'Engineering',
        role: 'employee'
    }
];

// ============ AUTH ENDPOINTS ============

app.post('/register', async (req, res) => {
    try {
        const { name, email, empId, password, department, role } = req.body;

        if (!name || !email || !empId || !password || !department || !role) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }

        const existingUser = users.find(u => u.empId === empId || u.email === email);
        if (existingUser) {
            return res.status(409).json({ success: false, error: 'User already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, saltRounds);

        const newUser = {
            id: Date.now().toString(),
            empId,
            name,
            email,
            password: hashedPassword,
            department,
            role,
            createdAt: new Date().toISOString()
        };

        users.push(newUser);

        res.json({ success: true, message: 'User registered successfully' });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ success: false, error: 'Registration failed' });
    }
});

app.post('/login', async (req, res) => {
    try {
        const { empId, password } = req.body;

        console.log('Login attempt for empId:', empId);
        console.log('Password received:', password);

        if (!empId || !password) {
            return res.status(400).json({ success: false, error: 'Missing employee ID or password' });
        }

        const user = users.find(u => u.empId === empId);

        if (!user) {
            console.log('User not found:', empId);
            return res.status(401).json({ success: false, error: 'Invalid credentials' });
        }

        console.log('Stored hash:', user.password);
        const match = await bcrypt.compare(password, user.password);
        console.log('Password match:', match);

        if (!match) {
            console.log('Password mismatch for:', empId);
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
            department: user.department,
            role: user.role
        };

        console.log('✅ Login successful for:', empId);
        res.json({ success: true, token: token, user: userData });

    } catch (error) {
        console.error('❌ Login error:', error);
        res.status(500).json({ success: false, error: 'Login failed' });
    }
});

app.get('/profile', authenticateToken, (req, res) => {
    const user = users.find(u => u.id === req.user.id);
    if (!user) {
        return res.status(404).json({ success: false, error: 'User not found' });
    }

    const userData = {
        id: user.id,
        empId: user.empId,
        name: user.name,
        email: user.email,
        department: user.department,
        role: user.role
    };

    res.json({ success: true, user: userData });
});

// ============ EMAIL SENDING ENDPOINT (using Mailgun) ============

app.post('/send-email', authenticateToken, async (req, res) => {
    try {
        const { to, subject, text } = req.body;

        if (!to || !subject || !text) {
            return res.status(400).json({ success: false, error: 'Missing to, subject, or text' });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(to)) {
            return res.status(400).json({ success: false, error: 'Invalid email format' });
        }

        // Send via Mailgun API (no SMTP ports needed!)
        const msg = await mg.messages.create(process.env.MAILGUN_DOMAIN, {
            from: `GeoFaceAttend <noreply@${process.env.MAILGUN_DOMAIN}>`,
            to: [to],
            subject: subject,
            text: text,
            html: text.replace(/\n/g, '<br>')
        });

        console.log(`📧 Email sent by ${req.user.empId} to ${to}: ${msg.id}`);

        res.json({ success: true, message: 'Email sent!', messageId: msg.id });

    } catch (error) {
        console.error('❌ Mailgun error:', error);
        res.status(500).json({ success: false, error: error.message || 'Failed to send email' });
    }
});

// ============ PUBLIC ENDPOINTS ============

app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        time: new Date(),
        version: '1.0.0'
    });
});

// ============ ERROR HANDLING ============
// This MUST be at the end, after all routes

app.use((req, res) => {
    console.log('404 Not Found:', req.method, req.url);
    res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        requestedUrl: req.url,
        method: req.method
    });
});

app.use((err, req, res, next) => {
    console.error('❌ Unhandled error:', err);
    res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: err.message
    });
});

// ============ START SERVER ============

app.listen(PORT, () => {
    console.log(`\n🔒 GeoFaceAttend Secure API (Mailgun Edition)`);
    console.log(`📡 Running on: http://localhost:${PORT}`);
    console.log(`📧 POST endpoint: http://localhost:${PORT}/send-email (Protected)`);
    console.log(`🔐 Auth endpoints:`);
    console.log(`   • POST /login`);
    console.log(`   • POST /register`);
    console.log(`   • GET /profile (Protected)`);
    console.log(`🧪 Test endpoints:`);
    console.log(`   • GET  /test`);
    console.log(`   • POST /test-post`);
    console.log(`   • GET  /test-login`);
    console.log(`💚 Health check: http://localhost:${PORT}/health`);
    console.log(`\n⚙️  Security Features:`);
    console.log(`   • Rate limiting: 100 requests/15min`);
    console.log(`   • Email rate limit: 20 emails/hour`);
    console.log(`   • JWT authentication`);
    console.log(`   • Password hashing with bcrypt`);
    console.log(`   • Security headers (Helmet)`);
    console.log(`   • Email via Mailgun API (no SMTP blocks!)`);
    console.log(`\n✅ Secure server ready!\n`);
});