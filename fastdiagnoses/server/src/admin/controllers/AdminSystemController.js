const { query, getConnection } = require("../../services/databaseService");
const os = require("os");
const { exec } = require("child_process");
const util = require("util");
const execPromise = util.promisify(exec);

class AdminSystemController {
  // Получение диагностической информации
  static async getSystemDiagnostics(req, res) {
    console.log(
      "🔧 [AdminSystemController.getSystemDiagnostics] Запрос диагностики:",
      {
        adminId: req.admin.id,
      }
    );

    try {
      const connection = await getConnection();

      try {
        // 1. Статус таблиц БД
        const [tables] = await connection.execute(`
          SELECT 
            TABLE_NAME as table_name,
            TABLE_ROWS as row_count,
            DATA_LENGTH as data_size,
            INDEX_LENGTH as index_size,
            DATA_FREE as free_size,
            CREATE_TIME as created,
            UPDATE_TIME as updated
          FROM information_schema.TABLES
          WHERE TABLE_SCHEMA = DATABASE()
          ORDER BY TABLE_NAME
        `);

        // 2. Размер БД
        const [dbSize] = await connection.execute(`
          SELECT 
            SUM(DATA_LENGTH + INDEX_LENGTH) as total_size,
            SUM(DATA_LENGTH) as data_size,
            SUM(INDEX_LENGTH) as index_size
          FROM information_schema.TABLES
          WHERE TABLE_SCHEMA = DATABASE()
        `);

        // 3. Системная информация
        const systemInfo = {
          // Node.js информация
          node: {
            version: process.version,
            platform: process.platform,
            arch: process.arch,
            pid: process.pid,
            uptime: process.uptime(),
            memoryUsage: process.memoryUsage(),
          },
          // OS информация
          os: {
            hostname: os.hostname(),
            type: os.type(),
            release: os.release(),
            uptime: os.uptime(),
            totalmem: os.totalmem(),
            freemem: os.freemem(),
            cpus: os.cpus().length,
            loadavg: os.loadavg(),
          },
          // Процессор
          cpu: os
            .cpus()
            .slice(0, 3)
            .map((cpu) => ({
              model: cpu.model,
              speed: cpu.speed,
              times: cpu.times,
            })),
          // Сеть
          network: Object.values(os.networkInterfaces())
            .flat()
            .filter((iface) => iface.family === "IPv4" && !iface.internal)
            .map((iface) => ({
              address: iface.address,
              netmask: iface.netmask,
              mac: iface.mac,
            })),
          // Диски
          disks: await this.getDiskInfo(),
        };

        // 4. Проверка целостности таблиц
        const tableHealth = await this.checkTableHealth();

        console.log("✅ Диагностика собрана:", {
          tablesCount: tables.length,
          dbSize: dbSize[0]?.total_size || 0,
          systemUptime: systemInfo.os.uptime,
        });

        res.json({
          success: true,
          diagnostics: {
            database: {
              tables: tables.map((table) => ({
                name: table.table_name,
                rows: table.row_count,
                size: table.data_size,
                indexSize: table.index_size,
                freeSize: table.free_size,
                created: table.created,
                updated: table.updated,
                formattedSize: this.formatBytes(
                  table.data_size + table.index_size
                ),
              })),
              totalSize: dbSize[0]?.total_size || 0,
              formattedTotalSize: this.formatBytes(dbSize[0]?.total_size || 0),
              dataSize: dbSize[0]?.data_size || 0,
              indexSize: dbSize[0]?.index_size || 0,
              tableCount: tables.length,
            },
            system: systemInfo,
            health: tableHealth,
            recommendations: await this.generateRecommendations(
              tables,
              dbSize[0],
              systemInfo
            ),
          },
        });
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error("❌ Ошибка получения диагностики:", error);
      res.status(500).json({
        success: false,
        message: "Ошибка получения диагностической информации",
      });
    }
  }

  // Проверка целостности таблиц
  static async checkTableHealth() {
    try {
      const connection = await getConnection();
      const [tables] = await connection.execute(`
        SELECT TABLE_NAME 
        FROM information_schema.TABLES 
        WHERE TABLE_SCHEMA = DATABASE()
      `);

      const healthChecks = [];

      for (const table of tables) {
        try {
          // Проверяем, можно ли прочитать таблицу
          const [result] = await connection.execute(
            `SELECT 1 FROM \`${table.TABLE_NAME}\` LIMIT 1`
          );

          healthChecks.push({
            table: table.TABLE_NAME,
            status: "healthy",
            message: "Таблица доступна",
            canRead: true,
          });
        } catch (error) {
          healthChecks.push({
            table: table.TABLE_NAME,
            status: "error",
            message: error.message,
            canRead: false,
          });
        }
      }

      // Проверяем наличие ключевых таблиц
      const requiredTables = [
        "usersdata",
        "sessionsdata",
        "admin_users",
        "admin_logs",
        "system_settings",
      ];

      const missingTables = requiredTables.filter(
        (table) => !tables.some((t) => t.TABLE_NAME === table)
      );

      return {
        checks: healthChecks,
        allTablesHealthy: healthChecks.every(
          (check) => check.status === "healthy"
        ),
        healthyCount: healthChecks.filter((check) => check.status === "healthy")
          .length,
        errorCount: healthChecks.filter((check) => check.status === "error")
          .length,
        missingTables: missingTables.length > 0 ? missingTables : null,
        totalTables: tables.length,
      };
    } catch (error) {
      console.error("❌ Ошибка проверки целостности:", error);
      return {
        checks: [],
        allTablesHealthy: false,
        error: error.message,
      };
    }
  }

  // Генерация рекомендаций
  static async generateRecommendations(tables, dbSize, systemInfo) {
    const recommendations = [];

    // Проверка размера БД
    const dbSizeMB = (dbSize?.total_size || 0) / (1024 * 1024);
    if (dbSizeMB > 100) {
      recommendations.push({
        type: "warning",
        title: "Большой размер базы данных",
        message: `Размер БД составляет ${Math.round(
          dbSizeMB
        )} MB. Рассмотрите очистку старых данных.`,
        action: "optimize_database",
        priority: "medium",
      });
    }

    // Проверка свободной памяти
    const freeMemPercent =
      (systemInfo.os.freemem / systemInfo.os.totalmem) * 100;
    if (freeMemPercent < 10) {
      recommendations.push({
        type: "critical",
        title: "Мало свободной памяти",
        message: `Свободно только ${Math.round(
          freeMemPercent
        )}% памяти (${this.formatBytes(systemInfo.os.freemem)})`,
        action: "increase_memory",
        priority: "high",
      });
    }

    // Проверка загрузки CPU
    const loadAvg = systemInfo.os.loadavg[0];
    const cpuCount = systemInfo.os.cpus;
    if (loadAvg > cpuCount * 1.5) {
      recommendations.push({
        type: "warning",
        title: "Высокая загрузка CPU",
        message: `Средняя загрузка CPU: ${loadAvg.toFixed(
          2
        )} (ядер: ${cpuCount})`,
        action: "monitor_cpu",
        priority: "medium",
      });
    }

    // Проверка таблиц без индексов
    const tablesWithoutIndexes = tables.filter(
      (table) => table.index_size === null || table.index_size < 1024
    );

    if (tablesWithoutIndexes.length > 0) {
      recommendations.push({
        type: "info",
        title: "Таблицы без индексов",
        message: `${tablesWithoutIndexes.length} таблиц могут работать медленно без индексов`,
        action: "add_indexes",
        tables: tablesWithoutIndexes.map((t) => t.table_name),
        priority: "low",
      });
    }

    return recommendations;
  }

  // Оптимизация таблиц
  static async optimizeTables(req, res) {
    console.log(
      "⚡ [AdminSystemController.optimizeTables] Оптимизация таблиц:",
      {
        adminId: req.admin.id,
        body: req.body,
      }
    );

    const connection = await getConnection();
    try {
      const { tableNames } = req.body;
      const adminId = req.admin.id;
      const results = [];

      await connection.beginTransaction();

      if (tableNames && tableNames.length > 0) {
        // Оптимизируем только указанные таблицы
        for (const tableName of tableNames) {
          try {
            const [result] = await connection.execute(
              `OPTIMIZE TABLE \`${tableName}\``
            );
            results.push({
              table: tableName,
              success: true,
              result: result[0],
            });
            console.log(`✅ Таблица оптимизирована: ${tableName}`);
          } catch (error) {
            results.push({
              table: tableName,
              success: false,
              error: error.message,
            });
            console.error(
              `❌ Ошибка оптимизации таблицы ${tableName}:`,
              error.message
            );
          }
        }
      } else {
        // Оптимизируем все таблицы
        const [tables] = await connection.execute(`
          SELECT TABLE_NAME 
          FROM information_schema.TABLES 
          WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_TYPE = 'BASE TABLE'
        `);

        for (const table of tables) {
          try {
            const [result] = await connection.execute(
              `OPTIMIZE TABLE \`${table.TABLE_NAME}\``
            );
            results.push({
              table: table.TABLE_NAME,
              success: true,
              result: result[0],
            });
            console.log(`✅ Таблица оптимизирована: ${table.TABLE_NAME}`);
          } catch (error) {
            results.push({
              table: table.TABLE_NAME,
              success: false,
              error: error.message,
            });
            console.error(
              `❌ Ошибка оптимизации таблицы ${table.TABLE_NAME}:`,
              error.message
            );
          }
        }
      }

      await connection.commit();

      // Логируем действие
      await this.logAdminAction(adminId, "optimize", "database_tables", null, {
        tablesOptimized: results.filter((r) => r.success).length,
        tablesFailed: results.filter((r) => !r.success).length,
        totalTables: results.length,
      });

      res.json({
        success: true,
        message: `Оптимизация завершена. Успешно: ${
          results.filter((r) => r.success).length
        }, с ошибками: ${results.filter((r) => !r.success).length}`,
        results: results,
        stats: {
          total: results.length,
          success: results.filter((r) => r.success).length,
          failed: results.filter((r) => !r.success).length,
        },
      });
    } catch (error) {
      await connection.rollback();
      console.error("❌ Ошибка оптимизации таблиц:", error);
      res.status(500).json({
        success: false,
        message: "Ошибка оптимизации таблиц",
      });
    } finally {
      connection.release();
    }
  }

  // Проверка соединений с БД
  static async checkConnections(req, res) {
    console.log(
      "🔌 [AdminSystemController.checkConnections] Проверка соединений БД"
    );

    try {
      const connection = await getConnection();

      try {
        // Получаем информацию о соединениях
        const [connections] = await connection.execute(`
          SHOW PROCESSLIST
        `);

        const [status] = await connection.execute(`
          SHOW STATUS LIKE '%onn%'
        `);

        const [variables] = await connection.execute(`
          SHOW VARIABLES LIKE '%onn%'
        `);

        const activeConnections = connections.filter(
          (conn) => conn.Command !== "Sleep" && conn.Time < 600
        );

        const connectionStats = {
          totalConnections: connections.length,
          activeConnections: activeConnections.length,
          sleepingConnections: connections.length - activeConnections.length,
          maxConnections:
            variables.find((v) => v.Variable_name === "max_connections")
              ?.Value || "unknown",
          connections: connections.slice(0, 20).map((conn) => ({
            id: conn.Id,
            user: conn.User,
            host: conn.Host,
            db: conn.db,
            command: conn.Command,
            time: conn.Time,
            state: conn.State,
            info: conn.Info ? conn.Info.substring(0, 100) : null,
          })),
        };

        // Рекомендации
        const recommendations = [];
        const activePercent =
          (activeConnections.length / connections.length) * 100;

        if (activePercent > 80) {
          recommendations.push({
            type: "warning",
            message: `Высокая загрузка соединений: ${Math.round(
              activePercent
            )}% активных соединений`,
            action: "increase_max_connections",
          });
        }

        const longRunning = connections.filter((conn) => conn.Time > 30);
        if (longRunning.length > 0) {
          recommendations.push({
            type: "warning",
            message: `${longRunning.length} долгих запросов (>30 секунд)`,
            action: "review_queries",
            queries: longRunning.map((conn) => ({
              id: conn.Id,
              time: conn.Time,
              query: conn.Info,
            })),
          });
        }

        res.json({
          success: true,
          connections: connectionStats,
          status: status.reduce((acc, row) => {
            acc[row.Variable_name] = row.Value;
            return acc;
          }, {}),
          variables: variables.reduce((acc, row) => {
            acc[row.Variable_name] = row.Value;
            return acc;
          }, {}),
          recommendations,
        });
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error("❌ Ошибка проверки соединений:", error);
      res.status(500).json({
        success: false,
        message: "Ошибка проверки соединений",
      });
    }
  }

  // Очистка кеша
  static async clearCache(req, res) {
    console.log("🧹 [AdminSystemController.clearCache] Очистка кеша:", {
      adminId: req.admin.id,
      body: req.body,
    });

    try {
      const { cacheType = "all" } = req.body;
      const adminId = req.admin.id;
      const results = [];

      if (cacheType === "all" || cacheType === "query") {
        try {
          const connection = await getConnection();
          await connection.execute("RESET QUERY CACHE");
          results.push({
            type: "query_cache",
            success: true,
            message: "Кеш запросов очищен",
          });
        } catch (error) {
          results.push({
            type: "query_cache",
            success: false,
            message: error.message,
          });
        }
      }

      if (cacheType === "all" || cacheType === "table") {
        try {
          const connection = await getConnection();
          await connection.execute("FLUSH TABLES");
          results.push({
            type: "table_cache",
            success: true,
            message: "Кеш таблиц очищен",
          });
        } catch (error) {
          results.push({
            type: "table_cache",
            success: false,
            message: error.message,
          });
        }
      }

      // Логируем действие
      await this.logAdminAction(adminId, "clear_cache", "system", null, {
        cacheType,
        results,
      });

      res.json({
        success: true,
        message: "Очистка кеша выполнена",
        results,
      });
    } catch (error) {
      console.error("❌ Ошибка очистки кеша:", error);
      res.status(500).json({
        success: false,
        message: "Ошибка очистки кеша",
      });
    }
  }

  // Вспомогательные методы
  static async getDiskInfo() {
    try {
      if (process.platform === "win32") {
        // Windows
        const { stdout } = await execPromise(
          "wmic logicaldisk get size,freespace,caption"
        );
        const lines = stdout.trim().split("\n").slice(1);

        return lines
          .map((line) => {
            const parts = line.trim().split(/\s+/);
            if (parts.length >= 3) {
              return {
                drive: parts[0],
                free: parseInt(parts[1]),
                total: parseInt(parts[2]),
                used: parseInt(parts[2]) - parseInt(parts[1]),
              };
            }
            return null;
          })
          .filter(Boolean);
      } else {
        // Linux/Unix
        const { stdout } = await execPromise("df -k");
        const lines = stdout.trim().split("\n").slice(1);

        return lines
          .map((line) => {
            const parts = line.trim().split(/\s+/);
            if (parts.length >= 6) {
              return {
                filesystem: parts[0],
                total: parseInt(parts[1]) * 1024,
                used: parseInt(parts[2]) * 1024,
                free: parseInt(parts[3]) * 1024,
                mount: parts[5],
              };
            }
            return null;
          })
          .filter(Boolean);
      }
    } catch (error) {
      console.error("❌ Ошибка получения информации о дисках:", error);
      return [];
    }
  }

  static formatBytes(bytes) {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }

  static async logAdminAction(
    adminId,
    actionType,
    targetType,
    targetId,
    details
  ) {
    try {
      await query(
        `INSERT INTO admin_logs (admin_id, action_type, target_type, target_id, details) 
         VALUES (?, ?, ?, ?, ?)`,
        [adminId, actionType, targetType, targetId, JSON.stringify(details)]
      );
    } catch (error) {
      console.error("Ошибка логирования действия админа:", error);
    }
  }
}

module.exports = AdminSystemController;
