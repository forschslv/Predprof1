//STUDENT ORDER FUNCTIONS
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
    if (!weekMenuDisplay) {
        console.warn('Week menu display container not found');
        return;
    }
    
    const daysOfWeek= ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
    
    let menuHtml = '<div class="week-menu">';
    
    for (let i = 0; i < 6; i++){
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
    
    menuHtml+= '</div>';
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
        const promises = dishIds.map(dishId =>fetch(`${window.API_BASE}/menu/${dishId}`, {
                headers: {
                    'Authorization': `Bearer ${window.currentToken}`
                }
            }).then(res => res.json())
        );
        
        const dishes = await Promise.all(promises);
        
        const dayContainer = document.getElementById(`day-${dayIndex}-dishes`);
        if (!dayContainer) {
            console.warn(`Day ${dayIndex} dishes container not found`);
            return;
        }
        
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
        const dayContainer = document.getElementById(`day-${dayIndex}-dishes`);
        if (dayContainer) dayContainer.innerHTML = '<p>Ошибка загрузки блюд</p>';
    }
}

function setupOrderForm() {
    const weekOrderForm = document.getElementById('weekOrderForm');
    if (!weekOrderForm) {
        console.warn('Week order form container not found');
        return;
    }
    
    const daysOfWeek = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
    
    let formHtml= '';
    
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
                <divclass="day-total">
                    Итого за день: <span id="day-${i}-total" class="price">0₽</span>
               </div>
            </div>
        `;
    }
    
    weekOrderForm.innerHTML = formHtml;
    
    // Now populate order forms for each day that hasdishes
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
        if (!dayFormContainer) {
            console.warn(`Day ${dayIndex} order form container not found`);
            return;
        }
        
        let formHtml = '';
        
        dishes.forEach((dish, dishIdx) => {
            if (dish){
                formHtml += `
                    <div class="dish-item">
                        <div class="dish-info">
                            <div class="dish-name">${dish.name}</div>
                            <div class="dish-composition">${dish.composition}</div>
                            <div class="dish-type">${window.getDishTypeName(dish.type)}</div>
                        </div>
                        <div>
<button onclick="adjustQuantity(${dayIndex}, ${dish.id}, -1)">-</button>
                            <input type="number" id="qty-${dayIndex}-${dish.id}" class="order-quantity" value="0" min="0" onchange="updateDayTotal(${dayIndex})">
                            <buttononclick="adjustQuantity(${dayIndex}, ${dish.id}, 1)">+</button>
                            <div class="dish-price">${dish.price_rub}₽</div>
                        </div>
                    </div>
                `;
            }
        });
        
        dayFormContainer.innerHTML = formHtml;
        
        // Initialize day incurrent order
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
        const dayFormContainer = document.getElementById(`day-${dayIndex}-order-form`);
        if (dayFormContainer) dayFormContainer.innerHTML = '<p>Ошибка настройки формы заказа</p>';
    }
}

function adjustQuantity(dayIndex, dishId, change) {
    const qtyInput = document.getElementById(`qty-${dayIndex}-${dishId}`);
   if (!qtyInput) {
        console.warn(`Quantity input for day ${dayIndex}, dish ${dishId} not found`);
        return;
    }
    
    let newValue = parseInt(qtyInput.value) + change;
    
    if (newValue < 0) newValue = 0;
    
    qtyInput.value =newValue;
    
    // Update the current order
    const dayOrder = window.currentOrder.days[dayIndex];
    const item = dayOrder.items.find(item => item.dish_id === dishId);
    if (item) {
        item.quantity = newValue;
    }
    
    updateDayTotal(dayIndex);
}

functionupdateDayTotal(dayIndex) {
    let dayTotal = 0;
    const dayOrder = window.currentOrder.days[dayIndex];
    
    if (dayOrder) {
        dayOrder.items.forEach(item => {
            // Need to get dish price to calculate total
            // For now, we'll update totals whensubmitting the order
        });
    }
    
    // Recalculate based on actual inputs
    const dishIds = window.moduleMenu[dayIndex]?.dish_ids || [];
    dishIds.forEach(dishId => {
        const qtyInput = document.getElementById(`qty-${dayIndex}-${dishId}`);
        if (qtyInput){
            // We need to fetch dish prices to calculate total
            // For simplicity in this demo, we'll calculate when needed
        }
    });
    
    // Placeholder - we'll update this when we have the actual dish prices
    const dayTotalElement = document.getElementById(`day-${dayIndex}-total`);
   if (dayTotalElement) dayTotalElement.textContent = `${calculateDayTotal(dayIndex)}₽`;
}

function calculateDayTotal(dayIndex) {
    let total = 0;
    const dishIds = window.moduleMenu[dayIndex]?.dish_ids || [];
    
    // Get prices and quantities to calculate total
    dishIds.forEach(dishId => {
        const qtyInput = document.getElementById(`qty-${dayIndex}-${dishId}`);
        if (qtyInput) {
            const quantity = parseInt(qtyInput.value) || 0;
            
            // Fetch dish price and add to total
            fetch(`${window.API_BASE}/menu/${dishId}`, {
                headers: {
                    'Authorization': `Bearer ${window.currentToken}`
                }
            })
            .then(response => response.json())
            .then(dish => {
                if (dish && dish.price_rub) {
                    total += dish.price_rub * quantity;
                }
            })
            .catch(error => {
                console.error(`Error fetching dish ${dishId} for total calculation:`, error);
            });
        }
    });
    
    return total;
}

// Enhanced function to calculate total with proper async handling
async function calculateTotalWithPrices() {
    let total = 0;
    const dishPromises =[];
    
    for (let dayIndex = 0; dayIndex < 6; dayIndex++) {
        const dishIds = window.moduleMenu[dayIndex]?.dish_ids || [];
        
        dishIds.forEach(dishId => {
            const qtyInput = document.getElementById(`qty-${dayIndex}-${dishId}`);
           if (qtyInput) {
                const quantity = parseInt(qtyInput.value) || 0;

                if (quantity > 0) {
                    // Create a promise to fetch dish price
                    const dishPromise = fetch(`${window.API_BASE}/menu/${dishId}`, {
                        headers: {
                            'Authorization': `Bearer ${window.currentToken}`
                        }
                    })
                    .then(response => response.json())
                    .then(dish => {
                        if (dish && dish.price_rub) {
                            return dish.price_rub * quantity;
                        }
                        return 0;
                    })
                    .catch(error => {
                        console.error(`Errorfetching dish ${dishId}:`, error);
                        return 0;
                    });

                    dishPromises.push(dishPromise);
                }
            }});
        }


    const prices = await Promise.all(dishPromises);
    total = prices.reduce((sum, price) => sum + price, 0);
    
    returntotal;
}

async function submitOrder() {
    const weekStartDate = document.getElementById('weekStartDate').value;
    
    if (!weekStartDate) {
        alert("Пожалуйста, выберите дату начала недели");
        return;
    }
    
    // Prepare order data
    const orderData= {
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
                        quantity:quantity
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
    
    if (orderData.days.length === 0) {
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
            // Calculate the total amount from the order
            const totalAmount = await calculateTotalWithPrices();
            alert(`Заказ успешно создан! Номерзаказа: ${result.id}, общая сумма: ${totalAmount}₽`);
            
            // Show payment modal
            const totalOrderAmount = document.getElementById('totalOrderAmount');
            if (totalOrderAmount) totalOrderAmount.textContent = `${totalAmount}₽`;
            const paymentModal = document.getElementById('paymentModal');
            if (paymentModal) paymentModal.style.display = 'block';
        } else {
            alert(result.detail || "Ошибка создания заказа");
        }
    } catch (error) {
        alert("Ошибка отправки заказа: " + error.message);
    }
}

function closeModal(modalId) {
   const modal = document.getElementById(modalId);
    if (modal) modal.style.display = 'none';
}

async function confirmPayment() {
    const orderId = 1; // In a real app, this would come from the created order
    const paymentProof = document.getElementById('paymentProof');
    
    if (!paymentProof || !paymentProof.files[0]) {
        alert("Пожалуйста, прикрепите подтверждение оплаты");
        return;
    }
    
    // Send payment confirmation to server
    const formData = new FormData();
    formData.append('file', paymentProof.files[0]);
    
   try {
        const response = await fetch(`${window.API_BASE}/orders/${orderId}/pay`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${window.currentToken}`
            },
            body: formData
        });
        
        if (response.ok) {
            alert("Оплата подтверждена!");
            closeModal('paymentModal');
            
            // Reload orders
            await loadMyOrders();
        } else {
            const result = await response.json();
            alert(result.detail || "Ошибка подтверждения оплаты");
        }
    } catch (error) {
        alert("Ошибка подтверждения оплаты: " + error.message);
    }
}

