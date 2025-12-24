import { fetchClient } from './fetchClient';

export const confirmEmail = async (token: string): Promise<{
  success: boolean;
  html?: string;
  message?: string;
  status?: number;
}> => {
  try {
    const baseURL = fetchClient.getBaseURL();
    const url = `${baseURL}/auth/confirm/${token}`;
    
    console.log('🔄 Отправка запроса подтверждения email:', url);
    
    // Используем прямой fetch, так как сервер возвращает HTML
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'text/html, application/json',
        'Cache-Control': 'no-cache',
      },
      credentials: 'include',
    });
    
    const html = await response.text();
    
    console.log(`✅ Ответ подтверждения email: статус ${response.status}`);
    
    if (response.ok) {
      return {
        success: true,
        html,
        status: response.status,
        message: 'Email успешно подтвержден'
      };
    } else {
      return {
        success: false,
        html,
        status: response.status,
        message: `Ошибка подтверждения: ${response.status} ${response.statusText}`
      };
    }
    
  } catch (error: any) {
    console.error('❌ Ошибка подтверждения email:', error);
    
    return {
      success: false,
      message: error.message || 'Ошибка сети при подтверждении email',
      status: 0
    };
  }
};

