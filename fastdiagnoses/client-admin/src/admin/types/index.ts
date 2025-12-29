// ==================== БАЗОВЫЕ ТИПЫ API ====================

export interface ApiResponse {
  success: boolean;
  message?: string;
  error?: string;
  timestamp?: string;
}

// Основной ответ для админ-панели
export interface AdminApiResponse extends ApiResponse {
  token?: string;
  admin?: {
    id: number;
    username: string;
    email: string;
    role: string;
    createdAt: string;
    lastLogin?: string;
  };
  data?: any;
}

// ==================== АВТОРИЗАЦИЯ ====================

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

// ==================== БЛОКИРОВКА ПОЛЬЗОВАТЕЛЕЙ ====================

export interface BlockUserRequest {
  duration: '7d' | '30d' | 'forever';
  reason?: string;
  deleteSessions?: boolean;
}

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

// ==================== ПОЛЬЗОВАТЕЛИ ====================

// Основной интерфейс пользователя
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
  
  // НОВЫЕ ПОЛЯ ДЛЯ ЗАПРОСОВ ТЕХПОДДЕРЖКИ
  supportRequests?: {
    password_reset: number;
    email_change: number;
    unblock: number;
    account_deletion: number;
    other: number;
    total: number;
    overdue: boolean;
    overdueCount: number;
    oldestRequestId?: number | null;
    oldestRequestType?: string | null;
  };
}

// Ответ для списка пользователей
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
    usersWithRequests: number;
    usersWithOverdueRequests: number;
  };
  filters?: {
    search?: string;
    isActive?: string;
    isBlocked?: string;
    hasRequests?: string;
    requestType?: string;
    isOverdue?: string;
    requestStatus?: string;
    sortBy?: string;
    sortOrder?: string;
  };
}

// Ответ для деталей пользователя
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

