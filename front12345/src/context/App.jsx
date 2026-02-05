import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import VerifyCode from './pages/VerifyCode';
import UserDashboard from './pages/UserDashboard';
import AdminDashboard from './pages/AdminDashboard';
import NewOrder from './pages/NewOrder';
import OrderDetails from './pages/OrderDetails';

const PrivateRoute = ({ children }) => {
    const { user } = useAuth();
    return user ? children : <Navigate to="/login" />;
};

const AdminRoute = ({ children }) => {
    const { user, isAdmin } = useAuth();
    return user && isAdmin ? children : <Navigate to="/dashboard" />;
};

const Navbar = () => {
    const { user, logout, isAdmin } = useAuth();
    if (!user) return null;

    return (
        <nav className="bg-blue-600 text-white p-4 shadow-md">
            <div className="container mx-auto flex justify-between items-center">
                <Link to="/dashboard" className="text-xl font-bold">Столовая Л2Ш</Link>
                <div className="flex gap-4 items-center">
                    <Link to="/dashboard" className="hover:text-blue-200">Мои заказы</Link>
                    <Link to="/new-order" className="hover:text-blue-200">Сделать заказ</Link>
                    {isAdmin && <Link to="/admin" className="bg-white text-blue-600 px-3 py-1 rounded font-bold">Админ</Link>}
                    <span className="text-sm opacity-80">{user.name}</span>
                    <button onClick={logout} className="bg-red-500 hover:bg-red-600 px-3 py-1 rounded">Выход</button>
                </div>
            </div>
        </nav>
    );
};

function App() {
    return (
        <AuthProvider>
            <Router>
                <div className="min-h-screen bg-gray-50 text-gray-800">
                    <Navbar />
                    <div className="container mx-auto p-4">
                        <Routes>
                            <Route path="/login" element={<Login />} />
                            <Route path="/verify" element={<VerifyCode />} />
                            <Route path="/dashboard" element={<PrivateRoute><UserDashboard /></PrivateRoute>} />
                            <Route path="/new-order" element={<PrivateRoute><NewOrder /></PrivateRoute>} />
                            <Route path="/order/:id" element={<PrivateRoute><OrderDetails /></PrivateRoute>} />
                            <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
                            <Route path="*" element={<Navigate to="/dashboard" />} />
                        </Routes>
                    </div>
                </div>
            </Router>
        </AuthProvider>
    );
}

export default App;
