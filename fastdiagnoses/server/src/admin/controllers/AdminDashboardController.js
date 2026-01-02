const { query, getConnection } = require("../../services/databaseService");
const logger = require("../../services/LoggerService");

class AdminDashboardController {
  // Получение общей статистики
  static async getStats(req, res) {
    const startTime = Date.now();

    logger.info("Запрос общей статистики", {
      admin_id: req.admin.id,
      username: req.admin.username,
      endpoint: req.path,
      method: req.method,
    });

    const connection = await getConnection();
    try {
      logger.debug("Начало сбора статистики", {
        admin_id: req.admin.id,
      });

      // 1. Общее количество активных пользователей
      const [usersResult] = await connection.execute(
        'SELECT COUNT(*) as count FROM usersdata WHERE logic = "true"'
      );

      // 2. Активные пользователи (заходили в последние 30 дней)
      const [activeUsersResult] = await connection.execute(
        `SELECT COUNT(*) as count FROM usersdata 
         WHERE logic = 'true' 
           AND last_login > DATE_SUB(NOW(), INTERVAL 30 DAY)`
      );

      // 3. Подсчет изображений
      let totalImages = 0;
      try {
        const [users] = await connection.execute(
          "SELECT login FROM usersdata WHERE logic = 'true'"
        );

        logger.debug("Подсчет изображений для пользователей", {
          users_count: users.length,
        });

        for (const user of users) {
          const tableName = user.login;
          try {
            const [tableExists] = await connection.execute(
              `SHOW TABLES LIKE '${tableName}'`
            );

            if (tableExists.length > 0) {
              const [imageCount] = await connection.execute(
                `SELECT COUNT(*) as count FROM \`${tableName}\` WHERE type = 'image' OR fileNameOriginIMG IS NOT NULL`
              );
              totalImages += imageCount[0]?.count || 0;
            }
          } catch (tableError) {
            logger.warn("Ошибка подсчета изображений для пользователя", {
              table_name: tableName,
              error_message: tableError.message,
            });
          }
        }
      } catch (imageError) {
        logger.error("Ошибка подсчета изображений", {
          error_message: imageError.message,
          stack_trace: imageError.stack?.substring(0, 300),
        });
      }

      // 4. Подсчет опросов
      let totalSurveys = 0;
      try {
        const [users] = await connection.execute(
          "SELECT login FROM usersdata WHERE logic = 'true'"
        );

        logger.debug("Подсчет опросов для пользователей", {
          users_count: users.length,
        });

        for (const user of users) {
          const tableName = user.login;
          try {
            const [tableExists] = await connection.execute(
              `SHOW TABLES LIKE '${tableName}'`
            );

            if (tableExists.length > 0) {
              const [surveyCount] = await connection.execute(
                `SELECT COUNT(*) as count FROM \`${tableName}\` WHERE type = 'survey' OR survey IS NOT NULL`
              );
              totalSurveys += surveyCount[0]?.count || 0;
            }
          } catch (tableError) {
            logger.warn("Ошибка подсчета опросов для пользователя", {
              table_name: tableName,
              error_message: tableError.message,
            });
          }
        }
      } catch (surveyError) {
        logger.error("Ошибка подсчета опросов", {
          error_message: surveyError.message,
          stack_trace: surveyError.stack?.substring(0, 300),
        });
      }

      // 5. Использование хранилища (оценка)
      const avgImageSize = 2.5;
      const storageUsedMB = totalImages * avgImageSize;
      const storageUsed =
        storageUsedMB > 1024
          ? `${(storageUsedMB / 1024).toFixed(1)} GB`
          : `${Math.round(storageUsedMB)} MB`;

      // 6. Новые регистрации за последние 7 дней
      const [newRegistrations] = await connection.execute(
        `SELECT COUNT(*) as count FROM usersdata 
         WHERE logic = 'true' 
           AND created_at > DATE_SUB(NOW(), INTERVAL 7 DAY)`
      );

      // 7. Получаем последнюю активность
      let recentActivity = [];
      try {
        const [adminLogs] = await connection.execute(
          `SELECT al.*, au.username as admin_name 
     FROM admin_logs al
     LEFT JOIN admin_users au ON al.admin_id = au.id
     ORDER BY al.created_at DESC 
     LIMIT 10`
        );

        const [userLogs] = await connection.execute(
          `SELECT login, ip_address, success, created_at 
     FROM login_attempts 
     WHERE created_at > DATE_SUB(NOW(), INTERVAL 1 DAY)
     ORDER BY created_at DESC 
     LIMIT 5`
        );

        const [registrations] = await connection.execute(
          `SELECT login, email, created_at 
     FROM usersdata 
     WHERE logic = "true" 
       AND created_at > DATE_SUB(NOW(), INTERVAL 7 DAY)
     ORDER BY created_at DESC 
     LIMIT 5`
        );

        recentActivity = [
          ...adminLogs.map((log, index) => ({
            id: `admin_${log.id}`,
            action: log.action,
            user: log.admin_name || "System",
            timestamp: log.created_at,
            ip: log.ip_address,
            type: "admin",
          })),
          ...userLogs.map((log, index) => ({
            id: `user_${log.login}_${index}`,
            action: log.success ? "Успешный вход" : "Неудачная попытка входа",
            user: log.login,
            timestamp: log.created_at,
            ip: log.ip_address,
            type: "user",
          })),
          ...registrations.map((reg, index) => ({
            id: `reg_${reg.login}`,
            action: "Новая регистрация",
            user: reg.login,
            timestamp: reg.created_at,
            email: reg.email,
            type: "registration",
          })),
        ]
          .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
          .slice(0, 10);

        logger.debug("Активность собрана", {
          admin_logs: adminLogs.length,
          user_logs: userLogs.length,
          registrations: registrations.length,
          recent_activity: recentActivity.length,
        });
      } catch (activityError) {
        logger.error("Ошибка сбора активности", {
          error_message: activityError.message,
        });
      }

      const responseTime = Date.now() - startTime;

      logger.info("Статистика собрана", {
        admin_id: req.admin.id,
        total_users: usersResult[0]?.count || 0,
        active_users: activeUsersResult[0]?.count || 0,
        total_images: totalImages,
        total_surveys: totalSurveys,
        storage_used: storageUsed,
        recent_activity_count: recentActivity.length,
        new_registrations: newRegistrations[0]?.count || 0,
        response_time_ms: responseTime,
      });

      res.json({
        success: true,
        data: {
          totalUsers: usersResult[0]?.count || 0,
          activeUsers: activeUsersResult[0]?.count || 0,
          totalImages: totalImages,
          totalSurveys: totalSurveys,
          storageUsed: storageUsed,
          recentActivity: recentActivity,
        },
        additionalStats: {
          newRegistrations7d: newRegistrations[0]?.count || 0,
          totalStorageMB: storageUsedMB,
        },
      });
    } catch (error) {
      logger.error("Ошибка получения статистики", {
        error_message: error.message,
        stack_trace: error.stack?.substring(0, 500),
        admin_id: req.admin.id,
        response_time_ms: Date.now() - startTime,
      });

      res.status(500).json({
        success: false,
        message: "Ошибка получения статистики",
      });
    } finally {
      connection.release();
      logger.debug("Соединение с БД освобождено", {
        admin_id: req.admin.id,
        endpoint: req.path,
      });
    }
  }

