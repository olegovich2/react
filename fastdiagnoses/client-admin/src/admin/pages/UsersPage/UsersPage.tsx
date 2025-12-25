import React, { useState, useEffect, useCallback } from 'react';
import { usersService, dashboardService } from '../../services/adminApi';
import './UsersPage.css';

interface User {
  id: number;
  login: string;
  email: string;
  isActive: boolean;
  createdAt: string;
  activeSessions: number;
  hasUserTable: boolean;
  stats: {
    surveys: number;
    images: number;
  };
}

interface Pagination {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
}

interface Stats {
  totalUsers: number | string;
  activeUsers: number | string;
  pendingUsers: number | string;
}

interface UsersResponse {
  success: boolean;
  users: User[];
  pagination: Pagination;
  stats: Stats;
  message?: string;
}

const UsersPage: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    status: 'all',
    hasTable: 'all',
  });
  const [pagination, setPagination] = useState<Pagination>({
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    itemsPerPage: 20,
  });
  
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    pendingUsers: 0,
  });

  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  // Загрузка пользователей
  const fetchUsers = useCallback(async (page = 1) => {
    setIsLoading(true);
    setError('');
    try {
      const response = await usersService.getAll({
        page,
        limit: pagination.itemsPerPage,
        search: searchTerm || undefined,
        sortBy: 'created_at',
        sortOrder: 'desc',
      });

      console.log('Users response:', response);

      // Безопасное приведение типа
      if (response.success) {
        const responseData = response as unknown as UsersResponse;
        
        // Пользователи
        const usersData = responseData.users || [];
        setUsers(usersData);
        setFilteredUsers(usersData);
        
        // Пагинация
        if (responseData.pagination) {
          setPagination({
            currentPage: Number(responseData.pagination.currentPage) || page,
            totalPages: Number(responseData.pagination.totalPages) || 1,
            totalItems: Number(responseData.pagination.totalItems) || 0,
            itemsPerPage: Number(responseData.pagination.itemsPerPage) || pagination.itemsPerPage,
          });
        }

        // Статистика из ответа
        if (responseData.stats) {
          setStats({
            totalUsers: Number(responseData.stats.totalUsers) || 0,
            activeUsers: Number(responseData.stats.activeUsers) || 0,
            pendingUsers: Number(responseData.stats.pendingUsers) || 0,
          });
        }
      } else {
        setError(response.message || 'Ошибка загрузки пользователей');
      }
    } catch (error: any) {
      console.error('Ошибка fetchUsers:', error);
      setError(error.message || 'Ошибка соединения с сервером');
    } finally {
      setIsLoading(false);
    }
  }, [searchTerm, pagination.itemsPerPage]); 

  // Загрузка общей статистики
  const fetchStats = useCallback(async () => {
    try {
      console.log('Fetching dashboard stats...');
      const response = await dashboardService.getStats();
      console.log('Dashboard stats response:', response);
      
      if (response.success) {
        // Используем as unknown as для безопасного приведения
        const statsData = response as unknown as {
          success: boolean;
          totalUsers?: number | string;
          activeUsers?: number | string;
          pendingUsers?: number | string;
        };
        
        setStats(prev => ({
          ...prev,
          totalUsers: Number(statsData.totalUsers) || prev.totalUsers,
          activeUsers: Number(statsData.activeUsers) || prev.activeUsers,
          pendingUsers: Number(statsData.pendingUsers) || prev.pendingUsers,
        }));
      }
    } catch (error) {
      console.error('Ошибка загрузки статистики:', error);
    }
  }, []);

  // Фильтрация пользователей
  useEffect(() => {
    let result = [...users];
    
    if (filters.status !== 'all') {
      result = result.filter(user => 
        filters.status === 'active' ? user.isActive : !user.isActive
      );
    }
    
    if (filters.hasTable !== 'all') {
      result = result.filter(user => 
        filters.hasTable === 'yes' ? user.hasUserTable : !user.hasUserTable
      );
    }
    
    setFilteredUsers(result);
  }, [users, filters]);

  // Первоначальная загрузка
  useEffect(() => {
    const loadData = async () => {
      await fetchUsers(1);
      // Дополнительная загрузка статистики, если нужно
      await fetchStats();
    };
    
    loadData();
  }, []);

  // Обработчики действий
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const handleSearchSubmit = () => {
    fetchUsers(1);
  };

  const handleFilterChange = (filterName: string, value: string) => {
    setFilters(prev => ({
      ...prev,
      [filterName]: value,
    }));
  };

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= pagination.totalPages) {
      fetchUsers(page);
    }
  };

  const handleViewDetails = (user: User) => {
    setSelectedUser(user);
    setShowDetails(true);
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

  // Если еще загружаем
  if (isLoading) {
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

  if (error) {
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

  // Основной интерфейс
  return (
    <div className="users-page">
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
        >
          <span>🔄</span>
          Обновить
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
        
        <div className="users-page-stat-card users-page-stat-records">
          <div className="users-page-stat-icon">📊</div>
          <div className="users-page-stat-content">
            <h3 className="users-page-stat-value">{pagination.totalItems}</h3>
            <p className="users-page-stat-label">Записей в системе</p>
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
            />
            {searchTerm && (
              <button
                onClick={() => { setSearchTerm(''); fetchUsers(1); }}
                className="users-page-search-clear"
              >
                ✕
              </button>
            )}
          </div>
          <button
            onClick={handleSearchSubmit}
            className="users-page-search-button"
          >
            Найти
          </button>
        </div>
        
        <div className="users-page-filters">
          <select
            value={filters.status}
            onChange={(e) => handleFilterChange('status', e.target.value)}
            className="users-page-filter-select"
          >
            <option value="all">Все статусы</option>
            <option value="active">Только активные</option>
            <option value="inactive">Только неактивные</option>
          </select>
          
          <select
            value={filters.hasTable}
            onChange={(e) => handleFilterChange('hasTable', e.target.value)}
            className="users-page-filter-select"
          >
            <option value="all">Все таблицы</option>
            <option value="yes">С таблицей</option>
            <option value="no">Без таблицы</option>
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
              {searchTerm ? 'Попробуйте изменить параметры поиска' : 'В системе еще нет пользователей'}
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
                      <div className="users-page-data-item">
                        <span className="users-page-data-label">Таблица:</span>
                        <span className={`users-page-data-value ${user.hasUserTable ? 'has-table' : 'no-table'}`}>
                          {user.hasUserTable ? 'Есть' : 'Нет'}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="users-page-actions">
                      <button
                        onClick={() => handleViewDetails(user)}
                        className="users-page-action-button users-page-action-view"
                        title="Просмотр деталей"
                      >
                        👁️
                      </button>
                      <button
                        onClick={() => handleViewDetails(user)}
                        className="users-page-action-button users-page-action-edit"
                        title="Редактировать"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => {
                          if (window.confirm(`Сбросить пароль для ${user.login}?`)) {
                            alert('Функция сброса пароля будет реализована');
                          }
                        }}
                        className="users-page-action-button users-page-action-reset"
                        title="Сбросить пароль"
                      >
                        🔑
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
                disabled={pagination.currentPage === 1}
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
                disabled={pagination.currentPage === pagination.totalPages}
                className="users-page-pagination-button"
              >
                Вперед →
              </button>
            </div>
          )}
        </div>
      )}

      {/* Модальное окно деталей пользователя */}
      {showDetails && selectedUser && (
        <div className="users-page-modal-overlay">
          <div className="users-page-modal">
            <div className="users-page-modal-header">
              <h3>Детальная информация</h3>
              <button
                onClick={() => setShowDetails(false)}
                className="users-page-modal-close"
              >
                ✕
              </button>
            </div>
            <div className="users-page-modal-body">
              <div className="users-page-details-grid">
                <div className="users-page-detail-item">
                  <span className="users-page-detail-label">Логин:</span>
                  <span className="users-page-detail-value">{selectedUser.login}</span>
                </div>
                <div className="users-page-detail-item">
                  <span className="users-page-detail-label">Email:</span>
                  <span className="users-page-detail-value">{selectedUser.email}</span>
                </div>
                <div className="users-page-detail-item">
                  <span className="users-page-detail-label">Статус:</span>
                  <span className={`users-page-detail-value ${selectedUser.isActive ? 'active' : 'inactive'}`}>
                    {selectedUser.isActive ? 'Активен' : 'Неактивен'}
                  </span>
                </div>
                <div className="users-page-detail-item">
                  <span className="users-page-detail-label">Дата регистрации:</span>
                  <span className="users-page-detail-value">{formatDate(selectedUser.createdAt)}</span>
                </div>
                <div className="users-page-detail-item">
                  <span className="users-page-detail-label">Активные сессии:</span>
                  <span className="users-page-detail-value">{selectedUser.activeSessions}</span>
                </div>
                <div className="users-page-detail-item">
                  <span className="users-page-detail-label">Наличие таблицы:</span>
                  <span className={`users-page-detail-value ${selectedUser.hasUserTable ? 'has-table' : 'no-table'}`}>
                    {selectedUser.hasUserTable ? 'Таблица существует' : 'Таблица отсутствует'}
                  </span>
                </div>
                <div className="users-page-detail-item">
                  <span className="users-page-detail-label">Опросов:</span>
                  <span className="users-page-detail-value">{selectedUser.stats.surveys}</span>
                </div>
                <div className="users-page-detail-item">
                  <span className="users-page-detail-label">Изображений:</span>
                  <span className="users-page-detail-value">{selectedUser.stats.images}</span>
                </div>
              </div>
            </div>
            <div className="users-page-modal-footer">
              <button
                onClick={() => setShowDetails(false)}
                className="users-page-modal-button"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

UsersPage.displayName = 'UsersPage';
export default UsersPage;