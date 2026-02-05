const API_URL = 'http://localhost:8000';

// === Глобальное состояние ===
let state = {
    user: null,
    globalMenuMap: {}, // ID -> Объект блюда
    schedule: [],      // Статичное расписание из /module-menu
    selections: {},    // { dayIndex: { dishId: {price, dishObject} } }
    weekStart: null    // Date object (всегда понедельник)
};

// Словари для красивого отображения
const DISH_TYPES = {
    'MAIN': '🍛 Основные блюда',
    'SOUP': '🍜 Супы',
    'SALAD': '🥗 Салаты',
    'GARNISH': '🍚 Гарниры',
    'DRINK': '🥤 Напитки',
    'BREAD': '🍞 Хлеб',
    'DESSERT': '🍰 Десерты'
};

const TYPE_ORDER = ['SOUP', 'MAIN', 'GARNISH', 'SALAD', 'DRINK', 'BREAD', 'DESSERT'];
const DAYS_NAMES = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];

// === 1. Базовая функция запроса ===
async function request(endpoint, method = 'GET', body = null) {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'index.html';
        throw new Error('No token');
    }

    const headers = { 'Authorization': `Bearer ${token}` };
    if (body && !(body instanceof FormData)) headers['Content-Type'] = 'application/json';

    const config = { method, headers };
    if (body) config.body = (body instanceof FormData) ? body : JSON.stringify(body);

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
    // Настройка кнопок
    document.getElementById('logoutBtn').onclick = () => {
        localStorage.clear();
        window.location.href = 'index.html';
    };
    document.getElementById('nav-newOrder').onclick = () => switchTab('newOrder');
    document.getElementById('nav-history').onclick = () => switchTab('history');
    document.getElementById('submitOrderBtn').onclick = submitOrder;

    // Настройка даты (Запрет прошлого)
    const today = new Date();
    const currentMonday = getMonday(today);
    state.weekStart = currentMonday;

    const picker = document.getElementById('weekPicker');
    // Форматируем дату для input type="date" (YYYY-MM-DD)
    const minDateStr = currentMonday.toISOString().split('T')[0];

    picker.min = minDateStr;
    picker.value = minDateStr;
    updateDateHint(currentMonday);

    picker.onchange = (e) => {
        if (!e.target.value) return;
        const selectedDate = new Date(e.target.value);

        // Всегда приводим к понедельнику выбранной недели
        state.weekStart = getMonday(selectedDate);

        // Если пользователь выбрал вторник, инпут визуально оставим как выбрал пользователь,
        // но логически мы считаем от понедельника.
        updateDateHint(state.weekStart);
    };

    // Загрузка данных
    try {
        state.user = await request('/users/me');
        document.getElementById('welcomeUser').innerText = `Привет, ${state.user.full_name || 'Студент'}`;
        document.getElementById('userEmail').innerText = state.user.email;

        if (state.user.is_admin) {
            const adminBtn = document.getElementById('adminBtn');
            adminBtn.classList.remove('hidden');
            adminBtn.onclick = () => window.location.href = 'admin.html';
        }

        // Загружаем меню ОДИН РАЗ
        await loadMenuData();

    } catch (e) {
        console.error("Init failed", e);
    }
}

function updateDateHint(mondayDate) {
    const sundayDate = new Date(mondayDate);
    sundayDate.setDate(mondayDate.getDate() + 6);

    const startStr = mondayDate.toLocaleDateString('ru-RU', {day: 'numeric', month: 'long'});
    const endStr = sundayDate.toLocaleDateString('ru-RU', {day: 'numeric', month: 'long'});

    document.getElementById('dateHint').innerText = `(Заказ на неделю: ${startStr} — ${endStr})`;
}

// === 3. Загрузка и Рендер Меню ===
async function loadMenuData() {
    const container = document.getElementById('menuContainer');
    container.innerHTML = '<p class="loading-text">Загрузка меню...</p>';

    try {
        const [globalMenuRes, moduleData] = await Promise.all([
            request('/menu', 'GET'),
            request('/module-menu', 'GET')
        ]);

        // 1. Создаем карту блюд
        state.globalMenuMap = {};
        const items = Array.isArray(globalMenuRes) ? globalMenuRes : (globalMenuRes.items || []);
        items.forEach(d => state.globalMenuMap[d.id] = d);

        // 2. Сохраняем расписание
        state.schedule = moduleData.schedule || moduleData || [];

        renderMenu();

    } catch (e) {
        console.error("Load menu failed", e);
        container.innerHTML = `<p style="color:red">Не удалось загрузить меню: ${e.message}</p>`;
    }
}

