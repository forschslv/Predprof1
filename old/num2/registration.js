const API_BASE = "http://127.0.0.1:8000";
let isRegisterMode = true;
let currentToken = localStorage.getItem('token');
let currentUser = null;

// Check if user is already logged in
if (currentToken) {
    showDashboard();
}

function toggleMode() {
    isRegisterMode = !isRegisterMode;
    
    const authTitle = document.getElementById('authTitle');
    const authBtn = document.getElementById('authBtn');
    const modeToggleBtn = document.getElementById('modeToggleBtn');
    const toggleText = document.getElementById('toggleText');
    const confirmPasswordField = document.getElementById('confirmPassword');
    const passwordField = document.getElementById('password');
    
    if (isRegisterMode) {
        // Switching to registration mode
        authTitle.innerText = "Регистрация";
        authBtn.innerText = "Создать аккаунт";
        modeToggleBtn.innerText = "Уже есть аккаунт? Войти";
        toggleText.innerText = "Уже есть аккаунт? Войти";
        
        // Show registration-specific fields
        document.getElementById('firstName').classList.remove('hidden');
        document.getElementById('lastName').classList.remove('hidden');
        document.getElementById('email').classList.remove('hidden');
        document.getElementById('userStatus').classList.remove('hidden');
        
        // Hide login-specific fields
        passwordField.classList.add('hidden');
        confirmPasswordField.classList.add('hidden');
    } else {
        // Switching to login mode
        authTitle.innerText = "Вход";
        authBtn.innerText = "Войти";
        modeToggleBtn.innerText = "Нет аккаунта? Зарегистрироваться";
        toggleText.innerText = "Нет аккаунта? Зарегистрироваться";
        
        // Hide registration-specific fields
        document.getElementById('firstName').classList.add('hidden');
        document.getElementById('lastName').classList.add('hidden');
        document.getElementById('userStatus').classList.add('hidden');
        
        // Show login-specific fields
        passwordField.classList.remove('hidden');
        confirmPasswordField.classList.add('hidden'); // Don't show confirm password on login
    }
}

async function handleAuth() {
    if (isRegisterMode) {
        await registerUser();
    } else {
        await loginUser();
    }
}

async function registerUser() {
    const firstName = document.getElementById('firstName').value;
    const lastName = document.getElementById('lastName').value;
    const email = document.getElementById('email').value;
    const status = document.getElementById('userStatus').value;
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    // Validation
    if (!firstName || !lastName || !email || !status || !password || !confirmPassword) {
        alert("Пожалуйста, заполните все поля");
        return;
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        alert("Пожалуйста, введите корректный email адрес");
        return;
    }

    if (password !== confirmPassword) {
        alert("Пароли не совпадают");
        return;
    }

    if (password.length < 6) {
        alert("Пароль должен содержать не менее 6 символов");
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/register`, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json" 
            },
            body: JSON.stringify({
                name: firstName,
                secondary_name: lastName,
                email: email,
                status: status
            })
        });

        const data = await response.json();
        
        if (!response.ok) {
            if (response.status === 422) {
                alert("Ошибка валидации данных. Пожалуйста, проверьте введенные данные.");
            } else {
                alert(data.detail || "Ошибка при регистрации");
            }
            return;
        }

        // Show verification section after successful registration
        document.getElementById('authSection').classList.add('hidden');
        document.getElementById('verificationSection').classList.remove('hidden');
        
        // Pre-fill email for verification
        document.getElementById('verificationEmail').value = email;
        
        alert("Регистрация успешна! Проверьте ваш email для получения кода подтверждения.");
        
    } catch (error) {
        console.error('Registration error:', error);
        alert("Ошибка сети при регистрации");
    }
}

// Login functionality is not explicitly defined in the OpenAPI spec
// The API seems to use registration and verification flow instead
// In a real implementation, you would need to check if there's a separate login endpoint

// For now, we'll simulate login by trying to get user info with a token
// But since login isn't in the spec, we'll just show an alert
async function loginUser() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    if (!email || !password) {
        alert("Пожалуйста, введите email и пароль");
        return;
    }

    // Note: According to the OpenAPI spec, there's no explicit login endpoint
    // The API flow appears to be register -> verify code -> get token
    alert("Система использует только регистрацию с подтверждением по email.\nПожалуйста, используйте форму регистрации.");
}

async function verifyCode() {
    const email = document.getElementById('verificationEmail').value;
    const code = document.getElementById('verificationCode').value;

    if (!email || !code) {
        alert("Пожалуйста, введите email и код подтверждения");
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/verify-code`, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json" 
            },
            body: JSON.stringify({
                email: email,
                code: code
            })
        });

        const data = await response.json();
        
        if (!response.ok) {
            if (response.status === 422) {
                alert("Ошибка валидации данных. Пожалуйста, проверьте код подтверждения.");
            } else {
                alert(data.detail || "Ошибка при подтверждении кода");
            }
            return;
        }

        // Save token and set current user
        localStorage.setItem('token', data.access_token);
        currentToken = data.access_token;
        currentUser = data.user;
        
        alert("Аккаунт подтвержден успешно!");
        showDashboard();
        
    } catch (error) {
        console.error('Verification error:', error);
        alert("Ошибка сети при подтверждении");
    }
}

function showDashboard() {
    document.getElementById('authSection').classList.add('hidden');
    document.getElementById('verificationSection').classList.add('hidden');
    document.getElementById('dashboardSection').classList.remove('hidden');
    
    // Display user information
    document.getElementById('profileFirstName').innerText = currentUser?.name || 'N/A';
    document.getElementById('profileLastName').innerText = currentUser?.secondary_name || 'N/A';
    document.getElementById('profileEmail').innerText = currentUser?.email || 'N/A';
    document.getElementById('profileStatus').innerText = currentUser?.status || 'N/A';
    
    document.getElementById('welcomeMsg').innerText = `Добро пожаловать, ${currentUser?.name || 'Пользователь'}!`;
}

function toggleBackToAuth() {
    document.getElementById('verificationSection').classList.add('hidden');
    document.getElementById('authSection').classList.remove('hidden');
    document.getElementById('dashboardSection').classList.add('hidden');
    
    // Reset form
    document.getElementById('verificationCode').value = '';
}

function logout() {
    localStorage.removeItem('token');
    currentToken = null;
    currentUser = null;
    
    // Reset all forms
    document.getElementById('authSection').classList.remove('hidden');
    document.getElementById('verificationSection').classList.add('hidden');
    document.getElementById('dashboardSection').classList.add('hidden');
    
    // Clear all inputs
    document.querySelectorAll('input').forEach(input => input.value = '');
    
    // Switch back to registration mode
    isRegisterMode = true;
    toggleMode();
}

// Initialize the page in registration mode
document.addEventListener('DOMContentLoaded', function() {
    toggleMode();
});