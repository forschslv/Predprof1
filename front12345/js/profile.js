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
        // Загружаем данные пользователя и его заказы параллельно
        const [user, orders] = await Promise.all([
            apiRequest('/users/me'),
            apiRequest('/orders')
        ]);

        document.getElementById('welcomeUser').textContent = `Редактирование профиля`;
        document.getElementById('userEmail').textContent = user.email;
        
        // Заполняем форму
        document.getElementById('name').value = user.name || '';
        document.getElementById('secondary_name').value = user.secondary_name || '';
        document.getElementById('email').value = user.email;
        document.getElementById('status').value = user.status || '';
        document.getElementById('is_admin').value = user.is_admin ? 'Да' : 'Нет';
        document.getElementById('email_verified').value = user.email_verified ? 'Да' : 'Нет';
        
        // Логируем данные для отладки
        console.log('Профиль загружен:', user);
        console.log('Заказы загружены:', orders);

        return { user, orders };
    } catch (error) {
        console.error('Ошибка загрузки профиля:', error);
        alert('Не удалось загрузить данные профиля: ' + error.message);
        window.location.href = 'main.html';
    }
}

function displayOrders(orders) {
    const ordersContainer = document.getElementById('ordersHistory');

    if (!orders || orders.length === 0) {
        ordersContainer.innerHTML = '<p style="color: var(--text-secondary); text-align: center;">Нет заказов</p>';
        return;
    }

    // Функция для форматирования статуса
    const getStatusColor = (status) => {
        const statusMap = {
            'pending': '#FFA500',
            'paid': '#4CAF50',
            'completed': '#2196F3',
            'cancelled': '#F44336'
        };
        return statusMap[status] || '#FFFFFF';
    };

    const getStatusText = (status) => {
        const statusTexts = {
            'pending': 'Ожидание',
            'paid': 'Оплачено',
            'completed': 'Завершено',
            'cancelled': 'Отменено'
        };
        return statusTexts[status] || status;
    };

    const ordersHTML = orders.map(order => {
        const date = new Date(order.week_start_date);
        const formattedDate = date.toLocaleDateString('ru-RU', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        return `
            <div style="padding: 12px; margin-bottom: 10px; background: rgba(255,255,255,0.08); border-left: 4px solid ${getStatusColor(order.status)}; border-radius: 4px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <div style="font-weight: bold; color: var(--text-primary);">Заказ #${order.id}</div>
                        <div style="font-size: 0.85rem; color: var(--text-secondary);">Неделя с ${formattedDate}</div>
                    </div>
                    <div style="text-align: right;">
                        <div style="color: var(--text-primary); font-weight: bold;">${order.total_amount} ₽</div>
                        <div style="font-size: 0.85rem; color: ${getStatusColor(order.status)}; font-weight: bold;">${getStatusText(order.status)}</div>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    ordersContainer.innerHTML = ordersHTML;
}

async function saveProfile() {
    const name = document.getElementById('name').value.trim();
    const secondary_name = document.getElementById('secondary_name').value.trim();
    
    const updateData = {};
    if (name) updateData.name = name;
    if (secondary_name) updateData.secondary_name = secondary_name;
    // Статус не включается в updateData, так как он управляется только на бэкенде
    
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

async function setPassword() {
    const password = document.getElementById('newPassword').value;
    const passwordConfirm = document.getElementById('confirmPassword').value;

    if (!password || !passwordConfirm) {
        alert('Заполните оба поля пароля');
        return;
    }

    if (password !== passwordConfirm) {
        alert('Пароли не совпадают');
        return;
    }

    if (password.length < 6) {
        alert('Пароль должен быть не менее 6 символов');
        return;
    }

    try {
        const result = await apiRequest('/set-password', 'POST', {
            password: password,
            password_confirm: passwordConfirm
        });
        alert('Пароль успешно установлен!');
        document.getElementById('passwordSection').style.display = 'none';
        document.getElementById('newPassword').value = '';
        document.getElementById('confirmPassword').value = '';
    } catch (error) {
        console.error('Ошибка установки пароля:', error);
        alert('Ошибка установки пароля: ' + error.message);
    }
}

// Инициализация
document.addEventListener('DOMContentLoaded', async () => {
    // Проверка авторизации
    if (!localStorage.getItem('token')) {
        window.location.href = '/register_login/register';
        return;
    }
    
    const { user, orders } = await loadUserProfile();
    displayOrders(orders);

    // Привязка кнопок профиля
    document.getElementById('saveBtn').addEventListener('click', saveProfile);
    document.getElementById('cancelBtn').addEventListener('click', cancelEdit);
    document.getElementById('logoutBtn').addEventListener('click', () => {
        localStorage.clear();
        window.location.href = '/register_login/register';
    });

    // Привязка кнопок для управления паролем
    document.getElementById('changePasswordBtn').addEventListener('click', () => {
        const section = document.getElementById('passwordSection');
        section.style.display = section.style.display === 'none' ? 'block' : 'none';
    });

    document.getElementById('savePasswordBtn').addEventListener('click', setPassword);

    document.getElementById('cancelPasswordBtn').addEventListener('click', () => {
        document.getElementById('passwordSection').style.display = 'none';
        document.getElementById('newPassword').value = '';
        document.getElementById('confirmPassword').value = '';
    });
});