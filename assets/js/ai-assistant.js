// Simple AI Assistant
class AIAssistant {
    constructor() {
        this.initialized = false;
        this.initialize();
    }

    initialize() {
        console.log('AI Assistant initialized');
        this.initialized = true;
    }

    showNotification(type, title, message) {
        // Create toast notification
        const toast = document.createElement('div');
        toast.className = `toast-notification toast-${type}`;
        toast.innerHTML = `
            <div class="toast-icon">${this.getIcon(type)}</div>
            <div class="toast-content">
                <strong>${title}</strong>
                <p>${message}</p>
            </div>
        `;

        // Add styles if not present
        if (!document.getElementById('ai-toast-styles')) {
            this.addToastStyles();
        }

        document.body.appendChild(toast);

        // Auto remove after 3 seconds
        setTimeout(() => {
            if (toast.parentElement) {
                toast.remove();
            }
        }, 3000);

        console.log(`${type}: ${title} - ${message}`);
    }

    getIcon(type) {
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };
        return icons[type] || '📌';
    }

    addToastStyles() {
        const style = document.createElement('style');
        style.id = 'ai-toast-styles';
        style.textContent = `
            .toast-notification {
                position: fixed;
                bottom: 20px;
                right: 20px;
                background: var(--card-bg);
                border-left: 4px solid var(--primary);
                border-radius: 8px;
                padding: 12px 16px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                display: flex;
                align-items: center;
                gap: 12px;
                min-width: 300px;
                max-width: 400px;
                animation: slideInRight 0.3s ease;
                z-index: 9999;
                border: 1px solid var(--border-color);
            }
            
            .toast-notification.toast-success { border-left-color: #10b981; }
            .toast-notification.toast-error { border-left-color: #ef4444; }
            .toast-notification.toast-warning { border-left-color: #f59e0b; }
            .toast-notification.toast-info { border-left-color: #4361ee; }
            
            .toast-icon {
                font-size: 24px;
            }
            
            .toast-content {
                flex: 1;
            }
            
            .toast-content strong {
                display: block;
                color: var(--text-primary);
                margin-bottom: 4px;
            }
            
            .toast-content p {
                color: var(--text-secondary);
                font-size: 13px;
            }
            
            @keyframes slideInRight {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
        `;
        document.head.appendChild(style);
    }
}

// Create global instance
const aiAssistant = new AIAssistant();
window.aiAssistant = aiAssistant;