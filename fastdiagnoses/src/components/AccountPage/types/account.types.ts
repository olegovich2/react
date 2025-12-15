// src/components/AccountPage/types/account.types.ts

// ==================== БАЗОВЫЕ ТИПЫ ====================
export interface APIResponse {
  success: boolean;
  message?: string;
  status?: number;
  field?: string;
  responseTime?: number;
  data?: any;
}

// ==================== ОПРОСЫ ====================
export interface Survey {
  id: number;
  date: string;
  nameSurname: string;
  age: string;
  temperature: string;
  anamnesis: string;
  title: string[];
  diagnostic: string[];
  treatment: string[];
  otherGuidelines: string[];
  survey?: string | object;
}

// ==================== ИЗОБРАЖЕНИЯ ====================
export interface UploadedImage {
  id: number;
  fileName: string;
  comment: string;
  smallImage: string;
  originIMG?: string;
}

// ==================== РЕЗУЛЬТАТЫ ОПРОСА ====================
export interface SurveyResult {
  survey: Survey;
  recommendations?: {
    titles: string[];
    diagnostic: string[];
    treatment: string[];
  };
  createdAt?: string;
}

// ==================== УДАЛЕНИЕ ====================
export interface DeleteResponse {
  success: boolean;
  message: string;
  deletedId?: number;
}

// ==================== ПАГИНАЦИЯ ====================
export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  message?: string;
}

// ==================== ФОРМЫ ДАННЫХ ====================
export interface FormData {
  [key: string]: any;
}

// ==================== МОДАЛЬНЫЕ ОКНА ====================
export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
}

// ==================== ЗАГРУЗКА ФАЙЛОВ ====================
export interface FileUploadProgress {
  loaded: number;
  total: number;
  percentage: number;
  filename: string;
}

export interface FileValidationResult {
  valid: boolean;
  message?: string;
  errors?: string[];
}

// ==================== ИСТОРИЯ ДЕЙСТВИЙ ====================
export interface AccountHistoryItem {
  id: number;
  action: 'create' | 'update' | 'delete' | 'view' | 'upload' | 'download';
  entityType: 'survey' | 'image' | 'user';
  entityId: number;
  timestamp: string;
  details?: Record<string, any>;
}

// ==================== СТАТИСТИКА АККАУНТА ====================
export interface AccountStats {
  totalSurveys: number;
  totalImages: number;
  lastSurveyDate?: string;
  lastImageDate?: string;
  storageUsed: number; // в байтах
  surveysByMonth: Array<{
    month: string;
    count: number;
  }>;
}

// ==================== ФИЛЬТРЫ И СОРТИРОВКА ====================
export interface SurveyFilters {
  dateFrom?: string;
  dateTo?: string;
  nameContains?: string;
  hasImages?: boolean;
  sortBy?: 'date' | 'name' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

export interface ImageFilters {
  dateFrom?: string;
  dateTo?: string;
  filenameContains?: string;
  hasComment?: boolean;
  sortBy?: 'filename' | 'createdAt' | 'size';
  sortOrder?: 'asc' | 'desc';
}

// ==================== ЭКСПОРТ ДАННЫХ ====================
export interface ExportOptions {
  format: 'json' | 'csv' | 'pdf' | 'word';
  includeSurveys: boolean;
  includeImages: boolean;
  dateRange?: {
    start: string;
    end: string;
  };
}

export interface ExportResult {
  success: boolean;
  url?: string;
  filename?: string;
  message?: string;
}

// ==================== НАСТРОЙКИ АККАУНТА ====================
export interface AccountSettings {
  autoSaveSurveys: boolean;
  compressImages: boolean;
  maxImageSize: number; // в МБ
  notifications: {
    email: boolean;
    push: boolean;
  };
  privacy: {
    showName: boolean;
    shareStatistics: boolean;
  };
}

// ==================== КОМПОНЕНТ ПРОПСЫ ====================
export interface SurveyListProps {
  surveys: Survey[];
  onView: (survey: Survey) => void;
  onDelete: (id: number) => void;
  isLoading?: boolean;
  filters?: SurveyFilters;
}

export interface ImageGalleryProps {
  images: UploadedImage[];
  onView: (imageId: number) => void;
  onDelete: (imageId: number) => void;
  isLoading?: boolean;
  filters?: ImageFilters;
}

export interface ImageUploadProps {
  onUploadSuccess: () => void;
  maxSize?: number; // в МБ
  allowedTypes?: string[];
}

export interface ResultSurveyProps {
  survey: Survey;
  onClose: () => void;
  onSaveAsWord?: () => void;
  onPrint?: () => void;
}

// ==================== СОСТОЯНИЕ АККАУНТА ====================
export interface AccountState {
  surveys: Survey[];
  images: UploadedImage[];
  selectedSurvey: Survey | null;
  selectedImage: UploadedImage | null;
  isLoading: boolean;
  error: string | null;
  filters: {
    surveys: SurveyFilters;
    images: ImageFilters;
  };
  stats: AccountStats | null;
}

// ==================== СОБЫТИЯ АККАУНТА ====================
export interface AccountEvent {
  type: 'survey_created' | 'survey_deleted' | 'image_uploaded' | 'image_deleted' | 'data_exported';
  data: any;
  timestamp: number;
  userId?: number;
}

// ==================== ТИПЫ ДЛЯ API ОТВЕТОВ ====================
export interface SurveysResponse extends APIResponse {
  data?: Survey[];
}

export interface ImagesResponse extends APIResponse {
  data?: UploadedImage[];
}

export interface AccountResponse extends APIResponse {
  data?: {
    surveys: Survey[];
    images: UploadedImage[];
    stats?: AccountStats;
  };
}