// Offline Sync Manager for GeoFaceAttend
class OfflineSyncManager {
    constructor() {
        this.dbName = 'GeoFaceAttendOffline';
        this.dbVersion = 2;
        this.db = null;
        this.syncInProgress = false;
        this.initialize();
    }

    async initialize() {
        try {
            await this.openDatabase();
            this.setupEventListeners();
            await this.checkPendingItems();
        } catch (error) {
            console.error('❌ OfflineSync initialization error:', error);
        }
    }

    async openDatabase() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = (event) => {
                console.error('Failed to open database:', event.target.error);
                reject(event.target.error);
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                console.log('✅ Offline database opened');

                // Handle database errors
                this.db.onerror = (event) => {
                    console.error('Database error:', event.target.error);
                };

                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                const oldVersion = event.oldVersion;
                console.log(`🔄 Upgrading database from v${oldVersion} to v${this.dbVersion}`);

                // Create object stores if they don't exist
                if (!db.objectStoreNames.contains('pendingAttendance')) {
                    const attendanceStore = db.createObjectStore('pendingAttendance', {
                        keyPath: 'id',
                        autoIncrement: true
                    });
                    attendanceStore.createIndex('timestamp', 'timestamp', { unique: false });
                    attendanceStore.createIndex('synced', 'synced', { unique: false });
                }

                if (!db.objectStoreNames.contains('pendingLeaves')) {
                    const leavesStore = db.createObjectStore('pendingLeaves', {
                        keyPath: 'id',
                        autoIncrement: true
                    });
                    leavesStore.createIndex('timestamp', 'timestamp', { unique: false });
                    leavesStore.createIndex('synced', 'synced', { unique: false });
                }

                if (!db.objectStoreNames.contains('pendingEmails')) {
                    const emailStore = db.createObjectStore('pendingEmails', {
                        keyPath: 'id',
                        autoIncrement: true
                    });
                    emailStore.createIndex('timestamp', 'timestamp', { unique: false });
                    emailStore.createIndex('synced', 'synced', { unique: false });
                }

                if (!db.objectStoreNames.contains('outstationQR')) {
                    const qrStore = db.createObjectStore('outstationQR', {
                        keyPath: 'qrId'
                    });
                    qrStore.createIndex('expiry', 'expiry', { unique: false });
                }

                if (!db.objectStoreNames.contains('appSettings')) {
                    db.createObjectStore('appSettings', { keyPath: 'key' });
                }
            };
        });
    }

    setupEventListeners() {
        // Listen for online/offline events
        window.addEventListener('online', () => {
            console.log('📶 Device is online - starting sync');
            this.syncAll();
        });

        // Register for background sync if available
        if ('serviceWorker' in navigator && 'SyncManager' in window) {
            navigator.serviceWorker.ready.then(registration => {
                registration.sync.register('sync-attendance').catch(err => {
                    console.log('Background sync not supported:', err);
                });
            });
        }

        // Periodic sync every 30 minutes if online
        setInterval(() => {
            if (navigator.onLine) {
                this.syncAll();
            }
        }, 30 * 60 * 1000);
    }

    // Add attendance record for offline sync
    async addAttendance(attendanceData) {
        return this.addPendingItem('pendingAttendance', {
            ...attendanceData,
            timestamp: Date.now(),
            synced: false
        });
    }

    // Add leave request for offline sync
    async addLeave(leaveData) {
        return this.addPendingItem('pendingLeaves', {
            ...leaveData,
            timestamp: Date.now(),
            synced: false
        });
    }

    // Add email for offline sync
    async addEmail(emailData) {
        return this.addPendingItem('pendingEmails', {
            ...emailData,
            timestamp: Date.now(),
            synced: false
        });
    }

    // Add pending item to store
    async addPendingItem(storeName, item) {
        if (!this.db) {
            await this.openDatabase();
        }

        return new Promise((resolve, reject) => {
            try {
                const transaction = this.db.transaction(storeName, 'readwrite');
                const store = transaction.objectStore(storeName);
                const request = store.add(item);

                request.onsuccess = () => {
                    console.log(`✅ Added to ${storeName} for offline sync`);

                    // Show notification
                    if (window.notificationSystem) {
                        notificationSystem.show({
                            title: 'Offline Mode',
                            message: 'Your data will sync when online',
                            type: 'info'
                        });
                    }

                    resolve(request.result);
                };

                request.onerror = (event) => {
                    console.error(`Error adding to ${storeName}:`, event.target.error);
                    reject(event.target.error);
                };

                transaction.oncomplete = () => {
                    console.log(`Transaction completed for ${storeName}`);
                };

                transaction.onerror = (event) => {
                    console.error(`Transaction error for ${storeName}:`, event.target.error);
                    reject(event.target.error);
                };
            } catch (error) {
                console.error(`Error in addPendingItem:`, error);
                reject(error);
            }
        });
    }

    // Get all pending items
    async getPendingItems(storeName) {
        if (!this.db) {
            await this.openDatabase();
        }

        return new Promise((resolve, reject) => {
            try {
                const transaction = this.db.transaction(storeName, 'readonly');
                const store = transaction.objectStore(storeName);

                // Check if index exists
                let request;
                try {
                    const index = store.index('synced');
                    request = index.getAll(false); // Get all unsynced items
                } catch (indexError) {
                    // If index doesn't exist, get all and filter manually
                    console.warn(`Index 'synced' not found in ${storeName}, getting all items`);
                    request = store.getAll();
                }

                request.onsuccess = () => {
                    let items = request.result || [];

                    // If we got all items and need to filter by synced status
                    if (!store.indexNames.contains('synced')) {
                        items = items.filter(item => item.synced === false);
                    }

                    resolve(items);
                };

                request.onerror = (event) => {
                    console.error(`Error getting items from ${storeName}:`, event.target.error);
                    reject(event.target.error);
                };

                transaction.onerror = (event) => {
                    console.error(`Transaction error for ${storeName}:`, event.target.error);
                    reject(event.target.error);
                };
            } catch (error) {
                console.error(`Error in getPendingItems:`, error);
                reject(error);
            }
        });
    }

    // Mark item as synced
    async markAsSynced(storeName, id) {
        if (!this.db) {
            await this.openDatabase();
        }

        return new Promise((resolve, reject) => {
            try {
                const transaction = this.db.transaction(storeName, 'readwrite');
                const store = transaction.objectStore(storeName);
                const getRequest = store.get(id);

                getRequest.onsuccess = () => {
                    const item = getRequest.result;
                    if (item) {
                        item.synced = true;
                        item.syncedAt = Date.now();

                        const putRequest = store.put(item);
                        putRequest.onsuccess = () => {
                            console.log(`✅ Item ${id} marked as synced in ${storeName}`);
                            resolve();
                        };
                        putRequest.onerror = (event) => {
                            console.error(`Error updating item ${id}:`, event.target.error);
                            reject(event.target.error);
                        };
                    } else {
                        console.warn(`Item ${id} not found in ${storeName}`);
                        resolve();
                    }
                };

                getRequest.onerror = (event) => {
                    console.error(`Error getting item ${id}:`, event.target.error);
                    reject(event.target.error);
                };
            } catch (error) {
                console.error(`Error in markAsSynced:`, error);
                reject(error);
            }
        });
    }

    // Remove item from store
    async removeItem(storeName, id) {
        if (!this.db) {
            await this.openDatabase();
        }

        return new Promise((resolve, reject) => {
            try {
                const transaction = this.db.transaction(storeName, 'readwrite');
                const store = transaction.objectStore(storeName);
                const request = store.delete(id);

                request.onsuccess = () => {
                    console.log(`✅ Item ${id} removed from ${storeName}`);
                    resolve();
                };

                request.onerror = (event) => {
                    console.error(`Error removing item ${id}:`, event.target.error);
                    reject(event.target.error);
                };
            } catch (error) {
                console.error(`Error in removeItem:`, error);
                reject(error);
            }
        });
    }

    // Sync all pending items
    async syncAll() {
        if (this.syncInProgress) {
            console.log('Sync already in progress');
            return;
        }

        if (!navigator.onLine) {
            console.log('Device offline - cannot sync');
            return;
        }

        this.syncInProgress = true;

        try {
            await this.syncAttendance();
            await this.syncLeaves();
            await this.syncEmails();

            console.log('✅ All pending items synced');

            // Show notification
            if (window.notificationSystem) {
                notificationSystem.show({
                    title: 'Sync Complete',
                    message: 'All offline data synced successfully',
                    type: 'success'
                });
            }

            // Update UI
            this.updateSyncStatus('completed');
        } catch (error) {
            console.error('Sync failed:', error);
            this.updateSyncStatus('failed');
        } finally {
            this.syncInProgress = false;
        }
    }

    // Sync attendance records
    async syncAttendance() {
        try {
            const pending = await this.getPendingItems('pendingAttendance');

            if (pending.length === 0) {
                console.log('No pending attendance to sync');
                return;
            }

            console.log(`Syncing ${pending.length} attendance records...`);

            let synced = 0;
            let failed = 0;

            for (const item of pending) {
                try {
                    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
                    if (!token) {
                        console.log('No auth token available');
                        continue;
                    }

                    const response = await fetch('/api/attendance/mark', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify(item)
                    });

                    if (response.ok) {
                        await this.removeItem('pendingAttendance', item.id);
                        synced++;
                    } else {
                        console.log(`Failed to sync attendance: ${response.status}`);
                        failed++;
                    }
                } catch (error) {
                    console.error('Error syncing attendance:', error);
                    failed++;
                }
            }

            console.log(`Attendance sync complete: ${synced} synced, ${failed} failed`);

        } catch (error) {
            console.error('Attendance sync error:', error);
        }
    }

    // Sync leave requests
    async syncLeaves() {
        try {
            const pending = await this.getPendingItems('pendingLeaves');

            if (pending.length === 0) {
                console.log('No pending leave requests to sync');
                return;
            }

            console.log(`Syncing ${pending.length} leave requests...`);

            let synced = 0;
            let failed = 0;

            for (const item of pending) {
                try {
                    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
                    if (!token) {
                        console.log('No auth token available');
                        continue;
                    }

                    const response = await fetch('/api/leaves/apply', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify(item)
                    });

                    if (response.ok) {
                        await this.removeItem('pendingLeaves', item.id);
                        synced++;
                    } else {
                        console.log(`Failed to sync leave: ${response.status}`);
                        failed++;
                    }
                } catch (error) {
                    console.error('Error syncing leave:', error);
                    failed++;
                }
            }

            console.log(`Leave sync complete: ${synced} synced, ${failed} failed`);

        } catch (error) {
            console.error('Leave sync error:', error);
        }
    }

    // Sync emails
    async syncEmails() {
        try {
            const pending = await this.getPendingItems('pendingEmails');

            if (pending.length === 0) {
                console.log('No pending emails to sync');
                return;
            }

            console.log(`Syncing ${pending.length} emails...`);

            let synced = 0;
            let failed = 0;

            for (const item of pending) {
                try {
                    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
                    if (!token) {
                        console.log('No auth token available');
                        continue;
                    }

                    const response = await fetch('/send-email', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify(item)
                    });

                    if (response.ok) {
                        await this.removeItem('pendingEmails', item.id);
                        synced++;
                    } else {
                        console.log(`Failed to sync email: ${response.status}`);
                        failed++;
                    }
                } catch (error) {
                    console.error('Error syncing email:', error);
                    failed++;
                }
            }

            console.log(`Email sync complete: ${synced} synced, ${failed} failed`);

        } catch (error) {
            console.error('Email sync error:', error);
        }
    }

    // Check pending items count
    async checkPendingItems() {
        try {
            const attendance = await this.getPendingItems('pendingAttendance').catch(() => []);
            const leaves = await this.getPendingItems('pendingLeaves').catch(() => []);
            const emails = await this.getPendingItems('pendingEmails').catch(() => []);

            const total = attendance.length + leaves.length + emails.length;

            if (total > 0) {
                console.log(`📊 Pending items: ${total} (Attendance: ${attendance.length}, Leaves: ${leaves.length}, Emails: ${emails.length})`);
                this.updateSyncStatus('pending', total);

                if (navigator.onLine) {
                    this.syncAll();
                }
            }

            return total;
        } catch (error) {
            console.error('Error checking pending items:', error);
            return 0;
        }
    }

    // Update sync status in UI
    updateSyncStatus(status, count = 0) {
        const badge = document.getElementById('syncBadge');
        if (!badge) return;

        if (status === 'pending') {
            badge.style.display = 'inline-block';
            badge.textContent = count;
            badge.title = `${count} items pending sync`;
        } else if (status === 'completed') {
            badge.style.display = 'none';
        } else if (status === 'failed') {
            badge.style.display = 'inline-block';
            badge.textContent = '!';
            badge.style.background = '#ef4444';
            setTimeout(() => {
                badge.style.display = 'none';
            }, 5000);
        }
    }

    // Clear old synced items (older than 30 days)
    async cleanOldItems() {
        try {
            const stores = ['pendingAttendance', 'pendingLeaves', 'pendingEmails'];
            const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);

            for (const storeName of stores) {
                try {
                    const transaction = this.db.transaction(storeName, 'readwrite');
                    const store = transaction.objectStore(storeName);

                    if (store.indexNames.contains('timestamp')) {
                        const index = store.index('timestamp');
                        const range = IDBKeyRange.upperBound(thirtyDaysAgo);
                        const request = index.openCursor(range);

                        request.onsuccess = (event) => {
                            const cursor = event.target.result;
                            if (cursor) {
                                store.delete(cursor.primaryKey);
                                cursor.continue();
                            }
                        };
                    }
                } catch (error) {
                    console.warn(`Error cleaning ${storeName}:`, error);
                }
            }

            console.log('✅ Old data cleaned');
        } catch (error) {
            console.error('Failed to clean old data:', error);
        }
    }

    // Get sync statistics
    async getSyncStats() {
        try {
            const attendance = await this.getPendingItems('pendingAttendance').catch(() => []);
            const leaves = await this.getPendingItems('pendingLeaves').catch(() => []);
            const emails = await this.getPendingItems('pendingEmails').catch(() => []);

            return {
                pending: {
                    attendance: attendance.length,
                    leaves: leaves.length,
                    emails: emails.length,
                    total: attendance.length + leaves.length + emails.length
                },
                lastSync: localStorage.getItem('lastSyncTime'),
                online: navigator.onLine
            };
        } catch (error) {
            console.error('Error getting sync stats:', error);
            return {
                pending: { attendance: 0, leaves: 0, emails: 0, total: 0 },
                online: navigator.onLine
            };
        }
    }
}

// Initialize offline sync manager
let offlineSync;
try {
    offlineSync = new OfflineSyncManager();
    window.offlineSync = offlineSync;
    console.log('✅ OfflineSync manager initialized');
} catch (error) {
    console.error('❌ Failed to initialize OfflineSync:', error);
}

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = OfflineSyncManager;
}