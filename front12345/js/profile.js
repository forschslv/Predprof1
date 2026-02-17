// === Профиль пользователя ===
try {
    const API_URL = '/api';
} catch (e) {
    console.warn('Ошибка определения API_URL:', e);
    // alert('Ошибка конфигурации приложения. Проверьте консоль для деталей.');
    // throw e;
}
async function apiRequest(endpoint, method = 'GET', body = null, isForm = false) {
    const token = localStorage.getItem('token');
    console.debug(`[apiRequest] ${method} ${API_URL}${endpoint} - token present: ${!!token}`);
    if (!token) {
        console.warn('[apiRequest] Нет токена авторизации, перенаправление на /register_login/register');
        window.location.href = '/register_login/register';
        throw new Error('Нет токена авторизации');
    }

    const headers = { 'Authorization': `Bearer ${token}` };
    const config = { method, headers };
    if (!isForm && body) {
        headers['Content-Type'] = 'application/json';
        config.body = JSON.stringify(body);
    }
    if (isForm && body) config.body = body;

    try {
        const response = await fetch(`${API_URL}${endpoint}`, config);
        console.debug(`[apiRequest] Response status for ${endpoint}:`, response.status);

        // Если не авторизован — удаляем токен и перенаправляем
        if (response.status === 401) {
            console.warn('[apiRequest] 401 Unauthorized - удаляю токен и перенаправляю');
            localStorage.removeItem('token');
            window.location.href = '/register_login/register';
            return;
        }

        // Попробуем корректно распарсить тело ответа — сначала смотрим Content-Type
        const contentType = response.headers.get('content-type') || '';
        let data = null;
        try {
            if (contentType.includes('application/json')) {
                data = await response.json();
            } else {
                // Не JSON — читаем как текст и логируем для отладки
                const text = await response.text();
                console.debug(`[apiRequest] Non-JSON response for ${endpoint}:`, text);
                try {
                    // На случай, если сервер вернул JSON без заголовка
                    data = JSON.parse(text);
                } catch (e) {
                    data = text;
                }
            }
        } catch (parseErr) {
            console.error(`[apiRequest] Ошибка парсинга ответа для ${endpoint}:`, parseErr);
            // Попытаемся прочитать как текст
            try {
                data = await response.text();
                console.debug(`[apiRequest] Fallback text body for ${endpoint}:`, data);
            } catch (e) {
                console.error(`[apiRequest] Невозможно прочитать тело ответа:`, e);
            }
        }

        if (!response.ok) {
            const errorDetail = (data && data.detail) ? data.detail : data;
            const msg = (typeof errorDetail === 'object') ? JSON.stringify(errorDetail, null, 2) : errorDetail || 'Неизвестная ошибка сервера';
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

        console.debug('loadUserProfile -> user:', user);
        console.debug('loadUserProfile -> orders:', orders);

        // Если API вернул пустой user, попытаемся использовать сохранённый в localStorage (fallback)
        let effectiveUser = user;
        if (!effectiveUser) {
            const stored = localStorage.getItem('user');
            if (stored) {
                try {
                    effectiveUser = JSON.parse(stored);
                    console.warn('loadUserProfile: Использую локальный user из localStorage как fallback:', effectiveUser);
                } catch (e) {
                    console.error('loadUserProfile: Ошибка парсинга localStorage.user:', e);
                }
            }
        }

        if (!effectiveUser) {
            console.error('loadUserProfile: Получен пустой user от API и в localStorage нет данных');
            alert('Не удалось получить данные пользователя. Проверьте консоль и сеть.');
            window.location.href = 'main.html';
            return { user: null, orders: null };
        }

        // Защищённый доступ к DOM элементам (если структура HTML изменится)
        const setText = (id, text) => {
            const el = document.getElementById(id);
            if (el) el.textContent = text;
        };
        const setValue = (id, value) => {
            const el = document.getElementById(id);
            if (el) el.value = value;
        };

        setText('welcomeUser', 'Редактирование профиля');
        setText('userEmail', effectiveUser.email || '');

        // Заполняем форму — используем безопасные операции (пустые строки по умолчанию)
        setValue('name', effectiveUser.name || '');
        setValue('secondary_name', effectiveUser.secondary_name || '');
        setValue('email', effectiveUser.email || '');
        setValue('status', effectiveUser.status || '');
        setValue('is_admin', (effectiveUser.is_admin) ? 'Да' : 'Нет');
        setValue('is_cook', (effectiveUser.is_cook) ? 'Да' : 'Нет');
        setValue('email_verified', (effectiveUser.email_verified) ? 'Да' : 'Нет');
        // allergies field (may be null)
        setValue('allergies', effectiveUser.allergies || '');
        // сохраняем первоначальное значение для сравнения при сохранении
        window.__initialAllergies = effectiveUser.allergies || '';

        // Баланс
        const balanceEl = document.getElementById('balanceAmount');
        if (balanceEl) balanceEl.textContent = `${(effectiveUser.balance || 0).toFixed(2)} ₽`;

        // Логируем данные для отладки
        console.log('Профиль загружен (effective):', effectiveUser);
        console.log('Заказы загружены:', orders);

        return { user: effectiveUser, orders };
    } catch (error) {
        console.error('Ошибка загрузки профиля:', error);
        alert('Не удалось загрузить данные профиля: ' + (error && error.message ? error.message : error));
        window.location.href = 'main.html';
    }
}

function displayOrders(orders) {
    const ordersContainer = document.getElementById('ordersHistory');

    if (!ordersContainer) {
        console.warn('displayOrders: ordersHistory element not found in DOM. Skipping render.');
        return;
    }

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
    const allergies = document.getElementById('allergies') ? document.getElementById('allergies').value.trim() : null;

    const updateData = {};
    if (name) updateData.name = name;
    if (secondary_name) updateData.secondary_name = secondary_name;
    // Если аллергии изменились (включая очистку), отправляем поле. Сравниваем с первоначальным значением.
    if (typeof allergies === 'string') {
        const initial = window.__initialAllergies || '';
        if (allergies !== initial) {
            updateData.allergies = allergies; // может быть пустой строк — это допустимо
        }
    }
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
        // Обновим баланс на странице на случай изменений
        document.getElementById('balanceAmount').textContent = `${(updatedUser.balance || 0).toFixed(2)} ₽`;
        // Обновим поле аллергий и первоначальное значение
        if (document.getElementById('allergies')) {
            document.getElementById('allergies').value = updatedUser.allergies || '';
            window.__initialAllergies = updatedUser.allergies || '';
        }
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
    const oldPassword = document.getElementById('oldPassword')?.value;
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
        const body = {
            password: password,
            password_confirm: passwordConfirm
        };
        if (oldPassword && oldPassword.length > 0) body.old_password = oldPassword;

        await apiRequest('/users/me/password', 'PATCH', body);
        alert('Пароль успешно обновлён!');
        document.getElementById('passwordSection').style.display = 'none';
        document.getElementById('oldPassword').value = '';
        document.getElementById('newPassword').value = '';
        document.getElementById('confirmPassword').value = '';
    } catch (error) {
        console.error('Ошибка установки пароля:', error);
        alert('Ошибка установки пароля: ' + error.message);
    }
}

