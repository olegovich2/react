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

// Опросы
export const saveSurveyToAccount = async (survey: any) => {
  return fetchClient.saveSurvey(survey);
};

export const getSurveysFromAccount = async () => {
  return fetchClient.getSurveys();
};

export const deleteSurvey = async (id: number) => {
  return fetchClient.deleteSurveyOrImage(id);
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