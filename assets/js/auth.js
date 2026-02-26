// Get selected role from localStorage
const selectedRole = localStorage.getItem('selectedRole');
let currentUser = null;

// Hash password function
async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Validate email format
function isValidEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

// Validate password strength
function isValidPassword(password) {
    return password.length >= 6;
}

// Clear error messages
function clearErrors() {
    document.querySelectorAll('.error-message').forEach(el => el.textContent = '');
}

// Show error
function showError(elementId, message) {
    const element = document.getElementById(elementId);
    if (element) element.textContent = message;
}

// Toggle between login and register
function showLogin() {
    clearErrors();
    document.getElementById('loginForm').classList.add('active');
    document.getElementById('registerForm').classList.remove('active');
}

function showRegister() {
    clearErrors();
    document.getElementById('registerForm').classList.add('active');
    document.getElementById('loginForm').classList.remove('active');
}

// Make functions global
window.showLogin = showLogin;
window.showRegister = showRegister;

// Handle Login with Employee ID
async function handleLogin() {
    clearErrors();

    const empId = document.getElementById('loginEmpId').value.trim();
    const password = document.getElementById('loginPassword').value;

    let hasError = false;

    if (!empId) {
        showError('loginEmpIdError', 'Employee ID is required');
        hasError = true;
    }

    if (!password) {
        showError('loginPasswordError', 'Password is required');
        hasError = true;
    } else if (!isValidPassword(password)) {
        showError('loginPasswordError', 'Password must be at least 6 characters');
        hasError = true;
    }

    if (hasError) return;

    // Get users from localStorage
    const users = JSON.parse(localStorage.getItem('users') || '[]');

    // Hash the input password for comparison
    const hashedPassword = await hashPassword(password);
    const user = users.find(u => u.empId === empId && u.password === hashedPassword && u.role === selectedRole);

    if (user) {
        currentUser = user;
        // Show OTP modal
        const modal = document.getElementById('otpModal');
        if (modal) {
            modal.style.display = 'flex';
            startOTPTimer();
            // Clear any previous OTP inputs
            document.querySelectorAll('.otp-input').forEach(input => input.value = '');
            document.querySelectorAll('.otp-input')[0]?.focus();
        }
    } else {
        alert('Invalid Employee ID or password');
    }
}

// Handle Register
async function handleRegister() {
    clearErrors();

    const name = document.getElementById('regName').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const empId = document.getElementById('regEmpId').value.trim();
    const password = document.getElementById('regPassword').value;
    const dept = document.getElementById('regDept').value;

    let hasError = false;

    if (!name) {
        showError('regNameError', 'Full name is required');
        hasError = true;
    }

    if (!email) {
        showError('regEmailError', 'Email is required');
        hasError = true;
    } else if (!isValidEmail(email)) {
        showError('regEmailError', 'Invalid email format');
        hasError = true;
    }

    if (!empId) {
        showError('regEmpIdError', 'Employee ID is required');
        hasError = true;
    }

    if (!password) {
        showError('regPasswordError', 'Password is required');
        hasError = true;
    } else if (!isValidPassword(password)) {
        showError('regPasswordError', 'Password must be at least 6 characters');
        hasError = true;
    }

    if (!dept) {
        showError('regDeptError', 'Department is required');
        hasError = true;
    }

    if (hasError) return;

    const users = JSON.parse(localStorage.getItem('users') || '[]');

    // Check if user already exists
    if (users.some(u => u.email === email)) {
        alert('Email already registered');
        return;
    }

    if (users.some(u => u.empId === empId)) {
        alert('Employee ID already exists');
        return;
    }

    // Hash password before storing
    const hashedPassword = await hashPassword(password);

    // Create new user
    const newUser = {
        id: Date.now().toString(),
        name,
        email,
        empId,
        password: hashedPassword,
        department: dept,
        role: selectedRole,
        createdAt: new Date().toISOString()
    };

    users.push(newUser);
    localStorage.setItem('users', JSON.stringify(users));

    currentUser = newUser;

    // Show OTP modal
    const modal = document.getElementById('otpModal');
    if (modal) {
        modal.style.display = 'flex';
        startOTPTimer();
        // Clear any previous OTP inputs
        document.querySelectorAll('.otp-input').forEach(input => input.value = '');
        document.querySelectorAll('.otp-input')[0]?.focus();
    }
}

