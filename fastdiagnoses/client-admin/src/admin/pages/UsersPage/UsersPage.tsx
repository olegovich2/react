import React, { useState, useEffect } from 'react';
import { usersService } from '../../services/adminApi';
import './UsersPage.css';

// Импорт новых компонентов
import UsersStats from './components/UsersStats/UsersStats';
import UsersFilters from './components/UsersFilters/UsersFilters';
import UsersTable from './components/UsersTable/UsersTable';
import UsersPagination from './components/UsersPagination/UsersPagination';
import UsersNotification from './components/UsersNotification/UsersNotification';
import BlockUserModal from './components/BlockUserModal';

// Кастомные хуки
import useUsersData from './hooks/useUsersData';
import useUsersActions from './hooks/useUsersActions';

// Типы
import { User } from '../../types';

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
    handleUnblockUser,
    handleResetPassword,
    handleRequestAction
  } = useUsersActions(fetchUsers, pagination.currentPage);

  // Состояние для модального окна
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [userToBlock, setUserToBlock] = useState<User | null>(null);

  // Первоначальная загрузка данных
  useEffect(() => {
    const loadData = async () => {
      await fetchUsers(1);
      await fetchStats();
    };
    
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

  const handleBlockUser = (user: User) => {
    setUserToBlock(user);
    setShowBlockModal(true);
  };

  const handleEnhancedRequestAction = async (user: User, requestType: string) => {
    const result = await handleRequestAction(user, requestType);
    if (result && requestType === 'unblock' && !user.isBlocked) {
      handleBlockUser(result);
    }
    return result;
  };

  const handleBlockConfirm = async (
    duration: '7d' | '30d' | 'forever', 
    reason?: string, 
    deleteSessions?: boolean
  ) => {
    if (!userToBlock) return;

    try {
      // Используем API для блокировки
      const response = await usersService.blockUser(
        userToBlock.login,
        duration,
        reason,
        deleteSessions
      );
      
      if (response.success) {
        showNotification('success', response.message || `Пользователь ${userToBlock.login} заблокирован`);
        setShowBlockModal(false);
        setUserToBlock(null);
        await fetchUsers(pagination.currentPage);
      } else {
        showNotification('error', response.message || 'Ошибка блокировки');
      }
    } catch (error: any) {
      console.error('❌ [UsersPage] Ошибка блокировки:', error);
      showNotification('error', error.message || 'Ошибка блокировки');
    }
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
            onBlockUser={handleBlockUser}
            onUnblockUser={handleUnblockUser}
            onRequestAction={handleEnhancedRequestAction}
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

      {/* Модальное окно блокировки */}
      {showBlockModal && userToBlock && (
        <BlockUserModal
          user={userToBlock}
          onConfirm={handleBlockConfirm}
          onCancel={() => {
            setShowBlockModal(false);
            setUserToBlock(null);
          }}
        />
      )}
    </div>
  );
};

UsersPage.displayName = 'UsersPage';
export default UsersPage;