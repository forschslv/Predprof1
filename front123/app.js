// Application-wide functions and state management

// Global variables
try {
    API_BASE = "http://localhost:8000";
} catch (e) {
    console.error("Error initializing API_BASE:", e);
}

// Check authentication status on page load
document.addEventListener('DOMContentLoaded', function() {
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('role');
    const user = localStorage.getItem('currentUser');
    
    if (token && role && user) {
        // User is authenticated, update UI accordingly
        updateAuthenticatedUI(JSON.parse(user), role);
    } else {
        // User is not authenticated
        updateUnauthenticatedUI();
    }
});

function updateAuthenticatedUI(user, role) {
    // Update UI elements to show authenticated state
    const authElements = document.querySelectorAll('.auth-required');
    authElements.forEach(el => el.classList.remove('hidden'));
    
    const unauthElements = document.querySelectorAll('.unauth-required');
    unauthElements.forEach(el => el.classList.add('hidden'));
    
    // Update user info display
    const userNameDisplay = document.querySelector('#userNameDisplay');
    if (userNameDisplay) {
        userNameDisplay.textContent = `${user.name} ${user.secondary_name}`;
    }
    
    // Update role display
    const userRoleDisplay = document.querySelector('#userRoleDisplay');
    if (userRoleDisplay) {
        userRoleDisplay.textContent = getRoleDisplayName(role);
    }
}

function updateUnauthenticatedUI() {
    // Update UI elements to show unauthenticated state
    const authElements = document.querySelectorAll('.auth-required');
    authElements.forEach(el => el.classList.add('hidden'));
    
    const unauthElements = document.querySelectorAll('.unauth-required');
    unauthElements.forEach(el => el.classList.remove('hidden'));
}

function getRoleDisplayName(role) {
    const roles = {
        'admin': 'Администратор',
        'cook': 'Повар',
        'student': 'Студент'
    };
    return roles[role] || role;
}

// Utility function to redirect to login if not authenticated
function requireAuth(redirectUrl = 'auth/auth.html') {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = redirectUrl;
        return false;
    }
    return true;
}

// Utility function to check user role
function hasRole(requiredRole) {
    const role = localStorage.getItem('role');
    return role === requiredRole;
}

// Utility function to check if user has admin rights
function isAdmin() {
    return hasRole('admin');
}

// Utility function to check if user has cook rights
function isCook() {
    return hasRole('cook');
}

// Utility function to check if user has student rights
function isStudent() {
    return hasRole('student');
}

// Function to log out user
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('currentUser');
    
    // Redirect to home page
    window.location.href = 'index.html';
}

// Function to make authenticated API calls
async function apiCall(endpoint, options = {}) {
    const token = localStorage.getItem('token');
    
    if (!token) {
        throw new Error('Authentication required');
    }
    
    const defaultOptions = {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    };
    
    const requestOptions = {
        ...defaultOptions,
        ...options,
        headers: {
            ...defaultOptions.headers,
            ...options.headers
        }
    };
    
    const response = await fetch(`${API_BASE}${endpoint}`, requestOptions);
    
    if (response.status === 401) {
        // Token might be expired, redirect to login
        logout();
        throw new Error('Authentication failed');
    }
    
    return response;
}

// Function to format currency
function formatCurrency(amount) {
    return new Intl.NumberFormat('ru-RU', {
        style: 'currency',
        currency: 'RUB',
        minimumFractionDigits: 2
    }).format(amount);
}

// Function to format date
function formatDate(dateString) {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString('ru-RU', options);
}

// Function to show notification
function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    // Add styles
    Object.assign(notification.style, {
        position: 'fixed',
        top: '20px',
        right: '20px',
        padding: '15px 20px',
        borderRadius: '5px',
        color: 'white',
        zIndex: '10000',
        maxWidth: '400px',
        wordWrap: 'break-word'
    });
    
    // Set background color based on type
    switch(type) {
        case 'success':
            notification.style.backgroundColor = '#4CAF50';
            break;
        case 'error':
            notification.style.backgroundColor = '#f44336';
            break;
        case 'warning':
            notification.style.backgroundColor = '#ff9800';
            break;
        default:
            notification.style.backgroundColor = '#2196F3';
    }
    
    // Add to document
    document.body.appendChild(notification);
    
    // Remove after 5 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 5000);
}