  // Статус сервисов
  static async getServicesStatus(req, res) {
    const startTime = Date.now();

    logger.info("Запрос статуса сервисов", {
      admin_id: req.admin.id,
      endpoint: req.path,
      method: req.method,
    });

    try {
      const dbCheck = await query("SELECT 1 as status");
      const dbStatus = dbCheck.length > 0 ? "online" : "offline";

      logger.debug("Проверка БД выполнена", {
        status: dbStatus,
        connected: dbCheck.length > 0,
      });

      let workerStats = { activeWorkers: 0, pendingTasks: 0 };
      try {
        workerStats = require("../../services/workerService").getStats();
        logger.debug("Статистика worker сервиса получена", workerStats);
      } catch (workerError) {
        logger.warn("Worker сервис недоступен", {
          error_message: workerError.message,
        });
      }

      const workerStatus = workerStats.activeWorkers > 0 ? "online" : "offline";

      const uptime = process.uptime();
      const uptimeFormatted = `${Math.floor(uptime / 3600)}ч ${Math.floor(
        (uptime % 3600) / 60
      )}м`;

      const responseTime = Date.now() - startTime;

      logger.info("Статус сервисов готов", {
        api_server: "online",
        database: dbStatus,
        workers: workerStatus,
        uptime: uptimeFormatted,
        response_time_ms: responseTime,
      });

      res.json({
        success: true,
        services: [
          {
            name: "API Сервер",
            status: "online",
            details: {
              uptime: uptimeFormatted,
              port: process.env.PORT || 5000,
              env: process.env.NODE_ENV || "development",
            },
          },
          {
            name: "База данных",
            status: dbStatus,
            details: {
              connection: "MySQL/MariaDB",
              status: dbStatus,
            },
          },
          {
            name: "Worker сервис",
            status: workerStatus,
            details: workerStats,
          },
          {
            name: "Файловая система",
            status: "online",
            details: {
              uploadsDir: "активен",
              backupsDir: "активен",
            },
          },
        ],
        systemInfo: {
          nodeVersion: process.version,
          platform: process.platform,
          memoryUsage: process.memoryUsage(),
          uptime: uptime,
        },
      });
    } catch (error) {
      logger.error("Ошибка получения статуса сервисов", {
        error_message: error.message,
        stack_trace: error.stack?.substring(0, 500),
        response_time_ms: Date.now() - startTime,
      });

      res.status(500).json({
        success: false,
        message: "Ошибка получения статуса сервисов",
      });
    }
  }

