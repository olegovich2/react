import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// Импорт админских компонентов
import AdminLogin from './admin/pages/AdminLogin/AdminLogin';
import Dashboard from './admin/pages/Dashboard/Dashboard';
import UsersPage from './admin/pages/UsersPage/UsersPage';
import SettingsPage from './admin/pages/SettingsPage/SettingsPage';
import NotFound from './admin/pages/NotFound/NotFound';
import AdminLayout from './admin/pages/components/AdminLayout/AdminLayout';

import './App.css';

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          {/* Основные пути админки */}
          <Route path="/admin" element={
              <AdminLayout>
                <Dashboard />
              </AdminLayout>
          } />
          
          <Route path="/admin/users" element={
              <AdminLayout>
                <UsersPage />
              </AdminLayout>
          } />
          
          <Route path="/admin/settings" element={
              <AdminLayout>
                <SettingsPage />
              </AdminLayout>
          } />
          
          <Route path="/admin/logs" element={
              <AdminLayout>
                <div style={{ padding: '40px', textAlign: 'center' }}>
                  <h2>Логи системы</h2>
                  <p>Страница в разработке</p>
                </div>
              </AdminLayout>
          } />
          
          <Route path="/admin/backups" element={
              <AdminLayout>
                <div style={{ padding: '40px', textAlign: 'center' }}>
                  <h2>Бэкапы системы</h2>
                  <p>Страница в разработке</p>
                </div>
              </AdminLayout>
          } />
          
          {/* Страница входа (без защитного роута) */}
          <Route path="/admin/login" element={<AdminLogin />} />
          
          {/* Редирект с /admin на дашборд */}
          <Route path="/admin" element={<Navigate to="/admin" replace />} />
          
          {/* 404 страница для админских путей */}
          <Route path="/admin/*" element={
            <AdminLayout>
              <NotFound />
            </AdminLayout>
          } />
          
          {/* Основное приложение (пользовательское) */}
          <Route path="/" element={<Navigate to="/admin/login" replace />} />
          <Route path="*" element={<Navigate to="/admin/login" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

App.displayName = 'App';
export default App;