// === ЛОГИКА ИСТОРИИ ЗАКАЗОВ ===

async function loadHistory() {
    const list = document.getElementById('ordersList');
    if(!list) return;
    list.innerHTML = '<p class="loading-text">Загрузка истории...</p>';
    
    try {
        // GET /orders - Получаем список заказов пользователя
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
                    <th>Дата</th>
                    <th>Статус</th>
                    <th>Сумма</th>
                    <th>Действия</th>
                </tr>
            </thead>
            <tbody>`;
            
        // Сортировка: новые сверху
        orders.sort((a,b) => new Date(b.created_at) - new Date(a.created_at));

        orders.forEach(o => {
            const date = new Date(o.created_at).toLocaleDateString('ru-RU', {
                day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit'
            });

            // Определяем цвета и текст статусов
            const statusMap = { 
                'PAID': { text: 'Оплачено', class: 'status-paid' }, 
                'PENDING': { text: 'Ожидает оплаты', class: 'status-pending' }, 
                'CANCELED': { text: 'Отменен', class: 'status-canceled' },
                'ON_REVIEW': { text: 'Проверка чека', class: 'status-pending' } // Если есть такой статус
            };
            
            const st = statusMap[o.status] || { text: o.status, class: '' };
            if (!st.text) {
                console.warn(`Неизвестный текст статуса заказа ${o.id}: ${st.text} (${o.status})`);
                st.text = o.status;
            }
            if (!st.class) {
                console.warn(`Неизвестный класс статуса заказа ${o.id}: ${st.class} (${o.status})`);
                st.class = '';
            }
            // Генерируем кнопки действий в зависимости от статуса
            let actionHtml = '';
            
            if (o.status === 'PENDING') {
                // Если ожидается оплата - кнопка ЗАГРУЗКИ чека
                // Используем label как кнопку для скрытого input file
                actionHtml = `
                    <label class="btn-upload" title="Загрузить подтверждение оплаты">
                        📎 Прикрепить чек
                        <input type="file" 
                               accept="image/*,application/pdf" 
                               onchange="uploadPaymentProof(${o.id}, this)" 
                               hidden>
                    </label>
                `;
            } else if (o.status === 'PAID') {
                // Если оплачено - кнопка СКАЧИВАНИЯ чека
                actionHtml = `
                    <button onclick="downloadReceipt(${o.id})" class="btn-secondary">
                        📄 Скачать чек
                    </button>
                `;
            } else {
                actionHtml = `<span class="text-muted">-</span>`;
            }
            
            html += `
            <tr>
                <td>#${o.id}</td>
                <td>${date}</td>
                <td><span class="status-badge ${st.class}">${st.text}</span></td>
                <td><strong>${o.total_amount} ₽</strong></td>
                <td>${actionHtml}</td>
            </tr>`;
        });

        html += '</tbody></table>';
        list.innerHTML = html;

    } catch (e) {
        console.error(e);
        list.innerHTML = `<div style="color:red; padding:10px; border:1px solid red; border-radius:8px;">
            Ошибка загрузки истории: ${e.message}
        </div>`;
    }
}

// === ФУНКЦИЯ ЗАГРУЗКИ ЧЕКА (Upload) ===
async function uploadPaymentProof(orderId, inputElement) {
    const file = inputElement.files[0];
    if (!file) return;

    // Подтверждение действия
    if (!confirm(`Загрузить файл "${file.name}" как подтверждение оплаты для заказа #${orderId}?`)) {
        inputElement.value = ''; // Сброс выбора
        return;
    }

    // Показываем индикатор загрузки (меняем текст лейбла)
    const label = inputElement.parentElement;
    const originalText = label.innerText;
    label.innerText = "⏳ Загрузка...";
    label.style.pointerEvents = "none"; // Блокируем клики

    try {
        const formData = new FormData();
        formData.append('file', file); // Важно: имя поля должно совпадать со Swagger ('file')

        // POST /orders/{id}/pay
        // Функция request в dashboard_core.js сама определит FormData и уберет Content-Type JSON
        await request(`/orders/${orderId}/pay`, 'POST', formData);

        alert("Чек успешно загружен! Статус заказа обновится после проверки.");
        loadHistory(); // Перезагружаем таблицу

    } catch (e) {
        alert("Ошибка загрузки чека: " + e.message);
        label.innerText = "📎 Прикрепить чек"; // Возвращаем текст
        label.style.pointerEvents = "auto";
        inputElement.value = '';
    }
}

// === ФУНКЦИЯ СКАЧИВАНИЯ ЧЕКА (Download) ===
async function downloadReceipt(orderId) {
    try {
        const token = localStorage.getItem('token');
        // GET /orders/{id}/receipt
        const res = await fetch(`${API_URL}/orders/${orderId}/receipt`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || "Не удалось скачать файл");
        }

        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `receipt_order_${orderId}.pdf`; // Имя файла
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url); // Чистим память

    } catch (e) {
        alert(e.message);
    }
}