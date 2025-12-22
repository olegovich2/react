/**
 * Центральный экспорт всех сервисов
 * Устраняет циклические зависимости
 */

// Сервисы аутентификации
export { userDataService } from './auth/UserDataService';
export type { UserDataService } from './auth/UserDataService';
export type { User } from '../context/context.types'; 