  // Последняя активность
  static async getRecentActivity(req, res) {
    const startTime = Date.now();

    logger.info("Запрос последней активности", {
      admin_id: req.admin.id,
      query: req.query,
      endpoint: req.path,
      method: req.method,
    });

    const connection = await getConnection();
    try {
      const [adminLogs] = await connection.execute(
        `SELECT al.*, au.username as admin_name 
         FROM admin_logs al
         LEFT JOIN admin_users au ON al.admin_id = au.id
         ORDER BY al.created_at DESC 
         LIMIT 20`
      );

      const [userLogs] = await connection.execute(
        `SELECT login, ip_address, success, created_at 
         FROM login_attempts 
         ORDER BY created_at DESC 
         LIMIT 15`
      );

      const [registrations] = await connection.execute(
        `SELECT login, email, created_at 
         FROM usersdata 
         WHERE logic = "true" 
         ORDER BY created_at DESC 
         LIMIT 10`
      );

      const responseTime = Date.now() - startTime;

      logger.info("Активность собрана", {
        admin_logs: adminLogs.length,
        user_logs: userLogs.length,
        registrations: registrations.length,
        response_time_ms: responseTime,
      });

      res.json({
        success: true,
        recentActivity: {
          adminActions: adminLogs.map((log) => ({
            id: log.id,
            admin: log.admin_name || "System",
            action: log.action,
            target: log.target_type
              ? {
                  type: log.target_type,
                  id: log.target_id,
                }
              : null,
            time: log.created_at,
            details: log.details ? JSON.parse(log.details) : null,
          })),
          userLogins: userLogs.map((log) => ({
            login: log.login,
            ip: log.ip_address,
            success: log.success === 1,
            time: log.created_at,
          })),
          newRegistrations: registrations.map((reg) => ({
            login: reg.login,
            email: reg.email,
            time: reg.created_at,
          })),
        },
      });
    } catch (error) {
      logger.error("Ошибка получения последней активности", {
        error_message: error.message,
        stack_trace: error.stack?.substring(0, 500),
        response_time_ms: Date.now() - startTime,
      });

      res.status(500).json({
        success: false,
        message: "Ошибка получения активности",
      });
    } finally {
      connection.release();
      logger.debug("Соединение с БД освобождено", {
        endpoint: req.path,
      });
    }
  }

