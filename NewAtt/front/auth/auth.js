try {
    const API_BASE = "http://localhost:8000";
} catch (e) {
    console.error("Error initializing API_BASE:", e);
}
async function toggleReg() {
    window.isRegister = !window.isRegister;
    
    const authTitle = document.getElementById('authTitle');
    const authBtn = document.getElementById('authBtn');
    const toggleText = document.getElementById('toggleText');
    const usernameField = document.getElementById('username');
    const emailField = document.getElementById('email');
    const confirmCodeField = document.getElementById('confirmCode');
    
    if (authTitle) authTitle.innerText = window.isRegister ? "Регистрация" : "Вход";
    if (authBtn) authBtn.innerText = window.isRegister ? "Зарегистрироваться" : "Войти";
    if (toggleText) toggleText.innerText = window.isRegister ? "Уже есть аккаунт? Войти" : "Нет аккаунта? Зарегистрироваться";
    
    if (!usernameField || !emailField || !confirmCodeField) {
        console.warn('Required auth elements not found');
        return;
    }
    
    if (window.isRegister) {
        // Registration: show username, email, and code fields
        usernameField.classList.remove('hidden');
        emailField.classList.remove('hidden');
        confirmCodeField.classList.remove('hidden');
        usernameField.placeholder = "Имя пользователя";
    } else {
        // Login: show email and code fields
        usernameField.classList.add('hidden');
        emailField.classList.remove('hidden');
        confirmCodeField.classList.remove('hidden');
    }
}

async function handleAuth() {
    const username = document.getElementById('username')?.value || '';
    const email = document.getElementById('email')?.value || '';
    const confirmCode = document.getElementById('confirmCode')?.value || '';
    
    // If code field is filled, try to verify directly
    if (confirmCode.trim() !== "") {
        // Verify the code directly
        try {
            const verifyRes = await fetch(`${API_BASE}/verify-code`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, code: confirmCode })
            });
            
            const verifyData = await verifyRes.json();
            
            if (verifyRes.ok) {
                localStorage.setItem('token', verifyData.access_token);
                window.currentToken = verifyData.access_token;
                window.currentUser = verifyData.user;
                localStorage.setItem('currentUser', JSON.stringify(verifyData.user)); // Store user in localStorage
                
                // Determine role based on status
                if (window.currentUser.status.toLowerCase().includes('admin')) {
                    window.currentRole = 'admin';
                } else if (window.currentUser.status.toLowerCase().includes('cook')) {
                    window.currentRole = 'cook';
                } else {
                    window.currentRole = 'student';
                }
                localStorage.setItem('role', window.currentRole);
                
                showDashboard();
            } else {
                alert(verifyData.detail || "Неверный код подтверждения");
            }
        } catch (error) {
            alert("Ошибка проверки кода: " + error.message);
        }
    } else {
        // Request code to be sent
        try {
            if (window.isRegister) {
                // Registration flow - send verification code
                const registerRes = await fetch(`${API_BASE}/register`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        name: username,
                        secondary_name: "User",
                        email: email,
                        status: "student"
                    })
                });
                
                const registerData = await registerRes.json();
                
                if (registerRes.ok) {
                    alert("Код подтверждения отправлен на ваш email. Пожалуйста, введите его.");
                } else {
                    alert(registerData.detail || "Ошибка регистрации");
                }
            } else {
                // Login flow - request verification code
                const loginRes = await fetch(`${API_BASE}/register`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        name: "temp", // Not used for login
                        secondary_name: "temp",
                        email: email,
                        status: "login" // Indicate this is a login attempt
                    })
                });
                
                const loginData = await loginRes.json();
                
                if (loginRes.ok) {
                    alert("Код подтверждения отправлен на ваш email. Пожалуйста, введите его.");
                } else {
                    alert(loginData.detail || "Ошибка входа");
                }
            }
        } catch (error) {
            if (window.isRegister) {
                alert("Ошибка регистрации: " + error.message);
            } else {
                alert("Ошибка входа: " + error.message);
            }
        }
    }
}

async function verifyCode() {
    const email = document.getElementById('verifyEmail')?.value || '';
    const code = document.getElementById('verifyCode')?.value || '';
    
    try {
        const verifyRes = await fetch(`${API_BASE}/verify-code`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, code })
        });
        
        const verifyData = await verifyRes.json();
        
        if (verifyRes.ok) {
            localStorage.setItem('token', verifyData.access_token);
            window.currentToken = verifyData.access_token;
            window.currentUser = verifyData.user;
            localStorage.setItem('currentUser', JSON.stringify(verifyData.user)); // Store user in localStorage
            
            // Determine role based on status
            if (window.currentUser.status.toLowerCase().includes('admin')) {
                window.currentRole = 'admin';
            } else if (window.currentUser.status.toLowerCase().includes('cook')) {
                window.currentRole = 'cook';
            } else {
                window.currentRole = 'student';
            }
            localStorage.setItem('role', window.currentRole);
            
            // Remove verification section and show main dashboard
            const verificationSection = document.getElementById('verificationSection');
            if (verificationSection) {
                verificationSection.remove();
            }
            
            // Show back the auth fields for next logout
            const usernameField = document.getElementById('username');
            const emailField = document.getElementById('email');
            const authBtn = document.getElementById('authBtn');
            const toggleText = document.getElementById('toggleText');
            
            if (usernameField) usernameField.classList.remove('hidden');
            if (emailField) emailField.classList.remove('hidden');
            if (authBtn) authBtn.classList.remove('hidden');
            if (toggleText) toggleText.classList.remove('hidden');
            
            showDashboard();
        } else {
            alert(verifyData.detail || "Неверный код подтверждения");
        }
    } catch (error) {
        alert("Ошибка проверки кода: " + error.message);
    }
}

function logout() {
    localStorage.clear();
    window.currentToken = null;
    window.currentRole = null;
    window.currentUser = null;
    
    // Remove verification section if it exists
    const verificationSection = document.getElementById('verificationSection');
    if (verificationSection) {
        verificationSection.remove();
    }
    
    const dashboardSection = document.getElementById('dashboardSection');
    const authSection = document.getElementById('authSection');
    
    if (dashboardSection) dashboardSection.classList.add('hidden');
    if (authSection) authSection.classList.remove('hidden');
    
    // Show all auth fields again if they were hidden
    const usernameField = document.getElementById('username');
    const emailField = document.getElementById('email');
    const confirmCodeField = document.getElementById('confirmCode');
    const authBtn = document.getElementById('authBtn');
    const toggleText = document.getElementById('toggleText');
    
    if (usernameField) usernameField.classList.remove('hidden');
    if (emailField) emailField.classList.remove('hidden');
    if (confirmCodeField) confirmCodeField.classList.remove('hidden');
    if (authBtn) authBtn.classList.remove('hidden');
    if (toggleText) toggleText.classList.remove('hidden');
    
    // Reset auth form
    if (usernameField) usernameField.value = '';
    if (emailField) emailField.value = '';
    if (confirmCodeField) confirmCodeField.value = '';

    window.isRegister = false;
    
    const authTitle = document.getElementById('authTitle');
    if (authTitle) {
        authTitle.innerText = 'Вход';
        document.getElementById('authBtn').innerText = 'Войти';
        document.getElementById('toggleText').innerText = 'Нет аккаунта? Зарегистрироваться';
    }
    
    // Reset fields to login mode
    if (usernameField) {
        usernameField.classList.add('hidden'); // Login mode hides username
        usernameField.placeholder = 'Имя пользователя';
    }
    if (emailField) emailField.classList.remove('hidden');
}