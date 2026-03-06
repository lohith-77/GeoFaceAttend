// Email Service for Gmail Notifications
class EmailService {
    constructor() {
        // Auto-detect environment
        this.apiUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
            ? 'http://localhost:5001'
            : 'https://geofaceattend.onrender.com';

        this.initializeTemplates();
        console.log('📧 Email Service initialized with Gmail');
        console.log('📡 API URL:', this.apiUrl);
    }

    // Initialize email templates
    initializeTemplates() {
        this.templates = {
            'leave-approved': {
                subject: '✅ LEAVE APPROVED - GeoFaceAttend',
                template: (data) => `Hello ${data.employeeName},

Your leave request has been APPROVED.

━━━━━━━━━━━━━━━━━━━━━━
📅 From: ${data.startDate}
📅 To: ${data.endDate}
📊 Duration: ${data.duration} days
📝 Type: ${data.leaveType}
━━━━━━━━━━━━━━━━━━━━━━

Best regards,
GeoFaceAttend Team`
            },

            'leave-rejected': {
                subject: '❌ LEAVE REJECTED - GeoFaceAttend',
                template: (data) => `Hello ${data.employeeName},

Your leave request has been REJECTED.

━━━━━━━━━━━━━━━━━━━━━━
📅 From: ${data.startDate}
📅 To: ${data.endDate}
📊 Duration: ${data.duration} days
📝 Type: ${data.leaveType}
❌ Reason: ${data.reason}
━━━━━━━━━━━━━━━━━━━━━━

Please contact your manager for more information.

Best regards,
GeoFaceAttend Team`
            },

            'leave-request': {
                subject: '📋 NEW LEAVE REQUEST - Pending Approval',
                template: (data) => `Hello Admin,

A new leave request has been submitted and requires your approval.

━━━━━━━━━━━━━━━━━━━━━━
👤 Employee: ${data.employeeName}
📝 Type: ${data.leaveType}
📅 From: ${data.startDate}
📅 To: ${data.endDate}
📊 Days: ${data.duration}
📋 Reason: ${data.reason}
━━━━━━━━━━━━━━━━━━━━━━

Please review and take action in the admin dashboard.

Best regards,
GeoFaceAttend System`
            },

            'welcome': {
                subject: '🎉 Welcome to GeoFaceAttend!',
                template: (data) => `Welcome ${data.name}!

Your account has been created successfully.

━━━━━━━━━━━━━━━━━━━━━━
📋 Employee ID: ${data.empId}
🏢 Department: ${data.department}
━━━━━━━━━━━━━━━━━━━━━━

Login here: ${window.location.origin}/auth.html

Best regards,
GeoFaceAttend Team`
            },

            'password-reset': {
                subject: '🔐 Password Reset - GeoFaceAttend',
                template: (data) => `Hello ${data.name},

Your password has been reset.

━━━━━━━━━━━━━━━━━━━━━━
🔑 Temporary Password: ${data.tempPassword}
━━━━━━━━━━━━━━━━━━━━━━

Please login and change your password immediately.

Login here: ${window.location.origin}/auth.html

Best regards,
GeoFaceAttend Team`
            },

            'attendance-reminder': {
                subject: '⏰ Attendance Reminder - GeoFaceAttend',
                template: (data) => `Hello ${data.employeeName},

Don't forget to mark your attendance for today!

━━━━━━━━━━━━━━━━━━━━━━
📅 Date: ${data.currentDate}
⏰ Time: ${data.currentTime}
━━━━━━━━━━━━━━━━━━━━━━

Click here to mark attendance: ${window.location.origin}/employee/dashboard.html

Best regards,
GeoFaceAttend Team`
            },

            'checkin-confirmation': {
                subject: '✅ Check-In Confirmed - GeoFaceAttend',
                template: (data) => `Hello ${data.employeeName},

You have successfully checked in.

━━━━━━━━━━━━━━━━━━━━━━
📍 Location: ${data.location}
⏰ Time: ${data.time}
📅 Date: ${data.date}
📊 Method: ${data.method}
━━━━━━━━━━━━━━━━━━━━━━

Have a great day!

Best regards,
GeoFaceAttend Team`
            },

            'checkout-confirmation': {
                subject: '👋 Check-Out Confirmed - GeoFaceAttend',
                template: (data) => `Hello ${data.employeeName},

You have successfully checked out.

━━━━━━━━━━━━━━━━━━━━━━
📍 Location: ${data.location}
⏰ Check-In: ${data.checkInTime}
⏰ Check-Out: ${data.time}
⏱️ Hours Worked: ${data.hoursWorked}
📅 Date: ${data.date}
━━━━━━━━━━━━━━━━━━━━━━

Thank you for your work today!

Best regards,
GeoFaceAttend Team`
            },

            'qr-generated': {
                subject: '📱 Outstation QR Code - GeoFaceAttend',
                template: (data) => `Hello ${data.employeeName},

Your outstation QR code has been generated.

━━━━━━━━━━━━━━━━━━━━━━
📍 Location: ${data.location}
📅 Valid From: ${data.startDate}
📅 Valid To: ${data.endDate}
📋 Purpose: ${data.purpose}
━━━━━━━━━━━━━━━━━━━━━━

Please check your dashboard to view and download the QR code.

Best regards,
GeoFaceAttend Team`
            },

            'monthly-report': {
                subject: '📊 Monthly Attendance Report - GeoFaceAttend',
                template: (data) => `Hello ${data.employeeName},

Here's your attendance summary for ${data.month}.

━━━━━━━━━━━━━━━━━━━━━━
📈 Present Days: ${data.present}
⚠️ Late Days: ${data.late}
🏖️ Leave Days: ${data.leave}
📍 Outstation Days: ${data.outstation}
⏱️ Total Hours: ${data.totalHours}
━━━━━━━━━━━━━━━━━━━━━━

Detailed report is available in your dashboard.

Best regards,
GeoFaceAttend Team`
            }
        };
    }

