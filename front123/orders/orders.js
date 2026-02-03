// Orders-specific functionality
try {
    API_BASE = "http://localhost:8000";
} catch (e) {
    console.error("Error initializing API_BASE:", e);
}
async function loadMyOrders() {
    try {
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

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
    }
}

async function confirmPayment() {
    const orderId = 1; // In a real app, this would come from the created order
    const paymentProof = document.getElementById('paymentProof').files[0];
    
    if (!paymentProof) {
        alert("Пожалуйста, прикрепите подтверждение оплаты");
        return;
    }
    
    try {
        // Create FormData for file upload
        const formData = new FormData();
        formData.append('file', paymentProof);
        
        const response = await fetch(`${window.API_BASE}/orders/1/pay`, {
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
            alert("Ошибка подтверждения оплаты");
        }
    } catch (error) {
        alert("Ошибка отправки подтверждения оплаты: " + error.message);
    }
}

function adjustQuantity(dayIndex, dishId, change) {
    const qtyInput = document.getElementById(`qty-${dayIndex}-${dishId}`);
    if (!qtyInput) return;
    
    let newValue = parseInt(qtyInput.value) + change;
    
    if (newValue < 0) newValue = 0;
    
    qtyInput.value = newValue;
}

function updateDayTotal(dayIndex) {
    // This function would update the day total
}