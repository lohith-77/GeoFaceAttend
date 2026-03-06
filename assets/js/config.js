// GeoFaceAttend Configuration File
const CONFIG = {
    // API Configuration
    API: {
        URL: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
            ? 'http://localhost:5001'
            : 'https://geofaceattend.onrender.com',
        TIMEOUT: 30000, // 30 seconds
        RETRY_ATTEMPTS: 3,
        RETRY_DELAY: 1000, // 1 second
    },

    // App Settings
    APP: {
        NAME: 'GeoFaceAttend',
        VERSION: '2.0.0',
        COMPANY: 'GeoFaceAttend Inc.',
        SUPPORT_EMAIL: 'support@geofaceattend.com',
        SUPPORT_PHONE: '+1-800-GEO-FACE',
    },

    // Attendance Settings
    ATTENDANCE: {
        CHECKIN_START: '09:00', // 9:00 AM
        LATE_THRESHOLD: 15, // minutes after start time
        GRACE_PERIOD: 5, // minutes
        WORK_HOURS: 8, // standard work day hours
        RADIUS_METERS: 1000, // 1km radius for location verification
        OFFICE_LOCATIONS: [
            {
                id: 'main',
                name: 'Main Office',
                lat: 22.85918122756394,
                lng: 75.95455016931957,
                radius: 1000,
                address: '123 Business Avenue, Downtown',
                workingHours: { start: 9, end: 18 }
            },
            {
                id: 'branch',
                name: 'Branch Office',
                lat: 10.956410017082131,
                lng: 78.75403715622984,
                radius: 1000,
                address: '456 Tech Park, Sector 5',
                workingHours: { start: 8, end: 17 }
            }
        ],
    },

    // Leave Settings
    LEAVE: {
        TYPES: ['Annual', 'Sick', 'Personal', 'Maternity', 'Paternity', 'Bereavement'],
        DEFAULT_BALANCE: {
            annual: 15,
            sick: 10,
            personal: 5
        },
        MIN_DAYS_NOTICE: 1, // days advance notice required
        MAX_CONSECUTIVE_DAYS: 30,
    },

    // Face Recognition Settings
    FACE: {
        MIN_CONFIDENCE: 0.7, // 70% minimum confidence
        EYE_OPEN_THRESHOLD: 0.25, // Eye Aspect Ratio threshold
        CAMERA: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: 'user'
        },
        MODELS: [
            'tiny_face_detector_model-weights_manifest.json',
            'face_landmark_68_model-weights_manifest.json',
            'face_recognition_model-weights_manifest.json'
        ],
        MODEL_URL: 'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights',
    },

    // QR Code Settings
    QR: {
        SIZE: 200,
        CHECKIN_TIMEOUT: 12, // hours valid
        MAX_SCANS: 100,
    },

    // PWA Settings
    PWA: {
        CACHE_NAME: 'geofaceattend-v3',
        ASSETS_TO_CACHE: [
            '/',
            '/index.html',
            '/auth.html',
            '/inbox.html',
            '/admin/dashboard.html',
            '/admin/analytics.html',
            '/employee/dashboard.html',
            '/assets/css/style.css',
            '/assets/js/auth.js',
            '/assets/js/ai-assistant.js',
            '/assets/js/email-service.js',
            '/assets/js/face-verification.js',
            '/assets/js/location-service.js',
            '/assets/js/notifications.js',
            '/assets/js/realtime.js',
            '/assets/js/install-prompt.js',
            '/assets/js/offline-sync.js',
        ],
        INSTALL_PROMPT_DELAY: 30000, // 30 seconds
        INSTALL_COOLDOWN_DAYS: 7, // days before showing prompt again
    },

    // Notification Settings
    NOTIFICATIONS: {
        TYPES: {
            SUCCESS: 'success',
            ERROR: 'error',
            WARNING: 'warning',
            INFO: 'info'
        },
        DURATION: 5000, // 5 seconds
        MAX_STORED: 50, // max notifications to store
    },

    // Chart Colors
    COLORS: {
        primary: '#4361ee',
        success: '#10b981',
        warning: '#f59e0b',
        danger: '#ef4444',
        info: '#8b5cf6',
        gray: '#94a3b8',
        chart: ['#4361ee', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899'],
    },

    // Pagination Settings
    PAGINATION: {
        DEFAULT_PAGE_SIZE: 10,
        PAGE_SIZE_OPTIONS: [10, 25, 50, 100],
    },

    // Date Formats
    DATE_FORMATS: {
        DISPLAY: 'MMM DD, YYYY',
        DISPLAY_TIME: 'MMM DD, YYYY hh:mm A',
        ISO: 'YYYY-MM-DD',
        ISO_TIME: 'YYYY-MM-DD HH:mm:ss',
        TIME: 'hh:mm A',
    },

    // File Upload
    UPLOAD: {
        MAX_SIZE: 5 * 1024 * 1024, // 5MB
        ALLOWED_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'],
    },

    // Feature Flags
    FEATURES: {
        FACE_RECOGNITION: true,
        LOCATION_TRACKING: true,
        QR_CODE: true,
        EMAIL_NOTIFICATIONS: true,
        SMS_NOTIFICATIONS: false, // requires Twilio setup
        PUSH_NOTIFICATIONS: true,
        OFFLINE_MODE: true,
        DARK_MODE: true,
        EXPORT_REPORTS: true,
        BULK_OPERATIONS: true,
    },

    // Debug Mode
    DEBUG: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1',
};

// Freeze configuration to prevent modifications
Object.freeze(CONFIG);

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}