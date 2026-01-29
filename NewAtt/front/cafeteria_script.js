//Globalvariables
const API_BASE = "http://10.92.59.143:8000";
let currentToken = localStorage.getItem('token');
let currentRole = localStorage.getItem('role');
let currentUser = null;
let globalMenu = [];
let moduleMenu = {};
let currentOrder = {};
let isRegister = false;

// Initialize the app
if (currentToken) {
    showDashboard();
} else {
    // Set up login form by default
    document.getElementById('username').classList.add('hidden');
    document.getElementById('confirmCode').classList.remove('hidden');
}

function toggleReg() {
    isRegister = !isRegister;
    document.getElementById('authTitle').innerText = isRegister ? "Регистрация" : "Вход";
    document.getElementById('authBtn').innerText = isRegister ? "Зарегистрироваться" : "Войти";
    document.getElementById('toggleText').innerText = isRegister ? "Уже есть аккаунт? Войти" : "Нет аккаунта? Зарегистрироваться";
    
    const usernameField = document.getElementById('username');
    const emailField = document.getElementById('email');
    const confirmCodeField = document.getElementById('confirmCode');
    
    if (isRegister) {
        // Registration: show username, email, and code fields
        usernameField.classList.remove('hidden');
        emailField.classList.remove('hidden');
        confirmCodeField.classList.remove('hidden');
        usernameField.placeholder = "Имя пользователя";
    } else {
        // Login: show email and code fields
        usernameField.classList.add('hidden');
        emailField.classList.remove('hidden');
        confirmCodeField.classList.remove('hidden');
    }
}

async function handleAuth() {
    const username = document.getElementById('username').value;
    const email = document.getElementById('email').value;
    const confirmCode = document.getElementById('confirmCode').value;
    
    // If code field is filled, try to verify directly
    if (confirmCode.trim() !== "") {
        // Verify the code directly
        try {
            const verifyRes = await fetch(`${API_BASE}/verify-code`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, code: confirmCode })
            });
            
            const verifyData = await verifyRes.json();
            
            if (verifyRes.ok) {
                localStorage.setItem('token', verifyData.access_token);
                currentToken = verifyData.access_token;
currentUser = verifyData.user;
                
                // Determine role based on status
                if (currentUser.status.toLowerCase().includes('admin')) {
                    currentRole = 'admin';
                } else if (currentUser.status.toLowerCase().includes('cook')) {
                    currentRole = 'cook';
                } else {
                    currentRole = 'student';
                }
                localStorage.setItem('role', currentRole);
                
                showDashboard();
            } else {
                alert(verifyData.detail || "Неверный код подтверждения");
            }
        } catch (error) {
            alert("Ошибка проверки кода: " + error.message);
        }
    } else {
        // Request code to be sent
        try {
            if (isRegister) {
                // Registration flow - send verification code
                const registerRes = await fetch(`${API_BASE}/register`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        name: username,
                        secondary_name: "User",
                        email: email,
                        status: "student"
                    })
                });
                
                const registerData = await registerRes.json();
                
                if (registerRes.ok) {
                    alert("Код подтверждения отправлен на ваш email. Пожалуйста, введите его.");
                } else {
                    alert(registerData.detail || "Ошибка регистрации");
                }
            } else {
                // Login flow - request verification code
                const loginRes = await fetch(`${API_BASE}/register`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        name: "temp", // Not used for login
                        secondary_name: "temp",
                        email: email,
                        status: "login" // Indicate this is a login attempt
                    })
                });
                
                const loginData = await loginRes.json();
                
                if (loginRes.ok) {
                    alert("Код подтверждения отправлен на ваш email. Пожалуйста, введите его.");
                } else {
                    alert(loginData.detail || "Ошибка входа");
                }
            }
        } catch (error) {
            if (isRegister) {
                alert("Ошибка регистрации: " + error.message);
            } else {
                alert("Ошибка входа: " + error.message);
            }
        }
    }
}

