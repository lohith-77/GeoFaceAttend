// Location Service with 1km Radius Verification
class LocationService {
    constructor() {
        // Company office locations - UPDATE THESE COORDINATES WITH YOUR LOCATION
        this.officeLocations = [
            {
                name: 'Main Office',
                lat: 22.85918122756394,        // <--- CHANGE THIS to your latitude
                lng: 75.95455016931957,     // <--- CHANGE THIS to your longitude
                radius: 1000        // 1km radius
            },
            {
                name: 'Branch Office',
                lat: 10.956410017082131,     // <--- CHANGE THIS to your branch latitude
                lng: 78.75403715622984,      // <--- CHANGE THIS to your branch longitude
                radius: 1000         // 1km radius
            }
        ];
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

    // Get current location
    async getCurrentLocation() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Geolocation is not supported by your browser'));
                return;
            }

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    resolve({
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                        accuracy: position.coords.accuracy
                    });
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
                            message = 'Location request timed out';
                            break;
                    }
                    reject(new Error(message));
                },
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 0
                }
            );
        });
    }

    // Verify if user is within 1km of any office
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
                    distance: Math.round(distance),
                    withinRadius: distance <= office.radius,
                    requiredRadius: office.radius
                };
            });

            // Find if any office is within radius
            const verified = results.find(r => r.withinRadius);

            if (verified) {
                return {
                    success: true,
                    message: `✅ Location verified at ${verified.office} (${verified.distance}m away - within 1km)`,
                    location: userLocation,
                    verification: verified
                };
            } else {
                // Find closest office
                const closest = results.reduce((prev, curr) =>
                    prev.distance < curr.distance ? prev : curr
                );

                return {
                    success: false,
                    message: `❌ You are ${closest.distance}m away from ${closest.office}. Must be within ${closest.requiredRadius}m (1km).`,
                    location: userLocation,
                    verification: closest
                };
            }
        } catch (error) {
            return {
                success: false,
                message: error.message
            };
        }
    }

    // Add new office location
    addOfficeLocation(name, lat, lng, radius = 1000) {
        this.officeLocations.push({ name, lat, lng, radius });
    }

    // Get current location for debugging
    async debugLocation() {
        try {
            const location = await this.getCurrentLocation();
            console.log('Your current location:', {
                latitude: location.lat,
                longitude: location.lng,
                accuracy: location.accuracy + ' meters'
            });

            // Check distance from all offices
            this.officeLocations.forEach(office => {
                const distance = this.calculateDistance(
                    location.lat, location.lng,
                    office.lat, office.lng
                );
                console.log(`Distance from ${office.name}: ${Math.round(distance)} meters`);
            });

            return location;
        } catch (error) {
            console.error('Error getting location:', error.message);
        }
    }
}

// Initialize location service
const locationService = new LocationService();
window.locationService = locationService;

// Auto-debug on load (remove in production)
document.addEventListener('DOMContentLoaded', () => {
    console.log('📍 Location Service Ready');
    console.log('📍 Office Locations:', locationService.officeLocations);
});