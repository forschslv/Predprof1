// Cook-specific functionality

async function loadCookData() {
    const cookPanel = document.getElementById('cookPanel');
    if (cookPanel) cookPanel.classList.remove('hidden');
    
    // Load global menu
    await loadGlobalMenu();
}

async function loadGlobalMenu() {
    try {
        const response = await fetch(`${window.API_BASE}/menu`, {
            headers: {
                'Authorization': `Bearer ${window.currentToken}`
            }
        });
        
        if (response.ok) {
            window.globalMenu = await response.json();
            displayDishes(window.globalMenu);
        } else {
            window.globalMenu = [];
            displayDishes([]);
        }
    } catch (error) {
        console.error("Error loading global menu:", error);
        window.globalMenu = [];
        displayDishes([]);
    }
}

function displayDishes(dishes) {
    const dishesList = document.getElementById('dishesList');
    
    if (!dishesList) return;
    
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
                    <button type="button" onclick="editDish(${dish.id})" style="width:auto; margin-top: 5px;">Изменить</button>
                    <button type="button" onclick="deleteDish(${dish.id})" class="danger" style="width:auto; margin-top: 5px;">Удалить</button>
                </div>
            </div>
        `;
    });
    
    dishesList.innerHTML = dishesHtml;
}

function filterDishes() {
    const filterValue = document.getElementById('dishTypeFilter').value;
    
    if (!filterValue) {
        displayDishes(window.globalMenu);
    } else {
       const filteredDishes = window.globalMenu.filter(dish => dish.type === filterValue);
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
        alert("Пожалуйста, заполните все обязательные поля");
        return;
    }
    
    try {
        const response = await fetch(`${window.API_BASE}/menu/dish`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${window.currentToken}`
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
            loadGlobalMenu(); // Refresh the list
            // Clear form
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
        const response = await fetch(`${window.API_BASE}/menu/dish/${dishId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${window.currentToken}`
            }
        });
        
        if (response.ok) {
            alert("Блюдо успешно удалено!");
            loadGlobalMenu(); // Refresh the list
        } else {
            const result = await response.json();
            alert(result.detail || "Ошибка удаления блюда");
        }
    } catch (error) {
        alert("Ошибка удаления блюда: " + error.message);
    }
}

function uploadMenuFile(isProvider) {
    // In a real app, this would open a file upload dialog
    alert(`Загрузка ${isProvider ? 'меню поставщика' : 'собственного меню'} из файла (функция в разработке)\nПараметр is_provider: ${isProvider}`);
}

async function loadDishesForDay() {
    const dayOfWeek = document.getElementById('dayOfWeekSelect').value;
    
    try {
        const response = await fetch(`${window.API_BASE}/menu`, {
            headers: {
                'Authorization': `Bearer ${window.currentToken}`
            }
        });
        
        if (response.ok) {
            const allDishes = await response.json();
            
            // Group dishes by type
            const dishesByType = {};
            allDishes.forEach(dish => {
                if (!dishesByType[dish.type]) {
                    dishesByType[dish.type] = [];
                }
                dishesByType[dish.type].push(dish);
            });
            
            // Display dish selectors by type
            const dayMenuSetup = document.getElementById('dayMenuSetup');
            if (!dayMenuSetup) return;
            
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
            const dayMenuSetup = document.getElementById('dayMenuSetup');
            if (dayMenuSetup) {
                dayMenuSetup.innerHTML = '<p>Ошибка загрузки блюд</p>';
            }
        }
    } catch (error) {
        console.error("Error loading dishes for day setup:", error);
        const dayMenuSetup = document.getElementById('dayMenuSetup');
        if (dayMenuSetup) {
            dayMenuSetup.innerHTML = '<p>Ошибка загрузки блюд</p>';
        }
    }
}

async function saveModuleMenu() {
    // Collect selected dishes for each day
    // This is a simplified version - in a real app we would collect actual selections
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
        const response = await fetch(`${window.API_BASE}/module-menu`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${window.currentToken}`
            },
            body: JSON.stringify({ schedule })
        });
        
        if (response.ok) {
            alert("Меню на модуль успешно сохранено!");
        } else {
            const result = await response.json();
            alert(result.detail || "Ошибка сохранения меню на модуль");
        }
    } catch (error) {
        alert("Ошибка сохранения меню на модуль: " + error.message);
    }
}

function exportModuleMenu() {
    // Export module menu to JSON file
    if (Object.keys(window.moduleMenu).length === 0) {
        alert("Нет данных для экспорта");
        return;
    }
    
    const dataStr = JSON.stringify(window.moduleMenu, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = 'module_menu.json';
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
}