async function verifyCode() {
    const email = document.getElementById('verifyEmail').value;
    const code = document.getElementById('verifyCode').value;
    
    try {
        const verifyRes = await fetch(`${API_BASE}/verify-code`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, code })
        });
        
        const verifyData = await verifyRes.json();
        
        if (verifyRes.ok) {
            localStorage.setItem('token', verifyData.access_token);
            currentToken = verifyData.access_token;
            currentUser = verifyData.user;
            
            // Determine role based on status
            if (currentUser.status.toLowerCase().includes('admin')) {
                currentRole = 'admin';
            } else if (currentUser.status.toLowerCase().includes('cook')) {
                currentRole = 'cook';
            } else {
                currentRole = 'student';
            }
            localStorage.setItem('role', currentRole);
            
            // Remove verification section and show main dashboard
            document.getElementById('verificationSection').remove();
            
            // Show back the auth fields for next logout
            document.getElementById('username').classList.remove('hidden');
            document.getElementById('email').classList.remove('hidden');
            document.getElementById('authBtn').classList.remove('hidden');
            document.getElementById('toggleText').classList.remove('hidden');
            
            showDashboard();
        } else {
            alert(verifyData.detail || "Неверный код подтверждения");
        }
    } catch (error) {
        alert("Ошибка проверки кода: " + error.message);
    }
}

async function showDashboard() {
    document.getElementById('authSection').classList.add('hidden');
    document.getElementById('dashboardSection').classList.remove('hidden');
    
    document.getElementById('welcomeMsg').innerText = `Добро пожаловать, ${currentUser.name} ${currentUser.secondary_name} (${currentRole})`;

    // Load data based on role
    if (currentRole === 'student') {
        loadStudentData();
    } else if (currentRole === 'cook') {
        loadCookData();
    } else if (currentRole === 'admin') {
        loadAdminData();
    }
}

// STUDENT FUNCTIONS
async function loadStudentData() {
    document.getElementById('studentPanel').classList.remove('hidden');
    
    // Load profile
    document.getElementById('profileName').innerText = currentUser.name;
    document.getElementById('profileSecondaryName').innerText = currentUser.secondary_name;
    document.getElementById('profileEmail').innerText = currentUser.email;
    document.getElementById('profileStatus').innerText = currentUser.status;
    document.getElementById('profileClass').innerText = "10А"; // Would come from backend
    document.getElementById('profileTeacher').innerText = "Иванова М.П."; // Would come from backend
    
// Load module menu
    await loadModuleMenu();
    
    // Load orders
    await loadMyOrders();
}

async function loadModuleMenu() {
    try {
        const response = await fetch(`${API_BASE}/module-menu`, {
            headers: {
                'Authorization': `Bearer ${currentToken}`
           }
        });
        
        if (response.ok) {
            moduleMenu = await response.json();
        } else {
            // If no module menu exists yet, create an empty one
            moduleMenu = {};
        }
        
        displayModuleMenu();
        setupOrderForm();
    } catch (error) {
        console.error("Error loading module menu:", error);
        // Create empty module menu
        moduleMenu = {};
        displayModuleMenu();
        setupOrderForm();
    }
}

