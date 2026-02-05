import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api';

export default function OrderDetails() {
    const { id } = useParams();
    const [order, setOrder] = useState(null);
    const [items, setItems] = useState([]); // Нужно бы вытянуть детали заказа, но backend endpoint /orders/{id} возвращает только Order model, не items.
    // Внимание: В предоставленном main.py endpoint `get_order_details` возвращает объект `Order`, но SQLAlchemy отношение `items` не подгружается в Pydantic схему `OrderResponse` по умолчанию, если оно не указано.
    // Исходя из кода backend, OrderResponse содержит только id, status, total, date.
    // Предположим, что мы доработали бэк или используем report логику. 
    // Для демонстрации реализуем загрузку и оплату.
    
    const [file, setFile] = useState(null);

    useEffect(() => {
        api.get(`/orders/${id}`).then(res => setOrder(res.data));
    }, [id]);

    const handleUpload = async (e) => {
        e.preventDefault();
        if(!file) return;

        const formData = new FormData();
        formData.append('file', file);

        try {
            await api.post(`/orders/${id}/pay`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            alert("Чек загружен!");
            window.location.reload();
        } catch (e) {
            alert("Ошибка загрузки");
        }
    };

    if (!order) return <div>Loading...</div>;

    return (
        <div className="max-w-2xl mx-auto bg-white p-6 rounded shadow">
            <h1 className="text-2xl font-bold mb-4">Заказ #{order.id}</h1>
            <p>Статус: <span className="font-bold">{order.status}</span></p>
            <p className="text-xl mt-2 mb-6">К оплате: <span className="font-bold text-blue-600">{order.total_amount} ₽</span></p>

            {/* Реквизиты (хардкод из ТЗ подразумевается) */}
            <div className="bg-gray-100 p-4 rounded mb-6">
                <h3 className="font-bold">Реквизиты для оплаты:</h3>
                <p>Сбербанк: 0000 0000 0000 0000</p>
                <p>Получатель: Лицей №2</p>
            </div>

            {order.status !== 'PAID' && (
                <form onSubmit={handleUpload} className="border-t pt-4">
                    <label className="block mb-2 font-medium">Загрузить подтверждение (Скриншот/PDF):</label>
                    <input type="file" onChange={e => setFile(e.target.files[0])} className="mb-4" />
                    <button type="submit" disabled={!file} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50">
                        Подтверждаю оплату
                    </button>
                </form>
            )}
        </div>
    );
}
