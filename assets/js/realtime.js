// Real-time Update System (Demo Version)
class RealtimeManager {
    constructor() {
        this.connected = false;
        this.subscribers = new Map();
        this.updateInterval = null;
        this.initialize();
    }

    initialize() {
        console.log('Real-time manager initialized');
        this.connected = true;
        this.startSimulatedUpdates();
    }

    disconnect() {
        this.connected = false;
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
    }

    // Subscribe to updates
    subscribe(channel, callback) {
        if (!this.subscribers.has(channel)) {
            this.subscribers.set(channel, []);
        }
        this.subscribers.get(channel).push(callback);

        // Return unsubscribe function
        return () => this.unsubscribe(channel, callback);
    }

    // Unsubscribe from updates
    unsubscribe(channel, callback) {
        if (this.subscribers.has(channel)) {
            const callbacks = this.subscribers.get(channel);
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        }
    }

    // Publish update to channel
    publish(channel, data) {
        if (!this.connected) return;

        if (this.subscribers.has(channel)) {
            this.subscribers.get(channel).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error('Error in subscriber callback:', error);
                }
            });
        }
    }

    // Start simulated real-time updates
    startSimulatedUpdates() {
        // Simulate attendance updates every 30 seconds
        this.updateInterval = setInterval(() => {
            if (Math.random() > 0.5) { // 50% chance of update
                const attendanceUpdate = {
                    type: 'attendance',
                    data: {
                        present: Math.floor(Math.random() * 10) + 140,
                        late: Math.floor(Math.random() * 5) + 5,
                        timestamp: new Date().toISOString()
                    }
                };
                this.publish('attendance', attendanceUpdate);
            }
        }, 30000);
    }

    // Get connection status
    getStatus() {
        return {
            connected: this.connected,
            subscribers: this.subscribers.size
        };
    }
}

// Initialize real-time manager
const realtimeManager = new RealtimeManager();
window.realtimeManager = realtimeManager;

// UI Update Functions
function updateUIWithRealtimeData() {
    // Subscribe to attendance updates
    realtimeManager.subscribe('attendance', (update) => {
        console.log('Attendance update:', update);

        // Update dashboard stats if elements exist
        const presentElement = document.getElementById('presentToday');
        const lateElement = document.getElementById('lateToday');

        if (presentElement) {
            presentElement.textContent = update.data.present;
        }
        if (lateElement) {
            lateElement.textContent = update.data.late;
        }

        // Show notification
        if (window.notificationSystem) {
            notificationSystem.show({
                title: 'Live Attendance Update',
                message: `Present: ${update.data.present} | Late: ${update.data.late}`,
                type: 'info'
            });
        }
    });
}

// Call when page loads
document.addEventListener('DOMContentLoaded', updateUIWithRealtimeData);