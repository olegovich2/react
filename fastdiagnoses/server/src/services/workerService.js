const { Worker } = require("worker_threads");
const path = require("path");
const fs = require("fs").promises;
const config = require("../config");

class WorkerService {
  constructor() {
    this.workers = [];
    this.queue = [];
    this.initialized = false;
    this.taskCounter = 0;
    this.WORKER_COUNT = config.IMAGE_WORKERS || 2;
    this.startTime = Date.now();
  }

  async initWorkers() {
    if (this.initialized) {
      console.log("⚠️ WorkerService уже инициализирован");
      return;
    }

    console.log(`🔄 Инициализация сервиса из ${this.WORKER_COUNT} воркеров...`);

    // ПУТЬ К ВАШЕМУ ФАЙЛУ image-worker.js
    const workerPath = path.join(__dirname, "..", "workers", "image-worker.js");

    try {
      await fs.access(workerPath);
      console.log(`✅ Worker файл найден: ${workerPath}`);
    } catch (error) {
      console.error(`❌ Worker файл не найден: ${workerPath}`);
      throw new Error(`Worker файл не найден: ${workerPath}`);
    }

    // Массив промисов для ожидания запуска всех воркеров
    const workerReadyPromises = [];

    for (let i = 0; i < this.WORKER_COUNT; i++) {
      const readyPromise = new Promise((resolve, reject) => {
        try {
          const worker = new Worker(workerPath, {
            workerData: {
              workerId: i,
              workerType: "image-processor",
              timestamp: Date.now(),
            },
            name: `image-worker-${i}`,
          });

          // Флаги для отслеживания состояния воркера
          let workerReady = false;
          let initializationTimeout = null;

          // Событие "online" - воркер запущен системой
          worker.on("online", () => {
            console.log(`✅ Worker ${i} запущен системой`);

            // Таймаут на инициализацию (10 секунд)
            initializationTimeout = setTimeout(() => {
              if (!workerReady) {
                console.warn(
                  `⚠️ Worker ${i} не отправил ready за 10 секунд, продолжаем...`
                );
                workerReady = true;
                resolve(worker);
              }
            }, 10000);
          });

          // Событие "message" - воркер сообщает о готовности или результатах
          worker.on("message", (message) => {
            // Сообщение о готовности воркера
            if (message && message.workerReady && !workerReady) {
              clearTimeout(initializationTimeout);
              workerReady = true;
              console.log(
                `✅ Worker ${i} инициализирован (Thread: ${message.threadId}, PID: ${message.pid})`
              );
              resolve(worker);
            }

            // Результат обработки задачи
            else if (message && message.success !== undefined) {
              this._handleTaskResult(i, message);
            }
          });

          worker.on("error", (error) => {
            console.error(`❌ Worker ${i} ошибка:`, error.message);
            clearTimeout(initializationTimeout);
            if (!workerReady) {
              workerReady = true;
              reject(error);
            }
          });

          worker.on("exit", (code) => {
            console.log(`ℹ️ Worker ${i} завершился с кодом ${code}`);
            clearTimeout(initializationTimeout);

            // Удаляем воркер из списка
            const workerIndex = this.workers.findIndex((w) => w.id === i);
            if (workerIndex !== -1) {
              this.workers.splice(workerIndex, 1);
            }

            // Если воркер завершился до инициализации
            if (!workerReady) {
              workerReady = true;
              reject(
                new Error(
                  `Worker ${i} завершился до инициализации с кодом ${code}`
                )
              );
            }
          });

          this.workers.push({
            id: i,
            worker,
            busy: false,
            currentCallback: null,
            currentTask: null,
            ready: false,
          });
        } catch (workerError) {
          console.error(
            `❌ Не удалось создать worker ${i}:`,
            workerError.message
          );
          reject(workerError);
        }
      });

      workerReadyPromises.push(readyPromise);
    }

    // Ждем, пока все воркеры сообщат о готовности
    try {
      await Promise.all(workerReadyPromises);
      this.initialized = true;
      const initTime = Date.now() - this.startTime;
      console.log(
        `✅ Сервис из ${this.workers.length} воркеров готов к работе за ${initTime}ms`
      );
    } catch (error) {
      console.error("❌ Ошибка инициализации воркеров:", error.message);
      throw error;
    }
  }

  _handleTaskResult(workerId, result) {
    const workerIndex = this.workers.findIndex((w) => w.id === workerId);
    if (workerIndex !== -1) {
      const workerObj = this.workers[workerIndex];
      workerObj.busy = false;
      workerObj.currentTask = null;

      if (workerObj.currentCallback) {
        workerObj.currentCallback(result);
        workerObj.currentCallback = null;
      }
    }
    this.processQueue();
  }

