const API_URL = 'http://localhost:8000';

// === Глобальное состояние ===
let state = {
    user: null,
    globalMenuMap: {},
    schedule: [],
    selections: {},
    weekStart: null
};

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

// === 1. Функция запроса с улучшенным логированием ===
async function request(endpoint, method = 'GET', body = null) {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'index.html';
        throw new Error('Нет токена авторизации');
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
            const errorDetail = data.detail || 'Неизвестная ошибка сервера';
            const msg = (typeof errorDetail === 'object') ? JSON.stringify(errorDetail) : errorDetail;
            throw new Error(`Ошибка ${response.status}: ${msg}`);
        }
        return data;
    } catch (error) {
        console.error(`API Error [${endpoint}]:`, error);
        throw error;
    }
}

// === 2. Инициализация ===
document.addEventListener('DOMContentLoaded', init);

async function init() {
    // Настройка даты
    const today = new Date();
    state.weekStart = getMonday(today);
    const picker = document.getElementById('weekPicker');
    if (picker) {
        picker.valueAsDate = state.weekStart;
        picker.min = state.weekStart.toISOString().split('T')[0];
        picker.onchange = (e) => {
            if (e.target.value) state.weekStart = getMonday(new Date(e.target.value));
        };
    }

    // Кнопки
    const btnLogout = document.getElementById('logoutBtn');
    if(btnLogout) btnLogout.onclick = () => { localStorage.clear(); window.location.href = 'index.html'; };

    const btnOrder = document.getElementById('submitOrderBtn');
    if(btnOrder) btnOrder.onclick = submitOrder;

    const navNew = document.getElementById('nav-newOrder');
    const navHist = document.getElementById('nav-history');
    if(navNew) navNew.onclick = () => switchTab('newOrder');
    if(navHist) navHist.onclick = () => switchTab('history');

    // Загрузка
    try {
        state.user = await request('/users/me');
        const welcome = document.getElementById('welcomeUser');
        if(welcome) welcome.innerText = `Привет, ${state.user.full_name || 'Студент'}`;

        if (state.user.is_admin) {
            const adminBtn = document.getElementById('adminBtn');
            if(adminBtn) {
                adminBtn.classList.remove('hidden');
                adminBtn.onclick = () => window.location.href = 'admin.html';
            }
        }

        await loadMenuData();

    } catch (e) {
        console.error("Critical Init Error:", e);
        // Если ошибка авторизации, request уже перенаправил. Иначе показываем alert.
        if (!e.message.includes('Нет токена')) {
            alert("Не удалось загрузить профиль: " + e.message);
        }
    }
}

// === 3. Загрузка Меню ===
async function loadMenuData() {
    const container = document.getElementById('menuContainer');
    if(!container) return;

    container.innerHTML = '<p class="loading-text">Загружаем меню и расписание...</p>';

    try {
        // Параллельная загрузка
        const [globalMenuRes, moduleData] = await Promise.all([
            request('/menu', 'GET'),
            request('/module-menu', 'GET')
        ]);

        console.log("Global Menu:", globalMenuRes);
        console.log("Module Schedule:", moduleData);

        // 1. Обработка Глобального Меню
        state.globalMenuMap = {};
        // API может вернуть массив или объект {items: []}
        const items = Array.isArray(globalMenuRes) ? globalMenuRes : (globalMenuRes.items || []);

        if (items.length === 0) {
            container.innerHTML = '<p style="color: orange">Глобальное меню пусто. Попросите администратора загрузить блюда.</p>';
            return;
        }

        items.forEach(d => state.globalMenuMap[d.id] = d);

        // 2. Обработка Расписания Модуля
        // API может вернуть массив, null, или объект {schedule: []}
        if (!moduleData) {
            state.schedule = [];
        } else if (Array.isArray(moduleData)) {
            state.schedule = moduleData;
        } else if (moduleData.schedule) {
            state.schedule = moduleData.schedule;
        } else {
            state.schedule = [];
        }

        renderMenu();

    } catch (e) {
        container.innerHTML = `
            <div style="color: #ef4444; padding: 20px; border: 1px solid #ef4444; border-radius: 8px;">
                <h3>Ошибка загрузки меню</h3>
                <p>${e.message}</p>
                <p style="font-size: 0.8em; color: #999">Проверьте консоль (F12) для деталей.</p>
                <button onclick="location.reload()" class="btn-secondary" style="margin-top:10px">Попробовать снова</button>
            </div>`;
    }
}

