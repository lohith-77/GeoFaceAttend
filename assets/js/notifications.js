// Advanced Notification System
class NotificationSystem {
    constructor() {
        this.notifications = [];
        this.permission = null;
        this.initialize();
    }

    async initialize() {
        // Load notifications from storage
        this.loadNotifications();

        // Add styles
        this.addNotificationStyles();

        // Request permission for desktop notifications
        if ('Notification' in window) {
            this.permission = Notification.permission;
            if (this.permission !== 'granted' && this.permission !== 'denied') {
                await Notification.requestPermission();
            }
        }
    }

    // Request notification permission
    async requestPermission() {
        if (!('Notification' in window)) {
            console.log('This browser does not support desktop notification');
            return false;
        }

        if (Notification.permission === 'granted') {
            this.permission = 'granted';
            return true;
        }

        if (Notification.permission !== 'denied') {
            const permission = await Notification.requestPermission();
            this.permission = permission;
            return permission === 'granted';
        }

        return false;
    }

    // Show notification
    async show(notification) {
        const notificationId = Date.now();

        const newNotification = {
            id: notificationId,
            title: notification.title,
            message: notification.message,
            type: notification.type || 'info',
            timestamp: new Date().toISOString(),
            read: false,
            data: notification.data || {}
        };

        // Add to list
        this.notifications.unshift(newNotification);
        this.saveNotifications();

        // Show desktop notification if permitted
        if (this.permission === 'granted') {
            this.showDesktopNotification(newNotification);
        }

        // Show in-app toast using AI assistant
        if (window.aiAssistant) {
            aiAssistant.showNotification(notification.type, notification.title, notification.message);
        }

        return notificationId;
    }

    // Show desktop notification
    showDesktopNotification(notification) {
        try {
            const options = {
                body: notification.message,
                icon: '/assets/icons/icon-192x192.png',
                badge: '/assets/icons/badge.png',
                vibrate: [200, 100, 200],
                data: notification.data
            };

            new Notification(notification.title, options);
        } catch (error) {
            console.log('Desktop notification failed:', error);
        }
    }

    // Mark notification as read
    markAsRead(id) {
        const notification = this.notifications.find(n => n.id === id);
        if (notification) {
            notification.read = true;
            this.saveNotifications();
        }
    }

    // Mark all as read
    markAllAsRead() {
        this.notifications.forEach(n => n.read = true);
        this.saveNotifications();
    }

    // Get unread count
    getUnreadCount() {
        return this.notifications.filter(n => !n.read).length;
    }

    // Get all notifications
    getAll() {
        return this.notifications;
    }

    // Get unread notifications
    getUnread() {
        return this.notifications.filter(n => !n.read);
    }

    // Clear all notifications
    clearAll() {
        this.notifications = [];
        this.saveNotifications();
    }

    // Save to localStorage
    saveNotifications() {
        localStorage.setItem('notifications', JSON.stringify(this.notifications));
    }

    // Load from localStorage
    loadNotifications() {
        const saved = localStorage.getItem('notifications');
        if (saved) {
            try {
                this.notifications = JSON.parse(saved);
            } catch (e) {
                this.notifications = [];
            }
        }
    }

    // Get time ago string
    getTimeAgo(timestamp) {
        const now = new Date();
        const past = new Date(timestamp);
        const diffMs = now - past;
        const diffSec = Math.floor(diffMs / 1000);
        const diffMin = Math.floor(diffSec / 60);
        const diffHour = Math.floor(diffMin / 60);
        const diffDay = Math.floor(diffHour / 24);

        if (diffDay > 0) return `${diffDay} day${diffDay > 1 ? 's' : ''} ago`;
        if (diffHour > 0) return `${diffHour} hour${diffHour > 1 ? 's' : ''} ago`;
        if (diffMin > 0) return `${diffMin} minute${diffMin > 1 ? 's' : ''} ago`;
        return 'just now';
    }

    // Add notification styles
    addNotificationStyles() {
        if (document.getElementById('notification-styles')) return;

        const style = document.createElement('style');
        style.id = 'notification-styles';
        style.textContent = `
            .notification-badge {
                position: absolute;
                top: -5px;
                right: -5px;
                background: #ef4444;
                color: white;
                font-size: 10px;
                padding: 2px 5px;
                border-radius: 10px;
                min-width: 18px;
                text-align: center;
            }
            
            .notification-panel {
                position: fixed;
                top: 80px;
                right: 20px;
                width: 350px;
                max-height: 500px;
                background: var(--card-bg);
                border-radius: 12px;
                box-shadow: 0 10px 25px rgba(0,0,0,0.2);
                border: 1px solid var(--border-color);
                z-index: 1000;
                display: flex;
                flex-direction: column;
            }
            
            .notification-panel.hidden {
                display: none;
            }
            
            .notification-header {
                padding: 15px;
                border-bottom: 1px solid var(--border-color);
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            
            .notification-header h3 {
                color: var(--text-primary);
                font-size: 16px;
            }
            
            .notification-list {
                overflow-y: auto;
                max-height: 400px;
            }
            
            .notification-item {
                padding: 12px 15px;
                border-bottom: 1px solid var(--border-color);
                cursor: pointer;
                transition: background 0.3s;
            }
            
            .notification-item:hover {
                background: var(--hover-bg);
            }
            
            .notification-item.unread {
                background: rgba(67, 97, 238, 0.05);
            }
            
            .notification-title {
                font-weight: 600;
                color: var(--text-primary);
                margin-bottom: 4px;
            }
            
            .notification-message {
                font-size: 13px;
                color: var(--text-secondary);
                margin-bottom: 4px;
            }
            
            .notification-time {
                font-size: 11px;
                color: var(--text-muted);
            }
            
            .mark-all-read {
                background: none;
                border: none;
                color: var(--primary);
                cursor: pointer;
                font-size: 12px;
            }
            
            .mark-all-read:hover {
                text-decoration: underline;
            }
        `;
        document.head.appendChild(style);
    }
}

// Initialize notification system
const notificationSystem = new NotificationSystem();
window.notificationSystem = notificationSystem;

// Predefined notification triggers
const NotificationTriggers = {
    async leaveRequestSubmitted(leaveData) {
        await notificationSystem.show({
            title: 'Leave Request Submitted',
            message: `Your ${leaveData.type} request has been submitted`,
            type: 'info',
            data: { leaveId: leaveData.id }
        });
    },

    async leaveApproved(leaveData) {
        await notificationSystem.show({
            title: 'Leave Approved ✅',
            message: `Your leave from ${leaveData.startDate} to ${leaveData.endDate} has been approved`,
            type: 'success',
            data: { leaveId: leaveData.id }
        });
    },

    async leaveRejected(leaveData, reason) {
        await notificationSystem.show({
            title: 'Leave Request Update',
            message: `Your leave request has been rejected: ${reason}`,
            type: 'error',
            data: { leaveId: leaveData.id }
        });
    },

    async attendanceMarked(status) {
        await notificationSystem.show({
            title: 'Attendance Marked',
            message: `You have been marked as ${status}`,
            type: status === 'present' ? 'success' : 'warning',
            data: { status }
        });
    }
};

window.NotificationTriggers = NotificationTriggers;