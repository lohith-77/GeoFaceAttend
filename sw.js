const CACHE_NAME = 'geofaceattend-v1';
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/auth.html',
    '/employee/dashboard.html',
    '/admin/dashboard.html',
    '/assets/css/style.css',
    '/assets/js/auth.js',
    '/assets/js/ai-assistant.js',
    '/assets/js/email-service.js',
    '/assets/js/face-verification.js',
    '/assets/js/location-service.js',
    '/assets/js/notifications.js',
    '/assets/js/realtime.js',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css',
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
    'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js',
    'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js'
];

// Install event - cache assets
self.addEventListener('install', event => {
    console.log('Service Worker installing...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Caching assets...');
                return cache.addAll(ASSETS_TO_CACHE);
            })
            .then(() => self.skipWaiting())
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
    console.log('Service Worker activating...');
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', event => {
    // Skip cross-origin requests like CDN
    if (!event.request.url.startsWith(self.location.origin) &&
        !event.request.url.includes('cdn.jsdelivr.net') &&
        !event.request.url.includes('cdnjs.cloudflare.com') &&
        !event.request.url.includes('fonts.googleapis.com')) {
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then(cachedResponse => {
                if (cachedResponse) {
                    return cachedResponse;
                }

                return fetch(event.request)
                    .then(networkResponse => {
                        // Don't cache API calls
                        if (event.request.url.includes('/send-email')) {
                            return networkResponse;
                        }

                        // Cache new resources
                        const responseClone = networkResponse.clone();
                        caches.open(CACHE_NAME).then(cache => {
                            cache.put(event.request, responseClone);
                        });
                        return networkResponse;
                    })
                    .catch(error => {
                        console.log('Fetch failed:', error);
                        // Return offline page for navigation requests
                        if (event.request.mode === 'navigate') {
                            return caches.match('/index.html');
                        }
                    });
            })
    );
});

// Handle offline sync for emails
self.addEventListener('sync', event => {
    if (event.tag === 'email-sync') {
        console.log('Syncing offline emails...');
        event.waitUntil(syncOfflineEmails());
    }
});

async function syncOfflineEmails() {
    // Check IndexedDB for offline emails
    // This is a placeholder - implement based on your needs
    console.log('Email sync completed');
}