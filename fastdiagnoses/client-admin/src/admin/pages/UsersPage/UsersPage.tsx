import React, { useState, useEffect } from 'react';
import { usersService } from '../../services/adminApi';
import './UsersPage.css';

// Импорт компонентов
import UsersStats from './components/UsersStats/UsersStats';
import UsersFilters from './components/UsersFilters/UsersFilters';
import UsersTable from './components/UsersTable/UsersTable';
import UsersPagination from './components/UsersPagination/UsersPagination';
import UsersNotification from './components/UsersNotification/UsersNotification';
import SupportRequestModal from './components/SupportRequestModal/SupportRequestModal';

// Кастомные хуки
import useUsersData from './hooks/useUsersData';
import useUsersActions from './hooks/useUsersActions';

// Типы
import { User, SupportRequestType } from '../../types';

// Вспомогательные функции
const getRequestTypeName = (type: string): string => {
  const names: Record<string, string> = {
    password_reset: 'Сброс пароля',
    email_change: 'Смена email',
    unblock: 'Разблокировка аккаунта',
    account_deletion: 'Удаление аккаунта',
    other: 'Другой запрос'
  };
  return names[type] || type;
};

const getRequestCount = (user: User, requestType: string): number => {
  if (!user.supportRequests) return 0;
  
  switch (requestType) {
    case 'password_reset':
      return user.supportRequests.password_reset || 0;
    case 'email_change':
      return user.supportRequests.email_change || 0;
    case 'unblock':
      return user.supportRequests.unblock || 0;
    case 'account_deletion':
      return user.supportRequests.account_deletion || 0;
    case 'other':
      return user.supportRequests.other || 0;
    default:
      return 0;
  }
};

const UsersPage: React.FC = () => {
  // Используем кастомные хуки
  const {
    users,
    filteredUsers,
    isLoading,
    error,
    pagination,
    stats,
    searchTerm,
    filters,
    setSearchTerm,
    setFilters,
    fetchUsers,
    fetchStats
  } = useUsersData();

  const {
    notification,
    showNotification,
    handleResetPassword,
  } = useUsersActions(fetchUsers, pagination.currentPage);

  // СОСТОЯНИЯ ДЛЯ МОДАЛКИ ТЕХПОДДЕРЖКИ
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [selectedUserForRequest, setSelectedUserForRequest] = useState<User | null>(null);
  const [selectedRequestType, setSelectedRequestType] = useState<SupportRequestType | null>(null);

  // Первоначальная загрузка данных
  useEffect(() => {
    const loadData = async () => {
      await fetchUsers(1);
      await fetchStats();
    };
    console.log('render UsersPage');
    loadData();
  }, []);

  // Обработчики
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const handleSearchSubmit = () => {
    fetchUsers(1);
  };

  const handleFilterChange = (filterName: keyof typeof filters, value: string) => {
    const newFilters = {
      ...filters,
      [filterName]: value as any,
    };
    setFilters(newFilters);
    fetchUsers(1, { [filterName]: value as any });
  };

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= pagination.totalPages) {
      fetchUsers(page);
    }
  };

  const handleClearSearch = () => {
    setSearchTerm('');
    fetchUsers(1);
  };

  // ОБНОВЛЕННЫЙ ОБРАБОТЧИК ЗАПРОСОВ (всегда открывает модалку)
