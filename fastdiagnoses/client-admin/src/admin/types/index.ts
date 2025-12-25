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

export interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  totalImages: number;
  totalSurveys: number;
  storageUsed: string;
  recentActivity: ActivityLog[];
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

// Основной интерфейс ответа API
export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  timestamp: string;
}

// Для админ-панели (с токеном)
export interface AdminApiResponse<T = any> extends ApiResponse<T> {
  token?: string;
  admin?: AdminUser; // Добавлено поле admin
}

// Для авторизации
export interface AuthResponse extends AdminApiResponse {
  admin?: AdminUser; // Исправлено с user на admin
}

// Для пагинации
export interface PaginatedResponse<T> extends AdminApiResponse {
  data?: {
    items: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface PaginatedData<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}