function displayModuleMenu() {
    const weekMenuDisplay = document.getElementById('weekMenuDisplay');
    const daysOfWeek = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
    
    let menuHtml = '<div class="week-menu">';
    
    for (let i = 0; i < 6; i++) {
        const dayDishes = moduleMenu[i] || { dish_ids: [] };
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
    weekMenuDisplay.innerHTML =menuHtml;
    
    // Now load dishes for each day that has them
    for (let i = 0; i < 6; i++) {
        const dayDishes = moduleMenu[i];
        if (dayDishes && dayDishes.dish_ids && dayDishes.dish_ids.length >0) {
            loadDishesForDayDisplay(i, dayDishes.dish_ids);
        }
    }
}

async function loadDishesForDayDisplay(dayIndex, dishIds) {
    try {
        const promises = dishIds.map(dishId => 
            fetch(`${API_BASE}/menu/${dishId}`, {
                headers: {
                    'Authorization': `Bearer ${currentToken}`
                }
            }).then(res => res.json())
        );
        
        const dishes = await Promise.all(promises);
        
        const dayContainer = document.getElementById(`day-${dayIndex}-dishes`);
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
        document.getElementById(`day-${dayIndex}-dishes`).innerHTML = '<p>Ошибка загрузки блюд</p>';
    }
}



function setupOrderForm() {
    const weekOrderForm = document.getElementById('weekOrderForm');
    constdaysOfWeek = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
    
    let formHtml = '';
    
    for (let i = 0; i < 6; i++){
        const dayDishes = moduleMenu[i] || { dish_ids: [] };
        formHtml += `
            <div class="week-day-container">
                <div class="week-day-title">${daysOfWeek[i]}</div>
                <div id="day-${i}-order-form">
                    ${dayDishes.dish_ids && dayDishes.dish_ids.length > 0 
                        ? '<p>Загрузка формызаказа...</p>' 
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
        const dayDishes = moduleMenu[i];
        if (dayDishes && dayDishes.dish_ids && dayDishes.dish_ids.length > 0) {
            setupDayOrderForm(i, dayDishes.dish_ids);
        }
    }
    
    // Initialize current order structure
    currentOrder = {
        week_start_date: '',
        days: []
    };
}

async function setupDayOrderForm(dayIndex, dishIds) {
    try {
        const promises = dishIds.map(dishId => 
            fetch(`${API_BASE}/menu/${dishId}`, {
                headers: {
                    'Authorization': `Bearer ${currentToken}`
                }
            }).then(res => res.json())
        );
        
        const dishes = await Promise.all(promises);
        
        const dayFormContainer = document.getElementById(`day-${dayIndex}-order-form`);
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
        
        // Initialize day incurrent orderif (!currentOrder.days[dayIndex]) {
            currentOrder.days[dayIndex] = {
                day_of_week: dayIndex,
                items: []
            };
            
            // Initialize items array for each dish
            dishes.forEach(dish => {
                if (dish) {
                    currentOrder.days[dayIndex].items.push({
                        dish_id: dish.id,
                        quantity: 0
                    });
                }
            });

    } catch (error) {
        console.error(`Error setting up order form for day ${dayIndex}:`, error);
        document.getElementById(`day-${dayIndex}-order-form`).innerHTML = '<p>Ошибка настройки формы заказа</p>';
    }
}

function adjustQuantity(dayIndex, dishId, change) {
    const qtyInput = document.getElementById(`qty-${dayIndex}-${dishId}`);
    let newValue = parseInt(qtyInput.value) + change;
    
    if (newValue <0) newValue = 0;
    
    qtyInput.value = newValue;
    
    // Update the current order
    const dayOrder = currentOrder.days[dayIndex];
    const item = dayOrder.items.find(item => item.dish_id === dishId);
    if (item) {
        item.quantity = newValue;
    }
    
    updateDayTotal(dayIndex);
}

function updateDayTotal(dayIndex) {
    let dayTotal = 0;
    const dayOrder = currentOrder.days[dayIndex];
    
    if (dayOrder) {
        dayOrder.items.forEach(item => {
            // Need to get dish price to calculatetotal// For now, we'll update totals when submitting the order
        });
    }
    
    // Recalculate based on actual inputs
    const dishIds = moduleMenu[dayIndex]?.dish_ids || [];
    dishIds.forEach(dishId => {
        const qtyInput = document.getElementById(`qty-${dayIndex}-${dishId}`);
        if (qtyInput) {
            // We need to fetch dish prices to calculate total
            // For simplicity in this demo, we'll calculate when needed
        }
    });
    
    // Placeholder - we'll update this when we have the actual dish prices
    document.getElementById(`day-${dayIndex}-total`).textContent = `${calculateDayTotal(dayIndex)}₽`;
}

function calculateDayTotal(dayIndex) {
    let total = 0;
    const dishIds = moduleMenu[dayIndex]?.dish_ids || [];
    
    dishIds.forEach(dishId => {
        const qtyInput = document.getElementById(`qty-${dayIndex}-${dishId}`);
        if (qtyInput) {
            constquantity = parseInt(qtyInput.value) || 0;
            // In a real app, we'd store dish prices, but for now we'll fetch them when needed
            // This is simplified for the demo
        }
    });
    
    // This is a simplified calculation - in a real app we'd have thedish prices cached
    return total;
}

async function submitOrder() {
    const weekStartDate = document.getElementById('weekStartDate').value;
    
    if (!weekStartDate) {
        alert("Пожалуйста, выберите дату начала недели");
        return;
    }
    
    // Prepare orderdata
    const orderData = {
        week_start_date: weekStartDate,
        days: []
    };
    
    for (let dayIndex = 0; dayIndex < 6; dayIndex++) {
        const dishIds = moduleMenu[dayIndex]?.dish_ids || [];
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
        const response = await fetch(`${API_BASE}/orders`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${currentToken}`
            },
            body: JSON.stringify(orderData)
        });
        
        const result = await response.json();
        
        if (response.ok) {
            alert(`Заказ успешно создан! Номер заказа: ${result.id}, общая сумма: ${result.total_amount}₽`);
            
            // Show payment modal
            document.getElementById('totalOrderAmount').textContent = `${result.total_amount}₽`;
            document.getElementById('paymentModal').style.display = 'block';
        } else {
            alert(result.detail || "Ошибка создания заказа");
        }
    } catch (error) {
        alert("Ошибка отправки заказа: " + error.message);
    }
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

