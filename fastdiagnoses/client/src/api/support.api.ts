import { fetchClient } from './fetchClient';
import { APIResponse } from './BaseApiService';

// Типы для заявок техподдержки
export interface SupportRequestData {
  type: string;
  login: string;
  email: string;
  secretWord: string;
  message: string;
  password?: string;
  newEmail?: string;
  blockReason?: string;
}

// Тип для данных успешного ответа
export interface SupportResponseData {
  requestId: string;
  email: string;
  note?: string;
}

// Тип для ответа от сервера техподдержки
export interface SupportApiResponse {
  success: boolean;
  message?: string;
  data?: SupportResponseData;
  field?: string;
}

// Общий тип ответа от fetchClient (обертка)
export interface SupportRequestResponse {
  success: boolean;
  message?: string;
  data?: SupportApiResponse;
  status?: number;
  field?: string;
  responseTime?: number;
}

export interface RequestType {
  value: string;
  label: string;
  description: string;
}

// Тип для данных статуса заявки
export interface SupportStatusData {
  requestId: string;
  type: string;
  status: string;
  created: string;
  updated: string;
  resolved?: string;
  rawStatus: string;
}

// Тип для ответа статуса
export interface SupportStatusResponse {
  success: boolean;
  message?: string;
  data?: SupportStatusData;
  status?: number;
  field?: string;
  responseTime?: number;
}

// Тип для ответа от fetchClient для статуса
export interface SupportStatusApiResponse extends APIResponse {
   data?: {
    success: boolean;
    data?: SupportStatusData;
    message?: string;
  };
}

// Функция для определения почтового провайдера
const getEmailProviderInfo = (domain: string): { name: string; url: string } => {
  const providers: Record<string, { name: string; url: string }> = {
    'gmail.com': { name: 'Gmail', url: 'https://mail.google.com' },
    'yandex.ru': { name: 'Яндекс', url: 'https://mail.yandex.ru' },
    'yandex.com': { name: 'Яндекс', url: 'https://mail.yandex.com' },
    'ya.ru': { name: 'Яндекс', url: 'https://mail.yandex.ru' },
    'mail.ru': { name: 'Mail.ru', url: 'https://mail.ru' },
    'bk.ru': { name: 'Mail.ru', url: 'https://mail.ru' },
    'inbox.ru': { name: 'Mail.ru', url: 'https://mail.ru' },
    'list.ru': { name: 'Mail.ru', url: 'https://mail.ru' },
    'outlook.com': { name: 'Outlook', url: 'https://outlook.live.com' },
    'hotmail.com': { name: 'Outlook', url: 'https://outlook.live.com' },
    'live.com': { name: 'Outlook', url: 'https://outlook.live.com' },
    'yahoo.com': { name: 'Yahoo', url: 'https://mail.yahoo.com' },
    'rambler.ru': { name: 'Rambler', url: 'https://mail.rambler.ru' },
    'icloud.com': { name: 'iCloud', url: 'https://www.icloud.com/mail' },
  };

  return providers[domain] || { name: 'почтовый сервис', url: '' };
};

// API методы для техподдержки
export const supportApi = {
  /**
   * Отправка заявки в техподдержку
   */
  async submitRequest(data: SupportRequestData): Promise<SupportRequestResponse> {
    console.log('📨 [supportApi] Отправка заявки:', { 
      type: data.type, 
      login: data.login,
      email: data.email.substring(0, 3) + '...'
    });

    try {
      const response = await fetchClient.post<SupportApiResponse>(
        '/support/submit',
        data
      );

      console.log('📨 [supportApi] Ответ от fetchClient:', {
        success: response.success,
        hasData: !!response.data,
        message: response.message
      });

      return response;
    } catch (error: any) {
      console.error('❌ [supportApi] Ошибка при отправке заявки:', error);
      return {
        success: false,
        message: error.message || 'Ошибка сети при отправке заявки'
      };
    }
  },

  /**
   * Проверка статуса заявки
   */
  async checkStatus(publicId: string): Promise<SupportStatusApiResponse> {
    console.log('🔍 [supportApi] Проверка статуса заявки:', publicId);

    try {
      const response = await fetchClient.get<SupportStatusData>(
        `/support/status/${publicId}`
      );

      // Приводим ответ к правильному типу
      const typedResponse: SupportStatusApiResponse = {
        success: response.success,
        message: response.message,
        data: response.data,
        status: response.status,
        field: response.field,
        responseTime: response.responseTime
      };

      console.log('🔍 [supportApi] Ответ от сервера:', {
        success: typedResponse.success,
        data: typedResponse.data,
        message: typedResponse.message
      });

      return typedResponse;
    } catch (error: any) {
      console.error('❌ [supportApi] Ошибка при проверке статуса:', error);
      return {
        success: false,
        message: error.message || 'Ошибка сети при проверке статуса'
      };
    }
  },

  /**
   * Получение типов заявок
   */
  getRequestTypes(): RequestType[] {
    return [
      { 
        value: 'password_reset', 
        label: 'Смена пароля', 
        description: 'Забыл пароль от аккаунта' 
      },
      { 
        value: 'email_change', 
        label: 'Смена email', 
        description: 'Хочу изменить email аккаунта' 
      },
      { 
        value: 'unblock', 
        label: 'Разблокировка аккаунта', 
        description: 'Меня заблокировали в системе' 
      },
      { 
        value: 'account_deletion', 
        label: 'Удаление аккаунта', 
        description: 'Хочу удалить свой аккаунт' 
      },
      { 
        value: 'other', 
        label: 'Другая проблема', 
        description: 'Любая другая проблема или вопрос' 
      }
    ];
  },

  /**
   * Подтверждение email
   */
  async confirmEmail(token: string): Promise<APIResponse> {
    console.log('📧 [supportApi] Подтверждение email по токену');

    try {
      const response = await fetchClient.get<APIResponse>(
        `/support/confirm/${token}`
      );

      return response;
    } catch (error: any) {
      console.error('❌ [supportApi] Ошибка при подтверждении email:', error);
      return {
        success: false,
        message: error.message || 'Ошибка сети при подтверждении email'
      };
    }
  },

  /**
   * Получение информации о почтовом провайдере
   */
  getEmailProvider(email: string): { name: string; url: string } {
    if (!email || !email.includes('@')) {
      return { name: 'почтовый сервис', url: '' };
    }
    
    const domain = email.split('@')[1]?.toLowerCase() || '';
    return getEmailProviderInfo(domain);
  },

  /**
   * Открытие почтового клиента
   */
  openEmailClient(email: string): void {
    console.log('📧 [supportApi] Открытие почтового клиента для:', email);
    
    if (!email || email.trim() === '') {
      console.error('❌ [supportApi] Email пустой!');
      alert('Email не указан');
      return;
    }

    try {
      const provider = supportApi.getEmailProvider(email);
      console.log('📧 [supportApi] Почтовый провайдер:', provider.name);
      
      let emailUrl = '';
      
      if (provider.url) {
        // Открываем страницу почтового сервиса
        emailUrl = provider.url;
      } else {
        // Если провайдер неизвестен, используем mailto
        emailUrl = `mailto:${email}`;
      }
      
      console.log('📧 [supportApi] Открываем URL:', emailUrl);
      
      // Открываем в новой вкладке
      window.open(emailUrl, '_blank', 'noopener,noreferrer');
      
    } catch (error) {
      console.error('❌ [supportApi] Ошибка:', error);
      // Fallback на mailto
      window.open(`mailto:${email}`, '_blank', 'noopener,noreferrer');
    }
  }
};