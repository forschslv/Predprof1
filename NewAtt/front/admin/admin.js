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