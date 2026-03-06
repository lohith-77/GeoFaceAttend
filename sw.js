const CACHE_NAME = 'geofaceattend-v3';
const ASSETS_TO_CACHE = [
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
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css',
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
    'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js',
    'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js',
    'https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js',
    'https://unpkg.com/qr-scanner@1.4.2/qr-scanner.min.js'
];

// ============ INSTALL EVENT ============
self.addEventListener('install', event => {
    console.log('🛠️ Service Worker v3 installing...');

    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('📦 Caching assets...');
                return cache.addAll(ASSETS_TO_CACHE);
            })
            .then(() => {
                console.log('✅ Service Worker installed');
                return self.skipWaiting();
            })
            .catch(error => {
                console.error('❌ Cache failed:', error);
            })
    );
});

// ============ ACTIVATE EVENT ============
self.addEventListener('activate', event => {
    console.log('⚡ Service Worker v3 activating...');

    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('🗑️ Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            console.log('✅ Service Worker v3 ready');
            return self.clients.claim();
        })
    );
});

// ============ FETCH EVENT ============
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // Skip cross-origin requests that aren't in our allowlist
    if (url.origin !== location.origin &&
        !url.hostname.includes('cdn.jsdelivr.net') &&
        !url.hostname.includes('cdnjs.cloudflare.com') &&
        !url.hostname.includes('fonts.googleapis.com') &&
        !url.hostname.includes('fonts.gstatic.com') &&
        !url.hostname.includes('unpkg.com')) {
        return;
    }

    // Handle API requests differently
    if (url.pathname.includes('/api/') || url.pathname.includes('/send-email')) {
        event.respondWith(networkFirst(event.request));
        return;
    }

    // Handle page navigations
    if (event.request.mode === 'navigate') {
        event.respondWith(networkFirst(event.request));
        return;
    }

    // Cache-first for static assets
    event.respondWith(cacheFirst(event.request));
});

// Cache-first strategy
async function cacheFirst(request) {
    const cached = await caches.match(request);
    if (cached) {
        return cached;
    }

    try {
        const network = await fetch(request);
        if (network.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, network.clone());
        }
        return network;
    } catch (error) {
        return new Response('Offline - Resource not available', {
            status: 503,
            statusText: 'Service Unavailable'
        });
    }
}

// Network-first strategy
async function networkFirst(request) {
    try {
        const network = await fetch(request);
        if (network.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, network.clone());
        }
        return network;
    } catch (error) {
        const cached = await caches.match(request);
        if (cached) {
            return cached;
        }

        // Return offline page for navigation
        if (request.mode === 'navigate') {
            return caches.match('/index.html');
        }

        return new Response('You are offline. Please check your connection.', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: new Headers({
                'Content-Type': 'text/plain'
            })
        });
    }
}