async function confirmPayment() {
    const orderId = 1; // In a real app, this would come from the created order
    const paymentProof = document.getElementById('paymentProof').files[0];
    
    if (!paymentProof) {
        alert("Пожалуйста, прикрепите подтверждение оплаты");
        return;
    }
    
    // In a real app, we would upload the payment proof file
    // For now, we'll just show a success message
    alert("Оплата подтверждена!");
    closeModal('paymentModal');
    
    // Reload orders
    await loadMyOrders();
}

async function loadMyOrders() {
    try {
        const response = await fetch(`${API_BASE}/orders/my`, {
            headers: {
                'Authorization': `Bearer ${currentToken}`
            }
        });
        
        if (response.ok) {
            const orders = await response.json();
            const ordersContainer = document.getElementById('myOrders');
            
            if (orders.length === 0) {
                ordersContainer.innerHTML = '<p>У вас нетзаказов</p>';
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
           document.getElementById('myOrders').innerHTML = '<p>Ошибка загрузки заказов</p>';
        }
    } catch (error) {
        console.error("Error loading orders:", error);
        document.getElementById('myOrders').innerHTML = '<p>Ошибка загрузки заказов</p>';
    }
}

// COOK FUNCTIONS
async function loadCookData() {
    document.getElementById('cookPanel').classList.remove('hidden');
    
    // Load global menu
    await loadGlobalMenu();
}

async function loadGlobalMenu() {
    try {
        const response = await fetch(`${API_BASE}/menu`, {
            headers: {
                'Authorization': `Bearer ${currentToken}`
            }
        });
        
        if (response.ok) {
            globalMenu = await response.json();
            displayDishes(globalMenu);
        } else {
            globalMenu = [];
            displayDishes([]);
        }
    } catch (error) {
        console.error("Error loading globalmenu:", error);
        globalMenu = [];
        displayDishes([]);
    }
}

function displayDishes(dishes) {
    const dishesList = document.getElementById('dishesList');
    
    if (dishes.length === 0) {
        dishesList.innerHTML = '<p>Меню пусто</p>';
        return;
    }
    
    let dishesHtml = '';
    dishes.forEach(dish => {
        dishesHtml += `
            <div class="menu-item">
                <div>
                    <b>${dish.name}</b> (${window.getDishTypeName(dish.type)})
                    <br><small><strong>Состав:</strong> ${dish.composition}</small>
                    <br><small><strong>Количество:</strong> ${dish.quantity_grams} грамм</small>
                    <br><small><strong>Штрих-код:</strong> ${dish.barcode || 'Не указан'}</small>
                    <br><small><strong>Период:</strong> ${dish.period || 'Не указан'}</small>
                </div>
                <div>
                    <span class="price">${dish.price_rub}₽</span>
                    <button onclick="editDish(${dish.id})" style="width:auto; margin-top: 5px;">Изменить</button>
                    <button onclick="deleteDish(${dish.id})" class="danger" style="width:auto; margin-top: 5px;">Удалить</button>
                </div>
            </div>
        `;
    });
    
    dishesList.innerHTML = dishesHtml;
}

function filterDishes() {
    const filterValue = document.getElementById('dishTypeFilter').value;
    
    if (!filterValue) {
        displayDishes(globalMenu);
    } else {
       const filteredDishes = globalMenu.filter(dish => dish.type === filterValue);
        displayDishes(filteredDishes);
    }
}

async function createDish() {
    const name = document.getElementById('newDishName').value;
    const shortName = document.getElementById('newDishShortName').value;
const type = document.getElementById('newDishType').value;
    const composition = document.getElementById('newDishComposition').value;
    const quantityGrams = parseInt(document.getElementById('newDishQuantityGrams').value);
    const priceRub = parseFloat(document.getElementById('newDishPriceRub').value);
   const barcode = document.getElementById('newDishBarcode').value || null;
    const period = document.getElementById('newDishPeriod').value || null;
    
    if (!name || !type || !composition || !quantityGrams || !priceRub) {
        alert("Пожалуйста, заполнитевсе обязательные поля");
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/menu/dish`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${currentToken}`
            },
            body: JSON.stringify({
name,
                short_name: shortName || null,
                type,
                composition,
                quantity_grams: quantityGrams,
                price_rub: priceRub,
                barcode,
                period
            })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            alert("Блюдо успешно добавлено!");
            loadGlobalMenu(); // Refresh the list// Clear form
            document.getElementById('newDishName').value = '';
            document.getElementById('newDishShortName').value = '';
            document.getElementById('newDishComposition').value = '';
            document.getElementById('newDishQuantityGrams').value = '';
            document.getElementById('newDishPriceRub').value = '';
            document.getElementById('newDishBarcode').value = '';
            document.getElementById('newDishPeriod').value = '';
        } else {
            alert(result.detail || "Ошибка добавления блюда");
        }
} catch (error) {
        alert("Ошибка добавления блюда: " + error.message);
    }
}

