const EventEmitter = require("events");
const mysql = require("mysql2/promise");
const fs = require("fs").promises;
const path = require("path");
const config = require("../config");

class LoggerService extends EventEmitter {
  constructor(customConfig = {}) {
    super();

    // СНАЧАЛА инициализируем stats
    this.stats = {
      totalLogged: 0,
      totalSaved: 0,
      totalFailed: 0,
      lastFlush: null,
      bufferUsage: 0,
      dbConnected: false,
      lastError: null,
    };

    // ПОТОМ объединяем конфигурации
    this.config = {
      ...config.logger,
      ...customConfig,
    };

    // Инициализируем буфер ПОСЛЕ stats
    this.buffer = new Array(this.config.bufferSize);
    this.head = 0;
    this.tail = 0;
    this.count = 0;

    // Флаги состояния
    this.isProcessing = false;
    this.isShuttingDown = false;
    this.retryQueue = [];

    // Таймер для фоновой обработки
    this.flushTimer = null;

    // Проверяем подключение к БД
    this.dbPool = null;
    this.initDatabaseConnection();

    // Запускаем воркер
    this.startWorker();

    this.createLogsDir();
    console.log(`📊 LoggerService запущен (буфер: ${this.config.bufferSize})`);
  }

  async createLogsDir() {
    const logDir = path.join(process.cwd(), this.config.fallbackDir || "logs");
    try {
      await fs.mkdir(logDir, { recursive: true });
      console.log(`📁 Папка для логов: ${logDir}`);
    } catch (error) {
      console.warn(`⚠️ Не удалось создать папку логов: ${error.message}`);
    }
  }

  // === ИНИЦИАЛИЗАЦИЯ БД ===
  async initDatabaseConnection() {
    try {
      // Создаем пул соединений с БД
      this.dbPool = mysql.createPool({
        host: config.database.host,
        user: config.database.user,
        password: config.database.password,
        database: config.database.database,
        port: config.database.port,
        connectionLimit: 10,
        waitForConnections: true,
        queueLimit: 0,
      });

      // Проверяем подключение
      const connection = await this.dbPool.getConnection();
      await connection.ping();
      connection.release();

      this.stats.dbConnected = true;
      console.log("✅ LoggerService подключен к БД");
    } catch (error) {
      console.error("❌ LoggerService ошибка подключения к БД:", error.message);
      this.stats.dbConnected = false;
      this.stats.lastError = error.message;
    }
  }

  // === ПУБЛИЧНЫЕ МЕТОДЫ ===
  log(event) {
    if (!this.config.enabled || this.isShuttingDown) {
      return null;
    }

    // Если БД не подключена, пропускаем (или сохраняем только в память)
    if (!this.stats.dbConnected && !this.config.fallbackToFile) {
      return null;
    }

    // Определяем уровень и тип
    const level = event.level || "info";
    const type = event.type || "default";

    const logEntry = {
      id: Date.now() + "-" + Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toISOString(),
      level: level,
      type: type,
      ...event,
      // Метаданные
      pid: process.pid,
      hostname: require("os").hostname(),
      node_env: config.NODE_ENV || "development",
    };

    // Удаляем дублирующие поля
    delete logEntry.level;

    // Записываем в буфер
    this.buffer[this.head] = logEntry;
    this.head = (this.head + 1) % this.config.bufferSize;
    this.count++;

    // Если буфер переполнен, сдвигаем tail
    if (this.head === this.tail && this.count > 0) {
      this.tail = (this.tail + 1) % this.config.bufferSize;
      this.count--;
      this.stats.totalFailed++;

      this.emit("buffer_overflow", {
        lostEntries: 1,
        bufferSize: this.config.bufferSize,
      });
    }

    this.stats.totalLogged++;
    this.stats.bufferUsage = (this.count / this.config.bufferSize) * 100;

    // Генерируем событие для отладки
    if (level === "error" || level === "fatal") {
      this.emit("error_logged", logEntry);
    }

    return logEntry.id;
  }

  // === УДОБНЫЕ МЕТОДЫ ДЛЯ РАЗНЫХ УРОВНЕЙ ===
  debug(message, meta = {}) {
    return this.log({
      level: "debug",
      type: "debug",
      message,
      ...meta,
    });
  }

  info(message, meta = {}) {
    return this.log({
      level: "info",
      type: "info",
      message,
      ...meta,
    });
  }

  warn(message, meta = {}) {
    return this.log({
      level: "warn",
      type: "warning",
      message,
      ...meta,
    });
  }

  error(message, meta = {}) {
    return this.log({
      level: "error",
      type: "error",
      message,
      ...meta,
    });
  }

