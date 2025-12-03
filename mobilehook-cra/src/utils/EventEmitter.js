class EventEmitter {
  constructor() {
    this.events = {};
  }

  on(event, listener) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(listener);
    return () => this.off(event, listener);
  }

  off(event, listener) {
    if (!this.events[event]) return;
    this.events[event] = this.events[event].filter((l) => l !== listener);
  }

  emit(event, ...args) {
    if (!this.events[event]) return;
    setTimeout(() => {
      this.events[event].forEach((listener) => listener(...args));
    }, 0);
  }

  removeAllListeners() {
    this.events = {};
  }

  getStats() {
    const stats = {};
    for (const event in this.events) {
      stats[event] = this.events[event].length;
    }
    return stats;
  }
}

export default EventEmitter;
