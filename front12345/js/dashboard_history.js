// === ЛОГИКА ИСТОРИИ ЗАКАЗОВ ===

async function loadHistory() {
    const list = document.getElementById('ordersList');
    if (!list) return;
    list.innerHTML = '<p class="loading-text">Загрузка истории...</p>';

    try {
        // GET /orders - Получаем список заказов
        const orders = await request('/orders', 'GET');

        if (!orders || !orders.length) {
            list.innerHTML = '<p>История заказов пуста</p>';
            return;
        }

        let html = `
        <table class="history-table">
            <thead>
                <tr>
                    <th>№</th>
                    <th>Неделя (Дата)</th>
                    <th>Статус</th>
                    <th>Сумма</th>
                    <th>Действия</th>
                </tr>
            </thead>
            <tbody>`;

        // Сортировка: Сначала по дате недели (новые сверху), потом по ID
        orders.sort((a, b) => {
            return (a.id - b.id);
        });

        // Используем map + Promise.all для параллельной проверки всех чеков
        const rowPromises = orders.map(async (o) => {
            // 1. Форматирование даты
            let dateDisplay = "—";
            if (o.week_start_date) {
                const d = new Date(o.week_start_date);
                dateDisplay = d.toLocaleDateString('ru-RU', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                });
            } else if (o.created_at) {
                dateDisplay = new Date(o.created_at).toLocaleDateString('ru-RU');
            }

            // 2. Статусы
            const statusMap = {
                'PAID': { text: 'Оплачено', class: 'status-paid' },
                'PENDING': { text: 'Ожидает оплаты', class: 'status-pending' },
                'PROBLEM': { text: 'Проблема', class: 'status-pending' },
                'CANCELED': { text: 'Отменен', class: 'status-canceled' },
                'ON_REVIEW': { text: 'На проверке', class: 'status-pending' }
            };
            const st = statusMap[o.status] || { text: o.status, class: '' };

            // 3. Логика кнопок (Асинхронная часть)
            let actionHtml = '';

            if (o.status === 'PENDING') {
                actionHtml = `
                    <label class="btn-upload" title="Загрузить скриншот оплаты">
                        📎 Прикрепить чек оплаты
                        <input type="file" 
                               accept="image/*,application/pdf" 
                               onchange="uploadPaymentProof(${o.id}, this)" 
                               hidden>
                    </label>
                    <button onclick="chargeFromBalance(${o.id})" class="btn-secondary" style="margin-left:8px;">
                        💳 Списать со счёта
                    </button>
                `;
            } else if (o.status === 'PAID' || o.status === 'ON_REVIEW') {
                // Асинхронная проверка наличия файла
                const url = `${API_URL}/orders/${o.id}/receipt`;
                const allowed = await checkAvailability(url);

                if (!allowed) {
                    actionHtml = `<span class="text-muted">Скачивание недоступно</span>`;
                } else {
                    actionHtml = `
                    <button onclick="downloadReceipt(${o.id})" class="btn-secondary">
                        📄 Скачать
                    </button>
                    `;
                }
            } else if (o.status === 'CANCELED') {
                actionHtml = `<span class="text-muted">-</span>`;
            } else {
                console.warn(`Неизвестный статус заказа #${o.id}: ${o.status}`);
                actionHtml = `<span class="text-muted">error</span>`;
            }

            // Возвращаем HTML одной строки
            return `
            <tr>
                <td>#${o.id}</td>
                <td>${dateDisplay}</td>
                <td><span class="status-badge ${st.class}">${st.text}</span></td>
                <td><strong>${o.total_amount} ₽</strong></td>
                <td>${actionHtml}</td>
            </tr>`;
        });

        // Ждем выполнения всех асинхронных операций
        const rows = await Promise.all(rowPromises);

        // Собираем таблицу
        html += rows.join('');
        html += '</tbody></table>';
        list.innerHTML = html;

    } catch (e) {
        console.error(e);
        list.innerHTML = `<div style="color:red; padding:10px; border:1px solid red; border-radius:8px;">
            Ошибка: ${e.message}
        </div>`;
    }
}

// === ФУНКЦИЯ ЗАГРУЗКИ ЧЕКА ===
async function uploadPaymentProof(orderId, inputElement) {
    const file = inputElement.files[0];
    if (!file) return;

    if (!confirm(`Загрузить файл "${file.name}" для заказа #${orderId}?`)) {
        inputElement.value = '';
        return;
    }

    const label = inputElement.parentElement;
    label.innerText = "⏳ ...";
    label.style.pointerEvents = "none";

    try {
        const formData = new FormData();
        formData.append('file', file);

        // Endpoint для загрузки оплаты (убедись, что он совпадает с бэкендом)
        await request(`/orders/${orderId}/pay`, 'POST', formData);

        alert("Чек загружен! Ожидайте подтверждения.");
        loadHistory();

    } catch (e) {
        alert("Ошибка: " + e.message);
        label.innerText = "📎 Чек";
        label.style.pointerEvents = "auto";
        inputElement.value = '';
    }
}

// === НОВАЯ ФУНКЦИЯ: Списание со счёта ===
async function chargeFromBalance(orderId) {
    if (!confirm(`Списать оплату заказа #${orderId} с баланса?`)) return;
    try {
        const res = await request(`/orders/${orderId}/charge`, 'POST');
        alert(res.message || 'Оплата успешно проведена');
        // Обновим историю и профиль (баланс может измениться)
        if (typeof loadHistory === 'function') loadHistory();
        // Попробуем обновить профиль-данные в state, чтобы показать новый баланс
        if (typeof window !== 'undefined' && window.state && window.request) {
            try {
                const updatedUser = await request('/users/me', 'GET');
                window.state.user = updatedUser;
                const balEl = document.getElementById('balanceAmount');
                if (balEl) balEl.innerText = `${(updatedUser.balance || 0).toFixed(2)} ₽`;
            } catch (e) {
                // Игнорируем ошибку обновления баланса
                console.warn('Не удалось обновить профиль после списания:', e);
            }
        }
    } catch (e) {
        alert('Ошибка: ' + e.message);
    }
}

// === ФУНКЦИЯ СКАЧИВАНИЯ ЧЕКА ===
async function downloadReceipt(orderId) {
    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_URL}/orders/${orderId}/receipt`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || "Ошибка скачивания");
        }

        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `receipt_${orderId}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);

    } catch (e) {
        alert(e.message);
    }
}