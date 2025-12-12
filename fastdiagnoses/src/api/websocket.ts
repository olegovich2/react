import { WebSocketMessage, APIResponse } from '../types/api.types';

/**
 * WebSocket сервис для управления соединением и передачей файлов
 * Основано на logicPage.js и logicPage7680.js
 */

class WebSocketService {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 3000;
  private messageHandlers: Map<string, (data: any) => void> = new Map();
  private progressCallbacks: ((progress: number) => void)[] = [];
  
  // Состояния как в оригинальном коде
  private directory: string = '';
  private countMessage: number = 0;
  private websocketId: string = '';
  private login: string = '';

  constructor() {
    // Используем URL из .env или дефолтный
    this.url = process.env.REACT_APP_WS_URL || 'ws://localhost:3000';
  }

  /**
   * Подключение к WebSocket серверу
   */
  public connect(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          console.log('WebSocket соединение установлено');
          this.reconnectAttempts = 0;
          
          // Отправляем начальное сообщение как в оригинале
          this.sendInitialMessage();
          resolve(true);
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event);
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket ошибка:', error);
          reject(error);
        };

        this.ws.onclose = (event) => {
          console.log(`WebSocket соединение закрыто. Код: ${event.code}, Причина: ${event.reason}`);
          this.handleReconnection();
        };
      } catch (error) {
        console.error('Ошибка создания WebSocket:', error);
        reject(error);
      }
    });
  }

  /**
   * Отправка начального сообщения (как в оригинале)
   */
  private sendInitialMessage(): void {
    this.websocketId = Date.now().toString();
    const initialMessage: WebSocketMessage = {
      websocketId: this.websocketId,
      message: 'Соединение установлено'
    };
    this.send(initialMessage);
  }

  /**
   * Отправка сообщения на сервер
   */
  public send(message: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.error('WebSocket не подключен');
    }
  }

  /**
   * Обработка входящих сообщений
   */
  private handleMessage(event: MessageEvent): void {
    try {
      const data: WebSocketMessage = JSON.parse(event.data);
      console.log('Получено сообщение от сервера:', data.message);

      // Обработка прогресса загрузки (как в оригинале)
      if (data.message.includes('Получено данных: ')) {
        const percent = parseInt(data.message.replace('Получено данных: ', ''));
        this.updateProgress(percent / 2, 'request'); // Делим на 2 как в оригинале
      } else if (data.message.includes('Запись завершена на ')) {
        const percent = parseInt(data.message.replace('Запись завершена на ', ''));
        this.updateProgress(percent, 'write');
      } else if (data.message === 'Передача и запись данных успешно завершена') {
        this.updateProgress(100, 'complete');
        setTimeout(() => this.updateProgress(0, 'reset'), 2000);
      }

      // Логика из оригинального WebSocket кода
      if (data.message === 'Соединение установлено') {
        this.countMessage++;
      } else if (this.countMessage === 1) {
        this.directory = data.message;
        data.message = 'Получено название директории';
        this.countMessage++;
      } else if (data.message === 'CLOSE') {
        data.message = 'Передача данных завершена';
        this.directory = '';
        this.countMessage = 0;
        this.closeConnection();
      }

      // Вызов зарегистрированных обработчиков
      this.messageHandlers.forEach((handler, key) => {
        if (key === 'message' || data.message.includes(key)) {
          handler(data);
        }
      });
    } catch (error) {
      console.error('Ошибка обработки WebSocket сообщения:', error);
    }
  }

  /**
   * Обновление прогресс бара (как в оригинале)
   */
  private updateProgress(value: number, when: 'request' | 'write' | 'complete' | 'reset'): void {
    this.progressCallbacks.forEach(callback => {
      callback(when === 'request' ? value / 2 : value);
    });
  }

  /**
   * Регистрация обработчика прогресса
   */
  public onProgress(callback: (progress: number) => void): void {
    this.progressCallbacks.push(callback);
  }

  /**
   * Регистрация обработчика сообщений
   */
  public onMessage(type: string, callback: (data: any) => void): void {
    this.messageHandlers.set(type, callback);
  }

  /**
   * Загрузка файла через WebSocket (основная логика)
   */
  public async uploadFile(
    file: File, 
    comment: string, 
    login: string
  ): Promise<APIResponse> {
    return new Promise(async (resolve, reject) => {
      try {
        this.login = login;
        const fileId = Date.now().toString();

        // Чтение файла как ArrayBuffer
        const arrayBuffer = await this.readFileAsArrayBuffer(file);
        const base64Data = this.arrayBufferToBase64(arrayBuffer);

        // Подготовка данных как в оригинале
        const uploadData = {
          websocketid: fileId,
          filename: file.name,
          comment: comment,
          file: base64Data,
        };

        // Переподключение если нужно (как в reconnect() функции)
        await this.reconnectForUpload(fileId, login);

        // Последовательность сообщений как в оригинале
        // 1. Соединение установлено (уже отправлено при connect)
        // 2. Отправка логина как директории
        const directoryMessage: WebSocketMessage = {
          websocketId: fileId,
          message: login
        };
        this.send(directoryMessage);

        // Ждем подтверждения получения директории
        const directoryHandler = (data: WebSocketMessage) => {
          if (data.message === 'Получено название директории') {
            // 3. Отправка файла на сервер через HTTP
            this.sendFileToServer(uploadData)
              .then(result => {
                resolve(result);
              })
              .catch(error => {
                reject(error);
              });
          }
        };

        this.onMessage('Получено название директории', directoryHandler);
      } catch (error) {
        reject({
          success: false,
          message: 'Ошибка подготовки файла: ' + error
        });
      }
    });
  }

  /**
   * Переподключение для загрузки файла (как в reconnect() функции)
   */
  private async reconnectForUpload(websocketId: string, login: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws) {
        this.ws.close(1000, 'Предыдущее соединение с сервером закрыто');
      }

      this.connect()
        .then(() => {
          // Отправляем установочное сообщение
          const initMessage: WebSocketMessage = {
            websocketId: websocketId,
            message: 'Соединение установлено'
          };
          this.send(initMessage);
          resolve();
        })
        .catch(error => {
          reject(error);
        });
    });
  }

  /**
   * Отправка файла на сервер через HTTP (как в оригинале)
   */
  private async sendFileToServer(data: any): Promise<APIResponse> {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/downloadToServer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(data)
      });

      if (response.ok) {
        return {
          success: true,
          message: 'Файл успешно загружен'
        };
      } else {
        return {
          success: false,
          message: 'Ошибка загрузки файла'
        };
      }
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Ошибка соединения с сервером'
      };
    }
  }

  /**
   * Чтение файла как ArrayBuffer
   */
  private readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          resolve(e.target.result as ArrayBuffer);
        } else {
          reject(new Error('Не удалось прочитать файл'));
        }
      };
      reader.onerror = () => reject(new Error('Ошибка чтения файла'));
      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * Конвертация ArrayBuffer в Base64 (как в оригинале)
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  /**
   * Обработка переподключения
   */
  private handleReconnection(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Попытка переподключения ${this.reconnectAttempts}/${this.maxReconnectAttempts}...`);
      
      setTimeout(() => {
        this.connect().catch(() => {
          // Ошибка уже обработана в connect
        });
      }, this.reconnectDelay);
    } else {
      console.error('Достигнут максимум попыток переподключения');
    }
  }

  /**
   * Закрытие соединения (как в оригинале)
   */
  private closeConnection(): void {
    if (this.ws) {
      this.ws.close(1000, 'Соединение с сервером закрыто');
    }
  }

  /**
   * Закрытие WebSocket соединения
   */
  public disconnect(): void {
    if (this.ws) {
      this.ws.close(1000, 'Нормальное закрытие');
      this.ws = null;
    }
  }

  /**
   * Получение текущего состояния соединения
   */
  public getConnectionState(): string {
    if (!this.ws) return 'DISCONNECTED';
    
    switch (this.ws.readyState) {
      case WebSocket.CONNECTING:
        return 'CONNECTING';
      case WebSocket.OPEN:
        return 'CONNECTED';
      case WebSocket.CLOSING:
        return 'CLOSING';
      case WebSocket.CLOSED:
        return 'DISCONNECTED';
      default:
        return 'UNKNOWN';
    }
  }

  /**
   * Проверка подключения
   */
  public isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

// Экспортируем синглтон экземпляр
export const webSocketService = new WebSocketService();
export default webSocketService;