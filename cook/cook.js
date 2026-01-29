const API = "http://127.0.0.1:8000";
let currentToken = localStorage.getItem('token');
let currentRole = localStorage.getItem('role');
let currentUser = null;

// Check if user is logged in and has cook role
if (!currentToken || currentRole !== 'cook') {
    alert('Доступ запрещен. Только повара могут просматривать эту страницу.');
    window.location.href = '../index/main.html';
}

// Load cook data on page load
window.onload = function() {
    if (currentToken && currentRole === 'cook') {
        loadCookData();
    }
};

async function loadCookData() {
    const res = await fetch(`${API}/me?token=${currentToken}`);
    currentUser = await res.json();
    
    document.getElementById('welcomeMsg').innerText = `Добро пожаловать, ${currentUser.username} (${currentRole})`;
    
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

function logout() {
    localStorage.clear();
    window.location.href = '../index/main.html';
}