  processQueue() {
    if (this.queue.length === 0) return;

    const freeWorkerIndex = this.workers.findIndex((w) => !w.busy && w.ready);
    if (freeWorkerIndex === -1) return;

    const task = this.queue.shift();
    const worker = this.workers[freeWorkerIndex];

    worker.busy = true;
    worker.currentCallback = task.callback;
    worker.currentTask = task.data.fileUuid;

    try {
      const taskWithTimestamp = {
        ...task.data,
        timestamp: Date.now(),
        taskId: task.data.taskId || ++this.taskCounter,
      };

      worker.worker.postMessage(taskWithTimestamp);
      console.log(
        `📤 Задача ${taskWithTimestamp.taskId} отправлена worker ${worker.id} (${taskWithTimestamp.fileUuid})`
      );
    } catch (error) {
      console.error(`❌ Ошибка отправки задачи worker ${worker.id}:`, error);
      worker.busy = false;
      worker.currentCallback = null;
      worker.currentTask = null;
      this.queue.unshift(task);
    }
  }

  addTask(data) {
    return new Promise((resolve) => {
      const taskId = ++this.taskCounter;
      const task = {
        data: {
          ...data,
          taskId,
          timestamp: Date.now(),
        },
        callback: resolve,
      };

      const freeWorkerIndex = this.workers.findIndex((w) => !w.busy);

      if (freeWorkerIndex !== -1) {
        const worker = this.workers[freeWorkerIndex];
        worker.busy = true;
        worker.currentCallback = resolve;
        worker.currentTask = data.fileUuid;

        try {
          worker.worker.postMessage(task.data);
          console.log(
            `📤 Задача ${taskId} отправлена напрямую worker ${worker.id} (${data.fileUuid})`
          );
        } catch (error) {
          console.error(`❌ Ошибка отправки worker ${worker.id}:`, error);
          worker.busy = false;
          worker.currentCallback = null;
          worker.currentTask = null;
          this.queue.push(task);
          console.log(
            `📝 Задача ${taskId} добавлена в очередь. Размер очереди: ${this.queue.length}`
          );
        }
      } else {
        this.queue.push(task);
        console.log(
          `📝 Задача ${taskId} добавлена в очередь. Размер очереди: ${this.queue.length}`
        );
      }
    });
  }

  getStats() {
    const busyWorkers = this.workers.filter((w) => w.busy).length;
    const currentTasks = this.workers
      .map((w) => ({ workerId: w.id, task: w.currentTask }))
      .filter((item) => item.task !== null);

    return {
      total: this.workers.length,
      busy: busyWorkers,
      available: this.workers.length - busyWorkers,
      queue: this.queue.length,
      currentTasks,
      initialized: this.initialized,
      totalProcessed: this.taskCounter,
      uptime: Date.now() - this.startTime,
    };
  }

  async shutdown() {
    console.log("🛑 Завершение работы WorkerService...");

    // Отправляем команду shutdown всем воркерам
    const shutdownPromises = this.workers.map(async (workerObj) => {
      try {
        console.log(`🛑 Отправка shutdown worker ${workerObj.id}...`);
        // Отправляем сообщение для graceful shutdown
        if (workerObj.worker.postMessage) {
          workerObj.worker.postMessage("shutdown");
        }

        // Даем время на завершение (1 секунда)
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Принудительно завершаем если еще жив
        await workerObj.worker.terminate();
        console.log(`✅ Worker ${workerObj.id} завершен`);
      } catch (error) {
        console.error(
          `❌ Ошибка завершения worker ${workerObj.id}:`,
          error.message
        );
      }
    });

    await Promise.allSettled(shutdownPromises);

    this.workers = [];
    this.initialized = false;
    this.queue = [];
    this.taskCounter = 0;
    console.log("✅ WorkerService завершен");
  }

  healthCheck() {
    const stats = this.getStats();
    const healthStatus = {
      status: this.initialized && stats.total > 0 ? "healthy" : "unhealthy",
      ...stats,
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
    };

    return healthStatus;
  }

  // Дополнительные методы для удобства
  async waitForCompletion(timeout = 30000) {
    const startTime = Date.now();

    while (this.queue.length > 0 || this.workers.some((w) => w.busy)) {
      if (Date.now() - startTime > timeout) {
        throw new Error(`Таймаут ожидания завершения задач (${timeout}ms)`);
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    console.log(`✅ Все задачи завершены за ${Date.now() - startTime}ms`);
    return true;
  }

  clearQueue() {
    const clearedCount = this.queue.length;
    const taskIds = this.queue.map((t) => t.data.taskId);
    this.queue = [];
    console.log(
      `🧹 Очередь очищена: ${clearedCount} задач удалено (ID: ${taskIds.join(
        ", "
      )})`
    );
    return { clearedCount, taskIds };
  }

  // Метод для тестирования воркеров
  async testWorker(workerId) {
    if (workerId >= this.workers.length) {
      throw new Error(`Worker ${workerId} не найден`);
    }

    const testBuffer = Buffer.from("test");
    const testData = {
      buffer: testBuffer,
      originalFilename: "test.jpg",
      userDir: "/tmp/test",
      fileUuid: "test-" + Date.now(),
    };

    console.log(`🧪 Тестирование worker ${workerId}...`);
    const result = await this.addTask(testData);

    return {
      workerId,
      success: result.success,
      testResult: result,
    };
  }
}

// Экспортируем singleton экземпляр
const workerService = new WorkerService();

module.exports = workerService;
