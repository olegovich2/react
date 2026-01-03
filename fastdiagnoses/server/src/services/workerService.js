const { Worker } = require("worker_threads");
const path = require("path");
const fs = require("fs").promises;
const config = require("../config");
const logger = require("./LoggerService");

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
      logger.warn("WorkerService уже инициализирован", {
        type: "worker_service",
        action: "init",
        status: "already_initialized",
        timestamp: new Date().toISOString(),
      });
      return;
    }

    logger.warn(`Инициализация сервиса из ${this.WORKER_COUNT} воркеров`, {
      type: "worker_service",
      action: "init",
      worker_count: this.WORKER_COUNT,
      status: "started",
      timestamp: new Date().toISOString(),
    });

    // ПУТЬ К ФАЙЛУ image-worker.js
    const workerPath = path.join(__dirname, "..", "workers", "image-worker.js");

    try {
      await fs.access(workerPath);
    } catch (error) {
      logger.error("Worker файл не найден", {
        type: "worker_service",
        action: "init",
        status: "failed",
        worker_path: workerPath,
        error_message: error.message,
        timestamp: new Date().toISOString(),
      });
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
            if (initializationTimeout) clearTimeout(initializationTimeout);
            workerReady = true;
            resolve(worker);
          });

          // Событие "message" - воркер сообщает о готовности или результатах
          worker.on("message", (message) => {
            // Сообщение о готовности воркера
            if (message && message.workerReady && !workerReady) {
              if (initializationTimeout) clearTimeout(initializationTimeout);
              workerReady = true;

              logger.info("Worker инициализирован", {
                type: "worker_service",
                action: "worker_init",
                worker_id: i,
                thread_id: message.threadId,
                pid: message.pid,
                status: "ready",
                timestamp: new Date().toISOString(),
              });

              resolve(worker);
            }

            // Результат обработки задачи
            else if (message && message.success !== undefined) {
              this._handleTaskResult(i, message);
            }
          });

          worker.on("error", (error) => {
            logger.error("Worker ошибка", {
              type: "worker_service",
              action: "worker_error",
              worker_id: i,
              error_message: error.message,
              timestamp: new Date().toISOString(),
            });

            if (initializationTimeout) clearTimeout(initializationTimeout);
            if (!workerReady) {
              workerReady = true;
              reject(error);
            }
          });

          worker.on("exit", (code) => {
            logger.warn("Worker завершился", {
              type: "worker_service",
              action: "worker_exit",
              worker_id: i,
              exit_code: code,
              timestamp: new Date().toISOString(),
            });

            // Удаляем воркер из списка
            const workerIndex = this.workers.findIndex((w) => w.id === i);
            if (workerIndex !== -1) {
              this.workers.splice(workerIndex, 1);
            }

            // Если воркер завершился до инициализации
            if (!workerReady) {
              if (initializationTimeout) clearTimeout(initializationTimeout);
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

          // Таймаут на инициализацию
          initializationTimeout = setTimeout(() => {
            if (!workerReady) {
              logger.warn("Worker не инициализировался в срок", {
                type: "worker_service",
                action: "worker_timeout",
                worker_id: i,
                timeout_ms: 10000,
                timestamp: new Date().toISOString(),
              });
              workerReady = true;
              resolve(worker);
            }
          }, 10000);
        } catch (workerError) {
          logger.error("Не удалось создать worker", {
            type: "worker_service",
            action: "create_worker",
            worker_id: i,
            status: "failed",
            error_message: workerError.message,
            timestamp: new Date().toISOString(),
          });
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

      logger.warn("WorkerService инициализирован", {
        type: "worker_service",
        action: "init",
        status: "completed",
        workers_count: this.workers.length,
        initialization_time_ms: initTime,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Ошибка инициализации воркеров", {
        type: "worker_service",
        action: "init",
        status: "failed",
        error_message: error.message,
        timestamp: new Date().toISOString(),
      });
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

      logger.info("Задача отправлена worker", {
        type: "worker_service",
        action: "send_task",
        worker_id: worker.id,
        task_id: taskWithTimestamp.taskId,
        file_uuid: taskWithTimestamp.fileUuid,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Ошибка отправки задачи worker", {
        type: "worker_service",
        action: "send_task",
        worker_id: worker.id,
        status: "failed",
        error_message: error.message,
        timestamp: new Date().toISOString(),
      });

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

          logger.info("Задача отправлена напрямую worker", {
            type: "worker_service",
            action: "send_direct",
            worker_id: worker.id,
            task_id: taskId,
            file_uuid: data.fileUuid,
            timestamp: new Date().toISOString(),
          });
        } catch (error) {
          logger.error("Ошибка отправки задачи", {
            type: "worker_service",
            action: "send_direct",
            worker_id: worker.id,
            task_id: taskId,
            status: "failed",
            error_message: error.message,
            timestamp: new Date().toISOString(),
          });

          worker.busy = false;
          worker.currentCallback = null;
          worker.currentTask = null;
          this.queue.push(task);
        }
      } else {
        this.queue.push(task);

        logger.info("Задача добавлена в очередь", {
          type: "worker_service",
          action: "queue_task",
          task_id: taskId,
          queue_size: this.queue.length,
          file_uuid: data.fileUuid,
          timestamp: new Date().toISOString(),
        });
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
    logger.warn("Завершение работы WorkerService", {
      type: "worker_service",
      action: "shutdown",
      status: "started",
      timestamp: new Date().toISOString(),
    });

    // Отправляем команду shutdown всем воркерам
    const shutdownPromises = this.workers.map(async (workerObj) => {
      try {
        // Отправляем сообщение для graceful shutdown
        if (workerObj.worker.postMessage) {
          workerObj.worker.postMessage("shutdown");
        }

        // Даем время на завершение (1 секунда)
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Принудительно завершаем если еще жив
        await workerObj.worker.terminate();

        logger.info("Worker завершен", {
          type: "worker_service",
          action: "worker_shutdown",
          worker_id: workerObj.id,
          status: "terminated",
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        logger.error("Ошибка завершения worker", {
          type: "worker_service",
          action: "worker_shutdown",
          worker_id: workerObj.id,
          status: "failed",
          error_message: error.message,
          timestamp: new Date().toISOString(),
        });
      }
    });

    await Promise.allSettled(shutdownPromises);

    this.workers = [];
    this.initialized = false;
    this.queue = [];
    this.taskCounter = 0;

    logger.warn("WorkerService завершен", {
      type: "worker_service",
      action: "shutdown",
      status: "completed",
      timestamp: new Date().toISOString(),
    });
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

    return true;
  }

  clearQueue() {
    const clearedCount = this.queue.length;
    const taskIds = this.queue.map((t) => t.data.taskId);
    this.queue = [];

    logger.warn("Очередь очищена", {
      type: "worker_service",
      action: "clear_queue",
      tasks_cleared: clearedCount,
      task_ids: taskIds,
      timestamp: new Date().toISOString(),
    });

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
