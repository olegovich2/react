import { fetchClient } from './fetchClient';

// Аутентификация
export const checkJWT = async (): Promise<{success: boolean}> => {
  // Проверяем есть ли токен
  const token = localStorage.getItem('token');
  if (!token) {
    return { success: false };
  }
  
  try {
    const result = await fetchClient.verifyToken();
    
    // Проверяем успешность и статус
    if (result.success) {
      return { success: true };
    } else {
      // Если 401 или любая другая ошибка
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      return { success: false };
    }
  } catch (error) {
    console.error('JWT check error:', error);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    return { success: false };
  }
};

export const login = async (login: string, password: string) => {
  return fetchClient.login(login, password);
};

export const register = async (login: string, password: string, email: string) => {
  return fetchClient.register(login, password, email);
};

export const confirmEmail = async (token: string) => {
  return fetchClient.get(`/auth/confirm/${token}`);
};

export const logoutUser = async () => {
  return fetchClient.logout();
};

// ==================== ВАЖНО! ЗАМЕНА СТАРЫХ МЕТОДОВ ====================

// Опросы - используем surveysApi вместо старых методов fetchClient
export const saveSurveyToAccount = async (survey: any) => {
  // Вместо fetchClient.saveSurvey() используем surveysApi
  // Нужно добавить импорт surveysApi
  // return surveysApi.saveSurveyToDB(survey);
  throw new Error('Этот метод устарел. Используйте surveysApi.saveSurveyToDB()');
};

export const getSurveysFromAccount = async () => {
  // ❌ УСТАРЕЛО: fetchClient.getSurveys() - старый эндпоинт без пагинации
  // ✅ ИСПОЛЬЗУЙ: surveysApi.getPaginatedSurveys() или surveysApi.getUserSurveys()
  throw new Error('Этот метод устарел. Используйте surveysApi.getPaginatedSurveys()');
};

export const deleteSurvey = async (id: number) => {
  // Вместо fetchClient.deleteSurveyOrImage() используем surveysApi
  // return surveysApi.deleteSurvey(id);
  throw new Error('Этот метод устарел. Используйте surveysApi.deleteSurvey()');
};

// Изображения
export const uploadImage = async (filename: string, base64Data: string, comment?: string) => {
  return fetchClient.uploadImageBase64(filename, base64Data, comment);
};

export const getImage = async (id: number) => {
  return fetchClient.getImageById(id);
};

// Диагнозы
export const searchDiagnoses = async (titles: string[]) => {
  return fetchClient.searchDiagnoses(titles);
};

// Утилиты
export const getCurrentUser = () => {
  return fetchClient.getCurrentUser();
};

export const isAuthenticated = () => {
  return fetchClient.isAuthenticated();
};

export const checkConnection = async () => {
  return fetchClient.checkConnection();
};