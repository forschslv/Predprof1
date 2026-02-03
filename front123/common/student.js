// Student-specific functionality

async function loadStudentData() {
    const studentPanel = document.getElementById('studentPanel');
    if (studentPanel) studentPanel.classList.remove('hidden');
    
    // Load profile
    if (window.currentUser) {
        document.getElementById('profileName').innerText = window.currentUser.name;
        document.getElementById('profileSecondaryName').innerText = window.currentUser.secondary_name;
        document.getElementById('profileEmail').innerText = window.currentUser.email;
        document.getElementById('profileStatus').innerText = window.currentUser.status;
        document.getElementById('profileClass').innerText = "10А"; // Would come from backend
        document.getElementById('profileTeacher').innerText = "Иванова М.П."; // Would come from backend
    }
    
    // Load module menu
    await loadModuleMenu();
    
    // Load orders
    await loadMyOrders();
}

async function loadModuleMenu() {
    try {
        const response = await fetch(`${window.API_BASE}/module-menu`, {
            headers: {
                'Authorization': `Bearer ${window.currentToken}`
           }
        });
        
        if (response.ok) {
            window.moduleMenu = await response.json();
        } else {
            // If no module menu exists yet, create an empty one
            window.moduleMenu = {};
        }
        
        displayModuleMenu();
        setupOrderForm();
    } catch (error) {
        console.error("Error loading module menu:", error);
        // Create empty module menu
        window.moduleMenu = {};
        displayModuleMenu();
        setupOrderForm();
    }
}

function displayModuleMenu() {
    const weekMenuDisplay = document.getElementById('weekMenuDisplay');
    const daysOfWeek = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
    
    if (!weekMenuDisplay) return;
    
    let menuHtml = '<div class="week-menu">';
    
    for (let i = 0; i < 6; i++) {
        const dayDishes = window.moduleMenu[i] || { dish_ids: [] };
        menuHtml += `
            <div class="week-day-container">
                <div class="week-day-title">${daysOfWeek[i]}</div>
                <div id="day-${i}-dishes">
                    ${dayDishes.dish_ids && dayDishes.dish_ids.length > 0 
                        ? '<p>Загрузка блюд...</p>' 
                        : '<p>Меню на этот день не установлено</p>'
                    }
                </div>
            </div>
        `;
    }
    
    menuHtml += '</div>';
    weekMenuDisplay.innerHTML = menuHtml;
    
    // Now load dishes for each day that has them
    for (let i = 0; i < 6; i++) {
        const dayDishes = window.moduleMenu[i];
        if (dayDishes && dayDishes.dish_ids && dayDishes.dish_ids.length > 0) {
            loadDishesForDayDisplay(i, dayDishes.dish_ids);
        }
    }
}

async function loadDishesForDayDisplay(dayIndex, dishIds) {
    try {
        const promises = dishIds.map(dishId => 
            fetch(`${window.API_BASE}/menu/${dishId}`, {
                headers: {
                    'Authorization': `Bearer ${window.currentToken}`
                }
            }).then(res => res.json())
        );
        
        const dishes = await Promise.all(promises);
        
        const dayContainer = document.getElementById(`day-${dayIndex}-dishes`);
        if (!dayContainer) return;
        
        let dishesHtml = '';
        
        dishes.forEach((dish, idx) => {
            if (dish) {
                dishesHtml += `
                    <div class="dish-item">
                        <div class="dish-info">
                            <div class="dish-name">${dish.name}</div>
                            <div class="dish-composition">${dish.composition}</div>
                            <div class="dish-type">${window.getDishTypeName(dish.type)}</div>
                        </div>
                        <div class="dish-price">${dish.price_rub}₽</div>
                    </div>
                `;
            }
        });
        
        dayContainer.innerHTML = dishesHtml || '<p>Нет доступных блюд</p>';
    } catch (error) {
       console.error(`Error loading dishes for day ${dayIndex}:`, error);
        const container = document.getElementById(`day-${dayIndex}-dishes`);
        if (container) container.innerHTML = '<p>Ошибка загрузки блюд</p>';
    }
}

