const API = "http://127.0.0.1:8000";
let currentToken = localStorage.getItem('token');
let currentRole = localStorage.getItem('role');
let currentUser = null;

// Check if user is logged in and has student role
if (!currentToken || currentRole !== 'student') {
    alert('Доступ запрещен. Только ученики могут просматривать эту страницу.');
    window.location.href = '../index/main.html';
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
    //Filter to show only unread notifications
    const unreadNotifications = notifications.filter(n => !n.is_read);
    
    if (unreadNotifications.length === 0) {
        list.innerHTML = '<p>Нет новых уведомлений</p>';
        return;
    }
    
    list.innerHTML = unreadNotifications.map(n=> `
        <div class="notification-item unread" onclick="markNotificationRead(${n.id})">
            <small>${new Date(n.created_at).toLocaleString()}</small><br>
            ${n.message}
        </div>
    `).join('');
}

async function markNotificationRead(id) {
    await fetch(`${API}/notifications/${id}/read?token=${currentToken}`, { method: "PUT" });
//Reload notifications to remove the read one from the display
    loadNotifications();
}

// Function to clear all read notifications
async function clearReadNotifications() {
    const res = await fetch(`${API}/notifications/read/clear?token=${currentToken}`, { method: "DELETE" });
    const data = await res.json();

    if (res.ok) {
        alert(data.msg);
        // Reload notifications to update the display
        loadNotifications();
    } else {
        alert(`Ошибка: ${data.detail || data.msg}`);
}
}

async function loadMenu() {
    const res = await fetch(`${API}/menu`);
    const menu = await res.json();
    
    const list = document.getElementById('menuList');
    if (menu.length === 0) {
        list.innerHTML = '<p>Меню пусто</p>';
        return;
    }
    
    // Get user's received orders to enable reviews for those items
    const ordersRes = await fetch(`${API}/my_orders?token=${currentToken}`);
    const orders = await ordersRes.json();
    
    const receivedOrderItemIds = orders.filter(order => order.is_received).map(order => order.item_id);
    
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

function logout() {
    localStorage.clear();
    window.location.href = '../index/main.html';
}