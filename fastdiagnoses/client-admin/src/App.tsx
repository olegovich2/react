import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import { AdminAuthProvider } from './contexts/AdminAuthContext';

// Импорт админских компонентов
import AdminLogin from './admin/pages/AdminLogin/AdminLogin';
import Dashboard from './admin/pages/Dashboard/Dashboard';
import UsersPage from './admin/pages/UsersPage/UsersPage';
import SettingsPage from './admin/pages/SettingsPage/SettingsPage';
import NotFound from './admin/pages/NotFound/NotFound';
import AdminLayout from './admin/pages/components/AdminLayout/AdminLayout';
import ProtectedRoute from './admin/pages/components/ProtectedRoute/ProtectedRoute';

import './App.css';

// Компонент для отслеживания навигации
const RedirectHandler: React.FC = () => {
  return null;
};

// Компонент для обработки корневого редиректа
const RootRedirect: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    navigate('/admin/login', { replace: true });
  }, [navigate]);

  return null;
};

function App() {
  console.log('🚀 [App] Компонент App смонтирован');
  
  return (
    <AdminAuthProvider>
      <Router>
        <div className="App">
          <RedirectHandler />
          <Routes>
            {/* Корневой путь - редирект на логин */}
            <Route path="/" element={<RootRedirect />} />
            
            {/* Страница входа (не требует авторизации) */}
            <Route path="/admin/login" element={
              <ProtectedRoute requireAuth={false}>
                <AdminLogin />
              </ProtectedRoute>
            } />
            
            {/* Главная страница админки (требует авторизации) */}
            <Route path="/admin" element={
              <ProtectedRoute>
                <AdminLayout>
                  <Dashboard />
                </AdminLayout>
              </ProtectedRoute>
            } />
            
            {/* Пользователи (требует авторизации) */}
            <Route path="/admin/users" element={
              <ProtectedRoute>
                <AdminLayout>
                  <UsersPage />
                </AdminLayout>
              </ProtectedRoute>
            } />
            
            {/* Настройки (требует авторизации) */}
            <Route path="/admin/settings" element={
              <ProtectedRoute>
                <AdminLayout>
                  <SettingsPage />
                </AdminLayout>
              </ProtectedRoute>
            } />
            
            {/* Логи (требует авторизации) */}
            <Route path="/admin/logs" element={
              <ProtectedRoute>
                <AdminLayout>
                  <div style={{ padding: '40px', textAlign: 'center' }}>
                    <h2>Логи системы</h2>
                    <p>Страница в разработке</p>
                  </div>
                </AdminLayout>
              </ProtectedRoute>
            } />
            
            {/* Бэкапы (требует авторизации) */}
            <Route path="/admin/backups" element={
              <ProtectedRoute>
                <AdminLayout>
                  <div style={{ padding: '40px', textAlign: 'center' }}>
                    <h2>Бэкапы системы</h2>
                    <p>Страница в разработке</p>
                  </div>
                </AdminLayout>
              </ProtectedRoute>
            } />
            
            {/* 404 страница (требует авторизации) */}
            <Route path="*" element={
              <ProtectedRoute>
                <AdminLayout>
                  <NotFound />
                </AdminLayout>
              </ProtectedRoute>
            } />
          </Routes>
        </div>
      </Router>
    </AdminAuthProvider>
  );
}

App.displayName = 'App';
export default App;