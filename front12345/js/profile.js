// === Профиль пользователя ===

const API_URL = 'http://localhost:8000';

async function apiRequest(endpoint, method = 'GET', body = null) {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/register_login/register';
        throw new Error('Нет токена авторизации');
    }

    const headers = { 'Authorization': `Bearer ${token}` };
    if (body) headers['Content-Type'] = 'application/json';

    const config = { method, headers };
    if (body) config.body = JSON.stringify(body);

    try {
        const response = await fetch(`${API_URL}${endpoint}`, config);

        if (response.status === 401) {
            localStorage.removeItem('token');
            window.location.href = '/register_login/register';
            return;
        }

        const data = await response.json();

        if (!response.ok) {
            const errorDetail = data.detail || 'Неизвестная ошибка сервера';
            const msg = (typeof errorDetail === 'object') ? JSON.stringify(errorDetail, null, 2) : errorDetail;
            throw new Error(`Ошибка ${response.status}: ${msg}`);
        }
        return data;
    } catch (error) {
        console.error(`API Error [${endpoint}]:`, error);
        throw error;
    }
}

async function loadUserProfile() {
    try {
        const user = await apiRequest('/users/me');
        document.getElementById('welcomeUser').textContent = `Редактирование профиля`;
        document.getElementById('userEmail').textContent = user.email;
        
        // Заполняем форму
        document.getElementById('name').value = user.name || '';
        document.getElementById('secondary_name').value = user.secondary_name || '';
        document.getElementById('email').value = user.email;
        document.getElementById('status').value = user.status || '';
        document.getElementById('is_admin').value = user.is_admin ? 'Да' : 'Нет';
        document.getElementById('email_verified').value = user.email_verified ? 'Да' : 'Нет';
        
        return user;
    } catch (error) {
        console.error('Ошибка загрузки профиля:', error);
        alert('Не удалось загрузить данные профиля: ' + error.message);
        window.location.href = 'main.html';
    }
}

async function saveProfile() {
    const name = document.getElementById('name').value.trim();
    const secondary_name = document.getElementById('secondary_name').value.trim();
    const status = document.getElementById('status').value.trim();
    
    const updateData = {};
    if (name) updateData.name = name;
    if (secondary_name) updateData.secondary_name = secondary_name;
    if (status) updateData.status = status;
    
    if (Object.keys(updateData).length === 0) {
        alert('Нет изменений для сохранения');
        return;
    }
    
    try {
        const updatedUser = await apiRequest('/users/me', 'PATCH', updateData);
        alert('Профиль успешно обновлён!');
        // Обновляем поля только для чтения
        document.getElementById('is_admin').value = updatedUser.is_admin ? 'Да' : 'Нет';
        document.getElementById('email_verified').value = updatedUser.email_verified ? 'Да' : 'Нет';
    } catch (error) {
        console.error('Ошибка сохранения:', error);
        alert('Ошибка сохранения: ' + error.message);
    }
}

function cancelEdit() {
    if (confirm('Отменить изменения и вернуться в личный кабинет?')) {
        window.location.href = 'main.html';
    }
}

// Инициализация
document.addEventListener('DOMContentLoaded', async () => {
    // Проверка авторизации
    if (!localStorage.getItem('token')) {
        window.location.href = '/register_login/register';
        return;
    }
    
    await loadUserProfile();
    
    // Привязка кнопок
    document.getElementById('saveBtn').addEventListener('click', saveProfile);
    document.getElementById('cancelBtn').addEventListener('click', cancelEdit);
    document.getElementById('logoutBtn').addEventListener('click', () => {
        localStorage.clear();
        window.location.href = '/register_login/register';
    });
});