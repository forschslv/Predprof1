const API = "http://127.0.0.1:8000";
let isRegister = false;
let currentToken = localStorage.getItem('token');
let currentRole = localStorage.getItem('role');
let currentUser = null;

// Clear invalid tokens (tokens with 'null' as username)
if (currentToken) {
    try {
        const tokenParts = currentToken.split('.');
        if (tokenParts.length === 3) {
            const payload = JSON.parse(atob(tokenParts[1]));
            if (payload.sub === 'null') {
                localStorage.removeItem('token');
                localStorage.removeItem('role');
                currentToken = null;
                currentRole = null;
            }
        }
    } catch (e) {
        console.error('Error parsing token:', e);
        localStorage.removeItem('token');
        localStorage.removeItem('role');
        currentToken = null;
        currentRole = null;
    }
}

if (currentToken) {
    showDashboard();
}

function toggleReg() {
    isRegister = !isRegister;
    document.getElementById('authTitle').innerText = isRegister ? "Регистрация" : "Вход";
    document.getElementById('authBtn').innerText = isRegister ? "Создать аккаунт" : "Войти";
    document.getElementById('toggleText').innerText = isRegister ? "Уже есть аккаунт? Войти" : "Нет аккаунта? Зарегистрироваться";
    
    document.getElementById('roleSelect').classList.toggle('hidden', !isRegister);
    document.getElementById('allergies').classList.toggle('hidden', !isRegister);
    document.getElementById('dietary_preferences').classList.toggle('hidden', !isRegister);
}

async function handleAuth() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const role = document.getElementById('roleSelect').value;
    const allergies = document.getElementById('allergies').value;
    const dietary_preferences = document.getElementById('dietary_preferences').value;

    const endpoint = isRegister ? "/register" : "/login";
    const body = isRegister 
        ? { username, password, role, allergies, dietary_preferences }
        : { username, password };

    try {
        const res = await fetch(API + endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });
        const data = await res.json();
        
        if (!res.ok) throw new Error(data.detail || "Ошибка");

        if (isRegister) {
            alert("Регистрация успешна! Теперь войдите.");
            toggleReg();
        } else {
            localStorage.setItem('token', data.access_token);
            localStorage.setItem('role', data.role);
            currentToken = data.access_token;
            currentRole = data.role;
            showDashboard();
        }
    } catch (e) {
        alert(e.message);
    }
}

async function showDashboard() {
    document.getElementById('authSection').classList.add('hidden');
    document.getElementById('dashboardSection').classList.remove('hidden');
    
    const res = await fetch(`${API}/me?token=${currentToken}`);
    currentUser = await res.json();
    
    document.getElementById('welcomeMsg').innerText = `Добро пожаловать, ${currentUser.username} (${currentRole})`;

    if (currentRole === 'student') {
        loadStudentData();
    } else if (currentRole === 'cook') {
        loadCookData();
    } else if (currentRole === 'admin') {
        loadAdminData();
    }
}

// --- УЧЕНИК ---
async function loadStudentData() {
    document.getElementById('studentPanel').classList.remove('hidden');
    await loadProfile();
    await loadNotifications();
    await loadMenu();
    await showOrders('active');
}

async function loadProfile() {
    const res = await fetch(`${API}/my_profile?token=${currentToken}`);
    const profile = await res.json();
    
    document.getElementById('profileUsername').innerText = profile.username;
    document.getElementById('profileBalance').innerText = profile.balance.toFixed(2);
    document.getElementById('profileAllergies').innerText = profile.allergies || 'Нет';
    document.getElementById('profilePreferences').innerText = profile.dietary_preferences || 'Нет';
    
    const subInfo = document.getElementById('subscriptionInfo');
    if (profile.subscription) {
        subInfo.innerHTML = `<span class="price">${profile.subscription.meals_remaining}</span> обедов (до ${new Date(profile.subscription.expires_at).toLocaleDateString()})`;
    } else {
        subInfo.innerText = 'Нет активного абонемента';
    }
}

