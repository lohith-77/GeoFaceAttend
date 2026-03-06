// Get selected role from localStorage
const selectedRole = localStorage.getItem('selectedRole');
let currentUser = null;

// Hash password function using Utils
async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Validate email using Utils
function isValidEmail(email) {
    return Utils.isValidEmail(email);
}

// Validate password using Utils
function isValidPassword(password) {
    return Utils.validatePassword(password).isValid;
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
    const rememberMe = document.getElementById('rememberMe')?.checked || false;

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

    Utils.showLoading('Verifying credentials...');

    try {
        // Try API login first
        const response = await fetch(`${CONFIG.API.URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ empId, password })
        });

        if (response.ok) {
            const data = await response.json();

            Utils.setStorage('token', data.token, !rememberMe);
            Utils.setStorage('currentUser', data.user, !rememberMe);

            if (rememberMe) {
                Utils.setStorage('rememberedUser', empId);
            }

            Utils.hideLoading();

            // Show OTP modal
            const modal = document.getElementById('otpModal');
            modal.style.display = 'flex';
            startOTPTimer();
            document.querySelectorAll('.otp-input')[0]?.focus();

            return;
        }

        // Fallback to localStorage
        const users = JSON.parse(localStorage.getItem('users') || '[]');
        const hashedPassword = await hashPassword(password);
        const user = users.find(u => u.empId === empId && u.password === hashedPassword && u.role === selectedRole);

        if (user) {
            Utils.hideLoading();

            Utils.setStorage('currentUser', user, !rememberMe);
            if (rememberMe) {
                Utils.setStorage('rememberedUser', empId);
            }

            const modal = document.getElementById('otpModal');
            modal.style.display = 'flex';
            startOTPTimer();
            document.querySelectorAll('.otp-input')[0]?.focus();
        } else {
            Utils.hideLoading();
            Utils.showToast('Invalid Employee ID or password', 'error');
        }

    } catch (error) {
        Utils.hideLoading();
        Utils.handleError(error, 'Login failed');
    }
}

// Handle Register
async function handleRegister() {
    clearErrors();

    const name = document.getElementById('regName').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const empId = document.getElementById('regEmpId').value.trim();
    const phone = document.getElementById('regPhone')?.value.trim();
    const password = document.getElementById('regPassword').value;
    const dept = document.getElementById('regDept').value;
    const joinDate = document.getElementById('regJoinDate')?.value || Utils.formatDate(new Date(), 'iso');

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

    if (phone && !Utils.isValidPhone(phone)) {
        showError('regPhoneError', 'Invalid phone number format');
        hasError = true;
    }

    if (!password) {
        showError('regPasswordError', 'Password is required');
        hasError = true;
    } else {
        const passwordCheck = Utils.validatePassword(password);
        if (!passwordCheck.isValid) {
            showError('regPasswordError', passwordCheck.messages[0]);
            hasError = true;
        }
    }

    if (!dept) {
        showError('regDeptError', 'Department is required');
        hasError = true;
    }

    if (hasError) return;

    Utils.showLoading('Creating account...');

    try {
        const users = JSON.parse(localStorage.getItem('users') || '[]');

        if (users.some(u => u.email === email)) {
            Utils.hideLoading();
            Utils.showToast('Email already registered', 'error');
            return;
        }

        if (users.some(u => u.empId === empId)) {
            Utils.hideLoading();
            Utils.showToast('Employee ID already exists', 'error');
            return;
        }

        const hashedPassword = await hashPassword(password);

        const newUser = {
            id: Date.now().toString(),
            name,
            email,
            empId,
            phone,
            password: hashedPassword,
            department: dept,
            joinDate,
            role: selectedRole,
            createdAt: new Date().toISOString(),
            leaveBalance: CONFIG.LEAVE.DEFAULT_BALANCE
        };

        users.push(newUser);
        localStorage.setItem('users', JSON.stringify(users));

        Utils.setStorage('currentUser', newUser, true);

        Utils.hideLoading();

        const modal = document.getElementById('otpModal');
        modal.style.display = 'flex';
        startOTPTimer();
        document.querySelectorAll('.otp-input')[0]?.focus();

        if (window.emailService) {
            emailService.sendWelcomeEmail(email, name, empId, dept);
        }

    } catch (error) {
        Utils.hideLoading();
        Utils.handleError(error, 'Registration failed');
    }
}

// OTP Functions
let otpTimer;

function startOTPTimer() {
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

function moveToNext(input, index) {
    if (input.value.length === 1) {
        const next = document.querySelectorAll('.otp-input')[index + 1];
        if (next) next.focus();
    }
}

function allowOnlyNumbers(event) {
    const charCode = event.which ? event.which : event.keyCode;
    if (charCode < 48 || charCode > 57) {
        event.preventDefault();
    }
}

function resendOTP() {
    Utils.showToast('OTP resent to your email (Demo: 123456)', 'info');
    startOTPTimer();
    document.querySelectorAll('.otp-input').forEach(input => input.value = '');
    document.querySelectorAll('.otp-input')[0]?.focus();
}

function verifyOTP() {
    const digits = document.querySelectorAll('.otp-input');
    const otp = Array.from(digits).map(d => d.value).join('');

    if (otp === '123456') {
        Utils.showLoading('Verifying OTP...');

        setTimeout(() => {
            const modal = document.getElementById('otpModal');
            modal.style.display = 'none';

            document.querySelectorAll('.otp-input').forEach(input => input.value = '');

            if (otpTimer) clearInterval(otpTimer);

            Utils.hideLoading();
            Utils.showToast('Login successful!', 'success');

            if (selectedRole === 'admin') {
                window.location.href = 'admin/dashboard.html';
            } else {
                window.location.href = 'employee/dashboard.html';
            }
        }, 1500);
    } else {
        Utils.showToast('Invalid OTP. Please use 123456', 'error');
        document.querySelectorAll('.otp-input').forEach(input => input.value = '');
        document.querySelectorAll('.otp-input')[0]?.focus();
    }
}

function closeOTPModal() {
    document.getElementById('otpModal').style.display = 'none';
    if (otpTimer) clearInterval(otpTimer);
}

// Make functions global
window.handleLogin = handleLogin;
window.handleRegister = handleRegister;
window.moveToNext = moveToNext;
window.verifyOTP = verifyOTP;
window.resendOTP = resendOTP;
window.closeOTPModal = closeOTPModal;
window.allowOnlyNumbers = allowOnlyNumbers;

// Close modal when clicking outside
window.onclick = function (event) {
    const modal = document.getElementById('otpModal');
    if (event.target === modal) {
        modal.style.display = 'none';
        if (otpTimer) clearInterval(otpTimer);
    }
};

// Create default users on load
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
                joinDate: Utils.formatDate(new Date(), 'iso'),
                leaveBalance: CONFIG.LEAVE.DEFAULT_BALANCE,
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
                joinDate: Utils.formatDate(new Date(), 'iso'),
                leaveBalance: CONFIG.LEAVE.DEFAULT_BALANCE,
                createdAt: new Date().toISOString()
            }
        ];

        localStorage.setItem('users', JSON.stringify(defaultUsers));
        console.log('✅ Default users created!');
        console.log('Admin - ID: ADM001, Password: admin123');
        console.log('Employee - ID: EMP001, Password: emp123');
    }
}

// Initialize on load
document.addEventListener('DOMContentLoaded', function () {
    const modal = document.getElementById('otpModal');
    if (modal) modal.style.display = 'none';

    createDefaultUsers();

    // Check for remembered user
    const remembered = Utils.getStorage('rememberedUser');
    if (remembered) {
        document.getElementById('loginEmpId').value = remembered;
        document.getElementById('rememberMe').checked = true;
    }

    console.log('✅ Auth.js loaded with Utils');
});