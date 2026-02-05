const API_URL = 'http://localhost:8000';

// === Глобальное состояние ===
let state = {
    user: null,
    globalMenuMap: {}, // ID -> Dish Object (для быстрого поиска)
    schedule: [],      // Данные из /module-menu
    selections: {},    // { dayIndex: { dishId: {price, dishObject} } }
    weekStart: getMonday(new Date())
};

// === 1. Функция запросов ===
async function request(endpoint, method = 'GET', body = null) {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'index.html';
        throw new Error('No token');
    }

    const headers = {
        'Authorization': `Bearer ${token}`
    };

    if (body && !(body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
    }

    const config = { method, headers };
    if (body) {
        config.body = (body instanceof FormData) ? body : JSON.stringify(body);
    }

    try {
        const response = await fetch(`${API_URL}${endpoint}`, config);

        if (response.status === 401) {
            localStorage.removeItem('token');
            window.location.href = 'index.html';
            return;
        }

        const data = await response.json();

        if (!response.ok) {
            if (response.status === 422 && data.detail) {
                console.error("Validation Error:", data.detail);
                // Превращаем сложный объект ошибок валидации в читаемый текст
                const msg = Array.isArray(data.detail)
                    ? data.detail.map(e => `${e.loc.join('.')} : ${e.msg}`).join('\n')
                    : JSON.stringify(data.detail);
                throw new Error(`Ошибка данных:\n${msg}`);
            }
            throw new Error(data.detail || 'Ошибка сервера');
        }

        return data;
    } catch (error) {
        console.error('API Error:', error);
        alert(error.message);
        throw error;
    }
}

// === 2. Инициализация ===
document.addEventListener('DOMContentLoaded', init);

async function init() {
    // Обработчики событий
    document.getElementById('logoutBtn').onclick = () => {
        localStorage.clear();
        window.location.href = 'index.html';
    };

    document.getElementById('weekPicker').valueAsDate = state.weekStart;
    document.getElementById('weekPicker').onchange = (e) => {
        state.weekStart = getMonday(new Date(e.target.value));
        // При смене даты просто сбрасываем выбор, так как меню модульное (одинаковое на все недели модуля)
        // Но если бы меню менялось по датам, тут нужно было бы перезагружать.
        state.selections = {};
        updateFooter();
        renderMenu(); // Перерисовываем, чтобы снять галочки
    };

    document.getElementById('nav-newOrder').onclick = () => switchTab('newOrder');
    document.getElementById('nav-history').onclick = () => switchTab('history');
    document.getElementById('submitOrderBtn').onclick = submitOrder;

    // Загрузка данных
    try {
        // 1. Кто я?
        state.user = await request('/users/me');
        document.getElementById('welcomeUser').innerText = `Привет, ${state.user.full_name || 'Студент'}`;
        document.getElementById('userEmail').innerText = state.user.email;

        if (state.user.is_admin) {
            const adminBtn = document.getElementById('adminBtn');
            adminBtn.classList.remove('hidden');
            adminBtn.onclick = () => window.location.href = 'admin.html';
        }

        // 2. Загружаем Меню и Расписание параллельно
        await loadMenuData();

    } catch (e) {
        console.error("Init failed", e);
    }
}

// === 3. Логика загрузки и отображения Меню ===
async function loadMenuData() {
    const container = document.getElementById('menuContainer');
    container.innerHTML = '<p class="loading-text">Загрузка меню...</p>';

    try {
        // Выполняем два запроса параллельно: список блюд и расписание
        const [globalMenu, moduleData] = await Promise.all([
            request('/menu', 'GET'),
            request('/module-menu', 'GET')
        ]);

        // 1. Создаем карту блюд для быстрого доступа: ID -> Объект
        // globalMenu приходит как массив объектов {id, name, price_rub...}
        state.globalMenuMap = {};
        if (globalMenu && globalMenu.items) {
             // Если API возвращает { items: [...] }
             globalMenu.items.forEach(d => state.globalMenuMap[d.id] = d);
        } else if (Array.isArray(globalMenu)) {
             // Если API возвращает сразу [...]
             globalMenu.forEach(d => state.globalMenuMap[d.id] = d);
        }

        // 2. Обрабатываем расписание
        // moduleData может прийти как { schedule: [...] } или просто [...]
        state.schedule = moduleData.schedule || moduleData;

        renderMenu();

    } catch (e) {
        container.innerHTML = `<p style="color:red">Не удалось загрузить меню: ${e.message}</p>`;
    }
}

