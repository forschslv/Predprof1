import React, { createContext, useState, useEffect, useContext } from 'react';
import api from '../api';
import { jwtDecode } from "jwt-decode";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    const fetchUser = async () => {
        try {
            const token = localStorage.getItem('token');
            if (token) {
                // Декодируем токен, чтобы проверить срок действия (опционально)
                // Запрашиваем профиль
                const res = await api.get('/users/me');
                setUser(res.data);
            }
        } catch (e) {
            console.error("Failed to fetch user", e);
            localStorage.removeItem('token');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUser();
    }, []);

    const login = (token, userData) => {
        localStorage.setItem('token', token);
        setUser(userData);
    };

    const logout = () => {
        localStorage.removeItem('token');
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, loading, isAdmin: user?.is_admin }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);