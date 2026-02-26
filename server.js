const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const app = express();
app.use(cors());
app.use(express.json());

// Rate limiting to prevent abuse
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10 // limit each IP to 10 requests per windowMs
});
app.use('/send-email', limiter);

// Email configuration from environment variables
const transporter = nodemailer.createTransport({
    service: 'gmail', // or your email provider
    auth: {
        user: process.env.EMAIL_USER, // stored in .env file, never in code
        pass: process.env.EMAIL_PASS  // stored in .env file
    }
});

app.post('/send-email', async (req, res) => {
    try {
        const { to, subject, text, html } = req.body;

        // Validate input
        if (!to || !subject || !text) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Send email
        const info = await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to,
            subject,
            text,
            html
        });

        console.log('Email sent:', info.messageId);
        res.json({ success: true, messageId: info.messageId });

    } catch (error) {
        console.error('Email error:', error);
        res.status(500).json({ error: 'Failed to send email' });
    }
});

app.listen(3000, () => {
    console.log('Email API running on port 3000');
});