// Параметры фильтрации пользователей
export interface UsersFilterParams {
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  isActive?: string;
  isBlocked?: string;
  // НОВЫЕ ФИЛЬТРЫ ДЛЯ ЗАПРОСОВ
  hasRequests?: string;
  requestType?: string;
  isOverdue?: string;
  requestStatus?: string;
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

// ==================== ТИПЫ ДЛЯ ЗАПРОСОВ ТЕХПОДДЕРЖКИ ====================

export interface SupportRequest {
  id: number;
  login: string;
  email?: string;
  type: 'password_reset' | 'email_change' | 'unblock' | 'account_deletion' | 'other';
  status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'rejected' | 'expired';
  details: {
    reason?: string;
    secretWord?: string;
    oldPassword?: string;
    oldEmail?: string;
    newEmail?: string;
    requestedEmail?: string;
    ipAddress?: string;
    userAgent?: string;
    [key: string]: any;
  };
  encryptedData?: string;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
  isOverdue: boolean;
  adminNotes?: string;
  processedBy?: string;
  processedAt?: string;
}

export interface ValidationResult extends AdminApiResponse {
  isValid: boolean;
  message?: string;
  details?: {
    secretWordMatch?: boolean;
    passwordMatch?: boolean;
    emailExists?: boolean;
    [key: string]: any;
  };
}

export interface ProcessResult extends AdminApiResponse {
  requestId: string;
  action: 'approve' | 'reject';
  result: {
    passwordReset?: boolean;
    newPassword?: string;
    emailChanged?: boolean;
    userUnblocked?: boolean;
    accountDeleted?: boolean;
    [key: string]: any;
  };
  nextSteps?: string[];
}

// ==================== ТИПЫ ДЛЯ КОМПОНЕНТОВ USERS PAGE ====================

export interface PaginationState {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
}

export interface UsersPageStats {
  totalUsers: number;
  activeUsers: number;
  pendingUsers: number;
  blockedUsers: number;
  notBlockedUsers: number;
  usersWithRequests: number;
  usersWithOverdueRequests: number;
}

export interface UsersPageFilters {
  status: 'all' | 'active' | 'inactive';
  isBlocked: 'all' | 'blocked' | 'not-blocked';
  hasRequests: 'all' | 'true' | 'false';
  requestType: 'all' | 'password_reset' | 'email_change' | 'unblock' | 'account_deletion' | 'other';
  isOverdue: 'all' | 'true' | 'false';
}

export type UsersPagePartialFilters = Partial<UsersPageFilters>;

export interface Notification {
  type: 'success' | 'error' | 'info';
  message: string;
}

// Типы для запросов техподдержки
export type SupportRequestType = 'password_reset' | 'email_change' | 'unblock' | 'account_deletion' | 'other';
export type SupportRequestStatus = 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'rejected' | 'expired';

// Улучшенный тип User с гарантированными supportRequests
export interface UserWithSupport extends User {
  supportRequests: {
    password_reset: number;
    email_change: number;
    unblock: number;
    account_deletion: number;
    other: number;
    total: number;
    overdue: boolean;
    overdueCount: number;
    oldestRequestId?: number | null;
    oldestRequestType?: string | null;
  };
}

// ==================== ЛОГИ ====================

export interface SystemLog {
  id: number;
  level: 'info' | 'warning' | 'error';
  message: string;
  timestamp: string;
  source: string;
  details?: string;
}

// ==================== ТИПЫ ДЛЯ ПРОВЕРКИ ЗАПРОСОВ ====================

export interface SupportRequestValidation {
  id: string;
  publicId: string;
  type: SupportRequestType;
  login: string;
  email: string;
  status: SupportRequestStatus;
  createdAt: string;
  updatedAt: string;
  isOverdue: boolean;
  newEmail?: string;
  message: string;
  adminNotes?: string;
}

export interface ValidationResult {
  success: boolean;
  isValid: boolean;  // true = все проверки прошли успешно
  errors?: string[]; // Список ошибок, если isValid = false
  checkedFields: {
    login: boolean;
    secretWord: boolean;
    password: boolean | null;
  };
  requestInfo: {
    id: string;
    publicId: string;
    type: SupportRequestType;
    login: string;
    email: string;
    status: SupportRequestStatus;
    createdAt: string;
    isOverdue: boolean;
  };
}

export interface SupportRequestLog {
  action: string;
  oldValue?: string;
  newValue?: string;
  actorType: 'system' | 'user' | 'admin';
  actorId?: string;
  createdAt: string;
}

export interface SupportRequestWithLogs {
  request: SupportRequestValidation;
  logs: SupportRequestLog[];
}

// ==================== ТИПЫ ДЛЯ ОТВЕТОВ API ====================

export interface SupportRequestsResponse extends AdminApiResponse {
  data?: {
    user: {
      login: string;
    };
    requests: SupportRequestValidation[];
    stats: {
      total: number;
      byType: Record<string, number>;
      byStatus: Record<string, number>;
    };
    filters: {
      type?: string;
      status?: string;
    };
  };
}

export interface SupportRequestInfoResponse extends AdminApiResponse {
  data?: SupportRequestWithLogs;
}

export interface ValidationResponse extends AdminApiResponse {
  isValid: boolean;
  errors?: string[];
  checkedFields: {
    login: boolean;
    secretWord: boolean;
    password: boolean | null;
  };
  requestInfo: {
    id: string;
    publicId: string;
    type: SupportRequestType;
    login: string;
    email: string;
    status: SupportRequestStatus;
    createdAt: string;
    isOverdue: boolean;
  };
}

// ==================== АЛЬЯСЫ ДЛЯ ОБРАТНОЙ СОВМЕСТИМОСТИ ====================

export type BaseAdminResponse = AdminApiResponse;
export type BlockRequest = BlockUserRequest;
export type BlockResponse = BlockUserResponse;
export type UnblockResponse = UnblockUserResponse;
export type UsersListResponse = UsersResponse;
export type UserDetailResponse = UserDetailsResponse;
export type FilterParams = UsersFilterParams;