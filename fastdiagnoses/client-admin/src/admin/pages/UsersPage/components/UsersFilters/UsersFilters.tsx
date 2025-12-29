import React from "react";
import "./UsersFilters.css";

// Создаем тип для фильтров
interface UsersFiltersState {
  status: "all" | "active" | "inactive";
  isBlocked: "all" | "blocked" | "not-blocked";
  hasRequests: "all" | "true" | "false";
  requestType:
    | "all"
    | "password_reset"
    | "email_change"
    | "unblock"
    | "account_deletion"
    | "other";
  isOverdue: "all" | "true" | "false";
  requestStatus: "all" | "confirmed" | "in_progress";
}

interface UsersFiltersProps {
  searchTerm: string;
  filters: UsersFiltersState;
  isLoading: boolean;
  onSearchChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSearchSubmit: () => void;
  onFilterChange: (filterName: keyof UsersFiltersState, value: string) => void;
  onClearSearch: () => void;
}

const UsersFilters: React.FC<UsersFiltersProps> = ({
  searchTerm,
  filters,
  isLoading,
  onSearchChange,
  onSearchSubmit,
  onFilterChange,
  onClearSearch,
}) => {
  return (
    <div className="users-filters-controls">
      <div className="users-filters-search">
        <div className="users-filters-search-wrapper">
          <span className="users-filters-search-icon">🔍</span>
          <input
            type="text"
            placeholder="Поиск по логину или email..."
            value={searchTerm}
            onChange={onSearchChange}
            onKeyPress={(e) => e.key === "Enter" && onSearchSubmit()}
            className="users-filters-search-input"
            disabled={isLoading}
          />
          {searchTerm && (
            <button
              onClick={onClearSearch}
              className="users-filters-search-clear"
              disabled={isLoading}
            >
              ✕
            </button>
          )}
        </div>
        <button
          onClick={onSearchSubmit}
          className="users-filters-search-button"
          disabled={isLoading}
        >
          {isLoading ? "..." : "Найти"}
        </button>
      </div>

      <div className="users-filters-filters">
        <select
          value={filters.status}
          onChange={(e) => onFilterChange("status", e.target.value)}
          className="users-filters-filter-select"
          disabled={isLoading}
        >
          <option value="all">Все статусы</option>
          <option value="active">Только активные</option>
          <option value="inactive">Только неактивные</option>
        </select>

        <select
          value={filters.isBlocked}
          onChange={(e) => onFilterChange("isBlocked", e.target.value)}
          className="users-filters-filter-select"
          disabled={isLoading}
        >
          <option value="all">Все блокировки</option>
          <option value="blocked">Только заблокированные</option>
          <option value="not-blocked">Только не заблокированные</option>
        </select>

        <select
          value={filters.hasRequests}
          onChange={(e) => onFilterChange("hasRequests", e.target.value)}
          className="users-filters-filter-select"
          disabled={isLoading}
        >
          <option value="all">Все запросы</option>
          <option value="true">С активными запросами</option>
          <option value="false">Без запросов</option>
        </select>

        <select
          value={filters.requestType}
          onChange={(e) => onFilterChange("requestType", e.target.value)}
          className="users-filters-filter-select"
          disabled={isLoading}
        >
          <option value="all">Все типы запросов</option>
          <option value="password_reset">Сброс пароля</option>
          <option value="email_change">Смена email</option>
          <option value="unblock">Разблокировка</option>
          <option value="account_deletion">Удаление аккаунта</option>
          <option value="other">Другое</option>
        </select>

        <select
          value={filters.requestStatus}
          onChange={(e) => onFilterChange("requestStatus", e.target.value)}
          className="users-filters-filter-select"
          disabled={isLoading}
        >
          <option value="all">Все статусы запросов</option>
          <option value="confirmed">Подтверждённые</option>
          <option value="in_progress">В обработке</option>
        </select>

        <select
          value={filters.isOverdue}
          onChange={(e) => onFilterChange("isOverdue", e.target.value)}
          className="users-filters-filter-select"
          disabled={isLoading}
        >
          <option value="all">Все сроки</option>
          <option value="true">Только просроченные</option>
          <option value="false">Только в срок</option>
        </select>
      </div>
    </div>
  );
};

UsersFilters.displayName = "UsersFilters";
export default UsersFilters;