  // Системные ошибки
  static async getSystemErrors(req, res) {
    const startTime = Date.now();

    logger.info("Запрос системных ошибок", {
      admin_id: req.admin.id,
      query: req.query,
      endpoint: req.path,
      method: req.method,
    });

    try {
      const { limit = 50, severity, resolved } = req.query;

      logger.debug("Параметры запроса системных ошибок", {
        limit,
        severity,
        resolved,
      });

      let sqlQuery = "SELECT * FROM system_errors WHERE 1=1";
      const params = [];

      if (severity) {
        sqlQuery += " AND severity = ?";
        params.push(severity);
      }

      if (resolved !== undefined) {
        sqlQuery += " AND is_resolved = ?";
        params.push(resolved === "true");
      }

      sqlQuery += " ORDER BY created_at DESC LIMIT ?";
      params.push(parseInt(limit));

      const errors = await query(sqlQuery, params);

      const [errorStats] = await query(
        `SELECT 
           severity,
           COUNT(*) as count,
           SUM(CASE WHEN is_resolved = TRUE THEN 1 ELSE 0 END) as resolved_count
         FROM system_errors
         WHERE created_at > DATE_SUB(NOW(), INTERVAL 30 DAY)
         GROUP BY severity`
      );

      const responseTime = Date.now() - startTime;

      logger.info("Системные ошибки получены", {
        total: errors.length,
        stats: errorStats,
        response_time_ms: responseTime,
      });

      res.json({
        success: true,
        errors: errors.map((error) => ({
          id: error.id,
          type: error.type || error.error_type,
          message: error.message || error.error_message,
          severity: error.severity,
          endpoint: error.endpoint,
          user: error.user_login,
          resolved: error.is_resolved === 1,
          resolvedBy: error.resolved_by,
          resolvedAt: error.resolved_at,
          createdAt: error.created_at,
          stackTrace: error.stack_trace,
        })),
        stats: {
          total: errors.length,
          bySeverity: errorStats.reduce((acc, stat) => {
            acc[stat.severity] = {
              total: stat.count,
              resolved: stat.resolved_count,
              unresolved: stat.count - stat.resolved_count,
            };
            return acc;
          }, {}),
          unresolvedCritical: errorStats
            .filter((s) => s.severity === "critical")
            .reduce((sum, s) => sum + (s.count - s.resolved_count), 0),
        },
      });
    } catch (error) {
      logger.error("Ошибка получения системных ошибок", {
        error_message: error.message,
        stack_trace: error.stack?.substring(0, 500),
        response_time_ms: Date.now() - startTime,
      });

      res.status(500).json({
        success: false,
        message: "Ошибка получения системных ошибок",
      });
    }
  }

  // Пометка ошибки как исправленной
  static async markErrorAsResolved(req, res) {
    const startTime = Date.now();

    logger.info("Пометка ошибки как исправленной", {
      admin_id: req.admin.id,
      username: req.admin.username,
      error_id: req.params.id,
      endpoint: req.path,
      method: req.method,
    });

    try {
      const { id } = req.params;
      const adminId = req.admin.id;

      logger.debug("Обновление ошибки", {
        error_id: id,
        admin_id: adminId,
      });

      const result = await query(
        `UPDATE system_errors 
         SET is_resolved = TRUE, resolved_at = NOW(), resolved_by = ?
         WHERE id = ?`,
        [adminId, id]
      );

      if (result.affectedRows === 0) {
        logger.warn("Ошибка не найдена для пометки как исправленной", {
          error_id: id,
        });

        return res.status(404).json({
          success: false,
          message: "Ошибка не найдена",
        });
      }

      logger.info("Ошибка помечена как исправленная", {
        error_id: id,
        admin_id: adminId,
        affected_rows: result.affectedRows,
        response_time_ms: Date.now() - startTime,
      });

      res.json({
        success: true,
        message: "Ошибка помечена как исправленная",
      });
    } catch (error) {
      logger.error("Ошибка пометки ошибки как исправленной", {
        error_message: error.message,
        error_id: req.params.id,
        admin_id: req.admin?.id,
        response_time_ms: Date.now() - startTime,
      });

      res.status(500).json({
        success: false,
        message: "Ошибка обновления статуса ошибки",
      });
    }
  }

