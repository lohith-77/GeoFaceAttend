// Enhanced Location Service with Geofencing and Multiple Office Support
class LocationService {
    constructor() {
        // Company office locations - UPDATE THESE COORDINATES WITH YOUR LOCATION
        this.officeLocations = [
            {
                id: 'main',
                name: 'Main Office',
                lat: 22.85918122756394,        // <--- CHANGE THIS to your latitude
                lng: 75.95455016931957,         // <--- CHANGE THIS to your longitude
                radius: 1000,                    // 1km radius
                address: '123 Business Avenue, Downtown',
                workingHours: { start: 9, end: 18 } // 9 AM to 6 PM
            },
            {
                id: 'branch',
                name: 'Branch Office',
                lat: 10.956410017082131,        // <--- CHANGE THIS to your branch latitude
                lng: 78.75403715622984,          // <--- CHANGE THIS to your branch longitude
                radius: 1000,                     // 1km radius
                address: '456 Tech Park, Sector 5',
                workingHours: { start: 8, end: 17 } // 8 AM to 5 PM
            },
            {
                id: 'client',
                name: 'Client Site',
                lat: 0,                          // Add client site coordinates
                lng: 0,
                radius: 500,                      // 500m radius
                address: 'Client location',
                isTemporary: true
            }
        ];

        this.watchId = null;
        this.lastLocation = null;
        this.geofenceCallbacks = [];
    }

    // Calculate distance between two coordinates using Haversine formula
    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371e3; // Earth's radius in meters
        const φ1 = lat1 * Math.PI / 180;
        const φ2 = lat2 * Math.PI / 180;
        const Δφ = (lat2 - lat1) * Math.PI / 180;
        const Δλ = (lon2 - lon1) * Math.PI / 180;

