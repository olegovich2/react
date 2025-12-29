import React from 'react';
import './UsersPagination.css';

interface UsersPaginationProps {
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
  };
  isLoading: boolean;
  onPageChange: (page: number) => void;
}

const UsersPagination: React.FC<UsersPaginationProps> = ({
  pagination,
  isLoading,
  onPageChange
}) => {
  if (pagination.totalPages <= 1) {
    return null;
  }

  return (
    <div className="users-pagination">
      <button
        onClick={() => onPageChange(pagination.currentPage - 1)}
        disabled={pagination.currentPage === 1 || isLoading}
        className="users-pagination-button"
      >
        ← Назад
      </button>
      <div className="users-pagination-info">
        Страница {pagination.currentPage} из {pagination.totalPages}
        <span className="users-pagination-total">
          ({pagination.totalItems} пользователей)
        </span>
      </div>
      <button
        onClick={() => onPageChange(pagination.currentPage + 1)}
        disabled={pagination.currentPage === pagination.totalPages || isLoading}
        className="users-pagination-button"
      >
        Вперед →
      </button>
    </div>
  );
};

UsersPagination.displayName = 'UsersPagination';
export default UsersPagination;