    // Send email via backend API
    async sendEmail(to, subject, text) {
        try {
            const token = localStorage.getItem('token') || sessionStorage.getItem('token');

            if (!token) {
                console.warn('No auth token found, storing email locally');
                this.storeEmail({ to, subject, text, timestamp: new Date().toISOString() });
                return false;
            }

            const response = await fetch(`${this.apiUrl}/send-email`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ to, subject, text })
            });

            const result = await response.json();

            if (response.ok && result.success) {
                console.log('✅ Email sent successfully:', subject);

                // Store in inbox
                this.storeEmail({
                    to,
                    subject,
                    text,
                    timestamp: new Date().toISOString(),
                    success: true
                });

                // Show notification
                if (window.notificationSystem) {
                    notificationSystem.show({
                        title: '📧 Email Sent',
                        message: subject,
                        type: 'success'
                    });
                }

                return true;
            } else {
                console.error('❌ Email failed:', result.error);

                // Store failed email for retry
                this.storeEmail({
                    to,
                    subject,
                    text,
                    timestamp: new Date().toISOString(),
                    failed: true,
                    error: result.error
                });

                return false;
            }
        } catch (error) {
            console.error('❌ Email error:', error);

            // Store offline email for later sync
            this.storeEmail({
                to,
                subject,
                text,
                timestamp: new Date().toISOString(),
                offline: true
            });

            // Show offline notification
            if (window.notificationSystem) {
                notificationSystem.show({
                    title: '📧 Email Queued',
                    message: 'Will send when online',
                    type: 'info'
                });
            }

            return false;
        }
    }

    // Send template-based email
    async sendTemplateEmail(to, templateName, data) {
        const template = this.templates[templateName];
        if (!template) {
            console.error('Template not found:', templateName);
            return false;
        }

        const text = template.template(data);
        return this.sendEmail(to, template.subject, text);
    }

    // Store email in localStorage (for inbox)
    storeEmail(email) {
        const emails = JSON.parse(localStorage.getItem('emails') || '[]');
        emails.unshift({
            ...email,
            id: Date.now(),
            read: false
        });

        // Keep only last 50 emails
        localStorage.setItem('emails', JSON.stringify(emails.slice(0, 50)));
    }

    // Get all emails from inbox
    getEmails() {
        return JSON.parse(localStorage.getItem('emails') || '[]');
    }

    // Mark email as read
    markAsRead(emailId) {
        const emails = this.getEmails();
        const email = emails.find(e => e.id === emailId);
        if (email) {
            email.read = true;
            localStorage.setItem('emails', JSON.stringify(emails));
        }
    }

    // Delete email
    deleteEmail(emailId) {
        const emails = this.getEmails().filter(e => e.id !== emailId);
        localStorage.setItem('emails', JSON.stringify(emails));
    }

    // Convenience methods for common notifications
    async sendLeaveApproval(employeeEmail, leaveData) {
        return this.sendTemplateEmail(employeeEmail, 'leave-approved', leaveData);
    }

    async sendLeaveRejection(employeeEmail, leaveData, reason) {
        return this.sendTemplateEmail(employeeEmail, 'leave-rejected', { ...leaveData, reason });
    }

    async sendLeaveRequest(adminEmail, leaveData) {
        return this.sendTemplateEmail(adminEmail, 'leave-request', leaveData);
    }

    async sendWelcomeEmail(email, name, empId, department) {
        return this.sendTemplateEmail(email, 'welcome', { name, empId, department });
    }

    async sendPasswordReset(email, name, tempPassword) {
        return this.sendTemplateEmail(email, 'password-reset', { name, tempPassword });
    }

    async sendAttendanceReminder(employeeEmail, employeeName) {
        const now = new Date();
        return this.sendTemplateEmail(employeeEmail, 'attendance-reminder', {
            employeeName,
            currentDate: now.toLocaleDateString(),
            currentTime: now.toLocaleTimeString()
        });
    }

    async sendCheckInConfirmation(email, checkInData) {
        return this.sendTemplateEmail(email, 'checkin-confirmation', checkInData);
    }

    async sendCheckOutConfirmation(email, checkOutData) {
        return this.sendTemplateEmail(email, 'checkout-confirmation', checkOutData);
    }

    async sendQRCode(email, qrData) {
        return this.sendTemplateEmail(email, 'qr-generated', qrData);
    }

    async sendMonthlyReport(email, reportData) {
        return this.sendTemplateEmail(email, 'monthly-report', reportData);
    }

    // Test email function
    async sendTestEmail(to = 'lohith7780@gmail.com') {
        return this.sendEmail(
            to,
            '🧪 Test Email from GeoFaceAttend',
            `This is a test email to verify Gmail integration is working correctly.

Sent at: ${new Date().toLocaleString()}

If you received this, your email setup is working! 🎉

Best regards,
GeoFaceAttend Team`
        );
    }
}

// Create global instance
const emailService = new EmailService();
window.emailService = emailService;

console.log('✅ GeoFaceAttend - Gmail Email Service loaded');