        const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return R * c; // Distance in meters
    }

    // Get current location with high accuracy
    async getCurrentLocation(options = {}) {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Geolocation is not supported by your browser'));
                return;
            }

            const defaultOptions = {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            };

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const location = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                        accuracy: position.coords.accuracy,
                        altitude: position.coords.altitude,
                        altitudeAccuracy: position.coords.altitudeAccuracy,
                        heading: position.coords.heading,
                        speed: position.coords.speed,
                        timestamp: position.timestamp
                    };

                    this.lastLocation = location;
                    resolve(location);
                },
                (error) => {
                    let message = 'Location access denied';
                    switch (error.code) {
                        case error.PERMISSION_DENIED:
                            message = 'Please allow location access to verify your attendance';
                            break;
                        case error.POSITION_UNAVAILABLE:
                            message = 'Location information is unavailable';
                            break;
                        case error.TIMEOUT:
                            message = 'Location request timed out. Please try again.';
                            break;
                    }
                    reject(new Error(message));
                },
                { ...defaultOptions, ...options }
            );
        });
    }

    // Watch position continuously
    startWatchingPosition(callback, options = {}) {
        if (!navigator.geolocation) {
            console.error('Geolocation not supported');
            return null;
        }

        const defaultOptions = {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        };

        this.watchId = navigator.geolocation.watchPosition(
            (position) => {
                const location = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                    accuracy: position.coords.accuracy,
                    timestamp: position.timestamp
                };

                this.lastLocation = location;

                // Check geofences
                this.checkGeofences(location);

                if (callback) {
                    callback(null, location);
                }
            },
            (error) => {
                console.error('Watch position error:', error);
                if (callback) {
                    callback(error, null);
                }
            },
            { ...defaultOptions, ...options }
        );

        return this.watchId;
    }

    // Stop watching position
    stopWatchingPosition() {
        if (this.watchId !== null) {
            navigator.geolocation.clearWatch(this.watchId);
            this.watchId = null;
        }
    }

    // Add geofence callback
    onGeofenceEnter(callback) {
        this.geofenceCallbacks.push({ type: 'enter', callback });
    }

    onGeofenceExit(callback) {
        this.geofenceCallbacks.push({ type: 'exit', callback });
    }

    // Check geofences
    checkGeofences(location) {
        const previousInOffice = this.lastLocation ?
            this.isInAnyOffice(this.lastLocation) : false;
        const currentInOffice = this.isInAnyOffice(location);

        // Check for enter/exit events
        if (!previousInOffice && currentInOffice) {
            // Entered office
            const office = this.getCurrentOffice(location);
            this.geofenceCallbacks
                .filter(cb => cb.type === 'enter')
                .forEach(cb => cb.callback(office));
        } else if (previousInOffice && !currentInOffice) {
            // Exited office
            this.geofenceCallbacks
                .filter(cb => cb.type === 'exit')
                .forEach(cb => cb.callback());
        }
    }

    // Verify if user is within any office
    async verifyLocation() {
        try {
            // Get current location
            const userLocation = await this.getCurrentLocation();

            // Check against all office locations
            const results = this.officeLocations.map(office => {
                const distance = this.calculateDistance(
                    userLocation.lat, userLocation.lng,
                    office.lat, office.lng
                );

                return {
                    office: office.name,
                    officeId: office.id,
                    address: office.address,
                    distance: Math.round(distance),
                    withinRadius: distance <= office.radius,
                    requiredRadius: office.radius,
                    withinWorkingHours: this.isWithinWorkingHours(office)
                };
            });

            // Find if any office is within radius
            const verified = results.find(r => r.withinRadius);

            if (verified) {
                // Check if within working hours
                if (!verified.withinWorkingHours) {
                    return {
                        success: false,
                        message: `⚠️ You're at ${verified.office} but outside working hours (${verified.office} hours: ${this.getWorkingHoursText(verified.officeId)})`,
                        location: userLocation,
                        verification: verified,
                        requiresApproval: true
                    };
                }

                return {
                    success: true,
                    message: `✅ Location verified at ${verified.office} (${verified.distance}m away)`,
                    location: userLocation,
                    verification: verified,
                    requiresApproval: false
                };
            } else {
                // Find closest office
                const closest = results.reduce((prev, curr) =>
                    prev.distance < curr.distance ? prev : curr
                );

                return {
                    success: false,
                    message: `❌ You are ${closest.distance}m away from ${closest.office}. Must be within ${closest.requiredRadius}m.`,
                    location: userLocation,
                    verification: closest,
                    requiresApproval: false
                };
            }
        } catch (error) {
            return {
                success: false,
                message: error.message,
                error: true
            };
        }
    }

    // Check if within working hours for an office
    isWithinWorkingHours(office) {
        if (!office.workingHours || office.isTemporary) return true;

        const now = new Date();
        const hours = now.getHours();
        const minutes = now.getMinutes();
        const currentTime = hours + minutes / 60;

        return currentTime >= office.workingHours.start &&
            currentTime < office.workingHours.end;
    }

    // Get working hours text
    getWorkingHoursText(officeId) {
        const office = this.officeLocations.find(o => o.id === officeId);
        if (!office || !office.workingHours) return 'Flexible hours';

        const formatHour = (hour) => {
            const ampm = hour >= 12 ? 'PM' : 'AM';
            const h = hour > 12 ? hour - 12 : hour;
            return `${h}:00 ${ampm}`;
        };

        return `${formatHour(office.workingHours.start)} - ${formatHour(office.workingHours.end)}`;
    }

    // Check if user is in any office
    isInAnyOffice(location) {
        return this.officeLocations.some(office => {
            const distance = this.calculateDistance(
                location.lat, location.lng,
                office.lat, office.lng
            );
            return distance <= office.radius;
        });
    }

    // Get current office (if in any)
    getCurrentOffice(location) {
        return this.officeLocations.find(office => {
            const distance = this.calculateDistance(
                location.lat, location.lng,
                office.lat, office.lng
            );
            return distance <= office.radius;
        });
    }

    // Add new office location
    addOfficeLocation(name, lat, lng, radius = 1000, address = '', workingHours = null) {
        const id = name.toLowerCase().replace(/\s+/g, '-');
        this.officeLocations.push({
            id,
            name,
            lat,
            lng,
            radius,
            address,
            workingHours
        });
        return id;
    }

    // Remove office location
    removeOfficeLocation(officeId) {
        this.officeLocations = this.officeLocations.filter(o => o.id !== officeId);
    }

    // Update office location
    updateOfficeLocation(officeId, updates) {
        const index = this.officeLocations.findIndex(o => o.id === officeId);
        if (index !== -1) {
            this.officeLocations[index] = { ...this.officeLocations[index], ...updates };
        }
    }

    // Get all office locations
    getOfficeLocations() {
        return this.officeLocations;
    }

    // Get location for debugging
    async debugLocation() {
        try {
            const location = await this.getCurrentLocation();
            console.log('📍 Your current location:', {
                latitude: location.lat,
                longitude: location.lng,
                accuracy: location.accuracy + ' meters',
                timestamp: new Date(location.timestamp).toLocaleString()
            });

            // Check distance from all offices
            this.officeLocations.forEach(office => {
                const distance = this.calculateDistance(
                    location.lat, location.lng,
                    office.lat, office.lng
                );
                const within = distance <= office.radius;
                console.log(`🏢 ${office.name}: ${Math.round(distance)} meters ${within ? '✅' : '❌'}`);

                if (office.workingHours) {
                    const withinHours = this.isWithinWorkingHours(office);
                    console.log(`   Hours: ${this.getWorkingHoursText(office.id)} ${withinHours ? '✅' : '⚠️'}`);
                }
            });

            return location;
        } catch (error) {
            console.error('Error getting location:', error.message);
        }
    }

    // Get distance from specific office
    async getDistanceFromOffice(officeId) {
        try {
            const location = await this.getCurrentLocation();
            const office = this.officeLocations.find(o => o.id === officeId);

            if (!office) {
                throw new Error('Office not found');
            }

            const distance = this.calculateDistance(
                location.lat, location.lng,
                office.lat, office.lng
            );

            return {
                distance: Math.round(distance),
                withinRadius: distance <= office.radius,
                office: office.name
            };
        } catch (error) {
            console.error('Error calculating distance:', error);
            return null;
        }
    }

    // Request location permission
    async requestPermission() {
        if (!navigator.permissions) {
            return true; // Assume granted if permissions API not available
        }

        try {
            const result = await navigator.permissions.query({ name: 'geolocation' });
            return result.state === 'granted';
        } catch (error) {
            console.error('Permission check failed:', error);
            return false;
        }
    }
}

// Initialize location service
const locationService = new LocationService();
window.locationService = locationService;

// Auto-debug on load (remove in production)
document.addEventListener('DOMContentLoaded', () => {
    console.log('📍 Enhanced Location Service Ready');
    console.log('📍 Office Locations:', locationService.getOfficeLocations());

    // Request permission on load
    locationService.requestPermission().then(granted => {
        if (granted) {
            console.log('✅ Location permission granted');
        } else {
            console.log('⚠️ Location permission not granted');
        }
    });
});