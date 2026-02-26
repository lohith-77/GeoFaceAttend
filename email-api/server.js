// Load environment variables
require('dotenv').config();

// Import required packages
const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');

// Create Express app
const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors());
app.use(express.json());

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

// Email sending endpoint
app.post('/send-email', async (req, res) => {
    try {
        const { to, subject, text } = req.body;

        // Check if all fields exist
        if (!to || !subject || !text) {
            return res.status(400).json({
                success: false,
                error: 'Missing to, subject, or text'
            });
        }

        // Send email
        const info = await transporter.sendMail({
            from: `"Smart Attendance" <${process.env.GMAIL_USER}>`,
            to: to,
            subject: subject,
            text: text,
            html: text.replace(/\n/g, '<br>')
        });

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
            error: error.message
        });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'OK', time: new Date() });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Email API running on http://localhost:${PORT}`);
    console.log(`📧 POST to http://localhost:${PORT}/send-email`);
    console.log(`💚 Health check: http://localhost:${PORT}/health`);
});