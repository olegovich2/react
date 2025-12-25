const { query, getConnection } = require("../../services/databaseService");

class AdminLogsController {
  // Получение объединенных логов
  static async getCombinedLogs(req, res) {
    console.log("📋 [AdminLogsController.getCombinedLogs] Запрос логов:", {
      adminId: req.admin.id,
      query: req.query,
    });

    try {
      const {
        type,
        startDate,
        endDate,
        user,
        page = 1,
        limit = 50,
      } = req.query;

      const offset = (parseInt(page) - 1) * parseInt(limit);
      const connection = await getConnection();

      try {
        // 1. Логи админов
        let adminLogsQuery = `
          SELECT 
            al.id,
            'admin_action' as log_type,
            al.action_type as action,
            au.username as user_name,
            al.ip_address,
            al.user_agent,
            al.created_at,
            al.details,
            NULL as success,
            NULL as error_type,
            NULL as error_message
          FROM admin_logs al
          LEFT JOIN admin_users au ON al.admin_id = au.id
          WHERE 1=1
        `;

        // 2. Логи входа
        let loginLogsQuery = `
          SELECT 
            id,
            'login_attempt' as log_type,
            CASE 
              WHEN success = 1 THEN 'successful_login'
              ELSE 'failed_login'
            END as action,
            login as user_name,
            ip_address,
            user_agent,
            created_at,
            NULL as details,
            success,
            NULL as error_type,
            NULL as error_message
          FROM login_attempts
          WHERE 1=1
        `;

        // 3. Системные ошибки
        let errorLogsQuery = `
          SELECT 
            id,
            'system_error' as log_type,
            error_type as action,
            user_login as user_name,
            NULL as ip_address,
            NULL as user_agent,
            created_at,
            NULL as details,
            NULL as success,
            severity as error_type,
            error_message
          FROM system_errors
          WHERE 1=1
        `;

        const params = [];
        const loginParams = [];
        const errorParams = [];

        // Фильтрация по типу
        if (type) {
          if (type === "admin_action") {
            adminLogsQuery += " AND al.action_type LIKE ?";
            params.push(`%${type}%`);
          } else if (type === "login_attempt") {
            loginLogsQuery += " AND (success = ? OR success = ?)";
            loginParams.push(type.includes("success") ? 1 : 0);
            loginParams.push(type.includes("failed") ? 0 : 1);
          } else if (type === "system_error") {
            errorLogsQuery += " AND severity = ?";
            errorParams.push(type);
          }
        }

        // Фильтрация по дате
        if (startDate) {
          adminLogsQuery += " AND al.created_at >= ?";
          loginLogsQuery += " AND created_at >= ?";
          errorLogsQuery += " AND created_at >= ?";
          params.push(startDate);
          loginParams.push(startDate);
          errorParams.push(startDate);
        }

        if (endDate) {
          adminLogsQuery += " AND al.created_at <= ?";
          loginLogsQuery += " AND created_at <= ?";
          errorLogsQuery += " AND created_at <= ?";
          params.push(endDate);
          loginParams.push(endDate);
          errorParams.push(endDate);
        }

        // Фильтрация по пользователю
        if (user) {
          adminLogsQuery +=
            " AND (au.username LIKE ? OR al.action_type LIKE ?)";
          loginLogsQuery += " AND login LIKE ?";
          errorLogsQuery += " AND (user_login LIKE ? OR error_type LIKE ?)";
          params.push(`%${user}%`, `%${user}%`);
          loginParams.push(`%${user}%`);
          errorParams.push(`%${user}%`, `%${user}%`);
        }

        // Объединяем все логи
        const unionQuery = `
          (${adminLogsQuery})
          UNION ALL
          (${loginLogsQuery})
          UNION ALL
          (${errorLogsQuery})
          ORDER BY created_at DESC
          LIMIT ? OFFSET ?
        `;

        const allParams = [
          ...params,
          ...loginParams,
          ...errorParams,
          parseInt(limit),
          offset,
        ];
        console.log("🔍 SQL запрос:", unionQuery.substring(0, 200) + "...");
        console.log("🔍 Параметры:", allParams);

        const [logs] = await connection.execute(unionQuery, allParams);

        // Получаем общее количество
        const countUnionQuery = `
          SELECT COUNT(*) as total FROM (
            (${adminLogsQuery
              .replace("SELECT id,", "SELECT id,")
              .replace("LIMIT ? OFFSET ?", "")})
            UNION ALL
            (${loginLogsQuery
              .replace("SELECT id,", "SELECT id,")
              .replace("LIMIT ? OFFSET ?", "")})
            UNION ALL
            (${errorLogsQuery
              .replace("SELECT id,", "SELECT id,")
              .replace("LIMIT ? OFFSET ?", "")})
          ) as combined_logs
        `;

        const countParams = [...params, ...loginParams, ...errorParams];
        const [countResult] = await connection.execute(
          countUnionQuery,
          countParams
        );
        const total = countResult[0]?.total || 0;

        // Статистика по типам
        const [typeStats] = await connection.execute(
          `
          SELECT 
            log_type,
            COUNT(*) as count
          FROM (
            ${adminLogsQuery
              .replace("SELECT id,", "SELECT id,")
              .replace("LIMIT ? OFFSET ?", "")}
            UNION ALL
            ${loginLogsQuery
              .replace("SELECT id,", "SELECT id,")
              .replace("LIMIT ? OFFSET ?", "")}
            UNION ALL
            ${errorLogsQuery
              .replace("SELECT id,", "SELECT id,")
              .replace("LIMIT ? OFFSET ?", "")}
          ) as all_logs
          GROUP BY log_type
        `,
          countParams
        );

        console.log("✅ Логи получены:", {
          totalLogs: logs.length,
          totalCount: total,
          typeStats,
        });

        res.json({
          success: true,
          logs: logs.map((log) => ({
            id: log.id,
            type: log.log_type,
            action: log.action,
            user: log.user_name,
            ip: log.ip_address,
            userAgent: log.user_agent,
            timestamp: log.created_at,
            details: log.details ? JSON.parse(log.details) : null,
            success: log.success === 1,
            errorType: log.error_type,
            errorMessage: log.error_message,
          })),
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            totalPages: Math.ceil(total / limit),
          },
          stats: {
            byType: typeStats.reduce((acc, stat) => {
              acc[stat.log_type] = stat.count;
              return acc;
            }, {}),
            totalLogs: total,
          },
        });
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error("❌ Ошибка получения логов:", error);
      res.status(500).json({
        success: false,
        message: "Ошибка получения логов системы",
      });
    }
  }

