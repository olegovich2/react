import { fetchClient } from './fetchClient';
import { LoginCredentials, RegisterData, APIResponse } from '../types/api.types';

/**
 * Вход в систему
 * Точная копия postDataForVerify из requestsForEntry.js
 */
export const login = async (credentials: LoginCredentials): Promise<APIResponse> => {
  try {
    console.log('Отправка данных для входа:', credentials.login);
    
    const result = await fetchClient.post('/entryData', credentials);
    
    // Если успешно, сохраняем пользователя как в вашем коде
    if (result.success && result.data) {
      console.log('Вход успешен, сохраняем пользователя:', result.data.login);
      
      localStorage.setItem('user', JSON.stringify(result.data));
      localStorage.setItem('token', result.data.jwt_access);
      
      // Редирект на главную как в вашем redirectToMain()
      setTimeout(() => {
        window.location.href = '/';
      }, 100);
      
      return {
        success: true,
        data: result.data,
        message: 'Вход успешен'
      };
    }
    
    return result;
    
  } catch (error: any) {
    console.error('Ошибка входа:', error);
    return {
      success: false,
      message: error.message || 'Ошибка входа'
    };
  }
};

/**
 * Регистрация
 * Точная копия отправки на /main/auth/variants
 */
export const register = async (data: RegisterData): Promise<APIResponse> => {
  try {
    console.log('Регистрация пользователя:', data.login);
    
    // Создаем FormData КАК В БРАУЗЕРЕ
    const formData = new FormData();
    formData.append('login', data.login);
    formData.append('password', data.password);
    formData.append('email', data.email);
    
    // Отправляем КАК В ВАШЕМ HTML ФОРМЕ
    const result = await fetchClient.postFormData('/main/auth/variants', formData);
    
    // Ваш сервер делает редирект или возвращает HTML
    if (result.redirected && result.redirectUrl) {
      const redirectUrl = result.redirectUrl;
      
      // Проверяем куда редирект
      if (redirectUrl.includes('/main/auth/success')) {
        const urlParams = new URLSearchParams(redirectUrl.split('?')[1]);
        const login = urlParams.get('login');
        
        return {
          success: true,
          message: `Регистрация успешна! Пользователь ${login} зарегистрирован. Проверьте email для подтверждения.`
        };
      }
      
      if (redirectUrl.includes('/main/auth/error')) {
        const urlParams = new URLSearchParams(redirectUrl.split('?')[1]);
        const errorMessage = urlParams.get('errorMessage');
        
        return {
          success: false,
          message: errorMessage || 'Ошибка регистрации'
        };
      }
    }
    
    // Если сервер вернул HTML с ошибкой
    if (!result.success && result.message) {
      return result;
    }
    
    // Если дошло до сюда без ошибок
    return {
      success: true,
      message: 'Регистрация отправлена. Проверьте email для подтверждения.'
    };
    
  } catch (error: any) {
    console.error('Ошибка регистрации:', error);
    return {
      success: false,
      message: error.message || 'Ошибка регистрации'
    };
  }
};

/**
 * Проверка JWT токена
 * Точная копия checkJWT из requestsForSurveys.js
 */
export const checkJWT = async (): Promise<APIResponse> => {
  try {
    const result = await fetchClient.post('/checkJWT', {});
    
    if (result.redirected) {
      return {
        success: false,
        message: 'Токен недействителен',
        redirected: true
      };
    }
    
    return {
      success: true,
      message: 'Токен действителен'
    };
    
  } catch (error: any) {
    return {
      success: false,
      message: error.message || 'Ошибка проверки токена'
    };
  }
};

/**
 * Редирект на главную
 * Точная копия redirectToMain из requests.js
 */
export const redirectToMain = async (): Promise<APIResponse> => {
  try {
    const result = await fetchClient.post('/toMain', {});
    
    if (result.redirected && result.redirectUrl) {
      window.location.href = result.redirectUrl;
    }
    
    return result;
    
  } catch (error: any) {
    return {
      success: false,
      message: error.message || 'Ошибка редиректа'
    };
  }
};

/**
 * Редирект на страницу аккаунта
 * Точная копия redirectToAccount из requestsForSurveys.js
 */
export const redirectToAccount = async (): Promise<APIResponse> => {
  try {
    const result = await fetchClient.post('/toAccount', {});
    
    if (result.redirected && result.redirectUrl) {
      window.location.href = result.redirectUrl;
    }
    
    return result;
    
  } catch (error: any) {
    return {
      success: false,
      message: error.message || 'Ошибка редиректа'
    };
  }
};