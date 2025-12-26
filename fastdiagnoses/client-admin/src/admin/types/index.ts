// ==================== ОСНОВНЫЕ ТИПЫ ====================

export interface AdminLoginCredentials {
  username: string;
  password: string;
}

export interface AdminUser {
  id: number;
  username: string;
  email: string;
  role: 'admin' | 'moderator';
  fullName?: string;
  createdAt: string;
  lastLogin: string | null;
  isActive: boolean;
}

// ==================== ДАШБОРД ====================

export interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  totalImages: number;
  totalSurveys: number;
  storageUsed: string;
  recentActivity: ActivityLog[];
  additionalStats?: {
    newRegistrations7d?: number;
    totalStorageMB?: number;
  };
}

export interface ActivityLog {
  id: number;
  action: string;
  user: string;
  timestamp: string;
  ip?: string;
}

export interface SystemLog {
  id: number;
  level: 'info' | 'warning' | 'error';
  message: string;
  timestamp: string;
  source: string;
  details?: string;
}

// ==================== ОТВЕТЫ API ====================

export interface ApiResponse {
  success: boolean;
  message?: string;
  error?: string;
  timestamp: string;
}

// Базовый ответ для админ-панели
export interface AdminApiResponse extends ApiResponse {
  token?: string;
  admin?: AdminUser;
}

// Ответ с данными (используем extends для конкретных ответов)
export interface AdminApiResponseWithData<T = any> extends AdminApiResponse {
  data?: T;
}

// ==================== ТИПЫ ДЛЯ БЛОКИРОВКИ ====================

export interface BlockUserRequest {
  duration: '7d' | '30d' | 'forever';
  reason?: string;
  deleteSessions?: boolean;
}

// Упрощаем - данные сразу в корне
export interface BlockUserResponse extends AdminApiResponse {
  login?: string;
  email?: string;
  duration?: string;
  blocked_until?: string;
  formatted_blocked_until?: string;
  reason?: string | null;
  sessions_deleted?: boolean;
  sessions_deleted_count?: number;
  blocked_by_admin?: {
    id: number;
    username: string;
  };
}

export interface UnblockUserResponse extends AdminApiResponse {
  login?: string;
  email?: string;
  previously_blocked?: boolean;
  previously_blocked_until?: string | null;
  blocked_record_updated?: boolean;
  unblocked_by_admin?: {
    id: number;
    username: string;
  };
}

// ==================== ТИПЫ ПОЛЬЗОВАТЕЛЕЙ ====================

export interface User {
  id: string; // login используется как id
  login: string;
  email: string;
  isActive: boolean;
  isBlocked: boolean;
  blockedUntil?: string | null;
  blockedUntilFormatted?: string | null;
  isPermanentlyBlocked?: boolean;
  daysRemaining?: number | null;
  createdAt: string;
  activeSessions: number;
  hasUserTable: boolean;
  stats: {
    surveys: number;
    images: number;
  };
}

// Ответ для списка пользователей - данные сразу в корне
export interface UsersResponse extends AdminApiResponse {
  users?: User[];
  pagination?: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
  };
  stats?: {
    totalUsers: number;
    activeUsers: number;
    pendingUsers: number;
    blockedUsers: number;
    notBlockedUsers: number;
  };
  filters?: {
    search: string;
    isActive?: string;
    isBlocked?: string;
    sortBy: string;
    sortOrder: string;
  };
}

// Ответ для деталей пользователя - данные сразу в корне
export interface UserDetailsResponse extends AdminApiResponse {
  user?: {
    login: string;
    email: string;
    isActive: boolean;
    isBlocked: boolean;
    blockStatus?: 'active' | 'temporarily_blocked' | 'permanently_blocked' | 'expired_block';
    blockedUntil?: string | null;
    blockedUntilFormatted?: string | null;
    isPermanentlyBlocked?: boolean;
    daysRemaining?: number | null;
    createdAt: string;
    lastLogin?: string | null;
    sessionCount: number;
    failedLogins7d?: number;
    hasUserTable: boolean;
  };
  userStats?: {
    surveyCount: number;
    imageCount: number;
    lastActivity?: string | null;
    totalStorage?: number;
    formattedStorage?: string;
  };
  sessions?: Array<{
    id: number;
    loginTime: string;
    tokenPrefix: string | null;
  }>;
  recentActivity?: Array<{
    ip: string;
    success: boolean;
    timestamp: string;
    type: string;
  }>;
  blockHistory?: Array<{
    id: number;
    ip: string;
    userAgent: string;
    blockedUntil: string;
    attemptedAt: string;
    autoUnblocked: boolean;
    unblockedAt: string | null;
    status: 'active_block' | 'auto_unblocked' | 'manually_unblocked';
  }>;
  adminActions?: Array<{
    action: string;
    admin: string;
    details: any;
    timestamp: string;
  }>;
}

// ==================== ФИЛЬТРЫ ====================

export interface UsersFilterParams {
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  isActive?: string;
  isBlocked?: string;
}

// ==================== ЭКСПОРТ ВСЕХ ТИПОВ ====================

export type {
  AdminApiResponse as BaseAdminResponse,
  BlockUserRequest as BlockRequest,
  BlockUserResponse as BlockResponse,
  UnblockUserResponse as UnblockResponse,
  UsersResponse as UsersListResponse,
  UserDetailsResponse as UserDetailResponse,
  UsersFilterParams as FilterParams,
};