async function editDish(dishId) {
    // In a real app, this would open a modal to edit the dish
    alert(`Редактирование блюда ID: ${dishId} (функция в разработке)`);
}

async function deleteDish(dishId) {
    if (!confirm("Вы уверены, что хотите удалить это блюдо?")) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/menu/dish/${dishId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${currentToken}`
            }
        });
        
        if (response.ok) {
            alert("Блюдо успешно удалено!");
            loadGlobalMenu(); // Refresh the list
        } else {
            const result = awaitresponse.json();
            alert(result.detail || "Ошибка удаления блюда");
        }
    } catch (error) {
        alert("Ошибка удаления блюда: " + error.message);
    }
}

function uploadMenuFile(isProvider) {
    // In a real app, this would open a file upload dialogalert(`Загрузка ${isProvider ? 'меню поставщика' : 'собственного меню'} из файла (функция в разработке)\nПараметр is_provider: ${isProvider}`);
}

async function loadDishesForDay() {
    const dayOfWeek = document.getElementById('dayOfWeekSelect').value;
    
    try {
        const response = await fetch(`${API_BASE}/menu`, {
            headers: {
                'Authorization': `Bearer ${currentToken}`
            }
        });
        
        if (response.ok) {
            const allDishes = await response.json();
            
            // Groupdishes by type
            const dishesByType = {};
            allDishes.forEach(dish => {
                if (!dishesByType[dish.type]) {
                    dishesByType[dish.type] = [];
                }
                dishesByType[dish.type].push(dish);
            });
            
            // Display dish selectors bytype
            const dayMenuSetup = document.getElementById('dayMenuSetup');
            let setupHtml = '';
            
            for (const [type, dishes] of Object.entries(dishesByType)) {
                setupHtml += `
                    <div class="day-menu-item">
                        <h4>${window.getDishTypeName(type)}</h4>
                        <div>
                            ${dishes.map(dish => `
                                <div class="day-dish-selector">
                                    <input type="checkbox" id="dish-${dish.id}" value="${dish.id}">
                                    <label for="dish-${dish.id}">${dish.name} -${dish.price_rub}₽</label>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            }
            
            dayMenuSetup.innerHTML = setupHtml;
        } else {
            document.getElementById('dayMenuSetup').innerHTML = '<p>Ошибка загрузки блюд</p>';
        }
    } catch (error) {
        console.error("Error loading dishes for day setup:", error);
        document.getElementById('dayMenuSetup').innerHTML = '<p>Ошибка загрузки блюд</p>';
    }
}

async function saveModuleMenu() {
    // Collect selected dishes for each day// This is a simplified version - in a real app we would collect actual selections
    const schedule = [];
    
    // For demonstration, we'll create a sample schedule
    for (let day = 0; day < 6; day++) {
        // Get all checked dish checkboxes for this day
const checkedDishes = []; // In a real app, we would collect from the UI
        
        schedule.push({
            day_of_week: day,
            dish_ids: checkedDishes
        });
    }
    
    if (schedule.length === 0) {
        alert("Пожалуйста, выберите блюда для меню на модуль");
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/module-menu`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${currentToken}`
            },
body: JSON.stringify({schedule })
        });
        
        if (response.ok) {
            alert("Меню на модуль успешно сохранено!");
        } else {
            const result = await response.json();
            alert(result.detail || "Ошибка сохранения меню на модуль");
        }
    } catch (error) {
        alert("Ошибкасохранения меню на модуль: " + error.message);
    }
}

function exportModuleMenu() {
    // Export module menu to JSON file
    if (Object.keys(moduleMenu).length === 0) {
        alert("Нет данных для экспорта");
        return;
    }
    
    const dataStr = JSON.stringify(moduleMenu, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = 'module_menu.json';
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
}

// ADMIN FUNCTIONS
async function loadAdminData() {
    document.getElementById('adminPanel').classList.remove('hidden');
    
    // Load orders
    await loadOrders();
}

async function loadOrders() {
    try {
        const response = await fetch(`${API_BASE}/orders/all`, {
            headers: {
                'Authorization': `Bearer ${currentToken}`
            }
        });
        
        if (response.ok) {
            const orders = await response.json();
            const ordersList = document.getElementById('ordersList');
            
            if (orders.length === 0) {
                ordersList.innerHTML = '<p>Нет заказов</p>';
                return;
            }
            
            let ordersHtml = '';
            orders.forEach(order => {
                ordersHtml += `
                    <div class="order-item">
                        <div>
                            <b>Заказ #${order.id}</b> - Статус: ${order.status}
                            <br><small>Пользователь: ${order.user_email || 'N/A'}</small>
                            <br><small>Дата начала недели: ${order.week_start_date}</small>
                            <br><small>Общая сумма: ${order.total_amount}₽</small>
                        </div>
                        <div>
                            <select id="status-${order.id}">
                                <option value="PENDING" ${order.status === 'PENDING' ? 'selected' : ''}>В ожидании</option>
                                <option value="PAID" ${order.status === 'PAID' ? 'selected' : ''}>Оплачен</option>
                                <option value="PROBLEM" ${order.status === 'PROBLEM' ? 'selected' : ''}>Проблема</option>
                            </select>
                            <button onclick="updateOrderStatus(${order.id})" style="width:auto; margin-top:5px;">Обновить</button>
                        </div>
                    </div>
                `;
            });
            
            ordersList.innerHTML = ordersHtml;
        } else {
            document.getElementById('ordersList').innerHTML = '<p>Ошибка загрузки заказов</p>';
        }
    } catch (error) {
        console.error("Error loading orders:", error);
        document.getElementById('ordersList').innerHTML = '<p>Ошибка загрузки заказов</p>';
    }
}

async function updateOrderStatus(orderId) {
    const newStatus = document.getElementById(`status-${orderId}`).value;
    
    try {
        const response = await fetch(`${API_BASE}/admin/orders/${orderId}/status?status=${newStatus}`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${currentToken}`
            }
        });
        
        if (response.ok) {
            alert("Статус заказа обновлен!");
            loadOrders(); // Refresh the list
        } else {
            const result = await response.json();
            alert(result.detail || "Ошибка обновления статуса заказа");
        }
    } catch (error) {
        alert("Ошибка обновления статуса заказа: " + error.message);
    }
}

