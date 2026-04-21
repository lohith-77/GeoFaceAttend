# GeoFaceAttend v3.2 | Quantum Workforce Synchronization

![GeoFaceAttend Hero](geofaceattend_hero_image_1776795699709.png)

## 🌌 Sovereign Infrastructure for Biometric Attendance
GeoFaceAttend (GFA) is an enterprise-grade, high-fidelity biometric attendance and geospatial synchronization platform. Designed for the modernization of workforce management, GFA leverages neural-face verification and nodal geofencing to ensure 100% operational integrity.

---

### 🚀 Key Capabilities
- **Neural Ingress**: 4-digit rapid OTP synchronization combined with liveness-verified facial recognition.
* **Tactical Geofencing**: Precision geofence enforcement within a 1km operational radius, synchronized via Leaflet Nodal Maps.
* **Outstation Hub**: Secure remote check-in via encrypted QR tokenization for operators in the field.
* **Command Nexus**: Advanced Admin Control Center with real-time telemetry, departmental doughnut analytics, and weekly attendance area-trends.
* **PWA Persistence**: Fully offline-capable Service Worker architecture with background synchronization protocol.

### 🛠️ Technology Stack
- **Frontend**: Vanila HTML5, CSS3 (Quantum Dark-Mode), JavaScript (ESNext).
- **Engines**: 
  - `face-api.js` (Neural Face Detection)
  - `Leaflet.js` (Geospatial Mapping)
  - `Chart.js 4.4` (Visual Analytics)
- **Deployment**: Render Blueprint (`render.yaml`).

---

### 📂 Repository Structure
- `/admin`: Command Center and Analytics Nodal Panels.
- `/employee`: Operator Dashboard and Ingress Protocol.
- `/assets`: 
  - `/css`: Quantum theme variables and layout modules.
  - `/js`: Core business logic, location services, and auth-guards.
- `/android-app-final`: Native Android wrapper for mobile nodal deployment.
- `render.yaml`: High-availability deployment blueprint.

### 🔐 Security & Access Control
All internal dashboards are protected by a centralized **Auth Guard** (`/assets/js/auth-guard.js`) ensuring Clearance Level enforcement. Credentials are encrypted on the client using SHA-256 baseline hashing.

**Enterprise Support**: contact@geofaceattend.com
**Version**: 3.2.0 [Quantum Ready]