// OTP input handling
function moveToNext(input, index) {
    if (input.value.length === 1) {
        const next = document.querySelectorAll('.otp-input')[index + 1];
        if (next) next.focus();
    }
}

// Allow only numbers in OTP
function allowOnlyNumbers(event) {
    const charCode = event.which ? event.which : event.keyCode;
    if (charCode < 48 || charCode > 57) {
        event.preventDefault();
    }
}

// OTP Timer
let otpTimer;
function startOTPTimer() {
    // Clear any existing timer
    if (otpTimer) clearInterval(otpTimer);

    let timeLeft = 120;
    const timerDisplay = document.getElementById('otpTimer');
    const resendBtn = document.getElementById('resendBtn');

    if (timerDisplay) timerDisplay.textContent = '02:00';
    if (resendBtn) resendBtn.disabled = true;

    otpTimer = setInterval(() => {
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        if (timerDisplay) {
            timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }

        if (timeLeft <= 0) {
            clearInterval(otpTimer);
            if (timerDisplay) timerDisplay.textContent = '00:00';
            if (resendBtn) resendBtn.disabled = false;
        }
        timeLeft--;
    }, 1000);
}

// Resend OTP
function resendOTP() {
    alert('OTP has been resent to your email (Demo: 123456)');
    startOTPTimer();
    document.querySelectorAll('.otp-input').forEach(input => input.value = '');
    document.querySelectorAll('.otp-input')[0]?.focus();
}

// Verify OTP
function verifyOTP() {
    const digits = document.querySelectorAll('.otp-input');
    const otp = Array.from(digits).map(d => d.value).join('');

    if (otp === '123456') {
        // Store current user in localStorage for session
        localStorage.setItem('currentUser', JSON.stringify(currentUser));

        // Close modal
        const modal = document.getElementById('otpModal');
        if (modal) modal.style.display = 'none';

        // Clear OTP inputs
        document.querySelectorAll('.otp-input').forEach(input => input.value = '');

        // Clear timer
        if (otpTimer) clearInterval(otpTimer);

        // Redirect based on role
        if (selectedRole === 'admin') {
            window.location.href = 'admin/dashboard.html';
        } else {
            window.location.href = 'employee/dashboard.html';
        }
    } else {
        alert('Invalid OTP. Please use 123456');
        // Clear inputs
        document.querySelectorAll('.otp-input').forEach(input => input.value = '');
        document.querySelectorAll('.otp-input')[0]?.focus();
    }
}

// Make functions global
window.handleLogin = handleLogin;
window.handleRegister = handleRegister;
window.moveToNext = moveToNext;
window.verifyOTP = verifyOTP;
window.resendOTP = resendOTP;
window.allowOnlyNumbers = allowOnlyNumbers;

// Close modal when clicking outside
window.onclick = function (event) {
    const modal = document.getElementById('otpModal');
    if (event.target === modal) {
        modal.style.display = 'none';
        // Clear inputs
        document.querySelectorAll('.otp-input').forEach(input => input.value = '');
        // Clear timer
        if (otpTimer) clearInterval(otpTimer);
    }
};

// Create default users
async function createDefaultUsers() {
    const users = JSON.parse(localStorage.getItem('users') || '[]');

    if (users.length === 0) {
        const defaultUsers = [
            {
                id: '1',
                name: 'Admin User',
                email: 'admin@company.com',
                empId: 'ADM001',
                password: await hashPassword('admin123'),
                department: 'Management',
                role: 'admin',
                createdAt: new Date().toISOString()
            },
            {
                id: '2',
                name: 'John Employee',
                email: 'john@company.com',
                empId: 'EMP001',
                password: await hashPassword('emp123'),
                department: 'Engineering',
                role: 'employee',
                createdAt: new Date().toISOString()
            }
        ];

        localStorage.setItem('users', JSON.stringify(defaultUsers));
        console.log('✅ GeoFaceAttend - Default users created!');
        console.log('Admin - Employee ID: ADM001, Password: admin123');
        console.log('Employee - Employee ID: EMP001, Password: emp123');
    }
}

// Create default users on page load
createDefaultUsers();

// Also run when DOM is fully loaded
document.addEventListener('DOMContentLoaded', function () {
    // Ensure modal is hidden initially
    const modal = document.getElementById('otpModal');
    if (modal) modal.style.display = 'none';
    console.log('✅ GeoFaceAttend - Auth.js loaded');
});