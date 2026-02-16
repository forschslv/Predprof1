/* --- START OF FILE script.js --- */

const API_URL = '/api';

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
            window.location.href = '/register_login/register';
            return;
        }

        if (!response.ok) {
            // Попробуем распарсить JSON-ошибку, но если сервер вернул HTML/text — вернём осмысленную ошибку
            let errText = 'Ошибка запроса';
            try {
                const errJson = await response.json();
                errText = errJson.detail || JSON.stringify(errJson);
            } catch (e) {
                // Нативный response.json() может выбросить, если тело не JSON (например HTML страницы ошибки)
                try {
                    errText = await response.text();
                } catch (e2) {
                    // Не удалось прочитать тело — оставим базовое сообщение
                }
            }
            throw new Error(errText || 'Ошибка запроса');
        }

        // Успешный ответ — попробуем распарсить JSON, но некоторые эндпоинты (файлы) не возвращают JSON
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
            return await response.json();
        }

        // Если это не JSON — вернём текст (или пустую строку), вызывающий код должен знать, как это обработать
        return await response.text();
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
    window.location.href = '/register_login/login';
}

function checkAuth() {
    if (!localStorage.getItem('token')) window.location.href = 'login';
}
// Updated admin check function using /users/me endpoint
async function requireAdmin() {
    try {
        const userData = await apiRequest('/users/me', 'GET');
        if (!userData.is_admin) {
            window.location.href = '/main';
        }
    } catch (error) {
        console.error('Error checking admin status:', error);
        // If there's an error getting user data, redirect to login
        localStorage.clear();
        window.location.href = '/register_login/login';
    }
}

// New helper: require cook or admin - used by pages that both roles may access
async function requireCookOrAdmin() {
    try {
        const userData = await apiRequest('/users/me', 'GET');
        if (!(userData.is_admin || userData.is_cook)) {
            window.location.href = '/main';
        }
    } catch (error) {
        console.error('Error checking cook/admin status:', error);
        localStorage.clear();
        window.location.href = '/register_login/login';
    }
}

async function validateAccess(needAdmin = false) {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/register_login/register';
        return;
    }
    try {
        const user = await apiRequest('/users/me');
        localStorage.setItem('user', JSON.stringify(user));
        if (needAdmin && !user.is_admin) {
            window.showErrorPage('403', 'Доступ запрещён', 'Требуются права администратора');
            return;
        }
        return user;
    } catch (e) {
        // Используем универсальную страницу ошибок вместо logout
        if (window.showErrorPage) {
            window.showErrorPage('401', 'Ошибка авторизации', e.message);
        } else {
            logout();
        }
    }
}

async function checkAvailability(url) {
    try {
        const response = await fetch(url, {
            method: 'HEAD',
            cache: 'no-cache' // Чтобы не кэшировать старые статусы
        });
        // Свойство .ok истинно, если статус 200-299.
        // Если статус 404, .ok будет false.
        // В случае 404, .ok будет false.
        if (response.status === 405) {
            return true; // Сервер отвечает, но метод не разрешён - значит метод HEAD не поддерживается, но сервер поддерживает API
        }

        return response.ok;

    } catch (error) {
        // Сюда мы попадаем, если сервер вообще лежит (Network Error)
        console.warn("Сервер недоступен или ошибка сети:", error);
        return false;
    }
}