  // === СПЕЦИАЛЬНЫЕ МЕТОДЫ ===
  apiRequest(data) {
    // data должно содержать: req, res, responseTime, requestId
    // ИЛИ напрямую все поля

    const adminId = data.admin_id || data.req?.admin?.id;
    const userLogin =
      data.user_login || data.req?.user?.login || data.req?.body?.login || null;
    const endpoint = data.endpoint || data.req?.path;
    const method = data.method || data.req?.method;
    const statusCode = data.status_code || data.res?.statusCode;
    const responseTime = data.response_time_ms || data.responseTime;
    const ipAddress = data.ip_address || data.req?.ip;
    const userAgent =
      data.user_agent || data.req?.headers?.["user-agent"]?.substring(0, 200);

    return this.log({
      level: "info",
      type: "api_request",
      message: `API ${method} ${endpoint} - ${statusCode}`,
      endpoint: endpoint,
      method: method,
      status_code: statusCode,
      response_time_ms: responseTime,
      admin_id: adminId,
      user_login: userLogin,
      ip_address: ipAddress,
      user_agent: userAgent,
      request_id: data.request_id || data.requestId,
    });
  }

  adminAction(
    adminId,
    action,
    target = null,
    details = {},
    ip = null,
    userAgent = null
  ) {
    return this.log({
      level: "info",
      type: "admin_action",
      message: `Админ ${adminId} выполнил: ${action}`,
      admin_id: adminId,
      action: action,
      target_type: target?.type,
      target_id: target?.id,
      details: details,
      ip_address: ip,
      user_agent: userAgent,
    });
  }

  // === СЛУЖЕБНЫЕ МЕТОДЫ ===
  startWorker() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    this.flushTimer = setInterval(() => {
      this.processBuffer();
    }, this.config.flushInterval);