  // Логи администраторов
  static async getAdminLogs(req, res) {
    const startTime = Date.now();

    logger.info("Запрос логов администраторов", {
      admin_id: req.admin.id,
      query: req.query,
      endpoint: req.path,
      method: req.method,
    });

    try {
      const { adminId, action, startDate, endDate, limit = 100 } = req.query;

      logger.debug("Параметры запроса логов", {
        admin_id_filter: adminId,
        action_filter: action,
        start_date: startDate,
        end_date: endDate,
        limit,
      });

      let queryStr = `
        SELECT al.*, au.username as admin_name, au.email as admin_email
        FROM admin_logs al
        LEFT JOIN admin_users au ON al.admin_id = au.id
        WHERE 1=1
      `;
      const params = [];

      if (adminId) {
        queryStr += " AND al.admin_id = ?";
        params.push(adminId);
      }

      if (action) {
        queryStr += " AND al.action = ?";
        params.push(action);
      }

      if (startDate) {
        queryStr += " AND al.created_at >= ?";
        params.push(startDate);
      }

      if (endDate) {
        queryStr += " AND al.created_at <= ?";
        params.push(endDate);
      }

      queryStr += " ORDER BY al.created_at DESC LIMIT ?";
      params.push(parseInt(limit));

      const logs = await query(queryStr, params);

      const responseTime = Date.now() - startTime;

      logger.info("Логи администраторов получены", {
        total: logs.length,
        response_time_ms: responseTime,
        filters_applied: {
          admin_id: !!adminId,
          action: !!action,
          date_range: !!(startDate || endDate),
        },
      });

      res.json({
        success: true,
        logs: logs.map((log) => ({
          id: log.id,
          admin: log.admin_name
            ? {
                id: log.admin_id,
                name: log.admin_name,
                email: log.admin_email,
              }
            : null,
          action: log.action,
          target: log.target_type
            ? {
                type: log.target_type,
                id: log.target_id,
              }
            : null,
          details: log.details ? JSON.parse(log.details) : null,
          ip: log.ip_address,
          userAgent: log.user_agent,
          timestamp: log.created_at,
        })),
        total: logs.length,
      });
    } catch (error) {
      logger.error("Ошибка получения логов администраторов", {
        error_message: error.message,
        stack_trace: error.stack?.substring(0, 500),
        response_time_ms: Date.now() - startTime,
      });

      res.status(500).json({
        success: false,
        message: "Ошибка получения логов",
      });
    }
  }

  // Статус воркеров
  static async getWorkersStatus(req, res) {
    const startTime = Date.now();

    logger.info("Запрос статуса воркеров", {
      admin_id: req.admin.id,
      endpoint: req.path,
      method: req.method,
    });

    try {
      const workerService = require("../../services/workerService");
      const workerStats = workerService.getStats();

      logger.info("Статус воркеров получен", {
        active_workers: workerStats.activeWorkers,
        pending_tasks: workerStats.pendingTasks,
        response_time_ms: Date.now() - startTime,
      });

      res.json({
        success: true,
        workers: workerStats,
        recommendations:
          workerStats.activeWorkers === 0
            ? [
                "Запустите worker сервис для обработки изображений",
                "Проверьте настройки workerService в конфигурации",
              ]
            : [],
      });
    } catch (error) {
      logger.error("Ошибка получения статуса воркеров", {
        error_message: error.message,
        stack_trace: error.stack?.substring(0, 500),
        response_time_ms: Date.now() - startTime,
      });

      res.status(500).json({
        success: false,
        message: "Ошибка получения статуса воркеров",
        workers: {
          activeWorkers: 0,
          pendingTasks: 0,
          error: error.message,
        },
      });
    }
  }

  // Получение настроек системы
  static async getSettings(req, res) {
    const startTime = Date.now();

    logger.info("Запрос настроек системы", {
      admin_id: req.admin.id,
      endpoint: req.path,
      method: req.method,
    });

    try {
      const settings = await query(
        "SELECT * FROM system_settings ORDER BY category, setting_key"
      );

      const groupedSettings = settings.reduce((acc, setting) => {
        if (!acc[setting.category]) {
          acc[setting.category] = [];
        }

        let value = setting.setting_value;
        switch (setting.data_type) {
          case "number":
            value = Number(value);
            break;
          case "boolean":
            value = value === "true" || value === "1";
            break;
          case "json":
            try {
              value = JSON.parse(value);
            } catch {
              value = value;
            }
            break;
          case "array":
            value = value.split(",").map((item) => item.trim());
            break;
        }

        acc[setting.category].push({
          key: setting.setting_key,
          value: value,
          type: setting.data_type,
          description: setting.description,
          isPublic: setting.is_public === 1,
          updatedAt: setting.updated_at,
          updatedBy: setting.updated_by,
        });

        return acc;
      }, {});

      logger.info("Настройки системы получены", {
        total: settings.length,
        categories: Object.keys(groupedSettings),
        response_time_ms: Date.now() - startTime,
      });

      res.json({
        success: true,
        settings: groupedSettings,
        categories: Object.keys(groupedSettings),
      });
    } catch (error) {
      logger.error("Ошибка получения настроек системы", {
        error_message: error.message,
        stack_trace: error.stack?.substring(0, 500),
        response_time_ms: Date.now() - startTime,
      });

      res.status(500).json({
        success: false,
        message: "Ошибка получения настроек",
      });
    }
  }

