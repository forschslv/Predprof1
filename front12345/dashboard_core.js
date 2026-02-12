// === КОНСТАНТЫ И НАСТРОЙКИ ===
try {
    API_URL = 'http://localhost:8000';
} catch (error) {
    console.error("Ошибка подключения к API:", error);
}
try {
    token = localStorage.getItem('token');
} catch (error) {
    console.error("Ошибка получения токена:", error);
}
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

// === ГЛОБАЛЬНОЕ СОСТОЯНИЕ (Доступно во всех файлах) ===
let state = {
    user: null,
    globalMenuMap: {},
    schedule: [],
    selections: {},
    weekStart: null
};

// === 1. Базовая функция запроса ===
async function request(endpoint, method = 'GET', body = null) {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'register.html';
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
            window.location.href = 'register.html';
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

// === 2. Навигация и Утилиты ===
function switchTab(tab) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));

    const content = document.getElementById(`tab-${tab}`);
    const btn = document.getElementById(`nav-${tab}`);

    if(content) content.classList.remove('hidden');
    if(btn) btn.classList.add('active');

    // Если перешли на историю, подгружаем её (функция из dashboard_history.js)
    if (tab === 'history' && typeof loadHistory === 'function') {
        loadHistory();
    }
}

function getMonday(d) {
    d = new Date(d);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
}

// === 3. Инициализация приложения ===
document.addEventListener('DOMContentLoaded', async () => {
    // Настройка даты
    const today = new Date();
    state.weekStart = getMonday(today);

    const picker = document.getElementById('weekPicker');
    if (picker) {
        picker.valueAsDate = state.weekStart;
        picker.min = state.weekStart.toISOString().split('T')[0];
        picker.onchange = async (e) => {
            if (e.target.value) {
                state.weekStart = getMonday(new Date(e.target.value));
                // Перезагружаем меню для новой недели
                if (typeof loadMenuData === 'function') {
                    await loadMenuData();
                }
            }
        };
    }

    // Привязка кнопок
    const btnLogout = document.getElementById('logoutBtn');
    if(btnLogout) btnLogout.onclick = () => { localStorage.clear(); window.location.href = 'register.html'; };

    const navNew = document.getElementById('nav-newOrder');
    const navHist = document.getElementById('nav-history');
    if(navNew) navNew.onclick = () => switchTab('newOrder');
    if(navHist) navHist.onclick = () => switchTab('history');

    const btnOrder = document.getElementById('submitOrderBtn');
    // Проверка, существует ли функция submitOrder (из dashboard_order.js)
    if(btnOrder) btnOrder.onclick = () => {
        if(typeof submitOrder === 'function') submitOrder();
        else alert('Модуль заказа не загружен');
    };

    // Загрузка данных пользователя и меню
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

        // Вызов функции из dashboard_order.js
        if (typeof loadMenuData === 'function') {
            await loadMenuData();
        }

    } catch (e) {
        console.error("Critical Init Error:", e);
        if (!e.message.includes('Нет токена')) {
            alert("Не удалось загрузить профиль: " + e.message);
        }
    }
});

document.getElementById('userEmail').innerText = localStorage.getItem('pending_email') || 'no_email_found@error.err';