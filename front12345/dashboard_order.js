// === ЗАГРУЗКА МЕНЮ ===
async function loadMenuData() {
    const container = document.getElementById('menuContainer');
    if(!container) return;

    container.innerHTML = '<p class="loading-text">Загружаем меню...</p>';

    try {
        // Формируем URL с параметром week_start_date
        const weekStartParam = state.weekStart ? `?week_start_date=${state.weekStart.toISOString().split('T')[0]}` : '';
        const [globalMenuRes, moduleData] = await Promise.all([
            request('/menu', 'GET'),
            request(`/module-menu${weekStartParam}`, 'GET')
        ]);

        // 1. Глобальное меню
        state.globalMenuMap = {};
        const items = Array.isArray(globalMenuRes) ? globalMenuRes : (globalMenuRes.items || []);

        if (items.length === 0) {
            container.innerHTML = '<p style="color: orange">Глобальное меню пусто.</p>';
            return;
        }
        items.forEach(d => state.globalMenuMap[d.id] = d);

        // 2. Расписание
        let tempSchedule = [];
        if (moduleData && Array.isArray(moduleData)) {
            // Преобразуем массив объектов {dish_id, day_of_week} в структуру {day_of_week, dish_ids: []}
            const scheduleByDay = {};
            moduleData.forEach(item => {
                const day = item.day_of_week;
                if (!scheduleByDay[day]) scheduleByDay[day] = [];
                scheduleByDay[day].push(item.dish_id);
            });
            tempSchedule = Object.keys(scheduleByDay).map(day => ({
                day_of_week: parseInt(day),
                dish_ids: scheduleByDay[day]
            }));
        } else if (moduleData && moduleData.schedule) {
            tempSchedule = moduleData.schedule;
        }

        // FALLBACK: Если расписание пустое ничего не показываем
        if (tempSchedule.length === 0) {
            console.warn("Расписание пустое! Показываем все блюда.");
            container.innerHTML = '<p style="color: orange">Модульное меню пусто.</p>';
            return;
            //const allDishIds = Object.keys(state.globalMenuMap).map(id => parseInt(id));
            //for (let day = 0; day <= 6; day++) {
            //    tempSchedule.push({ day_of_week: day, dish_ids: allDishIds });
            // }
        }

        state.schedule = tempSchedule;
        console.log(state.schedule)
        renderMenu();

    } catch (e) {
        container.innerHTML = `<p style="color:red">Ошибка: ${e.message}</p>`;
    }
}

// === ОТРИСОВКА ===
function renderMenu() {
    const container = document.getElementById('menuContainer');
    container.innerHTML = '';

    if (!state.schedule || state.schedule.length === 0) {
        container.innerHTML = '<p>Меню полностью пусто.</p>';
        return;
    }

    const sortedSchedule = [...state.schedule].sort((a, b) => a.day_of_week - b.day_of_week);

    sortedSchedule.forEach(dayEntry => {
        const dayIdx = dayEntry.day_of_week;
        const dishIds = dayEntry.dish_ids || [];

        const dayDishes = dishIds
            .map(id => state.globalMenuMap[id])
            .filter(dish => dish !== undefined);

        if (dayDishes.length === 0) return;

        const dayCard = document.createElement('div');
        dayCard.className = 'day-card';
        dayCard.innerHTML = `<div class="day-header">${DAYS_NAMES[dayIdx] || 'День ' + dayIdx}</div>`;

        const content = document.createElement('div');
        content.className = 'day-content';

        const groups = {};
        dayDishes.forEach(dish => {
            const type = dish.type || 'OTHER';
            if (!groups[type]) groups[type] = [];
            groups[type].push(dish);
        });

        TYPE_ORDER.forEach(typeKey => {
            if (!groups[typeKey]) return;
            renderCategory(typeKey, groups[typeKey], content, dayIdx);
            delete groups[typeKey];
        });

        Object.keys(groups).forEach(typeKey => {
            renderCategory(typeKey, groups[typeKey], content, dayIdx);
        });

        dayCard.appendChild(content);
        container.appendChild(dayCard);
    });
}