function renderMenu() {
    const container = document.getElementById('menuContainer');
    container.innerHTML = '';

    if (!state.schedule || state.schedule.length === 0) {
        container.innerHTML = '<p>Меню на этот модуль еще не сформировано.</p>';
        return;
    }

    // Сортировка дней (0=Пн)
    const sortedSchedule = [...state.schedule].sort((a, b) => a.day_of_week - b.day_of_week);

    sortedSchedule.forEach(dayEntry => {
        const dayIdx = dayEntry.day_of_week;
        const dishIds = dayEntry.dish_ids || [];

        if (dishIds.length === 0) return;

        const dayCard = document.createElement('div');
        dayCard.className = 'day-card';
        dayCard.innerHTML = `<div class="day-header">${DAYS_NAMES[dayIdx] || 'День ' + (dayIdx+1)}</div>`;

        const content = document.createElement('div');
        content.className = 'day-content';

        // Группировка блюд
        const dayDishes = [];
        dishIds.forEach(id => {
            if (state.globalMenuMap[id]) dayDishes.push(state.globalMenuMap[id]);
        });

        const groups = {};
        dayDishes.forEach(dish => {
            const type = dish.type || 'OTHER';
            if (!groups[type]) groups[type] = [];
            groups[type].push(dish);
        });

        // Вывод по категориям
        TYPE_ORDER.forEach(typeKey => {
            if (!groups[typeKey]) return;

            const catHeader = document.createElement('div');
            catHeader.className = 'dish-category-title';
            catHeader.innerText = DISH_TYPES[typeKey] || typeKey;
            content.appendChild(catHeader);

            groups[typeKey].forEach(dish => {
                const dishEl = document.createElement('div');
                dishEl.className = 'dish-card';

                // Проверка, выбрано ли блюдо (при перерисовке)
                if (state.selections[dayIdx] && state.selections[dayIdx][dish.id]) {
                    dishEl.classList.add('selected');
                }

                const compositionShort = dish.composition
                    ? dish.composition.slice(0, 45) + (dish.composition.length > 45 ? '...' : '')
                    : 'Состав не указан';

                dishEl.innerHTML = `
                    <div class="dish-info-block">
                        <span class="dish-name">${dish.name}</span>
                        <span class="dish-meta" title="${dish.composition || ''}">
                            ${dish.quantity_grams}г • ${compositionShort}
                        </span>
                    </div>
                    <div class="dish-price">${dish.price_rub} ₽</div>
                `;

                dishEl.onclick = () => toggleDish(dayIdx, dish, dishEl);
                content.appendChild(dishEl);
            });
        });

        dayCard.appendChild(content);
        container.appendChild(dayCard);
    });
}

// === 4. Управление корзиной ===
function toggleDish(day, dish, element) {
    if (!state.selections[day]) state.selections[day] = {};

    if (state.selections[day][dish.id]) {
        delete state.selections[day][dish.id];
        element.classList.remove('selected');
        if (Object.keys(state.selections[day]).length === 0) delete state.selections[day];
    } else {
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

// === 5. Оформление заказа ===
async function submitOrder() {
    // Проверка даты
    if (!state.weekStart) {
        alert("Пожалуйста, выберите дату начала недели.");
        return;
    }

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

        await request('/orders', 'POST', payload);

        alert('Заказ успешно создан! 🎉');
        state.selections = {};
        updateFooter();
        // Перерисовываем меню, чтобы сбросить визуальные выделения
        renderMenu();
        switchTab('history');

    } catch (e) {
        console.error("Submit order failed", e);
        alert(`Ошибка оформления заказа: ${e.message}`);
    } finally {
        btn.disabled = false;
        btn.innerText = "Оформить заказ";
    }
}

// === 6. История и Утилиты ===
async function loadHistory() {
    const list = document.getElementById('ordersList');
    list.innerHTML = 'Загрузка...';

    try {
        const orders = await request('/orders/me', 'GET');

        if (!orders || !orders.length) {
            list.innerHTML = '<p>История заказов пуста</p>';
            return;
        }

        let html = `<table class="history-table">
            <thead><tr><th>Дата заказа</th><th>Статус</th><th>Сумма</th><th>Чек</th></tr></thead><tbody>`;

        orders.sort((a,b) => new Date(b.created_at) - new Date(a.created_at));

        orders.forEach(o => {
            const date = new Date(o.created_at).toLocaleDateString('ru-RU');
            const statusMap = { 'PAID': 'Оплачено', 'PENDING': 'Ожидает оплаты', 'CANCELED': 'Отмена' };
            const statusClass = o.status === 'PAID' ? 'status-paid' : 'status-pending';

            html += `<tr>
                <td>${date}</td>
                <td><span class="${statusClass}">${statusMap[o.status] || o.status}</span></td>
                <td>${o.total_amount} ₽</td>
                <td><button onclick="downloadReceipt(${o.id})" class="btn-secondary" style="font-size: 0.8em; padding: 5px 10px;">Скачать</button></td>
            </tr>`;
        });
        html += '</tbody></table>';
        list.innerHTML = html;

    } catch (e) {
        console.error("Load history failed", e);
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
        console.error("Download receipt failed", e);
        alert(`Ошибка скачивания чека: ${e.message}`);
    }
}

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