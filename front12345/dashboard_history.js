async function loadHistory() {
    const list = document.getElementById('ordersList');
    if(!list) return;
    list.innerHTML = 'Загрузка...';

    try {
        // Исправленный маршрут: /orders (вместо /orders/me)
        const orders = await request('/orders', 'GET');

        if (!orders || !orders.length) {
            list.innerHTML = '<p>История заказов пуста</p>';
            return;
        }

        let html = `<table class="history-table">
            <thead><tr><th>Дата</th><th>Статус</th><th>Сумма</th><th>Чек</th></tr></thead><tbody>`;

        orders.sort((a,b) => new Date(b.created_at) - new Date(a.created_at));

        orders.forEach(o => {
            const d = new Date(o.created_at).toLocaleDateString('ru-RU');
            const statusMap = { 'PAID': 'Оплачено', 'PENDING': 'Ожидает оплаты', 'CANCELED': 'Отмена' };
            const statusClass = o.status === 'PAID' ? 'status-paid' : 'status-pending';

            html += `<tr>
                <td>${d}</td>
                <td><span class="${statusClass}">${statusMap[o.status] || o.status}</span></td>
                <td>${o.total_amount} ₽</td>
                <td><button onclick="downloadReceipt(${o.id})" class="btn-secondary" style="font-size:0.8em">Скачать</button></td>
            </tr>`;
        });
        html += '</tbody></table>';
        list.innerHTML = html;
    } catch (e) {
        console.error(e);
        if (e.message.includes('404')) {
             list.innerHTML = `<span style="color:red">Ошибка: маршрут /orders не найден.</span>`;
        } else {
             list.innerHTML = `<span style="color:red">Ошибка загрузки истории: ${e.message}</span>`;
        }
    }
}

async function downloadReceipt(orderId) {
    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_URL}/orders/${orderId}/receipt`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error("Ошибка скачивания");
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `receipt_${orderId}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
    } catch (e) { alert(e.message); }
}