function renderCategory(typeKey, dishes, container, dayIdx) {
    const catHeader = document.createElement('div');
    catHeader.className = 'dish-category-title';
    catHeader.innerText = DISH_TYPES[typeKey] || typeKey;
    container.appendChild(catHeader);

    dishes.forEach(dish => {
        const dishEl = document.createElement('div');
        dishEl.className = 'dish-card';
        if (state.selections[dayIdx] && state.selections[dayIdx][dish.id]) {
            dishEl.classList.add('selected');
        }

        const comp = dish.composition
            ? dish.composition.slice(0, 45) + (dish.composition.length > 45 ? '...' : '')
            : 'Состав не указан';

        dishEl.innerHTML = `
            <div class="dish-info-block">
                <span class="dish-name">${dish.name}</span>
                <span class="dish-meta" title="${dish.composition || ''}">${dish.quantity_grams}г • ${comp}</span>
                <span class="dish-source" style="font-size:0.7rem; color:${dish.is_provider ? 'var(--accent-blue)' : 'var(--accent-green)'};">${dish.is_provider ? 'Поставщик' : 'Собственное'}</span>
            </div>
            <div class="dish-price">${dish.price_rub} ₽</div>
        `;
        dishEl.onclick = () => toggleDish(dayIdx, dish, dishEl);
        container.appendChild(dishEl);
    });
}

// === ЛОГИКА КОРЗИНЫ ===
function toggleDish(day, dish, element) {
    if (!state.selections[day]) state.selections[day] = {};

    if (state.selections[day][dish.id]) {
        delete state.selections[day][dish.id];
        element.classList.remove('selected');
        if (Object.keys(state.selections[day]).length === 0) delete state.selections[day];
    } else {
        state.selections[day][dish.id] = dish;
        element.classList.add('selected');
    }
    updateFooter();
}

function updateFooter() {
    let count = 0;
    let total = 0;
    for (let day in state.selections) {
        for (let id in state.selections[day]) {
            count++;
            total += state.selections[day][id].price_rub;
        }
    }
    const countEl = document.getElementById('countDisplay');
    const totalEl = document.getElementById('totalDisplay');
    const bar = document.getElementById('orderSummary');

    if(countEl) countEl.innerText = count;
    if(totalEl) totalEl.innerText = total;

    if(bar) {
        if (count > 0) bar.classList.add('visible');
        else bar.classList.remove('visible');
    }
}

// === ОТПРАВКА ЗАКАЗА ===
async function submitOrder() {
    if (!state.weekStart) return alert("Не выбрана дата");

    const btn = document.getElementById('submitOrderBtn');
    btn.disabled = true;
    btn.innerText = "Отправка...";

    try {
        const daysPayload = [];
        for (const dayStr in state.selections) {
            const dayInt = parseInt(dayStr, 10);
            const itemIds = Object.keys(state.selections[dayStr]).map(Number);

            if (itemIds.length > 0) {
                // Исправленный формат для сервера
                const itemsObjects = itemIds.map(id => ({
                    dish_id: id,
                    quantity: 1
                }));

                daysPayload.push({
                    day_of_week: dayInt,
                    items: itemsObjects
                });
            }
        }

        if (daysPayload.length === 0) throw new Error("Корзина пуста");

        await request('/orders', 'POST', {
            week_start_date: state.weekStart.toISOString().split('T')[0],
            days: daysPayload
        });

        alert('Заказ принят! 🎉');
        state.selections = {};
        updateFooter();
        renderMenu(); // Перерисовка снимает выделения
        switchTab('history');

    } catch (e) {
        alert(e.message);
    } finally {
        btn.disabled = false;
        btn.innerText = "Оформить заказ";
    }
}