// Global variables
const API_BASE = "http://10.92.59.143:8000";
let currentToken = localStorage.getItem('token');
let currentRole = localStorage.getItem('role');
let currentUser = null;
let globalMenu = [];
let moduleMenu = {};
let currentOrder = {};
let isRegister = false;

// Make these variables globally accessible
window.API_BASE = API_BASE;
window.currentToken = currentToken;
window.currentRole = currentRole;
window.currentUser = currentUser;
window.globalMenu = globalMenu;
window.moduleMenu = moduleMenu;
window.currentOrder = currentOrder;
window.isRegister = isRegister;

// Initialize the app
document.addEventListener('DOMContentLoaded', async () => {
    window.currentToken = localStorage.getItem('token');
    window.currentRole = localStorage.getItem('role');
    
    if (window.currentToken) {
        // Try to get user from localStorage first
        const storedUser = localStorage.getItem('currentUser');
        if (storedUser) {
            window.currentUser = JSON.parse(storedUser);
        } else {
            // If not in localStorage, fetch from API
            try {
                const response = await fetch(`${API_BASE}/users/me`, {
                    headers: {
                        'Authorization': `Bearer ${window.currentToken}`
                    }
                });
                
                if (response.ok) {
                    const userData = await response.json();
                    window.currentUser = userData;
                    localStorage.setItem('currentUser', JSON.stringify(userData));
                }
            } catch (error) {
                console.error('Error fetching user data:', error);
            }
        }
        
        await showDashboard();
    } else {
        // Set up login form by default
        const usernameField = document.getElementById('username');
        const confirmCodeField = document.getElementById('confirmCode');
        
        if (usernameField) usernameField.classList.add('hidden');
        if (confirmCodeField) confirmCodeField.classList.remove('hidden');
    }
});

async function showDashboard() {
    const authSection = document.getElementById('authSection');
    const dashboardSection = document.getElementById('dashboardSection');
    
    if (authSection) authSection.classList.add('hidden');
    if (dashboardSection) dashboardSection.classList.remove('hidden');
    
    const welcomeMsg = document.getElementById('welcomeMsg');
    if (welcomeMsg && window.currentUser) {
        welcomeMsg.innerText = `Добро пожаловать, ${window.currentUser.name} ${window.currentUser.secondary_name} (${window.currentRole})`;
    } else if (welcomeMsg) {
        welcomeMsg.innerText = `Добро пожаловать, пользователь (${window.currentRole || 'unknown'})`;
    }

    // Load data based on role
    switch(window.currentRole) {
        case 'student':
            if (typeof loadStudentData === 'function') await loadStudentData();
            break;
        case 'cook':
            if (typeof loadCookData === 'function') await loadCookData();
            break;
        case 'admin':
            if (typeof loadAdminData === 'function') await loadAdminData();
            break;
        default:
            console.error('Unknown role:', window.currentRole);
    }
}

// Logout function
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

// Function to dynamically load themed sections
async function loadThemedSection(theme) {
    try {
        const response = await fetch(`${theme}/${theme}.html`);
        const html = await response.text();
        
        // Create a temporary container and extract the relevant section
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        
        // Return the relevant content based on the theme
        return tempDiv.firstElementChild;
    } catch (error) {
        console.error(`Error loading ${theme} section:`, error);
        return null;
    }
}