// ============ PUSH NOTIFICATIONS ============
self.addEventListener('push', event => {
    console.log('📨 Push notification received:', event);

    let data = {
        title: 'GeoFaceAttend',
        body: 'You have a new notification',
        icon: '/assets/icons/icon-192x192.png',
        badge: '/assets/icons/icon-72x72.png',
        url: '/',
        tag: 'default',
        requireInteraction: false,
        silent: false
    };

    if (event.data) {
        try {
            const payload = event.data.json();
            data = { ...data, ...payload };
        } catch (e) {
            data.body = event.data.text();
        }
    }

    const options = {
        body: data.body,
        icon: data.icon,
        badge: data.badge,
        vibrate: [200, 100, 200],
        data: {
            url: data.url,
            dateOfArrival: Date.now(),
            ...data.data
        },
        actions: data.actions || [
            {
                action: 'open',
                title: '🔓 Open App'
            },
            {
                action: 'dismiss',
                title: '❌ Dismiss'
            }
        ],
        tag: data.tag,
        renotify: true,
        requireInteraction: data.requireInteraction,
        silent: data.silent,
        timestamp: Date.now()
    };

    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

// ============ NOTIFICATION CLICK ============
self.addEventListener('notificationclick', event => {
    console.log('🔔 Notification clicked:', event);

    event.notification.close();

    if (event.action === 'dismiss') {
        return;
    }

    const urlToOpen = event.notification.data?.url || '/';

    event.waitUntil(
        clients.matchAll({
            type: 'window',
            includeUncontrolled: true
        })
            .then(clientList => {
                // If already open, focus the tab
                for (const client of clientList) {
                    if (client.url.includes(urlToOpen) && 'focus' in client) {
                        return client.focus();
                    }
                }
                // Otherwise open new tab
                if (clients.openWindow) {
                    return clients.openWindow(urlToOpen);
                }
            })
    );
});

// ============ NOTIFICATION CLOSE ============
self.addEventListener('notificationclose', event => {
    console.log('🔕 Notification closed:', event);

    // Track notification dismissal
    const analytics = {
        action: 'dismissed',
        timestamp: Date.now(),
        notification: event.notification.tag
    };

    // Store in IndexedDB for analytics
    storeAnalytics(analytics);
});

// ============ BACKGROUND SYNC ============
self.addEventListener('sync', event => {
    console.log('🔄 Background sync event:', event.tag);

    if (event.tag === 'sync-attendance') {
        event.waitUntil(syncAttendance());
    }

    if (event.tag === 'sync-leaves') {
        event.waitUntil(syncLeaves());
    }

    if (event.tag === 'sync-emails') {
        event.waitUntil(syncEmails());
    }

    if (event.tag === 'sync-all') {
        event.waitUntil(Promise.all([
            syncAttendance(),
            syncLeaves(),
            syncEmails()
        ]));
    }
});

// ============ PERIODIC SYNC ============
self.addEventListener('periodicsync', event => {
    console.log('📅 Periodic sync event:', event.tag);

    if (event.tag === 'update-attendance') {
        event.waitUntil(updateAttendanceData());
    }

    if (event.tag === 'clean-old-data') {
        event.waitUntil(cleanOldData());
    }
});

// ============ SYNC FUNCTIONS ============

async function syncAttendance() {
    console.log('📊 Syncing offline attendance...');

    try {
        const db = await openDB();
        const pending = await getPendingItems(db, 'pendingAttendance');

        if (pending.length === 0) {
            console.log('No pending attendance to sync');
            return;
        }

        console.log(`Syncing ${pending.length} attendance records...`);

        let synced = 0;
        let failed = 0;

        for (const item of pending) {
            try {
                const token = await getAuthToken();
                if (!token) {
                    console.log('No auth token available');
                    break;
                }

                const response = await fetch('/api/attendance/sync', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(item.data)
                });

                if (response.ok) {
                    await removeItem(db, 'pendingAttendance', item.id);
                    synced++;
                } else {
                    failed++;
                }
            } catch (error) {
                console.error('Failed to sync attendance item:', error);
                failed++;
            }
        }

        // Show notification
        if (synced > 0) {
            await showNotification('Attendance Synced',
                `✅ Synced ${synced} attendance records${failed > 0 ? `, ${failed} failed` : ''}`);
        }

        return { synced, failed };

    } catch (error) {
        console.error('Attendance sync failed:', error);
        await showNotification('Sync Failed', '❌ Failed to sync attendance data');
    }
}

async function syncLeaves() {
    console.log('📋 Syncing offline leave requests...');

    try {
        const db = await openDB();
        const pending = await getPendingItems(db, 'pendingLeaves');

        if (pending.length === 0) {
            console.log('No pending leave requests to sync');
            return;
        }

        console.log(`Syncing ${pending.length} leave requests...`);

        let synced = 0;
        let failed = 0;

        for (const item of pending) {
            try {
                const token = await getAuthToken();
                if (!token) {
                    console.log('No auth token available');
                    break;
                }

                const response = await fetch('/api/leaves/apply', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(item.data)
                });

                if (response.ok) {
                    await removeItem(db, 'pendingLeaves', item.id);
                    synced++;
                } else {
                    failed++;
                }
            } catch (error) {
                console.error('Failed to sync leave item:', error);
                failed++;
            }
        }

        if (synced > 0) {
            await showNotification('Leave Requests Synced',
                `✅ Synced ${synced} leave requests${failed > 0 ? `, ${failed} failed` : ''}`);
        }

        return { synced, failed };

    } catch (error) {
        console.error('Leave sync failed:', error);
    }
}

async function syncEmails() {
    console.log('📧 Syncing offline emails...');

    try {
        const db = await openDB();
        const pending = await getPendingItems(db, 'pendingEmails');

        if (pending.length === 0) {
            console.log('No pending emails to sync');
            return;
        }

        console.log(`Syncing ${pending.length} emails...`);

        let synced = 0;
        let failed = 0;

        for (const item of pending) {
            try {
                const token = await getAuthToken();
                if (!token) {
                    console.log('No auth token available');
                    break;
                }

                const response = await fetch('/send-email', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(item.data)
                });

                if (response.ok) {
                    await removeItem(db, 'pendingEmails', item.id);
                    synced++;
                } else {
                    failed++;
                }
            } catch (error) {
                console.error('Failed to sync email:', error);
                failed++;
            }
        }

        if (synced > 0) {
            await showNotification('Emails Synced',
                `✅ Synced ${synced} emails${failed > 0 ? `, ${failed} failed` : ''}`);
        }

        return { synced, failed };

    } catch (error) {
        console.error('Email sync failed:', error);
    }
}

async function updateAttendanceData() {
    console.log('🔄 Updating attendance data...');

    try {
        const token = await getAuthToken();
        if (!token) return;

        const response = await fetch('/api/attendance/latest', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            const data = await response.json();

            // Store in cache for offline access
            const cache = await caches.open(CACHE_NAME);
            const cachedResponse = new Response(JSON.stringify(data), {
                headers: { 'Content-Type': 'application/json' }
            });
            cache.put('/api/attendance/latest', cachedResponse);

            console.log('✅ Attendance data updated');
        }
    } catch (error) {
        console.error('Failed to update attendance:', error);
    }
}

