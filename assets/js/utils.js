// GeoFaceAttend Utility Functions

const Utils = {
    // ============ DATE UTILITIES ============

    /**
     * Format date to display string
     * @param {Date|string} date - Date to format
     * @param {string} format - Format type (display, iso, time, etc.)
     * @returns {string} Formatted date string
     */
    formatDate(date, format = 'display') {
        if (!date) return '';

        const d = new Date(date);
        if (isNaN(d.getTime())) return '';

        const formats = {
            display: d.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            }),
            displayTime: d.toLocaleString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            }),
            iso: d.toISOString().split('T')[0],
            isoTime: d.toISOString().replace('T', ' ').substring(0, 19),
            time: d.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit'
            }),
            timeWithSeconds: d.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            }),
        };

        return formats[format] || formats.display;
    },

    /**
     * Get relative time string (e.g., "2 hours ago")
     * @param {Date|string} date - Date to compare
     * @returns {string} Relative time string
     */
    timeAgo(date) {
        const now = new Date();
        const past = new Date(date);
        const diffMs = now - past;
        const diffSec = Math.floor(diffMs / 1000);
        const diffMin = Math.floor(diffSec / 60);
        const diffHour = Math.floor(diffMin / 60);
        const diffDay = Math.floor(diffHour / 24);
        const diffWeek = Math.floor(diffDay / 7);
        const diffMonth = Math.floor(diffDay / 30);
        const diffYear = Math.floor(diffDay / 365);

        if (diffYear > 0) return `${diffYear} year${diffYear > 1 ? 's' : ''} ago`;
        if (diffMonth > 0) return `${diffMonth} month${diffMonth > 1 ? 's' : ''} ago`;
        if (diffWeek > 0) return `${diffWeek} week${diffWeek > 1 ? 's' : ''} ago`;
        if (diffDay > 0) return `${diffDay} day${diffDay > 1 ? 's' : ''} ago`;
        if (diffHour > 0) return `${diffHour} hour${diffHour > 1 ? 's' : ''} ago`;
        if (diffMin > 0) return `${diffMin} minute${diffMin > 1 ? 's' : ''} ago`;
        if (diffSec > 10) return `${diffSec} seconds ago`;
        return 'just now';
    },

    /**
     * Get date range for different periods
     * @param {string} range - Range type (today, week, month, etc.)
     * @returns {Object} Start and end dates
     */
    getDateRange(range) {
        const today = new Date();
        const end = today.toISOString().split('T')[0];
        let start;

        switch (range) {
            case 'today':
                start = end;
                break;
            case 'yesterday':
                const yesterday = new Date(today);
                yesterday.setDate(yesterday.getDate() - 1);
                start = yesterday.toISOString().split('T')[0];
                break;
            case 'thisWeek':
                const monday = new Date(today);
                monday.setDate(today.getDate() - (today.getDay() || 7) + 1);
                start = monday.toISOString().split('T')[0];
                break;
            case 'lastWeek':
                const lastMonday = new Date(today);
                lastMonday.setDate(today.getDate() - (today.getDay() || 7) - 6);
                start = lastMonday.toISOString().split('T')[0];
                break;
            case 'thisMonth':
                start = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
                break;
            case 'lastMonth':
                start = new Date(today.getFullYear(), today.getMonth() - 1, 1).toISOString().split('T')[0];
                break;
            case 'thisYear':
                start = new Date(today.getFullYear(), 0, 1).toISOString().split('T')[0];
                break;
            default:
                start = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
        }

        return { start, end };
    },

    // ============ NUMBER UTILITIES ============

    /**
     * Format number with commas
     * @param {number} num - Number to format
     * @returns {string} Formatted number
     */
    formatNumber(num) {
        return num?.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',') || '0';
    },

    /**
     * Format currency
     * @param {number} amount - Amount to format
     * @param {string} currency - Currency code (USD, EUR, etc.)
     * @returns {string} Formatted currency
     */
    formatCurrency(amount, currency = 'USD') {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency,
        }).format(amount || 0);
    },

    /**
     * Format percentage
     * @param {number} value - Value to format (0-100)
     * @param {number} decimals - Number of decimal places
     * @returns {string} Formatted percentage
     */
    formatPercentage(value, decimals = 0) {
        return (value || 0).toFixed(decimals) + '%';
    },

    /**
     * Calculate percentage
     * @param {number} value - Current value
     * @param {number} total - Total value
     * @returns {number} Percentage
     */
    calculatePercentage(value, total) {
        if (!total) return 0;
        return Math.round((value / total) * 100);
    },

    // ============ STRING UTILITIES ============

    /**
     * Capitalize first letter of each word
     * @param {string} str - String to capitalize
     * @returns {string} Capitalized string
     */
    capitalize(str) {
        if (!str) return '';
        return str.split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
    },

    /**
     * Truncate string with ellipsis
     * @param {string} str - String to truncate
     * @param {number} length - Maximum length
     * @returns {string} Truncated string
     */
    truncate(str, length = 50) {
        if (!str) return '';
        if (str.length <= length) return str;
        return str.substring(0, length) + '...';
    },

    /**
     * Generate random string
     * @param {number} length - Length of string
     * @returns {string} Random string
     */
    randomString(length = 8) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    },

    // ============ VALIDATION UTILITIES ============

    /**
     * Validate email format
     * @param {string} email - Email to validate
     * @returns {boolean} Is valid email
     */
    isValidEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    },

    /**
     * Validate phone number
     * @param {string} phone - Phone to validate
     * @returns {boolean} Is valid phone
     */
    isValidPhone(phone) {
        const re = /^\+?[1-9]\d{1,14}$/;
        return re.test(phone.replace(/\s/g, ''));
    },

    /**
     * Validate password strength
     * @param {string} password - Password to validate
     * @returns {Object} Validation result
     */
    validatePassword(password) {
        const result = {
            isValid: false,
            strength: 'weak',
            score: 0,
            messages: []
        };

        if (!password) {
            result.messages.push('Password is required');
            return result;
        }

        // Length check
        if (password.length < 6) {
            result.messages.push('Password must be at least 6 characters');
        } else {
            result.score += 1;
        }

        if (password.length >= 8) result.score += 1;

        // Complexity checks
        if (/[A-Z]/.test(password)) result.score += 1;
        if (/[0-9]/.test(password)) result.score += 1;
        if (/[^A-Za-z0-9]/.test(password)) result.score += 1;

        // Determine strength
        if (result.score <= 2) result.strength = 'weak';
        else if (result.score <= 3) result.strength = 'medium';
        else result.strength = 'strong';

        result.isValid = result.score >= 3 && password.length >= 6;

        return result;
    },

    // ============ STORAGE UTILITIES ============

    /**
     * Set item in storage with optional encryption
     * @param {string} key - Storage key
     * @param {any} value - Value to store
     * @param {boolean} session - Use sessionStorage instead of localStorage
     */
    setStorage(key, value, session = false) {
        const storage = session ? sessionStorage : localStorage;
        try {
            const serialized = JSON.stringify(value);
            storage.setItem(key, serialized);
        } catch (error) {
            console.error('Storage error:', error);
        }
    },

    /**
     * Get item from storage
     * @param {string} key - Storage key
     * @param {boolean} session - Use sessionStorage instead of localStorage
     * @returns {any} Stored value
     */
    getStorage(key, session = false) {
        const storage = session ? sessionStorage : localStorage;
        try {
            const serialized = storage.getItem(key);
            if (serialized === null) return null;
            return JSON.parse(serialized);
        } catch (error) {
            console.error('Storage error:', error);
            return null;
        }
    },

    /**
     * Remove item from storage
     * @param {string} key - Storage key
     * @param {boolean} session - Use sessionStorage instead of localStorage
     */
    removeStorage(key, session = false) {
        const storage = session ? sessionStorage : localStorage;
        storage.removeItem(key);
    },

    /**
     * Clear all storage
     * @param {boolean} session - Clear sessionStorage instead of localStorage
     */
    clearStorage(session = false) {
        const storage = session ? sessionStorage : localStorage;
        storage.clear();
    },

    // ============ COLOR UTILITIES ============

    /**
     * Get status color
     * @param {string} status - Status string
     * @returns {string} Color code
     */
    getStatusColor(status) {
        const colors = {
            present: '#10b981',
            late: '#f59e0b',
            absent: '#ef4444',
            pending: '#f59e0b',
            approved: '#10b981',
            rejected: '#ef4444',
            active: '#10b981',
            inactive: '#94a3b8',
            success: '#10b981',
            warning: '#f59e0b',
            error: '#ef4444',
            info: '#4361ee'
        };
        return colors[status?.toLowerCase()] || '#4361ee';
    },

    /**
     * Get status badge class
     * @param {string} status - Status string
     * @returns {string} CSS class
     */
    getStatusClass(status) {
        const classes = {
            present: 'badge-success',
            late: 'badge-warning',
            absent: 'badge-danger',
            pending: 'badge-warning',
            approved: 'badge-success',
            rejected: 'badge-danger',
            active: 'badge-success',
            inactive: 'badge-secondary'
        };
        return classes[status?.toLowerCase()] || 'badge-primary';
    },

    // ============ OBJECT UTILITIES ============

    /**
     * Deep clone object
     * @param {Object} obj - Object to clone
     * @returns {Object} Cloned object
     */
    deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    },

    /**
     * Check if object is empty
     * @param {Object} obj - Object to check
     * @returns {boolean} Is empty
     */
    isEmpty(obj) {
        return obj && Object.keys(obj).length === 0 && obj.constructor === Object;
    },

    /**
     * Merge objects deeply
     * @param {...Object} objects - Objects to merge
     * @returns {Object} Merged object
     */
    deepMerge(...objects) {
        const result = {};
        objects.forEach(obj => {
            if (obj) {
                Object.keys(obj).forEach(key => {
                    if (typeof obj[key] === 'object' && obj[key] !== null) {
                        if (Array.isArray(obj[key])) {
                            result[key] = obj[key].slice();
                        } else {
                            result[key] = this.deepMerge(result[key] || {}, obj[key]);
                        }
                    } else {
                        result[key] = obj[key];
                    }
                });
            }
        });
        return result;
    },

    // ============ ARRAY UTILITIES ============

    /**
     * Group array by key
     * @param {Array} array - Array to group
     * @param {string} key - Key to group by
     * @returns {Object} Grouped object
     */
    groupBy(array, key) {
        return array.reduce((result, item) => {
            (result[item[key]] = result[item[key]] || []).push(item);
            return result;
        }, {});
    },

    /**
     * Sort array by key
     * @param {Array} array - Array to sort
     * @param {string} key - Key to sort by
     * @param {string} order - 'asc' or 'desc'
     * @returns {Array} Sorted array
     */
    sortBy(array, key, order = 'asc') {
        return array.sort((a, b) => {
            if (a[key] < b[key]) return order === 'asc' ? -1 : 1;
            if (a[key] > b[key]) return order === 'asc' ? 1 : -1;
            return 0;
        });
    },

    /**
     * Paginate array
     * @param {Array} array - Array to paginate
     * @param {number} page - Page number (1-based)
     * @param {number} pageSize - Items per page
     * @returns {Object} Paginated result
     */
    paginate(array, page = 1, pageSize = 10) {
        const start = (page - 1) * pageSize;
        const end = start + pageSize;
        return {
            items: array.slice(start, end),
            total: array.length,
            page,
            pageSize,
            totalPages: Math.ceil(array.length / pageSize),
            hasNext: end < array.length,
            hasPrev: page > 1
        };
    },

    // ============ DOM UTILITIES ============

    /**
     * Create DOM element with attributes
     * @param {string} tag - HTML tag
     * @param {Object} attrs - Attributes
     * @param {string|Array} children - Child elements or text
     * @returns {HTMLElement} Created element
     */
    createElement(tag, attrs = {}, children = null) {
        const element = document.createElement(tag);

        Object.entries(attrs).forEach(([key, value]) => {
            if (key === 'style' && typeof value === 'object') {
                Object.assign(element.style, value);
            } else if (key.startsWith('on') && typeof value === 'function') {
                element.addEventListener(key.substring(2).toLowerCase(), value);
            } else if (key === 'className') {
                element.className = value;
            } else {
                element.setAttribute(key, value);
            }
        });

        if (children) {
            if (Array.isArray(children)) {
                children.forEach(child => {
                    if (typeof child === 'string') {
                        element.appendChild(document.createTextNode(child));
                    } else if (child instanceof HTMLElement) {
                        element.appendChild(child);
                    }
                });
            } else if (typeof children === 'string') {
                element.textContent = children;
            } else if (children instanceof HTMLElement) {
                element.appendChild(children);
            }
        }

        return element;
    },

    /**
     * Show loading overlay
     * @param {string} message - Loading message
     */
    showLoading(message = 'Loading...') {
        let overlay = document.getElementById('loadingOverlay');
        if (!overlay) {
            overlay = this.createElement('div', { id: 'loadingOverlay', className: 'loading-overlay' }, [
                this.createElement('div', { className: 'spinner' }),
                this.createElement('p', { id: 'loadingMessage' }, message)
            ]);
            document.body.appendChild(overlay);
        }
        overlay.style.display = 'flex';
        document.getElementById('loadingMessage').textContent = message;
    },

    /**
     * Hide loading overlay
     */
    hideLoading() {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.style.display = 'none';
        }
    },

    /**
     * Show toast notification
     * @param {string} message - Toast message
     * @param {string} type - Toast type (success, error, warning, info)
     * @param {number} duration - Duration in ms
     */
    showToast(message, type = 'info', duration = 5000) {
        const toast = this.createElement('div', {
            className: `toast-notification toast-${type}`
        }, [
            this.createElement('div', { className: 'toast-icon' }, this.getToastIcon(type)),
            this.createElement('div', { className: 'toast-content' }, [
                this.createElement('strong', {}, this.capitalize(type)),
                this.createElement('p', {}, message)
            ])
        ]);

        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    },

    getToastIcon(type) {
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };
        return icons[type] || '📌';
    },

    // ============ BROWSER UTILITIES ============

    /**
     * Check if device is mobile
     * @returns {boolean} Is mobile
     */
    isMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    },

    /**
     * Check if device is online
     * @returns {boolean} Is online
     */
    isOnline() {
        return navigator.onLine;
    },

    /**
     * Copy text to clipboard
     * @param {string} text - Text to copy
     * @returns {Promise} Copy result
     */
    async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            this.showToast('Copied to clipboard!', 'success');
            return true;
        } catch (error) {
            console.error('Copy failed:', error);
            this.showToast('Failed to copy', 'error');
            return false;
        }
    },

    /**
     * Download file
     * @param {string} content - File content
     * @param {string} filename - File name
     * @param {string} type - MIME type
     */
    downloadFile(content, filename, type = 'text/plain') {
        const blob = new Blob([content], { type });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    },

    // ============ ERROR HANDLING ============

    /**
     * Handle API error
     * @param {Error} error - Error object
     * @param {string} fallbackMessage - Fallback error message
     * @returns {string} Error message
     */
    handleError(error, fallbackMessage = 'An error occurred') {
        console.error('Error:', error);

        let message = fallbackMessage;

        if (error.response?.data?.error) {
            message = error.response.data.error;
        } else if (error.message) {
            message = error.message;
        }

        this.showToast(message, 'error');
        return message;
    },

    // ============ DEBOUNCE / THROTTLE ============

    /**
     * Debounce function
     * @param {Function} func - Function to debounce
     * @param {number} wait - Wait time in ms
     * @returns {Function} Debounced function
     */
    debounce(func, wait = 300) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    /**
     * Throttle function
     * @param {Function} func - Function to throttle
     * @param {number} limit - Limit in ms
     * @returns {Function} Throttled function
     */
    throttle(func, limit = 300) {
        let inThrottle;
        return function executedFunction(...args) {
            if (!inThrottle) {
                func(...args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    },

    // ============ CACHE MANAGEMENT ============

    /**
     * Clear application cache
     * @returns {Promise} Clear result
     */
    async clearCache() {
        try {
            // Clear service worker caches
            if ('caches' in window) {
                const cacheKeys = await caches.keys();
                await Promise.all(
                    cacheKeys.map(key => caches.delete(key))
                );
            }

            // Clear localStorage except user data
            const user = this.getStorage('currentUser');
            const token = this.getStorage('token');
            this.clearStorage();
            if (user) this.setStorage('currentUser', user);
            if (token) this.setStorage('token', token);

            this.showToast('Cache cleared successfully', 'success');
            return true;
        } catch (error) {
            console.error('Cache clear failed:', error);
            this.showToast('Failed to clear cache', 'error');
            return false;
        }
    },

    // ============ THEME MANAGEMENT ============

    /**
     * Toggle dark mode
     * @returns {boolean} New dark mode state
     */
    toggleDarkMode() {
        const isDark = document.body.classList.toggle('dark-mode');
        this.setStorage('darkMode', isDark);

        // Update theme color meta tag
        const themeColor = document.querySelector('meta[name="theme-color"]');
        if (themeColor) {
            themeColor.setAttribute('content', isDark ? '#0f172a' : '#4361ee');
        }

        return isDark;
    },

    /**
     * Initialize theme from storage
     */
    initTheme() {
        const darkMode = this.getStorage('darkMode');
        if (darkMode) {
            document.body.classList.add('dark-mode');
            const themeColor = document.querySelector('meta[name="theme-color"]');
            if (themeColor) {
                themeColor.setAttribute('content', '#0f172a');
            }
        }
    }
};

// Initialize theme on load
document.addEventListener('DOMContentLoaded', () => Utils.initTheme());

// Make utils globally available
window.Utils = Utils;

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Utils;
}