async function loadNotifications() {
    const res = await fetch(`${API}/notifications?token=${currentToken}`);
    const notifications = await res.json();
    
    const list = document.getElementById('notifications');
    if (notifications.length === 0) {
        list.innerHTML = '<p>Нет новых уведомлений</p>';
        return;
    }
    
    list.innerHTML = notifications.map(n => `
        <div class="notification-item ${n.is_read ? '' : 'unread'}" onclick="markNotificationRead(${n.id})">
            <small>${new Date(n.created_at).toLocaleString()}</small><br>
            ${n.message}
        </div>
    `).join('');
}

async function markNotificationRead(id) {
    await fetch(`${API}/notifications/${id}/read?token=${currentToken}`, { method: "PUT" });
    loadNotifications();
}

async function loadMenu() {
    const res = await fetch(`${API}/menu`);
    const menu = await res.json();
    
    // Get user's received orders to enable reviews for those items
    const ordersRes = await fetch(`${API}/my_orders?token=${currentToken}`);
    const orders = await ordersRes.json();
    
    const receivedOrderItemIds = orders.filter(order => order.is_received).map(order => order.item_id);
    
    const list = document.getElementById('menuList');
    if (menu.length === 0) {
        list.innerHTML = '<p>Меню пусто</p>';
        return;
    }
    
    list.innerHTML = menu.map(item => `
        <div class="menu-item">
            <div>
                <b>${item.name}</b> (${item.category === 'breakfast' ? 'Завтрак' : 'Обед'}) 
                <br><small>${item.description || 'Нет описания'}</small>
                <br><small>Остаток: ${item.quantity}</small>
            </div>
            <div>
                <span class="price">${item.price}₽</span>
                <button onclick="buyItem(${item.id})" style="width:auto; padding:5px 10px;">Купить</button>
                ${receivedOrderItemIds.includes(item.id) ? `<button onclick="showReviewModal(${item.id})" style="width:auto; padding:5px 10px; margin-left: 5px;">Оценить</button>` : ''}
            </div>
        </div>
    `).join('');
}

async function buyItem(id) {
    const res = await fetch(`${API}/buy/${id}?token=${currentToken}`, { method: "POST" });
    const data = await res.json();
    
    if (res.ok) {
        alert(`Куплено! Способ оплаты: ${data.payment_method === 'subscription' ? 'Абонемент' : 'Баланс'}`);
        loadMenu();
        loadProfile();
        showOrders('active');
    } else {
        alert(`Ошибка: ${data.detail}`);
    }
}

async function showOrders(type) {
    const res = await fetch(`${API}/my_orders?token=${currentToken}`);
    const orders = await res.json();
    
    const div = document.getElementById('myOrders');
    let filteredOrders = type === 'active' ? orders.filter(o => !o.is_received) : orders;
    
    if (filteredOrders.length === 0) {
        div.innerHTML = `<p>Нет ${type === 'active' ? 'активных' : ''} заказов</p>`;
        return;
    }
    
    div.innerHTML = filteredOrders.map(o => `
        <div class="order-item">
            <div>
                <b>Заказ #${o.id}</b> - ${o.item_name}
                <br><small>${new Date(o.created_at).toLocaleString()}</small>
                ${o.is_received ? '<br><small style="color:var(--accent-cyan);">Получен</small>' : ''}
            </div>
            <div>
                <span class="price">${o.price}₽</span>
                ${!o.is_received ? `<button onclick="receiveOrder(${o.id}, this)" style="width:auto; padding:5px 10px;">Получить</button>` : ''}
            </div>
        </div>
    `).join('');
}

async function receiveOrder(id, btn) {
    const res = await fetch(`${API}/receive/${id}?token=${currentToken}`, { method: "PUT" });
    if (res.ok) {
        btn.parentElement.parentElement.remove();
        alert("Приятного аппетита!");
        loadNotifications();
    }
}

function showTopupModal() {
    document.getElementById('topupModal').style.display = 'block';
}

function showSubscriptionModal() {
    document.getElementById('subscriptionModal').style.display = 'block';
}

