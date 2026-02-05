import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { CheckCircle, AlertCircle, Clock } from 'lucide-react';

const StatusIcon = ({ status }) => {
    switch (status) {
        case 'PAID': return <CheckCircle className="text-green-500" />;
        case 'PROBLEM': return <AlertCircle className="text-red-500" />;
        default: return <Clock className="text-yellow-500" />;
    }
};

export default function UserDashboard() {
    const [orders, setOrders] = useState([]);

    useEffect(() => {
        api.get('/orders').then(res => setOrders(res.data));
    }, []);

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">История заказов</h1>
                <Link to="/new-order" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
                    + Новый заказ
                </Link>
            </div>

            <div className="grid gap-4">
                {orders.map(order => (
                    <Link to={`/order/${order.id}`} key={order.id} className="block bg-white p-4 rounded shadow hover:shadow-md transition">
                        <div className="flex justify-between items-center">
                            <div>
                                <p className="font-bold">Заказ #{order.id}</p>
                                <p className="text-sm text-gray-500">Неделя с {order.week_start_date}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="font-bold">{order.total_amount} ₽</span>
                                <StatusIcon status={order.status} />
                            </div>
                        </div>
                    </Link>
                ))}
                {orders.length === 0 && <p className="text-center text-gray-500">У вас пока нет заказов</p>}
            </div>
        </div>
    );
}