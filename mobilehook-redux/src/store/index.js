import { configureStore } from "@reduxjs/toolkit";
import clientsReducer from "./slices/clientsSlice";

// Создаем Redux store с помощью configureStore
//  configureStore автоматически настраивает:
//  1. Redux DevTools
//  2. Redux Thunk для асинхронных действий
//  3. Проверку на мутации состояния

export const store = configureStore({
  reducer: {
    clients: clientsReducer, // Подключаем наш слайс клиентов
  },
});
