import { useState, useCallback } from "react";
import { usersService, dashboardService } from "../../../services/adminApi";
import { User } from "../../../types";

// Типы для хука
interface UsersPageFilters {
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

interface PaginationState {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
}

interface UsersPageStats {
  totalUsers: number;
  activeUsers: number;
  pendingUsers: number;
  blockedUsers: number;
  notBlockedUsers: number;
  usersWithRequests: number;
  usersWithOverdueRequests: number;
}

const useUsersData = () => {
  // Состояние для пользователей
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  // Состояние для фильтров и поиска
  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState<UsersPageFilters>({
    status: "all",
    isBlocked: "all",
    hasRequests: "all",
    requestType: "all",
    isOverdue: "all",
    requestStatus: "all",
  });

  // Состояние для пагинации
  const [pagination, setPagination] = useState<PaginationState>({
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    itemsPerPage: 20,
  });

  // Состояние для статистики
  const [stats, setStats] = useState<UsersPageStats>({
    totalUsers: 0,
    activeUsers: 0,
    pendingUsers: 0,
    blockedUsers: 0,
    notBlockedUsers: 0,
    usersWithRequests: 0,
    usersWithOverdueRequests: 0,
  });

  // Загрузка общей статистики
  const fetchStats = useCallback(async () => {
    try {
      console.log("📊 [useUsersData] Загрузка статистики дашборда...");
      const response = await dashboardService.getStats();
      console.log("📊 [useUsersData] Статистика дашборда:", response);

      if (response.success && response.data) {
        setStats((prev) => ({
          ...prev,
          totalUsers: response.data?.totalUsers || prev.totalUsers,
          activeUsers: response.data?.activeUsers || prev.activeUsers,
        }));
      }
    } catch (error) {
      console.error("❌ [useUsersData] Ошибка загрузки статистики:", error);
    }
  }, []);

  // Загрузка пользователей
  const fetchUsers = useCallback(
    async (page = 1, filtersOverride?: Partial<UsersPageFilters>) => {
      setIsLoading(true);
      setError("");

      try {
        const currentFilters = { ...filters, ...(filtersOverride || {}) };

        console.log("🔍 [useUsersData] Запрос пользователей с фильтрами:", {
          page,
          search: searchTerm,
          filters: currentFilters,
          itemsPerPage: pagination.itemsPerPage,
        });

        // Подготавливаем параметры для API
        const apiParams: Record<string, any> = {
          page,
          limit: pagination.itemsPerPage,
          search: searchTerm || undefined,
          sortBy: "created_at",
          sortOrder: "desc",
        };

        // Добавляем фильтры статуса
        if (currentFilters.status === "active") {
          apiParams.isActive = "true";
        } else if (currentFilters.status === "inactive") {
          apiParams.isActive = "false";
        }

        // Добавляем фильтры блокировки
        if (currentFilters.isBlocked === "blocked") {
          apiParams.isBlocked = "true";
        } else if (currentFilters.isBlocked === "not-blocked") {
          apiParams.isBlocked = "false";
        }

        // Добавляем фильтры запросов
        if (currentFilters.hasRequests !== "all") {
          apiParams.hasRequests = currentFilters.hasRequests;
        }

        if (currentFilters.requestType !== "all") {
          apiParams.requestType = currentFilters.requestType;
        }

        if (currentFilters.isOverdue !== "all") {
          apiParams.isOverdue = currentFilters.isOverdue;
        }

        if (
          currentFilters.requestStatus &&
          currentFilters.requestStatus !== "all"
        ) {
          apiParams.requestStatus = currentFilters.requestStatus;
        }

        apiParams.sortOrder = (apiParams.sortOrder || "DESC").toUpperCase();
        
        const response = await usersService.getAll(apiParams);

        console.log("📥 [useUsersData] Ответ от сервера:", {
          success: response.success,
          usersCount: response.users?.length,
          pagination: response.pagination,
          stats: response.stats,
        });

        if (response.success && response.users) {
          // Пользователи
          const usersData = response.users;
          setUsers(usersData);
          setFilteredUsers(usersData);

          // Пагинация
          if (response.pagination) {
            setPagination({
              currentPage: response.pagination.currentPage || page,
              totalPages: response.pagination.totalPages || 1,
              totalItems: response.pagination.totalItems || 0,
              itemsPerPage:
                response.pagination.itemsPerPage || pagination.itemsPerPage,
            });
          }

          // Статистика из ответа
          if (response.stats) {
            setStats((prev) => ({
              ...prev,
              totalUsers: response.stats?.totalUsers || prev.totalUsers,
              activeUsers: response.stats?.activeUsers || prev.activeUsers,
              pendingUsers: response.stats?.pendingUsers || prev.pendingUsers,
              blockedUsers: response.stats?.blockedUsers || prev.blockedUsers,
              notBlockedUsers:
                response.stats?.notBlockedUsers || prev.notBlockedUsers,
              usersWithRequests:
                response.stats?.usersWithRequests || prev.usersWithRequests,
              usersWithOverdueRequests:
                response.stats?.usersWithOverdueRequests ||
                prev.usersWithOverdueRequests,
            }));
          }

          // Безопасный подсчет статистики с проверкой на undefined
          const blockedCount = usersData.filter((u) => u.isBlocked).length;
          const withRequestsCount = usersData.filter(
            (u) => (u.supportRequests?.total || 0) > 0
          ).length;
          const withOverdueCount = usersData.filter(
            (u) => u.supportRequests?.overdue
          ).length;

          console.log("✅ [useUsersData] Пользователи загружены:", {
            count: usersData.length,
            blocked: blockedCount,
            withRequests: withRequestsCount,
            withOverdue: withOverdueCount,
          });
        } else {
          const errorMsg = response.message || "Ошибка загрузки пользователей";
          setError(errorMsg);
        }
      } catch (error: any) {
        console.error("❌ [useUsersData] Ошибка fetchUsers:", error);
        const errorMsg = error.message || "Ошибка соединения с сервером";
        setError(errorMsg);
      } finally {
        setIsLoading(false);
      }
    },
    [searchTerm, pagination.itemsPerPage, filters]
  );

  // Функция для применения фильтров локально (опционально)
  const applyLocalFilters = useCallback(() => {
    let filtered = [...users];

    // Фильтрация по поисковому запросу
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (user) =>
          user.login.toLowerCase().includes(search) ||
          user.email.toLowerCase().includes(search)
      );
    }

    // Фильтрация по статусу
    if (filters.status !== "all") {
      filtered = filtered.filter((user) =>
        filters.status === "active" ? user.isActive : !user.isActive
      );
    }

    // Фильтрация по блокировке
    if (filters.isBlocked !== "all") {
      filtered = filtered.filter((user) =>
        filters.isBlocked === "blocked" ? user.isBlocked : !user.isBlocked
      );
    }

    // Фильтрация по наличию запросов
    if (filters.hasRequests !== "all") {
      filtered = filtered.filter((user) => {
        const hasRequests = (user.supportRequests?.total || 0) > 0;
        return filters.hasRequests === "true" ? hasRequests : !hasRequests;
      });
    }

    // Фильтрация по типу запроса
    if (filters.requestType !== "all") {
      filtered = filtered.filter((user) => {
        let requestCount = 0;

        switch (filters.requestType) {
          case "password_reset":
            requestCount = user.supportRequests?.password_reset || 0;
            break;
          case "email_change":
            requestCount = user.supportRequests?.email_change || 0;
            break;
          case "unblock":
            requestCount = user.supportRequests?.unblock || 0;
            break;
          case "account_deletion":
            requestCount = user.supportRequests?.account_deletion || 0;
            break;
          case "other":
            requestCount = user.supportRequests?.other || 0;
            break;
          default:
            requestCount = 0;
        }

        return requestCount > 0;
      });
    }

    // Фильтрация по просроченным запросам
    if (filters.isOverdue !== "all") {
      filtered = filtered.filter((user) => {
        const isOverdue = user.supportRequests?.overdue || false;
        return filters.isOverdue === "true" ? isOverdue : !isOverdue;
      });
    }

    setFilteredUsers(filtered);
  }, [users, searchTerm, filters]);

  // Функция для сброса фильтров
  const resetFilters = useCallback(() => {
    setSearchTerm("");
    setFilters({
      status: "all",
      isBlocked: "all",
      hasRequests: "all",
      requestType: "all",
      isOverdue: "all",
      requestStatus: "all",
    });
    setFilteredUsers(users);
    fetchUsers(1);
  }, [users, fetchUsers]);

  // Функция для обновления отдельных фильтров
  const updateFilter = useCallback(
    (filterName: keyof UsersPageFilters, value: any) => {
      setFilters((prev) => ({
        ...prev,
        [filterName]: value,
      }));
    },
    []
  );

  return {
    // Состояние
    users,
    filteredUsers,
    isLoading,
    error,
    pagination,
    stats,
    searchTerm,
    filters,

    // Сеттеры
    setSearchTerm,
    setFilters,

    // Действия
    fetchUsers,
    fetchStats,
    applyLocalFilters,
    resetFilters,
    updateFilter,
  };
};

export default useUsersData;
