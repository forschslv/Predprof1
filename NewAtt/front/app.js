// Global variables
const API_BASE = "http://10.92.59.143:8000";
let currentToken = localStorage.getItem('token');
let currentRole = localStorage.getItem('role');
let currentUser = null;
let globalMenu = [];
let moduleMenu = {};
let currentOrder = {};
let isRegister = false;

// Initialize the app
document.addEventListener('DOMContentLoaded', async () => {
    if (currentToken) {
        await showDashboard();
    } else {
        // Set up login form by default
        document.getElementById('username').classList.add('hidden');
        document.getElementById('confirmCode').classList.remove('hidden');
    }
});

async function showDashboard() {
    document.getElementById('authSection').classList.add('hidden');
    document.getElementById('dashboardSection').classList.remove('hidden');
    
    document.getElementById('welcomeMsg').innerText = `Добро пожаловать, ${currentUser.name} ${currentUser.secondary_name} (${currentRole})`;

    // Load data based on role
    switch(currentRole) {
        case 'student':
            await loadStudentData();
            break;
        case 'cook':
            await loadCookData();
            break;
        case 'admin':
            await loadAdminData();
            break;
        default:
            console.error('Unknown role:', currentRole);
    }
}

// Logout function
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