function downloadReport() {
    const reportDate = document.getElementById('reportDate').value;
    
    if (!reportDate) {
        alert("Пожалуйста, выберите дату для отчета");
        return;
    }
    
    // In a real app, this would download a DOCX report
    // For now, we'll simulate the download
    window.open(`${API_BASE}/admin/reports/docx?date_query=${reportDate}`, '_blank');
}

//LOGOUT FUNCTION
function logout() {
    localStorage.clear();
    currentToken = null;
    currentRole = null;
    currentUser = null;
    
    // Remove verification section if it exists
    const verificationSection = document.getElementById('verificationSection');
    if (verificationSection) {
        verificationSection.remove();
    }
    
    document.getElementById('dashboardSection').classList.add('hidden');
    document.getElementById('authSection').classList.remove('hidden');
    
    // Show all auth fields again if they were hidden
    document.getElementById('username').classList.remove('hidden');
    document.getElementById('email').classList.remove('hidden');
    document.getElementById('confirmCode').classList.remove('hidden');
    document.getElementById('authBtn').classList.remove('hidden');
    document.getElementById('toggleText').classList.remove('hidden');
    
    // Reset auth form
    document.getElementById('username').value = '';
    document.getElementById('email').value = '';
    document.getElementById('confirmCode').value = '';

    isRegister = false;
    document.getElementById('authTitle').innerText = 'Вход';
    document.getElementById('authBtn').innerText = 'Войти';
    document.getElementById('toggleText').innerText = 'Нет аккаунта? Зарегистрироваться';
    
    // Reset fields to login mode
    document.getElementById('username').classList.add('hidden'); // Login mode hides username
    document.getElementById('confirmCode').classList.remove('hidden'); // Show code field
    document.getElementById('username').placeholder = 'Имя пользователя';
    document.getElementById('email').classList.remove('hidden');
}