async function topupBalance() {
    const amount = parseFloat(document.getElementById('topupAmount').value);
    if (!amount || amount < 10) {
        alert("Минимальная сумма 10₽");
        return;
    }
    
    const res = await fetch(`${API}/topup_balance?token=${currentToken}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount })
    });
    
    if (res.ok) {
        alert("Баланс пополнен!");
        closeModal('topupModal');
        loadProfile();
    } else {
        alert("Ошибка пополнения");
    }
}

async function buySubscription() {
    const plan = parseInt(document.getElementById('subscriptionPlan').value);
    const res = await fetch(`${API}/buy_subscription?meals_count=${plan}&token=${currentToken}`, {
        method: "POST"
    });
    
    if (res.ok) {
        alert("Абонемент куплен!");
        closeModal('subscriptionModal');
        loadProfile();
    } else {
        const data = await res.json();
        alert(`Ошибка: ${data.detail}`);
    }
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

function showEditProfileModal() {
    // Create modal if it doesn't exist
    let profileModal = document.getElementById('profileModal');
    if (!profileModal) {
        profileModal = document.createElement('div');
        profileModal.id = 'profileModal';
        profileModal.className = 'modal';
        profileModal.innerHTML = `
            <div class="modal-content">
                <span class="close" onclick="closeModal('profileModal')">&times;</span>
                <h3>Изменить профиль</h3>
                <label>Аллергии:</label>
                <input type="text" id="editAllergies" placeholder="Аллергии (если есть)">
                <label>Пищевые предпочтения:</label>
                <input type="text" id="editDietaryPrefs" placeholder="Пищевые предпочтения">
                <button onclick="saveProfileChanges()">Сохранить изменения</button>
            </div>
        `;
        document.body.appendChild(profileModal);
    }
    
    // Load current profile data
    loadCurrentProfileData();
    
    document.getElementById('profileModal').style.display = 'block';
}

async function loadCurrentProfileData() {
    const res = await fetch(`${API}/my_profile?token=${currentToken}`);
    const profile = await res.json();
    
    document.getElementById('editAllergies').value = profile.allergies || '';
    document.getElementById('editDietaryPrefs').value = profile.dietary_preferences || '';
}

async function saveProfileChanges() {
    const allergies = document.getElementById('editAllergies').value;
    const dietaryPreferences = document.getElementById('editDietaryPrefs').value;
    
    const res = await fetch(`${API}/update_profile?token=${currentToken}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allergies, dietary_preferences: dietaryPreferences })
    });
    
    const data = await res.json();
    
    if (res.ok) {
        alert("Профиль успешно обновлен!");
        closeModal('profileModal');
        loadProfile(); // Refresh the profile display
    } else {
        alert(`Ошибка: ${data.detail || 'Неизвестная ошибка'}`);
    }
}

// --- ПОВАР ---
async function loadCookData() {
    document.getElementById('cookPanel').classList.remove('hidden');
    await loadDishInventory();
    await loadProductInventory();
}

async function loadDishInventory() {
    const res = await fetch(`${API}/cook/dishes?token=${currentToken}`);
    const items = await res.json();
    
    const list = document.getElementById('dishInventory');
    list.innerHTML = items.map(item => `
        <div class="inventory-item">
            <b>${item.name}</b> (${item.category === 'breakfast' ? 'Завтрак' : 'Обед'})
            <div class="button-group">
                <input type="number" id="qty-${item.id}" value="${item.quantity}" style="width:80px;">
                <button onclick="updateDishQuantity(${item.id})">Обновить</button>
            </div>
        </div>
    `).join('');
}

async function updateDishQuantity(itemId) {
    const qty = parseInt(document.getElementById(`qty-${itemId}`).value);
    const res = await fetch(`${API}/cook/dishes/${itemId}/quantity?token=${currentToken}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity: qty })
    });
    
    if (res.ok) {
        alert("Остаток обновлен!");
        loadDishInventory();
    }
}

async function loadProductInventory() {
    const res = await fetch(`${API}/cook/inventory?token=${currentToken}`);
    const items = await res.json();
    
    const list = document.getElementById('productInventory');
    if (items.length === 0) {
        list.innerHTML = '<p>Склад пуст</p>';
        return;
    }
    
    list.innerHTML = items.map(item => `
        <div class="inventory-item">
            <b>${item.item_name}</b>: ${item.quantity} ${item.unit}
            <div class="button-group">
                <input type="number" id="inv-qty-${item.id}" value="${item.quantity}" style="width:80px;">
                <button onclick="updateInventoryItem(${item.id})">Обновить</button>
            </div>
        </div>
    `).join('');
}

async function addInventoryItem() {
    const name = document.getElementById('invItemName').value;
    const quantity = parseFloat(document.getElementById('invItemQuantity').value);
    const unit = document.getElementById('invItemUnit').value;
    
    if (!name || !quantity || !unit) {
        alert("Заполните все поля");
        return;
    }
    
    const res = await fetch(`${API}/cook/inventory?token=${currentToken}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, quantity, unit })
    });
    
    if (res.ok) {
        alert("Продукт добавлен!");
        loadProductInventory();
        document.getElementById('invItemName').value = '';
        document.getElementById('invItemQuantity').value = '';
        document.getElementById('invItemUnit').value = '';
    }
}

