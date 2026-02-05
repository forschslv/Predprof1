import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

export default function Login() {
    const [formData, setFormData] = useState({ name: '', secondary_name: '', email: '', status: '' });
    const navigate = useNavigate();
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            // В вашем API /register используется и для регистрации, и для входа (отправки кода)
            await api.post('/register', formData);
            // Сохраняем email для следующего шага
            localStorage.setItem('pending_email', formData.email);
            navigate('/verify');
        } catch (err) {
            // Если статус 400 и user exists, просто переходим к вводу кода (код обновляется в backend)
             if (err.response?.status === 400 && err.response?.data?.detail === "User exists") {
                 // Здесь по логике бека код не отправится, если пользователь подтвержден.
                 // Но согласно main.py: if existing: existing.verification_code = code; return "Code resent"
                 // Так что 400 может быть только если email_verified=True.
                 // Для упрощения кейса считаем, что пользователь всегда проходит через этот флоу или ему нужно перелогиниться.
                 alert("Пользователь уже существует и подтвержден. В реальном приложении здесь нужен Login endpoint, но сейчас используем Verify.");
                 localStorage.setItem('pending_email', formData.email);
                 navigate('/verify');
             } else {
                 setError('Ошибка при входе');
             }
        }
    };

    return (
        <div className="max-w-md mx-auto mt-10 bg-white p-6 rounded shadow">
            <h2 className="text-2xl font-bold mb-4">Вход / Регистрация</h2>
            {error && <div className="text-red-500 mb-2">{error}</div>}
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                <input placeholder="Имя" className="border p-2 rounded" required
                       onChange={e => setFormData({...formData, name: e.target.value})} />
                <input placeholder="Фамилия" className="border p-2 rounded" required
                       onChange={e => setFormData({...formData, secondary_name: e.target.value})} />
                <input placeholder="Класс (например, 10А)" className="border p-2 rounded" required
                       onChange={e => setFormData({...formData, status: e.target.value})} />
                <input type="email" placeholder="Email (Лицейский)" className="border p-2 rounded" required
                       onChange={e => setFormData({...formData, email: e.target.value})} />
                <button type="submit" className="bg-blue-600 text-white p-2 rounded hover:bg-blue-700">Получить код</button>
            </form>
        </div>
    );
}