  // Экспорт логов в CSV
  static async exportLogs(req, res) {
    console.log("📤 [AdminLogsController.exportLogs] Экспорт логов:", {
      adminId: req.admin.id,
      query: req.query,
    });

    try {
      const { format = "csv", type, startDate, endDate } = req.query;

      // Получаем логи
      const logsResponse = await this.getCombinedLogs(req, res, true);
      if (!logsResponse.success) {
        throw new Error(logsResponse.message);
      }

      const logs = logsResponse.logs;

      if (format === "csv") {
        // Формируем CSV
        const headers = [
          "ID",
          "Тип",
          "Действие",
          "Пользователь",
          "IP адрес",
          "User Agent",
          "Время",
          "Успешно",
          "Тип ошибки",
          "Сообщение",
        ];

        const csvRows = [
          headers.join(","),
          ...logs.map((log) =>
            [
              log.id,
              log.type,
              `"${log.action}"`,
              `"${log.user || ""}"`,
              `"${log.ip || ""}"`,
              `"${log.userAgent || ""}"`,
              log.timestamp,
              log.success ? "Да" : "Нет",
              `"${log.errorType || ""}"`,
              `"${log.errorMessage || ""}"`,
            ].join(",")
          ),
        ];

        const csvContent = csvRows.join("\n");
        const fileName = `system_logs_${
          new Date().toISOString().split("T")[0]
        }.csv`;

        res.setHeader("Content-Type", "text/csv");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${fileName}"`
        );
        res.send(csvContent);
      } else if (format === "json") {
        const fileName = `system_logs_${
          new Date().toISOString().split("T")[0]
        }.json`;

        res.setHeader("Content-Type", "application/json");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${fileName}"`
        );
        res.json({
          success: true,
          exportDate: new Date().toISOString(),
          totalLogs: logs.length,
          logs: logs,
        });
      }
    } catch (error) {
      console.error("❌ Ошибка экспорта логов:", error);
      res.status(500).json({
        success: false,
        message: "Ошибка экспорта логов",
      });
    }
  }

  // Удаление старых логов
  static async cleanupOldLogs(req, res) {
    console.log(
      "🧹 [AdminLogsController.cleanupOldLogs] Очистка старых логов:",
      {
        adminId: req.admin.id,
      }
    );

    try {
      const { days = 30 } = req.query;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - parseInt(days));

      const connection = await getConnection();

      try {
        await connection.beginTransaction();

        // Удаляем старые логи входа
        const [loginResult] = await connection.execute(
          "DELETE FROM login_attempts WHERE created_at < ?",
          [cutoffDate]
        );

        // Удаляем старые логи админов
        const [adminLogResult] = await connection.execute(
          "DELETE FROM admin_logs WHERE created_at < ?",
          [cutoffDate]
        );

        // Удаляем старые ошибки (кроме критических)
        const [errorResult] = await connection.execute(
          "DELETE FROM system_errors WHERE created_at < ? AND severity != 'critical'",
          [cutoffDate]
        );

        await connection.commit();

        console.log("✅ Старые логи очищены:", {
          loginAttempts: loginResult.affectedRows,
          adminLogs: adminLogResult.affectedRows,
          systemErrors: errorResult.affectedRows,
        });

        // Логируем действие
        await this.logAdminAction(
          req.admin.id,
          "cleanup",
          "system_logs",
          null,
          {
            days,
            deletedLoginAttempts: loginResult.affectedRows,
            deletedAdminLogs: adminLogResult.affectedRows,
            deletedSystemErrors: errorResult.affectedRows,
          }
        );

        res.json({
          success: true,
          message: "Старые логи успешно очищены",
          stats: {
            deletedLoginAttempts: loginResult.affectedRows,
            deletedAdminLogs: adminLogResult.affectedRows,
            deletedSystemErrors: errorResult.affectedRows,
            totalDeleted:
              loginResult.affectedRows +
              adminLogResult.affectedRows +
              errorResult.affectedRows,
          },
        });
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error("❌ Ошибка очистки логов:", error);
      res.status(500).json({
        success: false,
        message: "Ошибка очистки логов",
      });
    }
  }

  // Вспомогательный метод для логирования действий админа
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

module.exports = AdminLogsController;
