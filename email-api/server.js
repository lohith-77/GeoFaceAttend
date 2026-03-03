// Load environment variables
require('dotenv').config();

// Import required packages
const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// Create Express app
const app = express();
const PORT = process.env.PORT || 5001;
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-key-change-this';
const saltRounds = 10;

// ============ SECURITY MIDDLEWARE ============

// Add security headers
app.use(helmet());

// Enable CORS with proper configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : ['http://localhost:3000', 'http://127.0.0.1:3000'];

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl)
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
app.use(express.json());

// ============ RATE LIMITING ============

// General rate limiter
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: {
        success: false,
        error: 'Too many requests, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false
});

// Stricter rate limiter for email sending
const emailLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 20, // limit each IP to 20 emails per hour
    message: {
        success: false,
        error: 'Email rate limit exceeded. Please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false
});

// Apply general rate limiter to all requests
app.use(generalLimiter);

// Apply stricter rate limiter to email endpoint
app.use('/send-email', emailLimiter);

// ============ HELPER FUNCTIONS ============

// Middleware to verify JWT
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({
            success: false,
            error: 'No token provided'
        });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({
                success: false,
                error: 'Invalid or expired token'
            });
        }
        req.user = user;
        next();
    });
}

// In-memory user store (replace with database in production)
const users = [
    {
        id: '1',
        empId: 'ADM001',
        name: 'Admin User',
        email: 'admin@company.com',
        password: '$2b$10$YourHashedPasswordHere', // You'll need to generate this
        department: 'Management',
        role: 'admin'
    },
    {
        id: '2',
        empId: 'EMP001',
        name: 'John Employee',
        email: 'john@company.com',
        password: '$2b$10$YourHashedPasswordHere', // You'll need to generate this
        department: 'Engineering',
        role: 'employee'
    }
];

// ============ AUTH ENDPOINTS ============

// Registration endpoint
app.post('/register', async (req, res) => {
    try {
        const { name, email, empId, password, department, role } = req.body;

        // Validate input
        if (!name || !email || !empId || !password || !department || !role) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields'
            });
        }

        // Check if user exists
        const existingUser = users.find(u => u.empId === empId || u.email === email);
        if (existingUser) {
            return res.status(409).json({
                success: false,
                error: 'User already exists'
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Create new user
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

        res.json({
            success: true,
            message: 'User registered successfully'
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({
            success: false,
            error: 'Registration failed'
        });
    }
});

// Login endpoint
app.post('/login', async (req, res) => {
    try {
        const { empId, password } = req.body;

        // Validate input
        if (!empId || !password) {
            return res.status(400).json({
                success: false,
                error: 'Missing employee ID or password'
            });
        }

        // Find user
        const user = users.find(u => u.empId === empId);

        if (!user) {
            return res.status(401).json({
                success: false,
                error: 'Invalid credentials'
            });
        }

        // Compare password
        const match = await bcrypt.compare(password, user.password);

        if (!match) {
            return res.status(401).json({
                success: false,
                error: 'Invalid credentials'
            });
        }

        // Create JWT token
        const token = jwt.sign(
            {
                id: user.id,
                empId: user.empId,
                name: user.name,
                role: user.role
            },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        // Return user data (without password)
        const userData = {
            id: user.id,
            empId: user.empId,
            name: user.name,
            email: user.email,
            department: user.department,
            role: user.role
        };

        res.json({
            success: true,
            token: token,
            user: userData
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            error: 'Login failed'
        });
    }
});

// Protected route example
app.get('/profile', authenticateToken, (req, res) => {
    const user = users.find(u => u.id === req.user.id);
    if (!user) {
        return res.status(404).json({
            success: false,
            error: 'User not found'
        });
    }

    // Return user data without password
    const userData = {
        id: user.id,
        empId: user.empId,
        name: user.name,
        email: user.email,
        department: user.department,
        role: user.role
    };

    res.json({
        success: true,
        user: userData
    });
});

// ============ EMAIL SENDING ENDPOINT ============

// Create email transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASS
    }
});

// Test connection
transporter.verify((error, success) => {
    if (error) {
        console.log('❌ Email error:', error);
    } else {
        console.log('✅ Email ready to send!');
    }
});

// Email sending endpoint (protected)
app.post('/send-email', authenticateToken, async (req, res) => {
    try {
        const { to, subject, text } = req.body;

        // Check if all fields exist
        if (!to || !subject || !text) {
            return res.status(400).json({
                success: false,
                error: 'Missing to, subject, or text'
            });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(to)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid email format'
            });
        }

        // Send email
        const info = await transporter.sendMail({
            from: `"GeoFaceAttend" <${process.env.GMAIL_USER}>`,
            to: to,
            subject: subject,
            text: text,
            html: text.replace(/\n/g, '<br>')
        });

        // Log email sending (for audit)
        console.log(`📧 Email sent by ${req.user.empId} to ${to}: ${info.messageId}`);

        // Success response
        res.json({
            success: true,
            message: 'Email sent!',
            messageId: info.messageId
        });

    } catch (error) {
        console.error('Email error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to send email'
        });
    }
});

// ============ PUBLIC ENDPOINTS ============

// Health check (public)
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        time: new Date(),
        version: '1.0.0'
    });
});

// ============ ERROR HANDLING ============

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found'
    });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        success: false,
        error: 'Internal server error'
    });
});

// ============ START SERVER ============

app.listen(PORT, () => {
    console.log(`\n🔒 GeoFaceAttend Secure API`);
    console.log(`📡 Running on: http://localhost:${PORT}`);
    console.log(`📧 POST endpoint: http://localhost:${PORT}/send-email (Protected)`);
    console.log(`🔐 Auth endpoints:`);
    console.log(`   • POST /login`);
    console.log(`   • POST /register`);
    console.log(`   • GET /profile (Protected)`);
    console.log(`💚 Health check: http://localhost:${PORT}/health`);
    console.log(`\n⚙️  Security Features:`);
    console.log(`   • Rate limiting: 100 requests/15min`);
    console.log(`   • Email rate limit: 20 emails/hour`);
    console.log(`   • JWT authentication`);
    console.log(`   • Password hashing with bcrypt`);
    console.log(`   • Security headers (Helmet)`);
    console.log(`\n✅ Secure server ready!\n`);
});