async function updateInventoryItem(id) {
    const qty = parseFloat(document.getElementById(`inv-qty-${id}`).value);
    const res = await fetch(`${API}/cook/inventory/${id}?token=${currentToken}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity: qty })
    });
    
    if (res.ok) {
        alert("Остаток обновлен!");
        loadProductInventory();
    }
}

async function sendSupplyRequest() {
    const name = document.getElementById('supplyItem').value;
    const amount = parseInt(document.getElementById('supplyAmount').value);
    const unit = document.getElementById('supplyUnit').value;
    
    if (!name || !amount) {
        alert("Заполните все поля");
        return;
    }
    
    const res = await fetch(`${API}/supply?token=${currentToken}`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ item_name: name, amount, unit })
    });
    
    if (res.ok) {
        alert("Заявка отправлена администратору");
        document.getElementById('supplyItem').value = '';
        document.getElementById('supplyAmount').value = '';
    }
}

// --- АДМИН ---
async function loadAdminData() {
    document.getElementById('adminPanel').classList.remove('hidden');
    await loadMenuItemsList();
    await loadAdminStats();
    await loadSupplyRequests();
}

async function loadMenuItemsList() {
    const res = await fetch(`${API}/menu`);
    const items = await res.json();
    
    const list = document.getElementById('menuItemsList');
    list.innerHTML = items.map(item => `
        <div class="menu-item">
            <div>
                <b>${item.name}</b> - ${item.price}₽ (${item.category})
                <br><small>${item.description || 'Нет описания'}</small>
            </div>
            <div>
                <button onclick="deleteMenuItem(${item.id})" class="danger" style="width:auto;">Удалить</button>
            </div>
        </div>
    `).join('');
}

async function createMenuItem() {
    const name = document.getElementById('newDishName').value;
    const price = parseFloat(document.getElementById('newDishPrice').value);
    const category = document.getElementById('newDishCategory').value;
    const desc = document.getElementById('newDishDesc').value;
    const qty = parseInt(document.getElementById('newDishQuantity').value);
    
    if (!name || !price || !desc) {
        alert("Заполните все поля");
        return;
    }
    
    const res = await fetch(`${API}/admin/menu?token=${currentToken}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, price, category, description: desc, quantity: qty })
    });
    
    if (res.ok) {
        alert("Блюдо добавлено!");
        loadMenuItemsList();
        document.getElementById('newDishName').value = '';
        document.getElementById('newDishPrice').value = '';
        document.getElementById('newDishDesc').value = '';
    }
}

async function deleteMenuItem(id) {
    if (!confirm("Удалить блюдо?")) return;
    
    const res = await fetch(`${API}/admin/menu/${id}?token=${currentToken}`, {
        method: "DELETE"
    });
    
    if (res.ok) {
        alert("Блюдо удалено!");
        loadMenuItemsList();
    }
}

async function loadAdminStats() {
    const res = await fetch(`${API}/admin/stats?token=${currentToken}`);
    const data = await res.json();
    
    document.getElementById('statsContent').innerHTML = `
        <div class="stats-box">Продано обедов: <b>${data.total_sales}</b></div>
        <div class="stats-box">Выручка: <b>${data.revenue.toFixed(2)}₽</b></div>
    `;
}

