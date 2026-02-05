import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';

export default function VerifyCode() {
    const [code, setCode] = useState('');
    const navigate = useNavigate();
    const { login } = useAuth();
    const email = localStorage.getItem('pending_email');

    const handleVerify = async (e) => {
        e.preventDefault();
        try {
            const res = await api.post('/verify-code', { email, code });
            login(res.data.access_token, res.data.user);
            navigate('/dashboard');
        } catch (err) {
            alert('Неверный код');
        }
    };

    return (
        <div className="max-w-md mx-auto mt-10 bg-white p-6 rounded shadow">
            <h2 className="text-2xl font-bold mb-4">Введите код из письма</h2>
            <p className="mb-4 text-sm text-gray-600">Код отправлен на {email} (см. консоль бекенда для теста)</p>
            <form onSubmit={handleVerify} className="flex flex-col gap-3">
                <input type="text" placeholder="Код подтверждения" className="border p-2 rounded text-center text-xl tracking-widest"
                       onChange={e => setCode(e.target.value)} />
                <button type="submit" className="bg-green-600 text-white p-2 rounded hover:bg-green-700">Войти</button>
            </form>
        </div>
    );
}
