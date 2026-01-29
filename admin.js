const API = "http://127.0.0.1:8000";
let currentToken = localStorage.getItem('token');
let currentRole = localStorage.getItem('role');
let currentUser = null;

// Check if user is logged in and has admin role
if (!currentToken || currentRole !== 'admin') {
    alert('Доступ запрещен. Только администраторы могут просматривать эту страницу.');
    window.location.href = 'main.html';
}

// Load admin data on page load
window.onload = function() {
    if (currentToken && currentRole === 'admin') {
        loadAdminData();
    }
};

async function loadAdminData() {
    const res = await fetch(`${API}/me?token=${currentToken}`);
    currentUser = await res.json();
    
    document.getElementById('welcomeMsg').innerText = `Добро пожаловать, ${currentUser.username} (${currentRole})`;
    
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
    const res = await fetch(`${API}/admin/supplies?token=${currentToken}`);
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
    window.location.href = 'main.html';
}