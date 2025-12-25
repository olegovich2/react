const { query, getConnection } = require("../../services/databaseService");

class AdminDashboardController {
  // Получение общей статистики
  static async getStats(req, res) {
    console.log("📊 [AdminDashboardController.getStats] Запрос статистики:", {
      adminId: req.admin.id,
      username: req.admin.username,
    });

    const connection = await getConnection();
    try {
      console.log(
        "🔍 [AdminDashboardController.getStats] Начало сбора статистики"
      );

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

        console.log(
          "🔍 [AdminDashboardController.getStats] Подсчет изображений для пользователей:",
          users.length
        );

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
            console.warn(
              `⚠️ [AdminDashboardController.getStats] Ошибка подсчета изображений для ${tableName}:`,
              tableError.message
            );
          }
        }
      } catch (imageError) {
        console.error(
          "❌ [AdminDashboardController.getStats] Ошибка подсчета изображений:",
          imageError.message
        );
      }

      // 4. Подсчет опросов
      let totalSurveys = 0;
      try {
        const [users] = await connection.execute(
          "SELECT login FROM usersdata WHERE logic = 'true'"
        );

        console.log(
          "🔍 [AdminDashboardController.getStats] Подсчет опросов для пользователей:",
          users.length
        );

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
            console.warn(
              `⚠️ [AdminDashboardController.getStats] Ошибка подсчета опросов для ${tableName}:`,
              tableError.message
            );
          }
        }
      } catch (surveyError) {
        console.error(
          "❌ [AdminDashboardController.getStats] Ошибка подсчета опросов:",
          surveyError.message
        );
      }

      // 5. Использование хранилища (оценка)
      const avgImageSize = 2.5; // средний размер изображения в MB
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

      // В методе getStats, после сбора статистики добавить:
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

        // Формируем массив активности
        recentActivity = [
          ...adminLogs.map((log, index) => ({
            id: `admin_${log.id}`,
            action: log.action_type,
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
          .slice(0, 10); // Ограничиваем 10 последними

        console.log(
          "📋 [AdminDashboardController.getStats] Активность собрана:",
          {
            adminLogs: adminLogs.length,
            userLogs: userLogs.length,
            registrations: registrations.length,
            recentActivity: recentActivity.length,
          }
        );
      } catch (activityError) {
        console.error(
          "❌ [AdminDashboardController.getStats] Ошибка сбора активности:",
          activityError.message
        );
      }

      console.log(
        "✅ [AdminDashboardController.getStats] Статистика собрана:",
        {
          totalUsers: usersResult[0]?.count || 0,
          activeUsers: activeUsersResult[0]?.count || 0,
          totalImages,
          totalSurveys,
          storageUsed,
          recentActivityCount: recentActivity.length,
          newRegistrations: newRegistrations[0]?.count || 0,
        }
      );

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
      console.error(
        "❌ [AdminDashboardController.getStats] Ошибка получения статистики:",
        {
          error: error.message,
          stack: error.stack,
          adminId: req.admin.id,
        }
      );

      res.status(500).json({
        success: false,
        message: "Ошибка получения статистики",
      });
    } finally {
      connection.release();
      console.log(
        "🔌 [AdminDashboardController.getStats] Соединение с БД освобождено"
      );
    }
  }

  // Статус сервисов
  static async getServicesStatus(req, res) {
    console.log(
      "⚙️ [AdminDashboardController.getServicesStatus] Запрос статуса сервисов:",
      {
        adminId: req.admin.id,
      }
    );

    try {
      // Проверка доступности БД
      const dbCheck = await query("SELECT 1 as status");
      const dbStatus = dbCheck.length > 0 ? "online" : "offline";

      console.log(
        "🔍 [AdminDashboardController.getServicesStatus] Проверка БД:",
        {
          status: dbStatus,
          connected: dbCheck.length > 0,
        }
      );

      // Проверка worker сервиса (если есть)
      let workerStats = { activeWorkers: 0, pendingTasks: 0 };
      try {
        workerStats = require("../../services/workerService").getStats();
        console.log(
          "🔍 [AdminDashboardController.getServicesStatus] Worker сервис:",
          workerStats
        );
      } catch (workerError) {
        console.warn(
          "⚠️ [AdminDashboardController.getServicesStatus] Worker сервис недоступен:",
          workerError.message
        );
      }

      const workerStatus = workerStats.activeWorkers > 0 ? "online" : "offline";

      // Время работы сервера
      const uptime = process.uptime();
      const uptimeFormatted = `${Math.floor(uptime / 3600)}ч ${Math.floor(
        (uptime % 3600) / 60
      )}м`;

      console.log(
        "✅ [AdminDashboardController.getServicesStatus] Статус сервисов готов:",
        {
          apiServer: "online",
          database: dbStatus,
          workers: workerStatus,
          uptime: uptimeFormatted,
        }
      );

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
      console.error(
        "❌ [AdminDashboardController.getServicesStatus] Ошибка получения статуса сервисов:",
        {
          error: error.message,
          stack: error.stack,
        }
      );

      res.status(500).json({
        success: false,
        message: "Ошибка получения статуса сервисов",
      });
    }
  }

  // Последняя активность
  static async getRecentActivity(req, res) {
    console.log(
      "📋 [AdminDashboardController.getRecentActivity] Запрос последней активности:",
      {
        adminId: req.admin.id,
        query: req.query,
      }
    );

    const connection = await getConnection();
    try {
      // 1. Последние логи админов
      const [adminLogs] = await connection.execute(
        `SELECT al.*, au.username as admin_name 
         FROM admin_logs al
         LEFT JOIN admin_users au ON al.admin_id = au.id
         ORDER BY al.created_at DESC 
         LIMIT 20`
      );

      // 2. Последние действия пользователей
      const [userLogs] = await connection.execute(
        `SELECT login, ip_address, success, created_at 
         FROM login_attempts 
         ORDER BY created_at DESC 
         LIMIT 15`
      );

      // 3. Последние регистрации
      const [registrations] = await connection.execute(
        `SELECT login, email, created_at 
         FROM usersdata 
         WHERE logic = "true" 
         ORDER BY created_at DESC 
         LIMIT 10`
      );

      console.log(
        "✅ [AdminDashboardController.getRecentActivity] Активность собрана:",
        {
          adminLogs: adminLogs.length,
          userLogs: userLogs.length,
          registrations: registrations.length,
        }
      );

      res.json({
        success: true,
        recentActivity: {
          adminActions: adminLogs.map((log) => ({
            id: log.id,
            admin: log.admin_name || "System",
            action: log.action_type,
            target: log.target_type,
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
      console.error(
        "❌ [AdminDashboardController.getRecentActivity] Ошибка получения последней активности:",
        {
          error: error.message,
          stack: error.stack,
        }
      );

      res.status(500).json({
        success: false,
        message: "Ошибка получения активности",
      });
    } finally {
      connection.release();
      console.log(
        "🔌 [AdminDashboardController.getRecentActivity] Соединение с БД освобождено"
      );
    }
  }

  // Системные ошибки
  static async getSystemErrors(req, res) {
    console.log(
      "🚨 [AdminDashboardController.getSystemErrors] Запрос системных ошибок:",
      {
        adminId: req.admin.id,
        query: req.query,
      }
    );

    try {
      const { limit = 50, severity, resolved } = req.query;

      console.log(
        "🔍 [AdminDashboardController.getSystemErrors] Параметры запроса:",
        {
          limit,
          severity,
          resolved,
        }
      );

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

      console.log(
        "🔍 [AdminDashboardController.getSystemErrors] SQL запрос:",
        sqlQuery
      );

      const errors = await query(sqlQuery, params);

      // Статистика по ошибкам
      const [errorStats] = await query(
        `SELECT 
           severity,
           COUNT(*) as count,
           SUM(CASE WHEN is_resolved = TRUE THEN 1 ELSE 0 END) as resolved_count
         FROM system_errors
         WHERE created_at > DATE_SUB(NOW(), INTERVAL 30 DAY)
         GROUP BY severity`
      );

      console.log(
        "✅ [AdminDashboardController.getSystemErrors] Ошибки получены:",
        {
          total: errors.length,
          stats: errorStats,
        }
      );

      res.json({
        success: true,
        errors: errors.map((error) => ({
          id: error.id,
          type: error.error_type,
          message: error.error_message,
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
      console.error(
        "❌ [AdminDashboardController.getSystemErrors] Ошибка получения системных ошибок:",
        {
          error: error.message,
          stack: error.stack,
        }
      );

      res.status(500).json({
        success: false,
        message: "Ошибка получения системных ошибок",
      });
    }
  }

  // Пометка ошибки как исправленной
  static async markErrorAsResolved(req, res) {
    console.log(
      "✅ [AdminDashboardController.markErrorAsResolved] Пометить ошибку как исправленную:",
      {
        adminId: req.admin.id,
        username: req.admin.username,
        params: req.params,
      }
    );

    try {
      const { id } = req.params;
      const adminId = req.admin.id;

      console.log(
        "🔍 [AdminDashboardController.markErrorAsResolved] Ошибка ID:",
        id
      );

      const result = await query(
        `UPDATE system_errors 
         SET is_resolved = TRUE, resolved_at = NOW(), resolved_by = ?
         WHERE id = ?`,
        [adminId, id]
      );

      console.log(
        "🔍 [AdminDashboardController.markErrorAsResolved] Результат обновления:",
        {
          affectedRows: result.affectedRows,
        }
      );

      if (result.affectedRows === 0) {
        console.warn(
          "⚠️ [AdminDashboardController.markErrorAsResolved] Ошибка не найдена:",
          id
        );

        return res.status(404).json({
          success: false,
          message: "Ошибка не найдена",
        });
      }

      // Логируем действие
      await query(
        `INSERT INTO admin_logs (admin_id, action_type, target_type, target_id, details) 
         VALUES (?, ?, ?, ?, ?)`,
        [
          adminId,
          "update",
          "system_error",
          id,
          JSON.stringify({ action: "mark_as_resolved" }),
        ]
      );

      console.log(
        "✅ [AdminDashboardController.markErrorAsResolved] Ошибка помечена как исправленная"
      );

      res.json({
        success: true,
        message: "Ошибка помечена как исправленная",
      });
    } catch (error) {
      console.error(
        "❌ [AdminDashboardController.markErrorAsResolved] Ошибка пометки ошибки как исправленной:",
        {
          error: error.message,
          stack: error.stack,
        }
      );

      res.status(500).json({
        success: false,
        message: "Ошибка обновления статуса ошибки",
      });
    }
  }

  // Логи администраторов
  static async getAdminLogs(req, res) {
    console.log(
      "📝 [AdminDashboardController.getAdminLogs] Запрос логов администраторов:",
      {
        adminId: req.admin.id,
        query: req.query,
      }
    );

    try {
      const {
        adminId,
        actionType,
        startDate,
        endDate,
        limit = 100,
      } = req.query;

      console.log("🔍 [AdminDashboardController.getAdminLogs] Параметры:", {
        adminId,
        actionType,
        startDate,
        endDate,
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

      if (actionType) {
        queryStr += " AND al.action_type = ?";
        params.push(actionType);
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

      console.log(
        "🔍 [AdminDashboardController.getAdminLogs] SQL запрос с параметрами:",
        { queryStr, params }
      );

      const logs = await query(queryStr, params);

      console.log("✅ [AdminDashboardController.getAdminLogs] Логи получены:", {
        total: logs.length,
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
          action: log.action_type,
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
      console.error(
        "❌ [AdminDashboardController.getAdminLogs] Ошибка получения логов администраторов:",
        {
          error: error.message,
          stack: error.stack,
        }
      );

      res.status(500).json({
        success: false,
        message: "Ошибка получения логов",
      });
    }
  }

  // Статус воркеров
  static async getWorkersStatus(req, res) {
    console.log(
      "👷 [AdminDashboardController.getWorkersStatus] Запрос статуса воркеров:",
      {
        adminId: req.admin.id,
      }
    );

    try {
      // Используем существующий сервис worker'ов
      const workerService = require("../../services/workerService");
      const workerStats = workerService.getStats();

      console.log(
        "✅ [AdminDashboardController.getWorkersStatus] Статус воркеров получен:",
        workerStats
      );

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
      console.error(
        "❌ [AdminDashboardController.getWorkersStatus] Ошибка получения статуса воркеров:",
        {
          error: error.message,
          stack: error.stack,
        }
      );

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
    console.log(
      "⚙️ [AdminDashboardController.getSettings] Запрос настроек системы:",
      {
        adminId: req.admin.id,
      }
    );

    try {
      const settings = await query(
        "SELECT * FROM system_settings ORDER BY category, setting_key"
      );

      console.log(
        "✅ [AdminDashboardController.getSettings] Настройки получены:",
        {
          total: settings.length,
        }
      );

      const groupedSettings = settings.reduce((acc, setting) => {
        if (!acc[setting.category]) {
          acc[setting.category] = [];
        }

        let value = setting.setting_value;
        // Преобразование типов
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

      res.json({
        success: true,
        settings: groupedSettings,
        categories: Object.keys(groupedSettings),
      });
    } catch (error) {
      console.error(
        "❌ [AdminDashboardController.getSettings] Ошибка получения настроек системы:",
        {
          error: error.message,
          stack: error.stack,
        }
      );

      res.status(500).json({
        success: false,
        message: "Ошибка получения настроек",
      });
    }
  }

  // Обновление настроек системы
  static async updateSettings(req, res) {
    console.log(
      "⚙️ [AdminDashboardController.updateSettings] Обновление настроек:",
      {
        adminId: req.admin.id,
        username: req.admin.username,
        bodySize: JSON.stringify(req.body).length,
      }
    );

    const connection = await getConnection();
    try {
      const { settings } = req.body; // Массив { key, value }
      const adminId = req.admin.id;

      console.log(
        "🔍 [AdminDashboardController.updateSettings] Настройки для обновления:",
        {
          count: settings?.length,
          settings: settings?.map((s) => ({
            key: s.key,
            value: typeof s.value,
          })),
        }
      );

      if (!Array.isArray(settings) || settings.length === 0) {
        console.warn(
          "⚠️ [AdminDashboardController.updateSettings] Не предоставлены настройки"
        );

        return res.status(400).json({
          success: false,
          message: "Не предоставлены настройки для обновления",
        });
      }

      await connection.beginTransaction();
      console.log(
        "🔁 [AdminDashboardController.updateSettings] Начало транзакции"
      );

      const updatedSettings = [];

      for (const setting of settings) {
        console.log(
          "🔧 [AdminDashboardController.updateSettings] Обновление:",
          {
            key: setting.key,
            valueType: typeof setting.value,
          }
        );

        // Получаем текущую настройку для проверки типа
        const [currentSetting] = await connection.execute(
          "SELECT data_type FROM system_settings WHERE setting_key = ?",
          [setting.key]
        );

        if (currentSetting.length === 0) {
          console.warn(
            `⚠️ [AdminDashboardController.updateSettings] Настройка ${setting.key} не найдена`
          );
          throw new Error(`Настройка ${setting.key} не найдена`);
        }

        const dataType = currentSetting[0].data_type;
        let valueToStore = setting.value;

        // Преобразуем значение в строку в зависимости от типа
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

        console.log(
          "🔧 [AdminDashboardController.updateSettings] Преобразование значения:",
          {
            original: typeof setting.value,
            converted: typeof valueToStore,
            dataType,
          }
        );

        const [result] = await connection.execute(
          `UPDATE system_settings 
           SET setting_value = ?, updated_by = ?, updated_at = NOW()
           WHERE setting_key = ?`,
          [valueToStore, adminId, setting.key]
        );

        if (result.affectedRows > 0) {
          updatedSettings.push(setting.key);
          console.log(
            `✅ [AdminDashboardController.updateSettings] Настройка ${setting.key} обновлена`
          );
        } else {
          console.warn(
            `⚠️ [AdminDashboardController.updateSettings] Настройка ${setting.key} не обновлена`
          );
        }
      }

      await connection.commit();
      console.log(
        "✅ [AdminDashboardController.updateSettings] Транзакция завершена"
      );

      // Логируем изменение настроек
      await connection.execute(
        `INSERT INTO admin_logs (admin_id, action_type, target_type, details) 
         VALUES (?, ?, ?, ?)`,
        [
          adminId,
          "update",
          "system_settings",
          JSON.stringify({
            updatedSettings: updatedSettings,
            count: updatedSettings.length,
          }),
        ]
      );

      console.log(
        "✅ [AdminDashboardController.updateSettings] Логирование завершено"
      );

      res.json({
        success: true,
        message: `Обновлено настроек: ${updatedSettings.length}`,
        updatedSettings,
      });
    } catch (error) {
      await connection.rollback();
      console.error(
        "❌ [AdminDashboardController.updateSettings] Ошибка обновления настроек системы:",
        {
          error: error.message,
          stack: error.stack,
        }
      );

      res.status(500).json({
        success: false,
        message: error.message || "Ошибка обновления настроек",
      });
    } finally {
      connection.release();
      console.log(
        "🔌 [AdminDashboardController.updateSettings] Соединение с БД освобождено"
      );
    }
  }
}

module.exports = AdminDashboardController;