function setupOrderForm() {
    const weekOrderForm = document.getElementById('weekOrderForm');
    if (!weekOrderForm) return;
    
    const daysOfWeek = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
    
    let formHtml = '';
    
    for (let i = 0; i < 6; i++){
        const dayDishes = window.moduleMenu[i] || { dish_ids: [] };
        formHtml += `
            <div class="week-day-container">
                <div class="week-day-title">${daysOfWeek[i]}</div>
                <div id="day-${i}-order-form">
                    ${dayDishes.dish_ids && dayDishes.dish_ids.length > 0 
                        ? '<p>Загрузка формы заказа...</p>' 
                        : '<p>Нет меню для заказа в этот день</p>'
                    }
                </div>
                <div class="day-total">
                    Итого за день: <span id="day-${i}-total" class="price">0₽</span>
               </div>
            </div>
        `;
    }
    
    weekOrderForm.innerHTML = formHtml;
    
    // Now populate order forms for each day that has dishes
    for (let i = 0; i < 6; i++) {
        const dayDishes = window.moduleMenu[i];
        if (dayDishes && dayDishes.dish_ids && dayDishes.dish_ids.length > 0) {
            setupDayOrderForm(i, dayDishes.dish_ids);
        }
    }
    
    // Initialize current order structure
    window.currentOrder = {
        week_start_date: '',
        days: []
    };
}

async function setupDayOrderForm(dayIndex, dishIds) {
    try {
        const promises = dishIds.map(dishId => 
            fetch(`${window.API_BASE}/menu/${dishId}`, {
                headers: {
                    'Authorization': `Bearer ${window.currentToken}`
                }
            }).then(res => res.json())
        );
        
        const dishes = await Promise.all(promises);
        
        const dayFormContainer = document.getElementById(`day-${dayIndex}-order-form`);
        if (!dayFormContainer) return;
        
        let formHtml = '';
        
        dishes.forEach((dish, dishIdx) => {
            if (dish) {
                formHtml += `
                    <div class="dish-item">
                        <div class="dish-info">
                            <div class="dish-name">${dish.name}</div>
                            <div class="dish-composition">${dish.composition}</div>
                            <div class="dish-type">${window.getDishTypeName(dish.type)}</div>
                        </div>
                        <div>
                            <button type="button" onclick="adjustQuantity(${dayIndex}, ${dish.id}, -1)">-</button>
                            <input type="number" id="qty-${dayIndex}-${dish.id}" class="order-quantity" value="0" min="0" onchange="updateDayTotal(${dayIndex})">
                            <button type="button" onclick="adjustQuantity(${dayIndex}, ${dish.id}, 1)">+</button>
                            <div class="dish-price">${dish.price_rub}₽</div>
                        </div>
                    </div>
                `;
            }
        });
        
        dayFormContainer.innerHTML = formHtml;
        
        // Initialize day in current order
        if (!window.currentOrder.days[dayIndex]) {
            window.currentOrder.days[dayIndex] = {
                day_of_week: dayIndex,
                items: []
            };
            
            // Initialize items array for each dish
            dishes.forEach(dish => {
                if (dish) {
                    window.currentOrder.days[dayIndex].items.push({
                        dish_id: dish.id,
                        quantity: 0
                    });
                }
            });
        }
    } catch (error) {
        console.error(`Error setting up order form for day ${dayIndex}:`, error);
        const container = document.getElementById(`day-${dayIndex}-order-form`);
        if (container) container.innerHTML = '<p>Ошибка настройки формы заказа</p>';
    }
}

function adjustQuantity(dayIndex, dishId, change) {
    const qtyInput = document.getElementById(`qty-${dayIndex}-${dishId}`);
    if (!qtyInput) return;
    
    let newValue = parseInt(qtyInput.value) + change;
    
    if (newValue < 0) newValue = 0;
    
    qtyInput.value = newValue;
    
    // Update the current order
    const dayOrder = window.currentOrder.days[dayIndex];
    const item = dayOrder.items.find(item => item.dish_id === dishId);
    if (item) {
        item.quantity = newValue;
    }
    
    updateDayTotal(dayIndex);
}

function updateDayTotal(dayIndex) {
    let dayTotal = 0;
    const dayOrder = window.currentOrder.days[dayIndex];
    
    if (dayOrder) {
        dayOrder.items.forEach(item => {
            // Need to get dish price to calculate total
            // For now, we'll update totals when submitting the order
        });
    }
    
    // Recalculate based on actual inputs
    const dishIds = window.moduleMenu[dayIndex]?.dish_ids || [];
    dishIds.forEach(dishId => {
        const qtyInput = document.getElementById(`qty-${dayIndex}-${dishId}`);
        if (qtyInput) {
            // We need to fetch dish prices to calculate total
            // For simplicity in this demo, we'll calculate when needed
        }
    });
    
    // Placeholder - we'll update this when we have the actual dish prices
    const totalElement = document.getElementById(`day-${dayIndex}-total`);
    if (totalElement) {
        totalElement.textContent = `${calculateDayTotal(dayIndex)}₽`;
    }
}

