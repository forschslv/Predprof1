import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

const DAYS = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"];

export default function NewOrder() {
    const [moduleMenu, setModuleMenu] = useState([]);
    const [globalDishes, setGlobalDishes] = useState({});
    const [selections, setSelections] = useState({}); // { dayIndex: { dishId: quantity } }
    const [weekStart, setWeekStart] = useState("");
    const navigate = useNavigate();

    useEffect(() => {
        // Загружаем глобальное меню для названий и цен
        api.get('/menu').then(res => {
            const map = {};
            res.data.forEach(d => map[d.id] = d);
            setGlobalDishes(map);
        });

        // Загружаем меню модуля
        api.get('/module-menu').then(res => {
            setModuleMenu(res.data);
        });

        // Вычисляем следующий понедельник
        const d = new Date();
        d.setDate(d.getDate() + (1 + 7 - d.getDay()) % 7); // Next Monday
        setWeekStart(d.toISOString().split('T')[0]);
    }, []);

    const handleQuantityChange = (dayIdx, dishId, delta) => {
        setSelections(prev => {
            const daySel = prev[dayIdx] || {};
            const currentQty = daySel[dishId] || 0;
            const newQty = Math.max(0, currentQty + delta);

            return {
                ...prev,
                [dayIdx]: { ...daySel, [dishId]: newQty }
            };
        });
    };

    const calculateTotal = () => {
        let total = 0;
        Object.entries(selections).forEach(([_, dayItems]) => {
            Object.entries(dayItems).forEach(([dishId, qty]) => {
                const dish = globalDishes[dishId];
                if (dish) total += dish.price_rub * qty;
            });
        });
        return total;
    };

    const submitOrder = async () => {
        const orderData = {
            week_start_date: weekStart,
            days: Object.entries(selections).map(([dayIdx, items]) => ({
                day_of_week: parseInt(dayIdx),
                items: Object.entries(items).map(([dId, q]) => ({
                    dish_id: parseInt(dId),
                    quantity: q
                })).filter(i => i.quantity > 0)
            }))
        };

        try {
            const res = await api.post('/orders', orderData);
            navigate(`/order/${res.data.id}`);
        } catch (e) {
            alert("Ошибка создания заказа");
        }
    };

    // Группировка меню по дням
    const menuByDay = Array(6).fill(null).map(() => []);
    moduleMenu.forEach(item => {
        if (item.day_of_week < 6) menuByDay[item.day_of_week].push(item.dish_id);
    });

    return (
        <div>
            <h1 className="text-2xl font-bold mb-4">Оформление заказа</h1>
            <div className="mb-4">
                <label className="block text-sm font-medium">Дата начала недели:</label>
                <input type="date" value={weekStart} onChange={e => setWeekStart(e.target.value)} className="border p-2 rounded" />
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {DAYS.map((dayName, dayIdx) => (
                    <div key={dayIdx} className="bg-white p-4 rounded shadow border border-gray-200">
                        <h3 className="font-bold text-lg mb-2 text-blue-800 border-b pb-1">{dayName}</h3>
                        <div className="space-y-3">
                            {menuByDay[dayIdx].length === 0 ? <p className="text-gray-400 text-sm">Меню не задано</p> :
                             menuByDay[dayIdx].map(dishId => {
                                 const dish = globalDishes[dishId];
                                 if (!dish) return null;
                                 const qty = selections[dayIdx]?.[dishId] || 0;

                                 return (
                                     <div key={dishId} className="flex justify-between items-center">
                                         <div>
                                             <div className="font-medium">{dish.name}</div>
                                             <div className="text-xs text-gray-500">{dish.price_rub} ₽ | {dish.type}</div>
                                         </div>
                                         <div className="flex items-center gap-2">
                                             <button onClick={() => handleQuantityChange(dayIdx, dishId, -1)} className="w-6 h-6 bg-gray-200 rounded text-center font-bold">-</button>
                                             <span className={`w-6 text-center ${qty > 0 ? 'font-bold' : ''}`}>{qty}</span>
                                             <button onClick={() => handleQuantityChange(dayIdx, dishId, 1)} className="w-6 h-6 bg-blue-100 text-blue-600 rounded text-center font-bold">+</button>
                                         </div>
                                     </div>
                                 );
                             })
                            }
                        </div>
                    </div>
                ))}
            </div>

            <div className="fixed bottom-0 left-0 right-0 bg-white p-4 border-t shadow-lg flex justify-between items-center container mx-auto">
                <div className="text-xl font-bold">Итого: {calculateTotal()} ₽</div>
                <button onClick={submitOrder} className="bg-green-600 text-white px-6 py-2 rounded text-lg font-bold hover:bg-green-700">
                    Подтвердить заказ
                </button>
            </div>
            <div className="h-20"></div> {/* Spacer for fixed footer */}
        </div>
    );
}
