import React, { createContext, useContext, useState, useEffect, useRef, ReactNode, useCallback } from 'react';

interface WebSocketMessage {
  websocketId: string;
  message: string;
  [key: string]: any;
}

interface WebSocketContextType {
  isConnected: boolean;
  sendMessage: (message: any) => void;
  connection: WebSocket | null;
  progress: number;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within WebSocketProvider');
  }
  return context;
};

interface WebSocketProviderProps {
  children: ReactNode;
}

export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [progress, setProgress] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined); // ← ИСПРАВЛЕНИЕ

  const connect = useCallback(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      console.log('No token available for WebSocket connection');
      return;
    }

    const wsUrl = process.env.REACT_APP_WS_URL || 'ws://localhost:7680';
    
    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        console.log('WebSocket connected');
        
        // Отправляем начальное сообщение
        const initMessage: WebSocketMessage = {
          websocketId: Date.now().toString(),
          message: 'Соединение установлено'
        };
        ws.send(JSON.stringify(initMessage));
      };

      ws.onmessage = (event) => {
        try {
          const data: WebSocketMessage = JSON.parse(event.data);
          console.log('WebSocket message received:', data.message);

          // Обработка сообщений о прогрессе
          if (data.message.includes('Получено данных: ')) {
            const percent = parseInt(data.message.replace('Получено данных: ', ''));
            setProgress(percent / 2); // Делим на 2 как в оригинале
          } else if (data.message.includes('Запись завершена на ')) {
            const percent = parseInt(data.message.replace('Запись завершена на ', ''));
            setProgress(percent);
          } else if (data.message === 'Передача и запись данных успешно завершена') {
            setProgress(100);
            setTimeout(() => setProgress(0), 2000);
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setIsConnected(false);
      };

      ws.onclose = (event) => {
        console.log(`WebSocket closed. Code: ${event.code}, Reason: ${event.reason}`);
        setIsConnected(false);
        
        // Переподключение через 5 секунд
        if (event.code !== 1000) { // Не переподключаться при нормальном закрытии
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, 5000);
        }
      };
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      setIsConnected(false);
    }
  }, []);

  const sendMessage = useCallback((message: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.error('WebSocket is not connected');
    }
  }, []);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close(1000, 'Normal closure');
      wsRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = undefined;
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  const value: WebSocketContextType = {
    isConnected,
    sendMessage,
    connection: wsRef.current,
    progress,
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
};