function calculateDayTotal(dayIndex) {
    let total = 0;
    const dishIds = window.moduleMenu[dayIndex]?.dish_ids || [];
    
    dishIds.forEach(dishId => {
        const qtyInput = document.getElementById(`qty-${dayIndex}-${dishId}`);
        if (qtyInput) {
            const quantity = parseInt(qtyInput.value) || 0;
            // In a real app, we'd store dish prices, but for now we'll fetch them when needed
            // This is simplified for the demo
        }
    });
    
    // This is a simplified calculation - in a real app we'd have the dish prices cached
    return total;
}

async function submitOrder() {
    const weekStartDate = document.getElementById('weekStartDate').value;
    
    if (!weekStartDate) {
        alert("Пожалуйста, выберите дату начала недели");
        return;
    }
    
    // Prepare order data
    const orderData = {
        week_start_date: weekStartDate,
        days: []
    };
    
    for (let dayIndex = 0; dayIndex < 6; dayIndex++) {
        const dishIds = window.moduleMenu[dayIndex]?.dish_ids || [];
        const dayItems = [];
        
        dishIds.forEach(dishId => {
            const qtyInput = document.getElementById(`qty-${dayIndex}-${dishId}`);
            if (qtyInput) {
                const quantity = parseInt(qtyInput.value) || 0;
                if (quantity > 0) {
                    dayItems.push({
                        dish_id: dishId,
                        quantity: quantity
                    });
                }
            }
        });
        
        if (dayItems.length > 0) {
            orderData.days.push({
                day_of_week: dayIndex,
                items: dayItems
            });
        }
    }
    
    if (orderData.days.length === 0){
       alert("Пожалуйста, добавьте хотя бы одно блюдо в заказ");
        return;
    }
    
    try {
        const response = await fetch(`${window.API_BASE}/orders`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${window.currentToken}`
            },
            body: JSON.stringify(orderData)
        });
        
        const result = await response.json();
        
        if (response.ok) {
            alert(`Заказ успешно создан! Номер заказа: ${result.id}, общая сумма: ${result.total_amount}₽`);
            
            // Show payment modal
            const totalAmountElement = document.getElementById('totalOrderAmount');
            if (totalAmountElement) {
                totalAmountElement.textContent = `${result.total_amount}₽`;
            }
            document.getElementById('paymentModal').style.display = 'block';
        } else {
            alert(result.detail || "Ошибка создания заказа");
        }
    } catch (error) {
        alert("Ошибка отправки заказа: " + error.message);
    }
}

async function loadMyOrders() {
    try {
        // Fixed endpoint according to OpenAPI spec - there's no /orders/my endpoint
        // Using /orders to get user's orders
        const response = await fetch(`${window.API_BASE}/orders`, {
            headers: {
                'Authorization': `Bearer ${window.currentToken}`
            }
        });
        
        if (response.ok) {
            const orders = await response.json();
            const ordersContainer = document.getElementById('myOrders');
            
            if (!ordersContainer) return;
            
            if (orders.length === 0) {
                ordersContainer.innerHTML = '<p>У вас нет заказов</p>';
                return;
            }
            
            let ordersHtml = '';
            orders.forEach(order => {
                ordersHtml += `
                    <div class="order-item">
                        <div>
                            <b>Заказ #${order.id}</b> - Статус: ${order.status}
                           <br><small>Дата начала недели: ${order.week_start_date}</small>
                            <br><small>Общая сумма: ${order.total_amount}₽</small>
                        </div>
                    </div>
                `;
            });
            
            ordersContainer.innerHTML = ordersHtml;
        } else {
           const ordersContainer = document.getElementById('myOrders');
           if (ordersContainer) {
               ordersContainer.innerHTML = '<p>Ошибка загрузки заказов</p>';
           }
        }
    } catch (error) {
        console.error("Error loading orders:", error);
        const ordersContainer = document.getElementById('myOrders');
        if (ordersContainer) {
            ordersContainer.innerHTML = '<p>Ошибка загрузки заказов</p>';
        }
    }
}