function renderMenu() {
    const container = document.getElementById('menuContainer');
    container.innerHTML = '';

    // Если расписание пустое
    if (!state.schedule || state.schedule.length === 0) {
        container.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 40px;">
                <h3>📅 Меню не сформировано</h3>
                <p style="color: var(--text-secondary)">Администратор еще не составил расписание на этот модуль.</p>
                <p style="font-size: 0.9em; margin-top: 10px;">(Технически: эндпоинт /module-menu вернул пустое расписание)</p>
            </div>`;
        return;
    }

    const sortedSchedule = [...state.schedule].sort((a, b) => a.day_of_week - b.day_of_week);
    let hasDishes = false;

    sortedSchedule.forEach(dayEntry => {
        const dayIdx = dayEntry.day_of_week;
        const dishIds = dayEntry.dish_ids || [];

        // Фильтруем ID, которых нет в глобальном меню (на всякий случай)
        const dayDishes = dishIds
            .map(id => state.globalMenuMap[id])
            .filter(dish => dish !== undefined);

        if (dayDishes.length === 0) return;
        hasDishes = true;

        const dayCard = document.createElement('div');
        dayCard.className = 'day-card';
        dayCard.innerHTML = `<div class="day-header">${DAYS_NAMES[dayIdx] || 'День ' + dayIdx}</div>`;

        const content = document.createElement('div');
        content.className = 'day-content';

        // Группировка
        const groups = {};
        dayDishes.forEach(dish => {
            const type = dish.type || 'OTHER';
            if (!groups[type]) groups[type] = [];
            groups[type].push(dish);
        });

        TYPE_ORDER.forEach(typeKey => {
            if (!groups[typeKey]) return;

            const catHeader = document.createElement('div');
            catHeader.className = 'dish-category-title';
            catHeader.innerText = DISH_TYPES[typeKey] || typeKey;
            content.appendChild(catHeader);

            groups[typeKey].forEach(dish => {
                const dishEl = document.createElement('div');
                dishEl.className = 'dish-card';
                if (state.selections[dayIdx] && state.selections[dayIdx][dish.id]) {
                    dishEl.classList.add('selected');
                }

                const comp = dish.composition
                    ? dish.composition.slice(0, 45) + (dish.composition.length > 45 ? '...' : '')
                    : 'Состав не указан';

                dishEl.innerHTML = `
                    <div class="dish-info-block">
                        <span class="dish-name">${dish.name}</span>
                        <span class="dish-meta" title="${dish.composition || ''}">${dish.quantity_grams}г • ${comp}</span>
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

    if (!hasDishes) {
        container.innerHTML = '<p>В расписании есть дни, но блюда для них не найдены в базе.</p>';
    }
}

// === 4. Корзина и Заказ ===
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
    const countEl = document.getElementById('countDisplay');
    const totalEl = document.getElementById('totalDisplay');
    const bar = document.getElementById('orderSummary');

    if(countEl) countEl.innerText = count;
    if(totalEl) totalEl.innerText = total;

    if(bar) {
        if (count > 0) bar.classList.add('visible');
        else bar.classList.remove('visible');
    }
}

async function submitOrder() {
    if (!state.weekStart) return alert("Не выбрана дата");

    const btn = document.getElementById('submitOrderBtn');
    btn.disabled = true;
    btn.innerText = "Отправка...";

    try {
        const daysPayload = [];
        for (const dayStr in state.selections) {
            const dayInt = parseInt(dayStr, 10);
            const itemIds = Object.keys(state.selections[dayStr]).map(Number);
            if (itemIds.length > 0) {
                daysPayload.push({ day_of_week: dayInt, items: itemIds });
            }
        }

        if (daysPayload.length === 0) throw new Error("Корзина пуста");

        await request('/orders', 'POST', {
            week_start_date: state.weekStart.toISOString().split('T')[0],
            days: daysPayload
        });

        alert('Заказ принят!');
        state.selections = {};
        updateFooter();
        renderMenu();
        switchTab('history');

    } catch (e) {
        alert(e.message);
    } finally {
        btn.disabled = false;
        btn.innerText = "Оформить заказ";
    }
}

// === 5. История ===
async function loadHistory() {
    const list = document.getElementById('ordersList');
    if(!list) return;
    list.innerHTML = 'Загрузка...';

    try {
        const orders = await request('/orders/me', 'GET');
        if (!orders || !orders.length) {
            list.innerHTML = '<p>История пуста</p>';
            return;
        }

        let html = `<table class="history-table">
            <thead><tr><th>Дата</th><th>Статус</th><th>Сумма</th><th>Чек</th></tr></thead><tbody>`;

        orders.sort((a,b) => new Date(b.created_at) - new Date(a.created_at));

        orders.forEach(o => {
            const d = new Date(o.created_at).toLocaleDateString('ru-RU');
            const statusMap = { 'PAID': 'Оплачено', 'PENDING': 'Не оплачено', 'CANCELED': 'Отмена' };
            const statusClass = o.status === 'PAID' ? 'status-paid' : 'status-pending';

            html += `<tr>
                <td>${d}</td>
                <td><span class="${statusClass}">${statusMap[o.status] || o.status}</span></td>
                <td>${o.total_amount} ₽</td>
                <td><button onclick="downloadReceipt(${o.id})" class="btn-secondary" style="font-size:0.8em">Скачать</button></td>
            </tr>`;
        });
        html += '</tbody></table>';
        list.innerHTML = html;
    } catch (e) {
        list.innerHTML = `<span style="color:red">Ошибка: ${e.message}</span>`;
    }
}

async function downloadReceipt(orderId) {
    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_URL}/orders/${orderId}/receipt`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error("Ошибка скачивания");
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `receipt_${orderId}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
    } catch (e) { alert(e.message); }
}

function switchTab(tab) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));
    const content = document.getElementById(`tab-${tab}`);
    const btn = document.getElementById(`nav-${tab}`);
    if(content) content.classList.remove('hidden');
    if(btn) btn.classList.add('active');
    if (tab === 'history') loadHistory();
}

function getMonday(d) {
    d = new Date(d);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
}