async function cleanOldData() {
    console.log('🧹 Cleaning old data...');

    try {
        const db = await openDB();
        const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);

        // Clean pending attendance
        await cleanOldItems(db, 'pendingAttendance', thirtyDaysAgo);

        // Clean pending leaves
        await cleanOldItems(db, 'pendingLeaves', thirtyDaysAgo);

        // Clean pending emails
        await cleanOldItems(db, 'pendingEmails', thirtyDaysAgo);

        console.log('✅ Old data cleaned');

    } catch (error) {
        console.error('Failed to clean old data:', error);
    }
}

// ============ INDEXEDDB HELPERS ============

async function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('GeoFaceAttendOffline', 2);

        request.onerror = () => {
            console.error('Failed to open database');
            reject(request.error);
        };

        request.onsuccess = () => {
            resolve(request.result);
        };

        request.onupgradeneeded = (event) => {
            const db = event.target.result;

            // Create object stores if they don't exist
            if (!db.objectStoreNames.contains('pendingAttendance')) {
                const attendanceStore = db.createObjectStore('pendingAttendance', {
                    keyPath: 'id',
                    autoIncrement: true
                });
                attendanceStore.createIndex('timestamp', 'timestamp');
                attendanceStore.createIndex('synced', 'synced');
            }

            if (!db.objectStoreNames.contains('pendingLeaves')) {
                const leavesStore = db.createObjectStore('pendingLeaves', {
                    keyPath: 'id',
                    autoIncrement: true
                });
                leavesStore.createIndex('timestamp', 'timestamp');
                leavesStore.createIndex('synced', 'synced');
            }

            if (!db.objectStoreNames.contains('pendingEmails')) {
                const emailStore = db.createObjectStore('pendingEmails', {
                    keyPath: 'id',
                    autoIncrement: true
                });
                emailStore.createIndex('timestamp', 'timestamp');
                emailStore.createIndex('synced', 'synced');
            }

            if (!db.objectStoreNames.contains('analytics')) {
                const analyticsStore = db.createObjectStore('analytics', {
                    keyPath: 'id',
                    autoIncrement: true
                });
                analyticsStore.createIndex('timestamp', 'timestamp');
            }

            if (!db.objectStoreNames.contains('auth')) {
                db.createObjectStore('auth', { keyPath: 'key' });
            }
        };
    });
}

async function getPendingItems(db, storeName) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const index = store.index('synced');
        const request = index.getAll(false); // Get all unsynced items

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function removeItem(db, storeName, id) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.delete(id);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

async function cleanOldItems(db, storeName, olderThan) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const index = store.index('timestamp');
        const range = IDBKeyRange.upperBound(olderThan);
        const request = index.openCursor(range);

        request.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
                store.delete(cursor.primaryKey);
                cursor.continue();
            } else {
                resolve();
            }
        };

        request.onerror = () => reject(request.error);
    });
}

async function storeAnalytics(data) {
    try {
        const db = await openDB();
        const transaction = db.transaction('analytics', 'readwrite');
        const store = transaction.objectStore('analytics');
        store.add({
            ...data,
            timestamp: Date.now()
        });
    } catch (error) {
        console.error('Failed to store analytics:', error);
    }
}

async function getAuthToken() {
    try {
        const db = await openDB();
        const transaction = db.transaction('auth', 'readonly');
        const store = transaction.objectStore('auth');
        const request = store.get('token');

        return new Promise((resolve) => {
            request.onsuccess = () => resolve(request.result?.value);
            request.onerror = () => resolve(null);
        });
    } catch {
        return null;
    }
}

// ============ NOTIFICATION HELPER ============

async function showNotification(title, body) {
    try {
        await self.registration.showNotification(title, {
            body: body,
            icon: '/assets/icons/icon-192x192.png',
            badge: '/assets/icons/icon-72x72.png',
            vibrate: [200, 100, 200],
            tag: 'sync-notification',
            timestamp: Date.now()
        });
    } catch (error) {
        console.error('Failed to show notification:', error);
    }
}

// ============ MESSAGE HANDLING ============

self.addEventListener('message', event => {
    console.log('📨 Message received:', event.data);

    if (event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }

    if (event.data.type === 'SYNC_NOW') {
        event.waitUntil(syncAll());
    }

    if (event.data.type === 'CLEAR_CACHE') {
        event.waitUntil(clearCache());
    }
});

async function syncAll() {
    await Promise.all([
        syncAttendance(),
        syncLeaves(),
        syncEmails()
    ]);

    // Notify all clients
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
        client.postMessage({
            type: 'SYNC_COMPLETE',
            timestamp: Date.now()
        });
    });
}

async function clearCache() {
    const cacheKeys = await caches.keys();
    await Promise.all(
        cacheKeys.map(key => caches.delete(key))
    );
    console.log('✅ Cache cleared');
}

// ============ OFFLINE ANALYTICS ============

// Track offline events
self.addEventListener('fetch', event => {
    // Track failed requests when offline
    if (!navigator.onLine && !event.request.url.includes('/api/')) {
        storeAnalytics({
            type: 'offline_request',
            url: event.request.url,
            timestamp: Date.now()
        });
    }
});