// --- Баланс: создание топапа и загрузка чека ---
async function createTopup() {
    const amountEl = document.getElementById('topupAmount');
    if (!amountEl) {
        alert('Элемент ввода суммы не найден');
        return;
    }
    const amount = parseFloat(amountEl.value);
    if (!amount || amount <= 0) {
        alert('Введите корректную сумму');
        return;
    }

    try {
        // Создаём запись топапа
        const topup = await apiRequest('/balance/topups', 'POST', { amount });
        // Если пользователь загрузил файл — отправим как form-data
        const fileInput = document.getElementById('topupProof');
        if (fileInput && fileInput.files && fileInput.files.length > 0) {
            const file = fileInput.files[0];
            const form = new FormData();
            form.append('file', file, file.name);
            try {
                await apiRequest(`/balance/topups/${topup.id}/proof`, 'POST', form, true);
            } catch (err) {
                console.error('Ошибка загрузки файла чека:', err);
                alert('Заявка создана, но ошибка загрузки чека: ' + (err.message || err));
                return;
            }
        }

        alert('Заявка создана. Чек отправлен на проверку администраторам.');
        // Скрываем форму и сбросим поля
        const topupSection = document.getElementById('topupSection');
        if (topupSection) topupSection.style.display = 'none';
        amountEl.value = '';
        const proofEl = document.getElementById('topupProof');
        if