async function loadMyOrders() {
    try {
        //Fixed endpoint according to OpenAPI spec - there's no /orders/my endpoint
        // Using /orders to get user's orders
        const response = await fetch(`${window.API_BASE}/orders`, {
            headers: {
                'Authorization': `Bearer ${window.currentToken}`
            }
        });
        
        if (response.ok) {
            const orders = await response.json();
            const ordersContainer = document.getElementById('myOrders');
            
            if (orders.length === 0) {
                ordersContainer.innerHTML = '<p>У вас нет заказов</p>';
                return;
            }
            
            let ordersHtml = '';
            orders.forEach(order => {
                ordersHtml += `
                    <div class="order-item">
                        <div>
                            <b>Заказ#${order.id}</b> - Статус: ${order.status}
                           <br><small>Дата начала недели: ${order.week_start_date}</small>
                            <br><small>Общая сумма: ${order.total_amount}₽</small>
                        </div>
                    </div>
`;
            });
            
            ordersContainer.innerHTML = ordersHtml;
        } else {
            document.getElementById('myOrders').innerHTML = '<p>Ошибка загрузки заказов</p>';
        }
    } catch (error) {
        console.error("Error loading orders:", error);
        document.getElementById('myOrders').innerHTML = '<p>Ошибка загрузки заказов</p>';
    }
}