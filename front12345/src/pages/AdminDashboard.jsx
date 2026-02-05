import React, { useState, useEffect } from 'react';
import api, { API_URL } from '../api';
// Добавьте эту функцию в src/pages/AdminDashboard.jsx после импортов
const downloadFile = async (url, filename) => {
    try {
        const response = await api.get(url, { responseType: 'blob' });
        const href = window.URL.createObjectURL(response.data);
        const link = document.createElement('a');
        link.href = href;
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(href);
    } catch (e) {
        console.error(e);
        alert("Ошибка скачивания файла. Проверьте авторизацию или права доступа.");
    }
};
const AdminDashboard = () => {
    const [tab, setTab] = useState('menu'); // 'menu', 'module', 'orders'

    return (
        <div>
            <h1 className="text-3xl font-bold mb-6">Административная панель</h1>
            <div className="flex gap-2 mb-6 border-b">
                <button onClick={() => setTab('menu')} className={`px-4 py-2 ${tab==='menu' ? 'border-b-2 border-blue-600 text-blue-600' : ''}`}>Глобальное меню</button>
                <button onClick={() => setTab('module')} className={`px-4 py-2 ${tab==='module' ? 'border-b-2 border-blue-600 text-blue-600' : ''}`}>Меню на модуль</button>
                <button onClick={() => setTab('orders')} className={`px-4 py-2 ${tab==='orders' ? 'border-b-2 border-blue-600 text-blue-600' : ''}`}>Заказы и отчеты</button>
            </div>

            {tab === 'menu' && <GlobalMenuTab />}
            {tab === 'module' && <ModuleMenuTab />}
            {tab === 'orders' && <OrdersTab />}
        </div>
    );
};

// 1. Вкладка Глобальное меню (Загрузка файла)
const GlobalMenuTab = () => {
    const [file, setFile] = useState(null);
    const [isProvider, setIsProvider] = useState(true);

    const handleUpload = async () => {
        if(!file) return;
        const formData = new FormData();
        formData.append('file', file);
        try {
            await api.post(`/menu/upload?is_provider=${isProvider}`, formData);
            alert("Меню обновлено успешно");
        } catch (e) {
            alert("Ошибка: " + e.response?.data?.detail);
        }
    };

    return (
        <div className="bg-white p-6 rounded shadow">
            <h3 className="text-xl font-bold mb-4">Загрузка меню</h3>
            <div className="flex gap-4 mb-4">
                <label className="flex items-center gap-2">
                    <input type="radio" checked={isProvider} onChange={() => setIsProvider(true)} /> Меню поставщика
                </label>
                <label className="flex items-center gap-2">
                    <input type="radio" checked={!isProvider} onChange={() => setIsProvider(false)} /> Собственное меню
                </label>
            </div>
            <input type="file" onChange={e => setFile(e.target.files[0])} className="border p-2 rounded mb-4 w-full" />
            <button onClick={handleUpload} className="bg-blue-600 text-white px-4 py-2 rounded">Загрузить</button>
        </div>
    );
};

// 2. Вкладка Меню Модуля (Конструктор по дням)
const ModuleMenuTab = () => {
    const [dishes, setDishes] = useState([]);
    const [schedule, setSchedule] = useState(Array(6).fill([])); // [ [id, id], ... ]

    useEffect(() => {
        api.get('/menu').then(res => setDishes(res.data));
    }, []);

    const toggleDish = (day, dishId) => {
        const currentDayDishes = schedule[day];
        if (currentDayDishes.includes(dishId)) {
            const newDay = currentDayDishes.filter(id => id !== dishId);
            const newSchedule = [...schedule];
            newSchedule[day] = newDay;
            setSchedule(newSchedule);
        } else {
            // Проверка на ограничение (макс 2 типа) - упрощенно, лучше валидировать типы
            const newSchedule = [...schedule];
            newSchedule[day] = [...currentDayDishes, dishId];
            setSchedule(newSchedule);
        }
    };

    const saveMenu = async () => {
        const payload = {
            schedule: schedule.map((ids, idx) => ({
                day_of_week: idx,
                dish_ids: ids
            }))
        };
        try {
            await api.post('/module-menu', payload);
            alert("Меню модуля сохранено");
        } catch (e) {
            alert("Ошибка: " + e.response?.data?.detail);
        }
    };

    return (
        <div>
            <div className="flex justify-between mb-4">
                <h3 className="text-xl font-bold">Конструктор меню</h3>
                <div className="flex gap-2">
                    <button
                        onClick={() => downloadFile('/module-menu/export', 'module_menu.csv')}
                        className="bg-green-600 text-white px-3 py-2 rounded"
                    >
                        Скачать CSV
                    </button>
                    <button onClick={saveMenu} className="bg-blue-600 text-white px-3 py-2 rounded">Сохранить</button>
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб"].map((day, idx) => (
                    <div key={idx} className="bg-white p-3 rounded shadow h-96 overflow-y-auto">
                        <h4 className="font-bold border-b mb-2">{day}</h4>
                        {dishes.map(dish => (
                            <label key={dish.id} className="flex items-center gap-2 mb-1 text-sm">
                                <input
                                    type="checkbox"
                                    checked={schedule[idx].includes(dish.id)}
                                    onChange={() => toggleDish(idx, dish.id)}
                                />
                                <span className={schedule[idx].includes(dish.id) ? "font-bold text-blue-600" : ""}>
                                    {dish.name} ({dish.type})
                                </span>
                            </label>
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
};

// 3. Вкладка Заказы (для подтверждения)
const OrdersTab = () => {
    // В реальном проекте здесь список заказов с фильтрацией
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

    return (
        <div className="bg-white p-6 rounded shadow">
             <h3 className="text-xl font-bold mb-4">Отчеты и Заказы</h3>

             <div className="mb-6 border-b pb-4">
                 <h4 className="font-bold mb-2">Генерация отчетов</h4>
                 <div className="flex gap-4 items-center">
                     <input type="date" value={date} onChange={e => setDate(e.target.value)} className="border p-2 rounded" />
                     <button
                        onClick={() => downloadFile(`/admin/reports/docx?date_query=${date}`, `Report_${date}.docx`)}
                        className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
                    >
                       Скачать отчет (DOCX)
                    </button>
                 </div>
             </div>

             <div>
                 <h4 className="font-bold mb-2">Проверка оплат (Демо)</h4>
                 <p className="text-gray-500 text-sm">Здесь должен быть список заказов со статусом PENDING. Для подтверждения нужно реализовать список заказов в API для админа.</p>
                 {/* Реализация списка требует endpoint GET /admin/orders, которого нет в main.py, но есть логика обновления статуса. */}
                 <div className="mt-4 p-4 border rounded bg-gray-50">
                     <p>Введите ID заказа для подтверждения вручную:</p>
                     <OrderAction />
                 </div>
             </div>
        </div>
    );
};

const OrderAction = () => {
    const [id, setId] = useState('');

    const setStatus = async (status) => {
        try {
            await api.patch(`/admin/orders/${id}/status?status=${status}`);
            alert(`Заказ ${id}: ${status}`);
        } catch(e) { alert("Ошибка"); }
    };

    return (
        <div className="flex gap-2 mt-2">
            <input placeholder="ID заказа" value={id} onChange={e => setId(e.target.value)} className="border p-1" />
            <button onClick={() => setStatus('PAID')} className="bg-green-500 text-white px-2 rounded">Оплачено</button>
            <button onClick={() => setStatus('PROBLEM')} className="bg-red-500 text-white px-2 rounded">Проблема</button>
        </div>
    );
}

export default AdminDashboard;
