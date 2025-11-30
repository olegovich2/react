class EventEmitter {
  constructor() {
    this.events = {};
  }

  // Безопасная подписка на событие

  on(event, listener) {
    if (!event || typeof listener !== "function") {
      console.warn("❌ EventEmitter: Invalid subscription", {
        event,
        listener,
      });
      return;
    }

    if (!this.events[event]) {
      this.events[event] = [];
    }

    // Проверяем, не подписаны ли уже
    if (this.events[event].includes(listener)) {
      console.warn(`⚠️ EventEmitter: Listener already subscribed to ${event}`);
      return;
    }

    this.events[event].push(listener);
  }

  //  Гарантированная отписка от события

  off(event, listener) {
    if (!this.events[event]) return;

    const index = this.events[event].indexOf(listener);
    if (index > -1) {
      this.events[event].splice(index, 1);
    }

    // Автоочистка пустых массивов
    if (this.events[event].length === 0) {
      delete this.events[event];
    }
  }

  //  Безопасный вызов события

  emit(event, ...args) {
    if (!this.events[event]) return;

    // Копируем массив на случай если подписчики изменятся во время вызова
    const listeners = this.events[event].slice();

    listeners.forEach((listener) => {
      try {
        listener(...args);
      } catch (error) {
        console.error(`💥 EventEmitter: Error in ${event} listener:`, error);
      }
    });
  }

  //  Массовая отписка от всех событий
  // Полезно при полной очистке компонента

  removeAllListeners() {
    this.events = {};
  }

  //  Получение статистики для отладки

  getStats() {
    const stats = {};
    for (const event in this.events) {
      stats[event] = this.events[event].length;
    }
    return stats;
  }
}

export default EventEmitter;
