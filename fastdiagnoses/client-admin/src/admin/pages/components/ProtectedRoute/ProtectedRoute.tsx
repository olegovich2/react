import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAdminAuth } from '../../../../hooks/useAdminAuth';

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
  const { state: { isAuthenticated, user } } = useAdminAuth();
  
 // ЕСЛИ требуется авторизация И пользователь НЕ авторизован → редирект
  if (requireAuth && !isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  // ЕСЛИ требуется админ И пользователь НЕ админ → редирект
  if (requireAdmin && user?.role !== 'admin') {
    return <Navigate to="/admin" replace />;
  }

  // ЕСЛИ авторизация НЕ требуется И пользователь авторизован → редирект с логина
  if (!requireAuth && isAuthenticated) {
    return <Navigate to="/admin" replace />;
  }

  // ВСЕ проверки пройдены → просто пробрасываем детей
  console.log('✅ [ProtectedRoute] Пробрасываем children');
  return <>{children}</>;
};

ProtectedRoute.displayName = 'ProtectedRoute';
export default ProtectedRoute;