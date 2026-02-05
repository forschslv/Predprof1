/* --- START OF FILE script.js --- */

const API_URL = 'http://localhost:8000';

// Хелпер для запросов
async function apiRequest(endpoint, method = 'GET', body = null, isFile = false) {
    const token = localStorage.getItem('token');
    const headers = {};

    if (!isFile) {
        headers['Content-Type'] = 'application/json';
    }

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const config = {
        method,
        headers,
    };

    if (body) {
        config.body = isFile ? body : JSON.stringify(body);
    }

    try {
        const response = await fetch(`${API_URL}${endpoint}`, config);

        if (response.status === 401) {
            alert("Сессия истекла");
            localStorage.removeItem('token');
            window.location.href = 'index.html';
            return;
        }

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.detail || 'Ошибка запроса');
        }

        return await response.json();
    } catch (error) {
        console.error(error);
        alert(error.message);
        throw error;
    }
}

// Хелпер для скачивания файлов (для админа)
async function downloadFile(endpoint, filename) {
    const token = localStorage.getItem('token');
    try {
        const response = await fetch(`${API_URL}${endpoint}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error("Ошибка скачивания");

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
    } catch (e) {
        alert(e.message);
    }
}

function logout() {
    localStorage.clear();
    window.location.href = 'login.html';
}

function checkAuth() {
    if (!localStorage.getItem('token')) window.location.href = 'login.html';
}
// Updated admin check function using /users/me endpoint
async function requireAdmin() {
    try {
        const userData = await apiRequest('/users/me', 'GET');
        if (!userData.is_admin) {
            window.location.href = 'dashboard.html';
        }
    } catch (error) {
        console.error('Error checking admin status:', error);
        // If there's an error getting user data, redirect to login
        localStorage.clear();
        window.location.href = 'login.html';
    }
}