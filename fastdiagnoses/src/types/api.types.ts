export interface User {
  id?: number;
  login: string;
  jwt_access: string;
  email?: string;
}

export interface Survey {
  id?: string;
  date: string;
  nameSurname: string;
  age: number;
  temperature: string;
  anamnesis: string;
  title: string[];
  diagnostic: string[];
  treatment: string[];
  otherGuidelines: string[];
}

export interface ImageData {
  id: string;
  fileNameOriginIMG: string;
  originIMG: string;
  smallIMG: string;
  comment: string;
}

export interface WebSocketMessage {
  websocketId: string;
  message: string;
  [key: string]: any;
}

export interface LoginCredentials {
  login: string;
  password: string;
}

export interface RegisterData {
  login: string;
  password: string;
  email: string;
  confirmPassword?: string;
}

// ⚡ ОБНОВЛЕННЫЙ ТИП APIResponse
export interface APIResponse {
  success: boolean;
  message?: string;
  data?: any;
  redirected?: boolean;        // ← ДОБАВЛЯЕМ
  redirectUrl?: string;        // ← ДОБАВЛЯЕМ
}

export interface SurveyListResponse {
  surveys: Record<string, string>;
  images: Record<string, ImageData>;
}

export interface ProgressUpdate {
  value: number;
  when: 'request' | 'write';
}