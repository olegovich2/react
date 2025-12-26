import React, { useState, useEffect, useCallback } from 'react';
import { usersService, dashboardService } from '../../services/adminApi';
import { User } from '../../types/index';
import './UsersPage.css';
import BlockUserModal from './components/BlockUserModal';

interface Pagination {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
}

interface Stats {
  totalUsers: number;
  activeUsers: number;
  pendingUsers: number;
  blockedUsers: number;
  notBlockedUsers: number;
}

interface UserFilters {
  status: 'all' | 'active' | 'inactive';
  isBlocked: 'all' | 'blocked' | 'not-blocked';
}

// Тип для фильтров с опциональными полями для фильтрации
type PartialUserFilters = Partial<UserFilters>;

const UsersPage: React.FC = () => {
  // Состояние для пользователей
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Состояние для фильтров и поиска
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState<UserFilters>({
    status: 'all',
    isBlocked: 'all',
  });
  
  // Состояние для пагинации
  const [pagination, setPagination] = useState<Pagination>({
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    itemsPerPage: 20,
  });
  
  // Состояние для статистики
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    activeUsers: 0,
    pendingUsers: 0,
    blockedUsers: 0,
    notBlockedUsers: 0,
  });

  // Состояние для модальных окон
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [userToBlock, setUserToBlock] = useState<User | null>(null);

  // Состояние для уведомлений
  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  // Показ уведомления
  const showNotification = (type: 'success' | 'error' | 'info', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  // Загрузка общей статистики
  const fetchStats = useCallback(async () => {
    try {
      console.log('📊 [UsersPage] Загрузка статистики дашборда...');
      const response = await dashboardService.getStats();
      console.log('📊 [UsersPage] Статистика дашборда:', response);
      
      if (response.success && response.data) {
        // Обновляем только если данные есть
        const dashboardStats = response.data;
        setStats(prev => ({
          ...prev,
          totalUsers: dashboardStats.totalUsers || prev.totalUsers,
          activeUsers: dashboardStats.activeUsers || prev.activeUsers,
        }));
      }
    } catch (error) {
      console.error('❌ [UsersPage] Ошибка загрузки статистики:', error);
    }
  }, []);

  // Загрузка пользователей
  const fetchUsers = useCallback(async (page = 1, filtersOverride?: PartialUserFilters) => {
    setIsLoading(true);
    setError('');
    
    try {
      const currentFilters = { ...filters, ...(filtersOverride || {}) };
      
      const response = await usersService.getAll({
        page,
        limit: pagination.itemsPerPage,
        search: searchTerm || undefined,
        sortBy: 'created_at',
        sortOrder: 'desc',
        isActive: currentFilters.status === 'active' ? 'true' : 
                 currentFilters.status === 'inactive' ? 'false' : undefined,
        isBlocked: currentFilters.isBlocked === 'blocked' ? 'true' :
                  currentFilters.isBlocked === 'not-blocked' ? 'false' : undefined,
      });

      console.log('📥 [UsersPage] Ответ от сервера:', response);

      if (response.success && response.users) {
        // Пользователи
        const usersData = response.users;
        setUsers(usersData);
        setFilteredUsers(usersData); // Убираем локальную фильтрацию
        
        // Пагинация
        if (response.pagination) {
          setPagination({
            currentPage: response.pagination.currentPage || page,
            totalPages: response.pagination.totalPages || 1,
            totalItems: response.pagination.totalItems || 0,
            itemsPerPage: response.pagination.itemsPerPage || pagination.itemsPerPage,
          });
        }

        // Статистика из ответа
        if (response.stats) {
          setStats(prev => ({
            ...prev,
            totalUsers: response.stats?.totalUsers || prev.totalUsers,
            activeUsers: response.stats?.activeUsers || prev.activeUsers,
            pendingUsers: response.stats?.pendingUsers || prev.pendingUsers,
            blockedUsers: response.stats?.blockedUsers || prev.blockedUsers,
            notBlockedUsers: response.stats?.notBlockedUsers || prev.notBlockedUsers,
          }));
        }
        
        console.log('✅ [UsersPage] Пользователи загружены:', {
          count: usersData.length,
          blocked: usersData.filter(u => u.isBlocked).length,
        });
      } else {
        setError(response.message || 'Ошибка загрузки пользователей');
        showNotification('error', response.message || 'Ошибка загрузки пользователей');
      }
    } catch (error: any) {
      console.error('❌ [UsersPage] Ошибка fetchUsers:', error);
      setError(error.message || 'Ошибка соединения с сервером');
      showNotification('error', error.message || 'Ошибка соединения с сервером');
    } finally {
      setIsLoading(false);
    }
  }, [searchTerm, pagination.itemsPerPage, filters]);

  // Первоначальная загрузка
  useEffect(() => {
    const loadData = async () => {
      await fetchUsers(1);
      // Дополнительная загрузка статистики дашборда
      await fetchStats();
    };
    
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Используем пустой массив зависимостей для начальной загрузки

  // Обработчики действий
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const handleSearchSubmit = () => {
    fetchUsers(1);
  };

  const handleFilterChange = (filterName: keyof UserFilters, value: string) => {
    const newFilters = {
      ...filters,
      [filterName]: value as any,
    };
    setFilters(newFilters);
    
    // Перезагружаем данные с сервера
    fetchUsers(1, { [filterName]: value as any });
  };

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= pagination.totalPages) {
      fetchUsers(page);
    }
  };

  const handleBlockUser = (user: User) => {
    setUserToBlock(user);
    setShowBlockModal(true);
  };

  const handleUnblockUser = async (user: User) => {
    if (!window.confirm(`Разблокировать пользователя ${user.login}?`)) {
      return;
    }

    try {
      setIsLoading(true);
      const response = await usersService.unblockUser(user.login);
      
      if (response.success) {
        showNotification('success', `Пользователь ${user.login} успешно разблокирован`);
        // Обновляем список пользователей
        await fetchUsers(pagination.currentPage);
      } else {
        showNotification('error', response.message || 'Ошибка разблокировки');
      }
    } catch (error: any) {
      console.error('❌ [UsersPage] Ошибка разблокировки:', error);
      showNotification('error', error.message || 'Ошибка разблокировки');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBlockConfirm = async (duration: '7d' | '30d' | 'forever', reason?: string, deleteSessions?: boolean) => {
    if (!userToBlock) return;

    try {
      setIsLoading(true);
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
        // Обновляем список пользователей
        await fetchUsers(pagination.currentPage);
      } else {
        showNotification('error', response.message || 'Ошибка блокировки');
      }
    } catch (error: any) {
      console.error('❌ [UsersPage] Ошибка блокировки:', error);
      showNotification('error', error.message || 'Ошибка блокировки');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (user: User) => {
    if (!window.confirm(`Сбросить пароль для ${user.login}? Новый пароль будет отправлен на email.`)) {
      return;
    }

    try {
      setIsLoading(true);
      const response = await usersService.resetPassword(user.login);
      
      if (response.success) {
        showNotification('success', response.message || `Пароль для ${user.login} сброшен`);
      } else {
        showNotification('error', response.message || 'Ошибка сброса пароля');
      }
    } catch (error: any) {
      console.error('❌ [UsersPage] Ошибка сброса пароля:', error);
      showNotification('error', error.message || 'Ошибка сброса пароля');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangeEmail = (user: User) => {
    showNotification('info', `Функция изменения email для ${user.login} скоро будет доступна`);
  };

  const handleDeleteAccount = (user: User) => {
    if (window.confirm(`ВНИМАНИЕ! Удалить аккаунт пользователя ${user.login}? Все данные будут безвозвратно удалены.`)) {
      showNotification('info', `Функция удаления аккаунта для ${user.login} скоро будет доступна`);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  const formatBlockInfo = (user: User) => {
    if (!user.isBlocked) return null;
    
    if (user.isPermanentlyBlocked) {
      return '🔒 Заблокирован бессрочно';
    }
    
    if (user.blockedUntilFormatted) {
      return `🔒 Заблокирован до: ${user.blockedUntilFormatted}`;
    }
    
    return '🔒 Заблокирован';
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
        <div className={`users-page-notification users-page-notification-${notification.type}`}>
          <div className="users-page-notification-content">
            <span className="users-page-notification-icon">
              {notification.type === 'success' ? '✅' : 
               notification.type === 'error' ? '❌' : 'ℹ️'}
            </span>
            <span>{notification.message}</span>
          </div>
          <button 
            onClick={() => setNotification(null)}
            className="users-page-notification-close"
          >
            ✕
          </button>
        </div>
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
      <div className="users-page-stats-grid">
        <div className="users-page-stat-card users-page-stat-total">
          <div className="users-page-stat-icon">👥</div>
          <div className="users-page-stat-content">
            <h3 className="users-page-stat-value">{stats.totalUsers}</h3>
            <p className="users-page-stat-label">Всего пользователей</p>
          </div>
        </div>
        
        <div className="users-page-stat-card users-page-stat-active">
          <div className="users-page-stat-icon">✅</div>
          <div className="users-page-stat-content">
            <h3 className="users-page-stat-value">{stats.activeUsers}</h3>
            <p className="users-page-stat-label">Активных</p>
          </div>
        </div>
        
        <div className="users-page-stat-card users-page-stat-pending">
          <div className="users-page-stat-icon">⏳</div>
          <div className="users-page-stat-content">
            <h3 className="users-page-stat-value">{stats.pendingUsers}</h3>
            <p className="users-page-stat-label">Ожидают активации</p>
          </div>
        </div>
        
        <div className="users-page-stat-card users-page-stat-blocked">
          <div className="users-page-stat-icon">🔒</div>
          <div className="users-page-stat-content">
            <h3 className="users-page-stat-value">{stats.blockedUsers}</h3>
            <p className="users-page-stat-label">Заблокировано</p>
          </div>
        </div>
      </div>

      {/* Поиск и фильтры */}
      <div className="users-page-controls">
        <div className="users-page-search">
          <div className="users-page-search-wrapper">
            <span className="users-page-search-icon">🔍</span>
            <input
              type="text"
              placeholder="Поиск по логину или email..."
              value={searchTerm}
              onChange={handleSearch}
              onKeyPress={(e) => e.key === 'Enter' && handleSearchSubmit()}
              className="users-page-search-input"
              disabled={isLoading}
            />
            {searchTerm && (
              <button
                onClick={() => { setSearchTerm(''); fetchUsers(1); }}
                className="users-page-search-clear"
                disabled={isLoading}
              >
                ✕
              </button>
            )}
          </div>
          <button
            onClick={handleSearchSubmit}
            className="users-page-search-button"
            disabled={isLoading}
          >
            {isLoading ? '...' : 'Найти'}
          </button>
        </div>
        
        <div className="users-page-filters">
          <select
            value={filters.status}
            onChange={(e) => handleFilterChange('status', e.target.value)}
            className="users-page-filter-select"
            disabled={isLoading}
          >
            <option value="all">Все статусы</option>
            <option value="active">Только активные</option>
            <option value="inactive">Только неактивные</option>
          </select>
          
          <select
            value={filters.isBlocked}
            onChange={(e) => handleFilterChange('isBlocked', e.target.value)}
            className="users-page-filter-select"
            disabled={isLoading}
          >
            <option value="all">Все блокировки</option>
            <option value="blocked">Только заблокированные</option>
            <option value="not-blocked">Только не заблокированные</option>
          </select>
        </div>
      </div>

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
        <div className="users-page-table-container">
          <table className="users-page-table">
            <thead>
              <tr>
                <th>Логин</th>
                <th>Email</th>
                <th>Статус</th>
                <th>Блокировка</th>
                <th>Регистрация</th>
                <th>Сессии</th>
                <th>Данные</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr key={user.id} className="users-page-table-row">
                  <td>
                    <div className="users-page-user-info">
                      <div className="users-page-user-avatar">
                        {user.login.charAt(0).toUpperCase()}
                      </div>
                      <div className="users-page-user-details">
                        <strong>{user.login}</strong>
                        <span className="users-page-user-id">ID: {user.id}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="users-page-email">
                      <span className="users-page-email-icon">✉️</span>
                      <span>{user.email}</span>
                    </div>
                  </td>
                  <td>
                    <div className={`users-page-status ${user.isActive ? 'active' : 'inactive'}`}>
                      {user.isActive ? (
                        <>
                          <span className="users-page-status-icon">✅</span>
                          <span>Активен</span>
                        </>
                      ) : (
                        <>
                          <span className="users-page-status-icon">❌</span>
                          <span>Неактивен</span>
                        </>
                      )}
                    </div>
                  </td>
                  <td>
                    <div className={`users-page-block-status ${user.isBlocked ? 'blocked' : 'not-blocked'}`}>
                      {user.isBlocked ? (
                        <>
                          <span className="users-page-block-icon">🔒</span>
                          <span className="users-page-block-text">
                            {formatBlockInfo(user) || 'Заблокирован'}
                          </span>
                          {user.daysRemaining !== undefined && user.daysRemaining !== null && user.daysRemaining > 0 && (
                            <span className="users-page-days-remaining">
                              ({user.daysRemaining} д.)
                            </span>
                          )}
                        </>
                      ) : (
                        <>
                          <span className="users-page-block-icon">🔓</span>
                          <span>Не заблокирован</span>
                        </>
                      )}
                    </div>
                  </td>
                  <td>
                    <div className="users-page-date">
                      <span className="users-page-date-icon">📅</span>
                      <span>{formatDate(user.createdAt)}</span>
                    </div>
                  </td>
                  <td>
                    <div className="users-page-sessions">
                      {user.activeSessions > 0 ? (
                        <span className="users-page-sessions-active">
                          {user.activeSessions} активных
                        </span>
                      ) : (
                        <span className="users-page-sessions-none">
                          Нет сессий
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <div className="users-page-data">
                      <div className="users-page-data-item">
                        <span className="users-page-data-label">Опросы:</span>
                        <span className="users-page-data-value">{user.stats.surveys}</span>
                      </div>
                      <div className="users-page-data-item">
                        <span className="users-page-data-label">Изображения:</span>
                        <span className="users-page-data-value">{user.stats.images}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="users-page-actions">
                      <button
                        onClick={() => handleResetPassword(user)}
                        className="users-page-action-button users-page-action-password"
                        title="Изменить пароль"
                        disabled={isLoading}
                      >
                        🔑
                      </button>
                      
                      <button
                        onClick={() => handleChangeEmail(user)}
                        className="users-page-action-button users-page-action-email"
                        title="Изменить email"
                        disabled={isLoading}
                      >
                        ✉️
                      </button>
                      
                      {user.isBlocked ? (
                        <button
                          onClick={() => handleUnblockUser(user)}
                          className="users-page-action-button users-page-action-unblock"
                          title="Разблокировать"
                          disabled={isLoading}
                        >
                          🔓
                        </button>
                      ) : (
                        <button
                          onClick={() => handleBlockUser(user)}
                          className="users-page-action-button users-page-action-block"
                          title="Заблокировать"
                          disabled={isLoading}
                        >
                          🔒
                        </button>
                      )}
                      
                      <button
                        onClick={() => handleDeleteAccount(user)}
                        className="users-page-action-button users-page-action-delete"
                        title="Удалить аккаунт"
                        disabled={isLoading}
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Пагинация */}
          {pagination.totalPages > 1 && (
            <div className="users-page-pagination">
              <button
                onClick={() => handlePageChange(pagination.currentPage - 1)}
                disabled={pagination.currentPage === 1 || isLoading}
                className="users-page-pagination-button"
              >
                ← Назад
              </button>
              <div className="users-page-pagination-info">
                Страница {pagination.currentPage} из {pagination.totalPages}
                <span className="users-page-pagination-total">
                  ({pagination.totalItems} пользователей)
                </span>
              </div>
              <button
                onClick={() => handlePageChange(pagination.currentPage + 1)}
                disabled={pagination.currentPage === pagination.totalPages || isLoading}
                className="users-page-pagination-button"
              >
                Вперед →
              </button>
            </div>
          )}
        </div>
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