function renderMenu() {
    const container = document.getElementById('menuContainer');
    container.innerHTML = '';
    const daysNames = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];

    // Если расписания нет
    if (!state.schedule || state.schedule.length === 0) {
        container.innerHTML = '<p>Меню на этот модуль еще не сформировано.</p>';
        return;
    }

    // Сортируем дни по порядку (0 = Понедельник)
    const sortedSchedule = [...state.schedule].sort((a, b) => a.day_of_week - b.day_of_week);

    sortedSchedule.forEach(dayEntry => {
        const dayIdx = dayEntry.day_of_week;
        const dishIds = dayEntry.dish_ids;

        // Если в этот день ничего не подают
        if (!dishIds || dishIds.length === 0) return;

        const dayCard = document.createElement('div');
        dayCard.className = 'day-card';

        // Заголовок дня
        const dayName = daysNames[dayIdx] || `День ${dayIdx}`;
        dayCard.innerHTML = `<div class="day-header">${dayName}</div>`;

        const content = document.createElement('div');
        content.className = 'day-content';

        dishIds.forEach(id => {
            const dish = state.globalMenuMap[id];
            // Если блюдо есть в расписании, но удалено из глобального меню - пропускаем
            if (!dish) return;

            const dishEl = document.createElement('div');
            dishEl.className = 'dish-card';

            // Проверяем, выбрано ли уже (чтобы сохранить состояние при перерисовке)
            if (state.selections[dayIdx] && state.selections[dayIdx][dish.id]) {
                dishEl.classList.add('selected');
            }

            dishEl.innerHTML = `
                <div>
                    <span class="dish-name">${dish.name}</span>
                    <span class="dish-meta">${dish.calories || 0} ккал | ${dish.weight_g || 0}г</span>
                </div>
                <div class="dish-price">${dish.price_rub} ₽</div>
            `;

            dishEl.onclick = () => toggleDish(dayIdx, dish, dishEl);
            content.appendChild(dishEl);
        });

        dayCard.appendChild(content);
        container.appendChild(dayCard);
    });
}

function toggleDish(day, dish, element) {
    if (!state.selections[day]) state.selections[day] = {};

    if (state.selections[day][dish.id]) {
        // Убираем из корзины
        delete state.selections[day][dish.id];
        element.classList.remove('selected');
        if (Object.keys(state.selections[day]).length === 0) delete state.selections[day];
    } else {
        // Добавляем в корзину
        state.selections[day][dish.id] = dish;
        element.classList.add('selected');
    }
    updateFooter();
}

function updateFooter() {
    let count = 0;
    let total = 0;
    for (let day in state.selections) {
        for (let id in state.selections[day]) {
            count++;
            total += state.selections[day][id].price_rub;
        }
    }
    document.getElementById('countDisplay').innerText = count;
    document.getElementById('totalDisplay').innerText = total;

    const bar = document.getElementById('orderSummary');
    if (count > 0) bar.classList.add('visible');
    else bar.classList.remove('visible');
}

// === 4. Оформление заказа ===
async function submitOrder() {
    const btn = document.getElementById('submitOrderBtn');
    btn.disabled = true;
    btn.innerText = "Отправка...";

    try {
        const daysPayload = [];

        for (const dayStr in state.selections) {
            const dayInt = parseInt(dayStr, 10);
            const itemIds = Object.keys(state.selections[dayStr]).map(id => parseInt(id, 10));

            if (itemIds.length > 0) {
                daysPayload.push({
                    day_of_week: dayInt,
                    items: itemIds
                });
            }
        }

        if (daysPayload.length === 0) {
            alert("Корзина пуста!");
            return;
        }

        const payload = {
            week_start_date: state.weekStart.toISOString().split('T')[0],
            days: daysPayload
        };

        // Отправляем заказ
        await request('/orders', 'POST', payload);

        alert('Заказ успешно создан! 🎉');

        // Очистка
        state.selections = {};
        updateFooter();
        renderMenu(); // Снимаем выделения
        switchTab('history');

    } catch (e) {
        // Ошибка уже показана в request
    } finally {
        btn.disabled = false;
        btn.innerText = "Оформить заказ";
    }
}

// === 5. История заказов ===
async function loadHistory() {
    const list = document.getElementById('ordersList');
    list.innerHTML = 'Загрузка...';

    try {
        const orders = await request('/orders/me', 'GET');

        if (!orders || !orders.length) {
            list.innerHTML = '<p>История пуста</p>';
            return;
        }

        let html = `<table class="history-table">
            <thead><tr><th>Дата</th><th>Статус</th><th>Сумма</th><th>Чек</th></tr></thead><tbody>`;

        // Сортировка: новые сверху
        orders.sort((a,b) => new Date(b.created_at) - new Date(a.created_at));

        orders.forEach(o => {
            const date = new Date(o.created_at).toLocaleDateString('ru-RU');
            const statusMap = { 'PAID': 'Оплачено', 'PENDING': 'Не оплачено', 'CANCELED': 'Отмена' };
            const statusClass = o.status === 'PAID' ? 'status-paid' : 'status-pending';

            html += `<tr>
                <td>${date}</td>
                <td><span class="${statusClass}">${statusMap[o.status] || o.status}</span></td>
                <td>${o.total_amount} ₽</td>
                <td><button onclick="downloadReceipt(${o.id})" class="btn-secondary" style="padding:4px 8px; font-size: 0.8em">Скачать</button></td>
            </tr>`;
        });
        html += '</tbody></table>';
        list.innerHTML = html;

    } catch (e) {
        list.innerHTML = 'Ошибка загрузки истории';
    }
}

async function downloadReceipt(orderId) {
    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_URL}/orders/${orderId}/receipt`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) throw new Error("Не удалось скачать чек");

        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `receipt_${orderId}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
    } catch (e) {
        alert(e.message);
    }
}

// Утилиты
function switchTab(tab) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));

    document.getElementById(`tab-${tab}`).classList.remove('hidden');
    document.getElementById(`nav-${tab}`).classList.add('active');

    if (tab === 'history') loadHistory();
}

function getMonday(d) {
    d = new Date(d);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
}