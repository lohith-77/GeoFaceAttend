(function() {
    // Advanced Auth Guard for GeoFaceAttend Nodal Infrastructure
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    const token = localStorage.getItem('token');
    const roleRequirement = document.body.dataset.role; // Set this on <body> in dashboards

    // If no user/token, redirect to auth
    if (!currentUser || !token) {
        console.warn('⚠️ Access Denied: No active session found. Redirecting to terminal...');
        window.location.href = '../auth.html';
        return;
    }

    // Role verification
    if (roleRequirement && currentUser.role !== roleRequirement) {
        console.error('🚫 Clearance Error: Role mismatch. Diverting to index...');
        window.location.href = '../index.html';
        return;
    }

    console.log(`🛡️ Access Granted: Operator ${currentUser.name} verified.`);
})();
