try {
    const API_BASE = "http://10.92.59.143:8000";
} catch (e) {
    console.error("Error initializing API_BASE:", e);
}
async function toggleReg() {
    isRegister = !isRegister;
    document.getElementById('authTitle').innerText = isRegister ? "Регистрация" : "Вход";
    document.getElementById('authBtn').innerText = isRegister ? "Зарегистрироваться" : "Войти";
    document.getElementById('toggleText').innerText = isRegister ? "Уже есть аккаунт? Войти" : "Нет аккаунта? Зарегистрироваться";
    
    const usernameField = document.getElementById('username');
    const emailField = document.getElementById('email');
    const confirmCodeField = document.getElementById('confirmCode');
    
    if (isRegister) {
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
    const username = document.getElementById('username').value;
    const email = document.getElementById('email').value;
    const confirmCode = document.getElementById('confirmCode').value;
    
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
                currentToken = verifyData.access_token;
                currentUser = verifyData.user;
                
                // Determine role based on status
                if (currentUser.status.toLowerCase().includes('admin')) {
                    currentRole = 'admin';
                } else if (currentUser.status.toLowerCase().includes('cook')) {
                    currentRole = 'cook';
                } else {
                    currentRole = 'student';
                }
                localStorage.setItem('role', currentRole);
                
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
            if (isRegister) {
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
            if (isRegister) {
                alert("Ошибка регистрации: " + error.message);
            } else {
                alert("Ошибка входа: " + error.message);
            }
        }
    }
}

async function verifyCode() {
    const email = document.getElementById('verifyEmail').value;
    const code = document.getElementById('verifyCode').value;
    
    try {
        const verifyRes = await fetch(`${API_BASE}/verify-code`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, code })
        });
        
        const verifyData = await verifyRes.json();
        
        if (verifyRes.ok) {
            localStorage.setItem('token', verifyData.access_token);
            currentToken = verifyData.access_token;
            currentUser = verifyData.user;
            
            // Determine role based on status
            if (currentUser.status.toLowerCase().includes('admin')) {
                currentRole = 'admin';
            } else if (currentUser.status.toLowerCase().includes('cook')) {
                currentRole = 'cook';
            } else {
                currentRole = 'student';
            }
            localStorage.setItem('role', currentRole);
            
            // Remove verification section and show main dashboard
            document.getElementById('verificationSection').remove();
            
            // Show back the auth fields for next logout
            document.getElementById('username').classList.remove('hidden');
            document.getElementById('email').classList.remove('hidden');
            document.getElementById('authBtn').classList.remove('hidden');
            document.getElementById('toggleText').classList.remove('hidden');
            
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
    currentToken = null;
    currentRole = null;
    currentUser = null;
    
    // Remove verification section if it exists
    const verificationSection = document.getElementById('verificationSection');
    if (verificationSection) {
        verificationSection.remove();
    }
    
    document.getElementById('dashboardSection').classList.add('hidden');
    document.getElementById('authSection').classList.remove('hidden');
    
    // Show all auth fields again if they were hidden
    document.getElementById('username').classList.remove('hidden');
    document.getElementById('email').classList.remove('hidden');
    document.getElementById('confirmCode').classList.remove('hidden');
    document.getElementById('authBtn').classList.remove('hidden');
    document.getElementById('toggleText').classList.remove('hidden');
    
    // Reset auth form
    document.getElementById('username').value = '';
    document.getElementById('email').value = '';
    document.getElementById('confirmCode').value = '';

    isRegister = false;
    document.getElementById('authTitle').innerText = 'Вход';
    document.getElementById('authBtn').innerText = 'Войти';
    document.getElementById('toggleText').innerText = 'Нет аккаунта? Зарегистрироваться';
    
    // Reset fields to login mode
    document.getElementById('username').classList.add('hidden'); // Login mode hides username
    document.getElementById('confirmCode').classList.remove('hidden'); // Show code field
    document.getElementById('username').placeholder = 'Имя пользователя';
    document.getElementById('email').classList.remove('hidden');
}