// Email Service for Notifications
class EmailService {
    constructor() {
        this.notificationTemplates = new Map();
        this.apiUrl = 'http://localhost:5001'; // Your email API URL
        this.initializeTemplates();
    }

    // Initialize email templates with exact format from image
    initializeTemplates() {
        // Leave Approval Template
        this.notificationTemplates.set('leave-approved', {
            subject: 'LEAVE UPDATE: Approved',
            template: (data) => `ADMIN to me\n\nA message by has been received. Kindly respond at your earliest convenience.\n\n---\n\nADMIN\nHello, ${data.employeeName}, Your leave request for ${data.startDate} to ${data.endDate} (${data.duration} days) has been Approved.\nBest regards, ADMIN.\n\n---\n\n[Reply] [Forward]`
        });

        // Leave Rejection Template
        this.notificationTemplates.set('leave-rejected', {
            subject: 'LEAVE UPDATE: Rejected',
            template: (data) => `ADMIN to me\n\nA message by has been received. Kindly respond at your earliest convenience.\n\n---\n\nADMIN\nHello, ${data.employeeName}, Your leave request for ${data.startDate} to ${data.endDate} (${data.duration} days) has been Rejected.\nReason: ${data.reason}\nBest regards, ADMIN.\n\n---\n\n[Reply] [Forward]`
        });

        // Leave Request Template
        this.notificationTemplates.set('leave-request', {
            subject: 'LEAVE REQUEST: Pending Approval',
            template: (data) => `EMPLOYEE to ADMIN\n\nA message by has been received. Kindly respond at your earliest convenience.\n\n---\n\nEMPLOYEE\nHello Admin, I have submitted a leave request.\nName: ${data.employeeName}\nType: ${data.leaveType}\nFrom: ${data.startDate}\nTo: ${data.endDate}\nReason: ${data.reason}\nPlease approve.\nBest regards, ${data.employeeName}.\n\n---\n\n[Reply] [Forward]`
        });

        // Attendance Reminder Template
        this.notificationTemplates.set('attendance-reminder', {
            subject: 'REMINDER: Mark Attendance',
            template: (data) => `SYSTEM to ${data.employeeName}\n\nA message by has been received. Kindly respond at your earliest convenience.\n\n---\n\nSYSTEM\nHello, ${data.employeeName}, Don't forget to mark your attendance for today.\nCurrent Time: ${data.currentTime}\nBest regards, GeoFaceAttend.\n\n---\n\n[Reply] [Forward]`
        });
    }

    // Send REAL email via API
    async sendRealEmail(to, subject, body) {
        try {
            console.log('📧 Sending real email to:', to);

            const response = await fetch(`${this.apiUrl}/send-email`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    to: to,
                    subject: subject,
                    text: body
                })
            });

            const result = await response.json();

            if (result.success) {
                console.log('✅ Real email sent successfully!');

                // Also store in localStorage for inbox
                this.storeEmail({
                    to,
                    subject,
                    content: body,
                    timestamp: new Date().toLocaleString(),
                    read: false
                });

                return true;
            } else {
                console.error('❌ Email sending failed:', result.error);
                return false;
            }
        } catch (error) {
            console.error('❌ Email API error:', error);
            return false;
        }
    }

    // Send email (kept for backward compatibility)
    async sendEmail(to, type, data) {
        const template = this.notificationTemplates.get(type);
        if (!template) {
            console.error('Template not found:', type);
            return false;
        }

        const emailContent = template.template(data);

        // Try to send real email first
        const sent = await this.sendRealEmail(to, template.subject, emailContent);

        if (!sent) {
            // Fallback to localStorage only
            console.log('📧 Using fallback - storing in localStorage only');
            this.storeEmail({
                to,
                subject: template.subject,
                content: emailContent,
                timestamp: new Date().toLocaleString(),
                read: false
            });
        }

        // Show notification
        if (window.notificationSystem) {
            notificationSystem.show({
                title: `📧 ${template.subject}`,
                message: emailContent.split('\n')[0] + '...',
                type: 'info'
            });
        }

        return true;
    }

    // Store email in localStorage
    storeEmail(email) {
        const emails = JSON.parse(localStorage.getItem('emails') || '[]');
        emails.unshift(email);
        localStorage.setItem('emails', JSON.stringify(emails.slice(0, 50))); // Keep last 50
    }

    // Get all emails
    getEmails() {
        return JSON.parse(localStorage.getItem('emails') || '[]');
    }

    // Mark email as read
    markAsRead(index) {
        const emails = this.getEmails();
        if (emails[index]) {
            emails[index].read = true;
            localStorage.setItem('emails', JSON.stringify(emails));
        }
    }

    // Send leave request notification to admin
    async notifyAdminLeaveRequest(adminEmail, leaveData) {
        return this.sendEmail(adminEmail, 'leave-request', {
            employeeName: leaveData.employeeName,
            leaveType: leaveData.type,
            startDate: leaveData.startDate,
            endDate: leaveData.endDate,
            reason: leaveData.reason
        });
    }

    // Send leave approval to employee
    async notifyEmployeeLeaveApproval(employeeEmail, leaveData) {
        const start = new Date(leaveData.startDate);
        const end = new Date(leaveData.endDate);
        const diffTime = Math.abs(end - start);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

        return this.sendEmail(employeeEmail, 'leave-approved', {
            employeeName: leaveData.employeeName,
            startDate: leaveData.startDate,
            endDate: leaveData.endDate,
            duration: diffDays
        });
    }

    // Send leave rejection to employee
    async notifyEmployeeLeaveRejection(employeeEmail, leaveData, reason) {
        const start = new Date(leaveData.startDate);
        const end = new Date(leaveData.endDate);
        const diffTime = Math.abs(end - start);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

        return this.sendEmail(employeeEmail, 'leave-rejected', {
            employeeName: leaveData.employeeName,
            startDate: leaveData.startDate,
            endDate: leaveData.endDate,
            duration: diffDays,
            reason: reason
        });
    }
}

// Initialize email service
const emailService = new EmailService();
window.emailService = emailService;

console.log('✅ GeoFaceAttend - Email Service loaded');