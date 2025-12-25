import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAdminAuth } from '../../../../hooks/useAdminAuth';
import Loader from '../Loader/Loader';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
  requireAuth?: boolean;
  redirectTo?: string;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  requireAdmin = false,
  requireAuth = true,
  redirectTo = '/admin/login'
}) => {
  const { isAuthenticated, isLoading, user } = useAdminAuth();
  
  console.log('🛡️ [ProtectedRoute] Проверка доступа:', {
    isAuthenticated,
    isLoading,
    requireAuth,
    requireAdmin,
    userRole: user?.role,
    userUsername: user?.username
  });
  
  // Если идет загрузка
  if (isLoading) {
    console.log('⏳ [ProtectedRoute] Загрузка состояния авторизации...');
    return <Loader />;
  }
  
  // Если требуется авторизация и пользователь не авторизован
  if (requireAuth && !isAuthenticated) {
    console.log('🚫 [ProtectedRoute] Пользователь не авторизован, редирект на', redirectTo);
    return <Navigate to={redirectTo} replace />;
  }
  
  // Если требуется админская роль и пользователь не админ
  if (requireAdmin && user?.role !== 'admin') {
    console.log('⛔ [ProtectedRoute] Недостаточно прав, роль:', user?.role, 'требуется: admin');
    return <Navigate to="/admin" replace />;
  }
  
  // Если авторизация не требуется и пользователь авторизован - редирект на главную
  if (!requireAuth && isAuthenticated) {
    console.log('↪️ [ProtectedRoute] Авторизованный пользователь на странице входа, редирект на /admin');
    return <Navigate to="/admin" replace />;
  }
  
  console.log('✅ [ProtectedRoute] Доступ разрешен');
  return <>{children}</>;
};

ProtectedRoute.displayName = 'ProtectedRoute';
export default ProtectedRoute;