    // Обработка очереди повторов
    setInterval(() => {
      this.processRetryQueue();
    }, this.config.retryDelay);
  }

  async processBuffer() {
    if (this.isProcessing || this.count === 0 || !this.stats.dbConnected) {
      return;
    }

    this.isProcessing = true;

    try {
      const batch = [];
      const batchSize = Math.min(this.config.batchSize, this.count);

      for (let i = 0; i < batchSize; i++) {
        if (this.tail === this.head && this.buffer[this.tail] === undefined) {
          break;
        }

        const entry = this.buffer[this.tail];
        if (entry) {
          batch.push(entry);
          this.buffer[this.tail] = undefined;
        }

        this.tail = (this.tail + 1) % this.config.bufferSize;
        this.count--;
      }

      if (batch.length > 0) {
        await this.saveBatch(batch);
        this.stats.lastFlush = new Date();
        this.stats.totalSaved += batch.length;

        this.emit("batch_saved", {
          count: batch.length,
          timestamp: this.stats.lastFlush,
        });
      }
    } catch (error) {
      console.error("❌ LoggerService processBuffer error:", error.message);
      this.emit("process_error", error);
    } finally {
      this.isProcessing = false;
    }
  }

  async saveBatch(batch) {
    if (!this.stats.dbConnected && !this.config.fallbackToFile) {
      console.warn("⚠️ БД не подключена и файловый fallback отключен");
      return;
    }

    // Группируем логи по таблицам
    const groupedLogs = {};

    for (const entry of batch) {
      const tableName = this.getTableForType(entry.type);

      if (!groupedLogs[tableName]) {
        groupedLogs[tableName] = [];
      }

      const dbEntry = this.prepareDatabaseEntry(entry, tableName);
      groupedLogs[tableName].push(dbEntry);
    }

    // Пытаемся сохранить в БД
    let saveToDBFailed = false;

    if (this.stats.dbConnected) {
      for (const [tableName, logs] of Object.entries(groupedLogs)) {
        try {
          await this.saveToDatabase(tableName, logs);
        } catch (dbError) {
          console.warn(
            `⚠️ LoggerService: Ошибка сохранения в ${tableName}:`,
            dbError.message
          );
          saveToDBFailed = true;

          this.retryQueue.push({
            tableName,
            logs,
            retryCount: 0,
            error: dbError.message,
          });
        }
      }
    }

    // Если не удалось сохранить в БД, пробуем файлы
    if (
      (saveToDBFailed || !this.stats.dbConnected) &&
      this.config.fallbackToFile
    ) {
      for (const [tableName, logs] of Object.entries(groupedLogs)) {
        try {
          await this.saveToFile(tableName, logs);
        } catch (fileError) {
          console.error(
            `❌ LoggerService: Ошибка сохранения в файл:`,
            fileError.message
          );
          this.emit("save_failed", { tableName, logs, error: fileError });
        }
      }
    }
  }

  getTableForType(type) {
    // Простая логика роутинга
    if (type && type.includes("admin_")) {
      return "admin_logs";
    }

    if (type === "error" || type === "system_error" || type === "fatal") {
      return "system_errors";
    }

    // Все остальное в api_logs
    return "api_logs";
  }

  prepareDatabaseEntry(entry, tableName) {
    // api_logs - новая таблица, все поля есть
    if (tableName === "api_logs") {
      return {
        level: entry.level || "info",
        type: entry.type || "default",
        message: entry.message || null,
        endpoint: entry.endpoint || null,
        method: entry.method || null,
        status_code: entry.status_code || null,
        response_time_ms: entry.response_time_ms || null,
        admin_id: entry.admin_id || null,
        user_login: entry.user_login || null,
        ip_address: entry.ip_address || null,
        user_agent: entry.user_agent || null,
        details: entry.details ? JSON.stringify(entry.details) : null,
      };
    }

    // admin_logs - измененная таблица
    if (tableName === "admin_logs") {
      return {
        level: entry.level || "info",
        type: entry.type || "admin_action",
        message: entry.message || null,
        admin_id: entry.admin_id || 0,
        action: entry.action || null, // ← ТЫ ПЕРЕИМЕНОВАЛ в action
        target_type: entry.target_type || null,
        target_id: entry.target_id || null,
        details: entry.details ? JSON.stringify(entry.details) : null,
        ip_address: entry.ip_address || null,
        user_agent: entry.user_agent || null,
      };
    }

    // system_errors - измененная таблица
    if (tableName === "system_errors") {
      return {
        level: entry.level || "error",
        type: entry.type || "system_error", // ← новое поле type
        message: entry.message || null,
        error_type: entry.type || "system", // ← старое поле error_type
        error_message: entry.error_message || entry.message || null,
        stack_trace: entry.stack_trace || null,
        endpoint: entry.endpoint || null,
        method: entry.method || null,
        admin_id: entry.admin_id || null, // ← новое поле
        user_login: entry.user_login || null,
        severity: entry.severity || "medium",
        is_resolved: 0,
        resolved_at: null,
        resolved_by: null,
      };
    }

    return {};
  }

  async saveToDatabase(tableName, logs) {
    if (!this.dbPool || logs.length === 0) return;

    const connection = await this.dbPool.getConnection();

    try {
      // ПРОВЕРЯЕМ таблицу (без prepared statement)
      const [tables] = await connection.query(
        `SHOW TABLES LIKE '${tableName}'`
      );
      if (tables.length === 0) return;

      // ВСТАВЛЯЕМ по одному (проще для отладки)
      for (const log of logs) {
        try {
          // Динамический INSERT на основе полей в log
          const columns = Object.keys(log);
          const values = columns.map((col) => log[col]);
          const placeholders = columns.map(() => "?").join(",");

          const sql = `INSERT INTO \`${tableName}\` (${columns
            .map((c) => `\`${c}\``)
            .join(",")}) VALUES (${placeholders})`;

          await connection.execute(sql, values);
        } catch (rowError) {
          console.warn(
            `⚠️ Ошибка в строке для ${tableName}:`,
            rowError.message
          );
        }
      }

      console.log(`✅ Сохранено ${logs.length} логов в ${tableName}`);
    } catch (error) {
      console.error(
        `❌ Ошибка в saveToDatabase для ${tableName}:`,
        error.message
      );
      throw error;
    } finally {
      connection.release();
    }
  }

  async processRetryQueue() {
    if (this.retryQueue.length === 0 || !this.stats.dbConnected) {
      return;
    }

    const failedRetries = [];

    for (const item of this.retryQueue) {
      if (item.retryCount >= this.config.maxRetries) {
        console.warn(
          `⚠️ Превышено количество повторов для ${item.tableName}, удаляем`
        );
        continue;
      }

      try {
        await this.saveToDatabase(item.tableName, item.logs);
        console.log(`✅ Успешно повторно сохранено в ${item.tableName}`);
      } catch (retryError) {
        item.retryCount++;
        item.error = retryError.message;
        failedRetries.push(item);
      }
    }

    this.retryQueue = failedRetries;
  }

  async saveToFile(tableName, logs) {
    const logDir = path.join(process.cwd(), this.config.fallbackDir || "logs");
    await fs.mkdir(logDir, { recursive: true });

    const date = new Date().toISOString().split("T")[0];
    const logFile = path.join(logDir, `${tableName}_${date}.log`);

    const lines = logs.map((entry) => JSON.stringify(entry)).join("\n") + "\n";

    await fs.appendFile(logFile, lines, "utf8");

    console.log(
      `📝 Резервное сохранение: ${logs.length} логов в файл ${logFile}`
    );
  }

  // === УТИЛИТЫ ===
  getStats() {
    return {
      ...this.stats,
      bufferCount: this.count,
      isProcessing: this.isProcessing,
      retryQueueLength: this.retryQueue.length,
      config: {
        enabled: this.config.enabled,
        bufferSize: this.config.bufferSize,
        flushInterval: this.config.flushInterval,
      },
    };
  }

  clearBuffer() {
    this.buffer.fill(undefined);
    this.head = 0;
    this.tail = 0;
    this.count = 0;
    this.emit("buffer_cleared");
  }

  async shutdown() {
    console.log("🔌 LoggerService shutting down...");

    this.isShuttingDown = true;

    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    if (this.count > 0) {
      console.log(`Flushing ${this.count} remaining logs...`);
      await this.processBuffer();
    }

    if (this.retryQueue.length > 0) {
      console.log(`Processing ${this.retryQueue.length} retry items...`);
      await this.processRetryQueue();
    }

    if (this.dbPool) {
      await this.dbPool.end();
    }

    console.log("✅ LoggerService shutdown complete");
  }
}

// Создаем глобальный инстанс
const loggerInstance = new LoggerService();

module.exports = loggerInstance;
