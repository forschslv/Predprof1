const API = "http://127.0.0.1:8000";
let currentToken = localStorage.getItem('token');
let currentRole = localStorage.getItem('role');
let currentUser = null;

// Check if user is logged in and has student role
if (!currentToken || currentRole !== 'student') {
    alert('Доступ запрещен. Только ученики могут просматривать эту страницу.');
    window.location.href = 'main.html';
}

// Load student data on page load
window.onload = function() {
    if (currentToken && currentRole === 'student') {
        loadStudentData();
    }
};

async function loadStudentData() {
    const res = await fetch(`${API}/me?token=${currentToken}`);
    currentUser = await res.json();
    
    document.getElementById('welcomeMsg').innerText = `Добро пожаловать, ${currentUser.username} (${currentRole})`;
    
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

function logout() {
    localStorage.clear();
    window.location.href = 'main.html';
}