async function loadSupplyRequests() {
    const res = await fetch(`${API}/admin/stats?token=${currentToken}`);
    const data = await res.json();
    
    const list = document.getElementById('supplyList');
    if (data.pending_supplies.length === 0) {
        list.innerHTML = '<p>Нет новых заявок</p>';
        return;
    }
    
    list.innerHTML = data.pending_supplies.map(req => `
        <div class="request-item">
            <b>${req.item_name}</b> (${req.amount} ${req.unit})
            <br>Повар: ${req.cook_name}
            <br><small>${new Date(req.created_at).toLocaleString()}</small>
            <button onclick="approveSupply(${req.id})" style="width:auto; float:right;">Согласовать</button>
            <div style="clear:both"></div>
        </div>
    `).join('');
}

async function approveSupply(id) {
    const res = await fetch(`${API}/admin/approve_supply/${id}?token=${currentToken}`, { method: "PUT" });
    if (res.ok) {
        alert("Заявка одобрена!");
        loadAdminStats();
        loadSupplyRequests();
    }
}

async function generateReport() {
    const startDate = document.getElementById('reportStartDate').value;
    const endDate = document.getElementById('reportEndDate').value;
    
    if (!startDate || !endDate) {
        alert("Выберите даты");
        return;
    }
    
    const res = await fetch(`${API}/admin/reports?start_date=${startDate}&end_date=${endDate}&token=${currentToken}`);
    const report = await res.json();
    
    if (!res.ok) {
        alert(`Ошибка: ${report.detail}`);
        return;
    }
    
    const div = document.getElementById('reportResult');
    div.innerHTML = `
        <h4>Отчет за период: ${report.period}</h4>
        <p>Всего заказов: <b>${report.total_orders}</b></p>
        <p>Общая выручка: <b>${report.total_revenue.toFixed(2)}₽</b></p>
        <table>
            <tr>
                <th>Дата</th>
                <th>Ученик</th>
                <th>Блюдо</th>
                <th>Цена</th>
                <th>Статус</th>
            </tr>
            ${report.details.map(r => `
                <tr>
                    <td>${new Date(r.date).toLocaleDateString()}</td>
                    <td>${r.student_name}</td>
                    <td>${r.item_name}</td>
                    <td>${r.price}₽</td>
                    <td>${r.is_received ? 'Получен' : 'Не получен'}</td>
                </tr>
            `).join('')}
        </table>
    `;
}

function logout() {
    localStorage.clear();
    location.reload();
}

function showReviewModal(itemId) {
    // Create modal if it doesn't exist
    let reviewModal = document.getElementById('reviewModal');
    if (!reviewModal) {
        reviewModal = document.createElement('div');
        reviewModal.id = 'reviewModal';
        reviewModal.className = 'modal';
        reviewModal.innerHTML = `
            <div class="modal-content">
                <span class="close" onclick="closeModal('reviewModal')">&times;</span>
                <h3>Оставить отзыв</h3>
                <label>Оценка:</label>
                <select id="reviewRating">
                    <option value="1">1 - Плохо</option>
                    <option value="2">2 - Удовлетворительно</option>
                    <option value="3">3 - Хорошо</option>
                    <option value="4">4 - Очень хорошо</option>
                    <option value="5">5 - Отлично</option>
                </select>
                <textarea id="reviewComment" placeholder="Ваш комментарий"></textarea>
                <button onclick="submitReview()">Отправить</button>
            </div>
        `;
        document.body.appendChild(reviewModal);
    }
    
    // Store the item ID for later use
    window.currentReviewItemId = itemId;
    
    document.getElementById('reviewModal').style.display = 'block';
}

async function submitReview() {
    const rating = parseInt(document.getElementById('reviewRating').value);
    const comment = document.getElementById('reviewComment').value;
    
    if (!window.currentReviewItemId) {
        alert('Ошибка: не выбрано блюдо для отзыва');
        return;
    }
    
    const res = await fetch(`${API}/review/${window.currentReviewItemId}?token=${currentToken}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, comment })
    });
    
    const data = await res.json();
    
    if (res.ok) {
        alert("Отзыв успешно отправлен!");
        closeModal('reviewModal');
        document.getElementById('reviewComment').value = '';
    } else {
        alert(`Ошибка: ${data.detail || 'Неизвестная ошибка'}`);
    }
}