  // Обновление настроек системы
  static async updateSettings(req, res) {
    const startTime = Date.now();

    logger.info("Обновление настроек системы", {
      admin_id: req.admin.id,
      username: req.admin.username,
      body_size: JSON.stringify(req.body).length,
      endpoint: req.path,
      method: req.method,
    });

    const connection = await getConnection();
    try {
      const { settings } = req.body;
      const adminId = req.admin.id;

      if (!Array.isArray(settings) || settings.length === 0) {
        logger.warn("Не предоставлены настройки для обновления", {
          admin_id: adminId,
        });

        return res.status(400).json({
          success: false,
          message: "Не предоставлены настройки для обновления",
        });
      }

      await connection.beginTransaction();
      logger.debug("Начало транзакции обновления настроек", {
        settings_count: settings.length,
      });

      const updatedSettings = [];

      for (const setting of settings) {
        const [currentSetting] = await connection.execute(
          "SELECT data_type FROM system_settings WHERE setting_key = ?",
          [setting.key]
        );

        if (currentSetting.length === 0) {
          logger.warn("Настройка не найдена", {
            setting_key: setting.key,
            admin_id: adminId,
          });
          throw new Error(`Настройка ${setting.key} не найдена`);
        }

        const dataType = currentSetting[0].data_type;
        let valueToStore = setting.value;

        switch (dataType) {
          case "boolean":
            valueToStore = Boolean(setting.value).toString();
            break;
          case "number":
            valueToStore = Number(setting.value).toString();
            break;
          case "json":
            valueToStore = JSON.stringify(setting.value);
            break;
          case "array":
            valueToStore = Array.isArray(setting.value)
              ? setting.value.join(",")
              : setting.value;
            break;
          default:
            valueToStore = String(setting.value);
        }

        const [result] = await connection.execute(
          `UPDATE system_settings 
           SET setting_value = ?, updated_by = ?, updated_at = NOW()
           WHERE setting_key = ?`,
          [valueToStore, adminId, setting.key]
        );

        if (result.affectedRows > 0) {
          updatedSettings.push(setting.key);
          logger.debug("Настройка обновлена", {
            setting_key: setting.key,
            data_type: dataType,
          });
        } else {
          logger.warn("Настройка не обновлена", {
            setting_key: setting.key,
            affected_rows: result.affectedRows,
          });
        }
      }

      await connection.commit();
      logger.debug("Транзакция обновления настроек завершена", {
        updated_count: updatedSettings.length,
      });

      const responseTime = Date.now() - startTime;

      logger.info("Настройки системы обновлены", {
        admin_id: adminId,
        updated_count: updatedSettings.length,
        response_time_ms: responseTime,
      });

      res.json({
        success: true,
        message: `Обновлено настроек: ${updatedSettings.length}`,
        updatedSettings,
      });
    } catch (error) {
      await connection.rollback();

      logger.error("Ошибка обновления настроек системы", {
        error_message: error.message,
        stack_trace: error.stack?.substring(0, 500),
        admin_id: req.admin?.id,
        response_time_ms: Date.now() - startTime,
      });

      res.status(500).json({
        success: false,
        message: error.message || "Ошибка обновления настроек",
      });
    } finally {
      connection.release();
      logger.debug("Соединение с БД освобождено", {
        endpoint: req.path,
      });
    }
  }
}

module.exports = AdminDashboardController;