const handleRequestAction = async (user: User, requestType: string): Promise<User | null> => {  
  // ВСЕГДА открываем модалку техподдержки
  setSelectedUserForRequest(user);
  setSelectedRequestType(requestType as SupportRequestType);
  setShowSupportModal(true);
  
  const requestCount = getRequestCount(user, requestType);
  if (requestCount > 0) {
    showNotification('info', 
      `Открываю ${requestCount} активных запросов типа "${getRequestTypeName(requestType)}" для пользователя ${user.login}`
    );
  } else {
    showNotification('info', 
      `Открываю форму для запроса "${getRequestTypeName(requestType)}" пользователя ${user.login}`
    );
  }
  
  return null;
};

  // Функция обработки запроса из модалки техподдержки
  const handleProcessSupportRequest = async (
    requestId: string, 
    action: 'approve' | 'reject', 
    reason?: string,
    emailResponse?: string // для типа "other"
  ) => {
    try {      
      // Используем supportService для обработки запроса
      const response = await usersService.processSupportRequest(
        requestId, 
        action, 
        { 
          reason, 
          emailResponse 
        }
      );
      
      if (response.success) {
        showNotification('success', 
          action === 'approve' 
            ? '✅ Запрос успешно обработан'
            : '❌ Запрос отклонен'
        );
        handleCloseSupportModal();
        
        // Обновляем список пользователей
        await fetchUsers(pagination.currentPage);
      } else {
        showNotification('error', response.message || 'Ошибка обработки запроса');
      }
    } catch (error: any) {
      console.error('❌ Ошибка обработки запроса:', error);
      showNotification('error', error.message || 'Ошибка сервера');
    }
  };

  // Функция закрытия модалки техподдержки
  const handleCloseSupportModal = () => {
    setShowSupportModal(false);
    setSelectedUserForRequest(null);
    setSelectedRequestType(null);
  };

  const handleNotificationClose = () => {
    showNotification(null);
  };

  // Если еще загружаем
  if (isLoading && users.length === 0) {
    return (
      <div className="users-page">
        <div className="users-page-header">
          <h2 className="users-page-title">Управление пользователями</h2>
          <p className="users-page-subtitle">
            Просмотр и управление пользователями системы
          </p>
        </div>
        <div className="users-page-content">
          <div className="users-page-placeholder">
            <div className="users-page-placeholder-icon">⏳</div>
            <h3 className="users-page-placeholder-title">
              Загрузка пользователей...
            </h3>
            <p className="users-page-placeholder-description">
              Получаем данные с сервера
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error && users.length === 0) {
    return (
      <div className="users-page">
        <div className="users-page-header">
          <h2 className="users-page-title">Управление пользователями</h2>
          <p className="users-page-subtitle">
            Просмотр и управление пользователями системы
          </p>
        </div>
        <div className="users-page-content">
          <div className="users-page-placeholder">
            <div className="users-page-placeholder-icon">⚠️</div>
            <h3 className="users-page-placeholder-title">
              Ошибка загрузки
            </h3>
            <p className="users-page-placeholder-description">
              {error}
            </p>
            <button
              onClick={() => fetchUsers(1)}
              className="users-page-retry-button"
            >
              Попробовать снова
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="users-page">
      {/* Уведомление */}
      {notification && (
        <UsersNotification
          type={notification.type}
          message={notification.message}
          onClose={handleNotificationClose}
        />
      )}

      <div className="users-page-header">
        <div>
          <h2 className="users-page-title">Управление пользователями</h2>
          <p className="users-page-subtitle">
            Просмотр и управление пользователями системы
          </p>
        </div>
        <button
          onClick={() => fetchUsers(1)}
          className="users-page-refresh-button"
          disabled={isLoading}
        >
          <span>🔄</span>
          {isLoading ? 'Загрузка...' : 'Обновить'}
        </button>
      </div>

      {/* Статистика */}
      <UsersStats stats={stats} />

      {/* Поиск и фильтры */}
      <UsersFilters
        searchTerm={searchTerm}
        filters={filters}
        isLoading={isLoading}
        onSearchChange={handleSearch}
        onSearchSubmit={handleSearchSubmit}
        onFilterChange={handleFilterChange}
        onClearSearch={handleClearSearch}
      />

      {/* Таблица пользователей */}
      {filteredUsers.length === 0 ? (
        <div className="users-page-content">
          <div className="users-page-placeholder">
            <div className="users-page-placeholder-icon">👥</div>
            <h3 className="users-page-placeholder-title">
              Пользователи не найдены
            </h3>
            <p className="users-page-placeholder-description">
              {searchTerm || Object.values(filters).some(f => f !== 'all') 
                ? 'Попробуйте изменить параметры поиска или фильтры' 
                : 'В системе еще нет пользователей'}
            </p>
          </div>
        </div>
      ) : (
        <>
          <UsersTable
            users={filteredUsers}
            isLoading={isLoading}
            onRequestAction={handleRequestAction}
            onResetPassword={handleResetPassword}
          />

          {/* Пагинация */}
          <UsersPagination
            pagination={pagination}
            isLoading={isLoading}
            onPageChange={handlePageChange}
          />
        </>
      )}

      {/* Модальное окно запроса техподдержки */}
      {showSupportModal && selectedUserForRequest && selectedRequestType && (
        <SupportRequestModal
          user={selectedUserForRequest}
          requestType={selectedRequestType}
          onClose={handleCloseSupportModal}
          onProcess={handleProcessSupportRequest}
        />
      )}
    </div>
  );
};

UsersPage.displayName = 'UsersPage';
export default UsersPage;