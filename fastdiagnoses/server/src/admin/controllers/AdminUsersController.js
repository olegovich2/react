const bcrypt = require("bcryptjs");
const { query, getConnection } = require("../../services/databaseService");
const emailService = require("../../utils/emailService");
const validator = require("validator");

class AdminUsersController {
  // Получение списка пользователей
  static async getUsers(req, res) {
    console.log("👥 [AdminUsersController.getUsers] Запрос пользователей:", {
      query: req.query,
      adminId: req.admin.id,
    });

    const {
      search = "",
      page = 1,
      limit = 20,
      sortBy = "created_at",
      sortOrder = "DESC",
      isActive, // фильтр по статусу активации
      isBlocked, // НОВЫЙ ПАРАМЕТР: фильтр по статусу блокировки
    } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offsetNum = (pageNum - 1) * limitNum;

    try {
      // Формируем условия WHERE
      const whereConditions = [];

      // Поиск по логину или email
      if (search.trim() !== "") {
        const searchTerm = `%${search.trim()}%`;
        whereConditions.push(
          `(login LIKE '${searchTerm}' OR email LIKE '${searchTerm}')`
        );
      }

      // Фильтрация по статусу активности
      if (isActive !== undefined) {
        if (isActive === "true") {
          whereConditions.push('logic = "true"');
        } else if (isActive === "false") {
          whereConditions.push('logic = "false"');
        }
      }

      // НОВЫЙ: Фильтрация по статусу блокировки
      if (isBlocked !== undefined) {
        if (isBlocked === "true") {
          whereConditions.push("blocked = 1");
        } else if (isBlocked === "false") {
          whereConditions.push("(blocked = 0 OR blocked IS NULL)");
        }
      }

      const whereClause =
        whereConditions.length > 0
          ? `WHERE ${whereConditions.join(" AND ")}`
          : "";

      // ОСНОВНОЙ ЗАПРОС - ДОБАВЛЯЕМ ПОЛЯ БЛОКИРОВКИ
      const sql = `
      SELECT 
        login, 
        email, 
        logic as is_active,
        blocked,
        blocked_until,
        created_at,
        (SELECT COUNT(*) FROM sessionsdata WHERE login = usersdata.login) as active_sessions       
      FROM usersdata 
      ${whereClause}
      ORDER BY ${sortBy} ${sortOrder}
      LIMIT ${limitNum} OFFSET ${offsetNum}
    `;

      console.log("🔍 [AdminUsersController.getUsers] SQL запрос:", sql);
      const users = await query(sql);

      // Общее количество с учетом фильтров
      const [totalResult] = await query(
        `SELECT COUNT(*) as total FROM usersdata ${whereClause}`
      );

      // Статистика с учетом фильтров - ДОБАВЛЯЕМ СТАТИСТИКУ ПО БЛОКИРОВКАМ
      const [statsResult] = await query(`
      SELECT 
        COUNT(*) as total_users,
        SUM(CASE WHEN logic = "true" THEN 1 ELSE 0 END) as active_users,
        SUM(CASE WHEN logic = "false" THEN 1 ELSE 0 END) as pending_users,
        SUM(CASE WHEN blocked = 1 THEN 1 ELSE 0 END) as blocked_users,
        SUM(CASE WHEN blocked = 0 OR blocked IS NULL THEN 1 ELSE 0 END) as not_blocked_users
      FROM usersdata 
      ${whereClause}
    `);

      console.log("📊 [AdminUsersController.getUsers] Статистика получена:", {
        total: statsResult.total_users,
        active: statsResult.active_users,
        pending: statsResult.pending_users,
        blocked: statsResult.blocked_users,
        notBlocked: statsResult.not_blocked_users,
      });

      // Получаем статистику для каждого пользователя
      const usersWithStats = await Promise.all(
        users.map(async (user) => {
          let surveyCount = 0;
          let imageCount = 0;

          if (user.has_user_table > 0) {
            try {
              const statsSql = `
              SELECT 
                COUNT(CASE WHEN type = 'survey' THEN 1 END) as survey_count,
                COUNT(CASE WHEN type = 'image' THEN 1 END) as image_count
              FROM \`${user.login}\`
            `;

              const [statsResult] = await query(statsSql);

              if (statsResult) {
                surveyCount = parseInt(statsResult.survey_count) || 0;
                imageCount = parseInt(statsResult.image_count) || 0;
              }
            } catch (statsError) {
              console.warn(
                `⚠️ [AdminUsersController.getUsers] Не удалось получить статистику для ${user.login}:`,
                statsError.message
              );
            }
          }

          // РАСЧЕТ ДОПОЛНИТЕЛЬНЫХ ПОЛЕЙ ДЛЯ БЛОКИРОВКИ
          const isBlocked = user.blocked === 1;
          let isPermanentlyBlocked = false;
          let blockedUntilFormatted = null;
          let daysRemaining = null;

          if (isBlocked && user.blocked_until) {
            const blockedUntil = new Date(user.blocked_until);
            const now = new Date();

            // Проверяем бессрочную блокировку (2099 год)
            isPermanentlyBlocked = blockedUntil.getFullYear() >= 2099;

            if (!isPermanentlyBlocked && blockedUntil > now) {
              // Рассчитываем оставшиеся дни
              const diffTime = blockedUntil - now;
              daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

              // Форматируем дату
              const day = blockedUntil.getDate();
              const month = blockedUntil.toLocaleString("ru-RU", {
                month: "long",
              });
              const year = blockedUntil.getFullYear();
              blockedUntilFormatted = `${day} ${month} ${year} года`;
            }
          }

          return {
            id: user.login, // используем login как id для фронтенда
            login: user.login,
            email: user.email,
            isActive: user.is_active === "true",
            isBlocked: isBlocked, // НОВОЕ ПОЛЕ
            blockedUntil: user.blocked_until,
            blockedUntilFormatted: blockedUntilFormatted,
            isPermanentlyBlocked: isPermanentlyBlocked,
            daysRemaining: daysRemaining,
            createdAt: user.created_at,
            activeSessions: user.active_sessions || 0,
            hasUserTable: user.has_user_table > 0,
            stats: {
              surveys: surveyCount,
              images: imageCount,
            },
          };
        })
      );

      console.log(
        "✅ [AdminUsersController.getUsers] Пользователи обработаны:",
        {
          totalUsers: usersWithStats.length,
          blockedCount: usersWithStats.filter((u) => u.isBlocked).length,
        }
      );

      res.json({
        success: true,
        users: usersWithStats,
        pagination: {
          currentPage: pageNum,
          totalPages: Math.ceil(totalResult.total / limitNum),
          totalItems: totalResult.total,
          itemsPerPage: limitNum,
        },
        stats: {
          totalUsers: statsResult.total_users,
          activeUsers: statsResult.active_users,
          pendingUsers: statsResult.pending_users,
          blockedUsers: statsResult.blocked_users, // НОВОЕ ПОЛЕ
          notBlockedUsers: statsResult.not_blocked_users,
        },
        filters: {
          search,
          isActive,
          isBlocked, // НОВОЕ ПОЛЕ
          sortBy,
          sortOrder,
        },
      });
    } catch (error) {
      console.error(
        "❌ [AdminUsersController.getUsers] Ошибка получения списка пользователей:",
        {
          error: error.message,
          stack: error.stack,
          adminId: req.admin.id,
        }
      );

      res.status(500).json({
        success: false,
        message: "Ошибка получения списка пользователей",
      });
    }
  }

  // Получение детальной информации о пользователе
  static async getUserDetails(req, res) {
    console.log(
      "👤 [AdminUsersController.getUserDetails] Запрос деталей пользователя:",
      {
        params: req.params,
        adminId: req.admin.id,
      }
    );

    try {
      const { login } = req.params;

      // Основная информация - ДОБАВЛЯЕМ ПОЛЯ БЛОКИРОВКИ
      const [user] = await query(
        `SELECT 
           login, 
           email, 
           logic as is_active,
           blocked,
           blocked_until,
           created_at,
           last_login,
           (SELECT COUNT(*) FROM sessionsdata WHERE login = ?) as session_count,
           (SELECT COUNT(*) FROM login_attempts WHERE login = ? AND success = FALSE AND created_at > DATE_SUB(NOW(), INTERVAL 7 DAY)) as failed_logins_7d
         FROM usersdata 
         WHERE login = ?`,
        [login, login, login]
      );

      console.log(
        "🔍 [AdminUsersController.getUserDetails] Пользователь найден:",
        {
          exists: user.length > 0,
          login: user[0]?.login,
          isBlocked: user[0]?.blocked,
          blockedUntil: user[0]?.blocked_until,
        }
      );

      if (!user || user.length === 0) {
        console.warn(
          "⚠️ [AdminUsersController.getUserDetails] Пользователь не найден:",
          login
        );

        return res.status(404).json({
          success: false,
          message: "Пользователь не найден",
        });
      }

      const userData = user[0];

      // РАСЧЕТ ДОПОЛНИТЕЛЬНЫХ ПОЛЕЙ ДЛЯ БЛОКИРОВКИ
      const isBlocked = userData.blocked === 1;
      let isPermanentlyBlocked = false;
      let blockedUntilFormatted = null;
      let daysRemaining = null;
      let blockStatus = "active";

      if (isBlocked && userData.blocked_until) {
        const blockedUntil = new Date(userData.blocked_until);
        const now = new Date();

        // Проверяем бессрочную блокировку (2099 год)
        isPermanentlyBlocked = blockedUntil.getFullYear() >= 2099;

        if (isPermanentlyBlocked) {
          blockStatus = "permanently_blocked";
          blockedUntilFormatted = "бессрочно";
        } else if (blockedUntil > now) {
          blockStatus = "temporarily_blocked";

          // Рассчитываем оставшиеся дни
          const diffTime = blockedUntil - now;
          daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          // Форматируем дату
          const day = blockedUntil.getDate();
          const month = blockedUntil.toLocaleString("ru-RU", { month: "long" });
          const year = blockedUntil.getFullYear();
          blockedUntilFormatted = `${day} ${month} ${year} года`;
        } else {
          // Срок блокировки истёк, но статус ещё не обновлён
          blockStatus = "expired_block";
          blockedUntilFormatted = "срок истёк";
        }
      }

      console.log(
        "📊 [AdminUsersController.getUserDetails] Статус блокировки:",
        {
          isBlocked,
          blockStatus,
          isPermanentlyBlocked,
          daysRemaining,
          blockedUntilFormatted,
        }
      );

      // Проверяем существование таблицы пользователя
      const [tableExists] = await query(
        `SELECT COUNT(*) as exists_flag 
         FROM information_schema.tables 
         WHERE table_schema = DATABASE() 
           AND table_name = ?`,
        [login]
      );

      let userStats = {};
      if (tableExists.exists_flag > 0) {
        // Получаем статистику из таблицы пользователя
        const [stats] = await query(
          `SELECT 
             COUNT(CASE WHEN type = 'survey' THEN 1 END) as survey_count,
             COUNT(CASE WHEN type = 'image' THEN 1 END) as image_count,
             MAX(created_at) as last_activity,
             SUM(file_size) as total_storage_bytes
           FROM \`${login}\``
        );

        userStats = {
          surveyCount: stats.survey_count || 0,
          imageCount: stats.image_count || 0,
          lastActivity: stats.last_activity,
          totalStorage: stats.total_storage_bytes || 0,
          formattedStorage: stats.total_storage_bytes
            ? `${(stats.total_storage_bytes / 1024 / 1024).toFixed(2)} MB`
            : "0 MB",
        };
      }

      // Получаем последние сессии
      const sessions = await query(
        `SELECT id, date as login_time, jwt_access as token_prefix
         FROM sessionsdata 
         WHERE login = ? 
         ORDER BY date DESC 
         LIMIT 5`,
        [login]
      );

      // Получаем последние действия (логи входа) - ИЗМЕНЯЕМ: только администраторов
      const recentAdminLogins = await query(
        `SELECT ip_address, success, created_at 
         FROM login_attempts 
         WHERE login = ? 
           AND success = TRUE  // только успешные
         ORDER BY created_at DESC 
         LIMIT 10`,
        [login]
      );

      // Получаем историю блокировок из blocked_login_attempts
      const blockHistory = await query(
        `SELECT 
           id,
           ip_address,
           user_agent,
           blocked_until,
           attempted_at,
           auto_unblocked,
           unblocked_at
         FROM blocked_login_attempts 
         WHERE user_login = ? 
         ORDER BY attempted_at DESC 
         LIMIT 10`,
        [login]
      );

      console.log(
        "📋 [AdminUsersController.getUserDetails] История блокировок:",
        {
          count: blockHistory.length,
        }
      );

      // Получаем историю админских действий с этим пользователем
      const adminActions = await query(
        `SELECT 
           al.action_type,
           al.details,
           al.created_at,
           au.username as admin_name
         FROM admin_logs al
         LEFT JOIN admin_users au ON al.admin_id = au.id
         WHERE al.target_id = ? 
           AND al.target_type = 'user'
         ORDER BY al.created_at DESC 
         LIMIT 10`,
        [login]
      );

      console.log("✅ [AdminUsersController.getUserDetails] Данные собраны:", {
        userStats: Object.keys(userStats).length > 0,
        sessions: sessions.length,
        adminActions: adminActions.length,
        blockHistory: blockHistory.length,
      });

      res.json({
        success: true,
        user: {
          login: userData.login,
          email: userData.email,
          isActive: userData.is_active === "true",
          isBlocked: isBlocked, // НОВОЕ ПОЛЕ
          blockStatus: blockStatus, // "active", "temporarily_blocked", "permanently_blocked", "expired_block"
          blockedUntil: userData.blocked_until,
          blockedUntilFormatted: blockedUntilFormatted,
          isPermanentlyBlocked: isPermanentlyBlocked,
          daysRemaining: daysRemaining,
          createdAt: userData.created_at,
          lastLogin: userData.last_login,
          sessionCount: userData.session_count,
          failedLogins7d: userData.failed_logins_7d,
          hasUserTable: tableExists.exists_flag > 0,
        },
        stats: userStats,
        sessions: sessions.map((session) => ({
          id: session.id,
          loginTime: session.login_time,
          tokenPrefix: session.token_prefix
            ? session.token_prefix.substring(0, 20) + "..."
            : null,
        })),
        recentActivity: recentAdminLogins.map((loginRecord) => ({
          ip: loginRecord.ip_address,
          success: loginRecord.success === 1,
          timestamp: loginRecord.created_at,
          type: "admin_login",
        })),
        blockHistory: blockHistory.map((block) => ({
          id: block.id,
          ip: block.ip_address,
          userAgent:
            block.user_agent?.substring(0, 50) +
            (block.user_agent?.length > 50 ? "..." : ""),
          blockedUntil: block.blocked_until,
          attemptedAt: block.attempted_at,
          autoUnblocked: block.auto_unblocked === 1,
          unblockedAt: block.unblocked_at,
          status:
            block.auto_unblocked === 1
              ? "auto_unblocked"
              : block.unblocked_at
              ? "manually_unblocked"
              : "active_block",
        })),
        adminActions: adminActions.map((action) => ({
          action: action.action_type,
          admin: action.admin_name || "System",
          details: action.details ? JSON.parse(action.details) : null,
          timestamp: action.created_at,
        })),
      });
    } catch (error) {
      console.error(
        "❌ [AdminUsersController.getUserDetails] Ошибка получения деталей пользователя:",
        {
          error: error.message,
          stack: error.stack,
          login: req.params.login,
          adminId: req.admin?.id,
        }
      );

      res.status(500).json({
        success: false,
        message: "Ошибка получения информации о пользователе",
      });
    }
  }

  // Сброс пароля пользователя
  static async resetUserPassword(req, res) {
    const connection = await getConnection();
    try {
      const { login } = req.params;
      const { notifyUser = true, newPassword } = req.body;
      const adminId = req.admin.id;

      // Проверяем существование пользователя
      const [user] = await query(
        'SELECT login, email FROM usersdata WHERE login = ? AND logic = "true"',
        [login]
      );

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "Пользователь не найден или не активирован",
        });
      }

      await connection.beginTransaction();

      // Генерируем новый пароль
      const generatedPassword =
        newPassword || Math.random().toString(36).slice(-8) + "A1!";
      const salt = await bcrypt.genSalt(12);
      const hashedPassword = await bcrypt.hash(generatedPassword, salt);

      // Обновляем пароль
      await connection.execute(
        "UPDATE usersdata SET password = ? WHERE login = ?",
        [hashedPassword, login]
      );

      // Удаляем все сессии пользователя
      await connection.execute("DELETE FROM sessionsdata WHERE login = ?", [
        login,
      ]);

      // Логируем действие
      await connection.execute(
        `INSERT INTO admin_logs (admin_id, action_type, target_type, target_id, details) 
         VALUES (?, ?, ?, ?, ?)`,
        [
          adminId,
          "update",
          "user",
          login,
          JSON.stringify({
            action: "password_reset",
            notifyUser: notifyUser,
            passwordGenerated: !newPassword,
          }),
        ]
      );

      await connection.commit();

      // Отправляем email уведомление если нужно
      if (notifyUser) {
        try {
          await emailService.sendPasswordResetByAdmin({
            login: user.login,
            email: user.email,
            adminName: req.admin.username,
            newPassword: generatedPassword,
            resetByAdmin: true,
          });
        } catch (emailError) {
          console.warn(
            "⚠️ Не удалось отправить email уведомление:",
            emailError.message
          );
        }
      }

      res.json({
        success: true,
        message: "Пароль успешно сброшен",
        details: {
          login: user.login,
          email: user.email,
          newPassword: newPassword
            ? "задан администратором"
            : generatedPassword,
          userNotified: notifyUser,
          sessionsCleared: true,
        },
      });
    } catch (error) {
      await connection.rollback();
      console.error("❌ Ошибка сброса пароля пользователя:", error);
      res.status(500).json({
        success: false,
        message: "Ошибка сброса пароля",
      });
    } finally {
      connection.release();
    }
  }

  // Смена email пользователя
  static async changeUserEmail(req, res) {
    const connection = await getConnection();
    try {
      const { login } = req.params;
      const { newEmail, reason } = req.body;
      const adminId = req.admin.id;

      if (!newEmail || !validator.isEmail(newEmail)) {
        return res.status(400).json({
          success: false,
          message: "Некорректный email адрес",
        });
      }

      // Проверяем существование пользователя
      const [user] = await query(
        'SELECT login, email FROM usersdata WHERE login = ? AND logic = "true"',
        [login]
      );

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "Пользователь не найден или не активирован",
        });
      }

      // Проверяем не занят ли email
      const [emailCheck] = await query(
        "SELECT COUNT(*) as count FROM usersdata WHERE email = ? AND login != ?",
        [newEmail, login]
      );

      if (emailCheck.count > 0) {
        return res.status(400).json({
          success: false,
          message: "Этот email уже используется другим пользователем",
        });
      }

      await connection.beginTransaction();

      const oldEmail = user.email;

      // Обновляем email
      await connection.execute(
        "UPDATE usersdata SET email = ? WHERE login = ?",
        [newEmail, login]
      );

      // Логируем действие
      await connection.execute(
        `INSERT INTO admin_logs (admin_id, action_type, target_type, target_id, details) 
         VALUES (?, ?, ?, ?, ?)`,
        [
          adminId,
          "update",
          "user",
          login,
          JSON.stringify({
            action: "email_change",
            oldEmail: oldEmail,
            newEmail: newEmail,
            reason: reason || "Изменено администратором",
          }),
        ]
      );

      await connection.commit();

      // Отправляем уведомления
      try {
        // Пользователю на новый email
        await emailService.sendEmailChangedNotification({
          login: user.login,
          oldEmail: oldEmail,
          newEmail: newEmail,
          changedBy: "administrator",
          adminName: req.admin.username,
        });

        // На старый email (если он валидный)
        if (validator.isEmail(oldEmail)) {
          await emailService.sendEmailChangeAlert({
            login: user.login,
            email: oldEmail,
            newEmail: newEmail,
            changedBy: "administrator",
          });
        }
      } catch (emailError) {
        console.warn(
          "⚠️ Не удалось отправить email уведомления:",
          emailError.message
        );
      }

      res.json({
        success: true,
        message: "Email успешно изменен",
        details: {
          login: user.login,
          oldEmail: oldEmail,
          newEmail: newEmail,
          notificationsSent: true,
        },
      });
    } catch (error) {
      await connection.rollback();
      console.error("❌ Ошибка смены email пользователя:", error);
      res.status(500).json({
        success: false,
        message: "Ошибка смены email",
      });
    } finally {
      connection.release();
    }
  }

  // Удаление пользователя
  static async deleteUser(req, res) {
    const connection = await getConnection();
    try {
      const { login } = req.params;
      const { deleteFiles = true, backupUserData = true } = req.body;
      const adminId = req.admin.id;

      // Проверяем существование пользователя
      const [user] = await query(
        "SELECT login, email FROM usersdata WHERE login = ?",
        [login]
      );

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "Пользователь не найден",
        });
      }

      await connection.beginTransaction();

      // 1. Делаем бэкап данных пользователя (опционально)
      let backupCreated = false;
      if (backupUserData) {
        // Здесь можно реализовать логику бэкапа
        // Например, экспорт данных в JSON
        backupCreated = true;
      }

      // 2. Удаляем таблицу пользователя если существует
      try {
        await connection.execute(`DROP TABLE IF EXISTS \`${login}\``);
      } catch (tableError) {
        console.warn(
          `⚠️ Таблица пользователя ${login} не найдена:`,
          tableError.message
        );
      }

      // 3. Удаляем сессии
      await connection.execute("DELETE FROM sessionsdata WHERE login = ?", [
        login,
      ]);

      // 4. Удаляем логи входа
      await connection.execute("DELETE FROM login_attempts WHERE login = ?", [
        login,
      ]);

      // 5. Удаляем пользователя
      await connection.execute("DELETE FROM usersdata WHERE login = ?", [
        login,
      ]);

      // 6. Удаляем запросы на смену email
      await connection.execute(
        "DELETE FROM email_change_requests WHERE user_login = ?",
        [login]
      );

      // 7. Логируем действие
      await connection.execute(
        `INSERT INTO admin_logs (admin_id, action_type, target_type, target_id, details) 
         VALUES (?, ?, ?, ?, ?)`,
        [
          adminId,
          "delete",
          "user",
          login,
          JSON.stringify({
            action: "user_deletion",
            email: user.email,
            backupCreated: backupCreated,
            filesDeleted: deleteFiles,
          }),
        ]
      );

      await connection.commit();

      // 8. Удаляем файлы пользователя (опционально)
      if (deleteFiles) {
        try {
          const fs = require("fs").promises;
          const path = require("path");
          const uploadDir = path.join(
            __dirname,
            "..",
            "..",
            "..",
            "uploads",
            login
          );

          if (fs.existsSync(uploadDir)) {
            await fs.rm(uploadDir, { recursive: true, force: true });
          }
        } catch (fsError) {
          console.warn(
            "⚠️ Ошибка удаления файлов пользователя:",
            fsError.message
          );
        }
      }

      res.json({
        success: true,
        message: "Пользователь успешно удален",
        details: {
          login: user.login,
          email: user.email,
          backupCreated: backupCreated,
          filesDeleted: deleteFiles,
          tablesRemoved: true,
          sessionsCleared: true,
        },
      });
    } catch (error) {
      await connection.rollback();
      console.error("❌ Ошибка удаления пользователя:", error);
      res.status(500).json({
        success: false,
        message: "Ошибка удаления пользователя",
      });
    } finally {
      connection.release();
    }
  }

  // Получение запросов на смену email
  static async getEmailRequests(req, res) {
    try {
      const { status, page = 1, limit = 20 } = req.query;

      const offset = (parseInt(page) - 1) * parseInt(limit);
      let whereClause = "";
      const params = [];

      if (status) {
        whereClause = "WHERE status = ?";
        params.push(status);
      }

      const requests = await query(
        `SELECT ecr.*, 
                u.login as user_login,
                au.username as processed_by_admin
         FROM email_change_requests ecr
         LEFT JOIN usersdata u ON ecr.user_login = u.login
         LEFT JOIN admin_users au ON ecr.admin_id = au.id
         ${whereClause}
         ORDER BY ecr.created_at DESC
         LIMIT ? OFFSET ?`,
        [...params, parseInt(limit), offset]
      );

      const [totalResult] = await query(
        `SELECT COUNT(*) as total FROM email_change_requests ${whereClause}`,
        params
      );

      // Статистика по статусам
      const [statsResult] = await query(
        `SELECT 
           status,
           COUNT(*) as count
         FROM email_change_requests
         GROUP BY status`
      );

      res.json({
        success: true,
        requests: requests.map((req) => ({
          id: req.id,
          user: {
            login: req.user_login,
            oldEmail: req.old_email,
            newEmail: req.new_email,
          },
          reason: req.reason,
          status: req.status,
          adminNotes: req.admin_notes,
          processedBy: req.processed_by_admin,
          userIp: req.user_ip,
          createdAt: req.created_at,
          processedAt: req.processed_at,
        })),
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalResult.total / limit),
          totalItems: totalResult.total,
          itemsPerPage: parseInt(limit),
        },
        stats: statsResult.reduce((acc, stat) => {
          acc[stat.status] = stat.count;
          return acc;
        }, {}),
      });
    } catch (error) {
      console.error("❌ Ошибка получения запросов на смену email:", error);
      res.status(500).json({
        success: false,
        message: "Ошибка получения запросов",
      });
    }
  }

  // Одобрение запроса на смену email
  static async approveEmailRequest(req, res) {
    const connection = await getConnection();
    try {
      const { id } = req.params;
      const { adminNotes } = req.body;
      const adminId = req.admin.id;

      // Получаем запрос
      const [request] = await query(
        `SELECT ecr.*, u.email as current_email
         FROM email_change_requests ecr
         JOIN usersdata u ON ecr.user_login = u.login
         WHERE ecr.id = ? AND ecr.status = 'pending'`,
        [id]
      );

      if (!request) {
        return res.status(404).json({
          success: false,
          message: "Запрос не найден или уже обработан",
        });
      }

      await connection.beginTransaction();

      // Обновляем email пользователя
      await connection.execute(
        "UPDATE usersdata SET email = ? WHERE login = ?",
        [request.new_email, request.user_login]
      );

      // Обновляем статус запроса
      await connection.execute(
        `UPDATE email_change_requests 
         SET status = 'approved', 
             admin_id = ?,
             admin_notes = ?,
             processed_at = NOW()
         WHERE id = ?`,
        [adminId, adminNotes || "Одобрено администратором", id]
      );

      // Логируем действие
      await connection.execute(
        `INSERT INTO admin_logs (admin_id, action_type, target_type, target_id, details) 
         VALUES (?, ?, ?, ?, ?)`,
        [
          adminId,
          "update",
          "email_request",
          id,
          JSON.stringify({
            action: "approve_email_change",
            user: request.user_login,
            oldEmail: request.old_email,
            newEmail: request.new_email,
          }),
        ]
      );

      await connection.commit();

      // Отправляем уведомления
      try {
        await emailService.sendEmailChangeApproved({
          login: request.user_login,
          oldEmail: request.old_email,
          newEmail: request.new_email,
          adminNotes: adminNotes,
        });
      } catch (emailError) {
        console.warn(
          "⚠️ Не удалось отправить email уведомление:",
          emailError.message
        );
      }

      res.json({
        success: true,
        message: "Запрос на смену email одобрен",
        details: {
          requestId: id,
          user: request.user_login,
          oldEmail: request.old_email,
          newEmail: request.new_email,
          notificationSent: true,
        },
      });
    } catch (error) {
      await connection.rollback();
      console.error("❌ Ошибка одобрения запроса на смену email:", error);
      res.status(500).json({
        success: false,
        message: "Ошибка обработки запроса",
      });
    } finally {
      connection.release();
    }
  }

  // Отклонение запроса на смену email
  static async rejectEmailRequest(req, res) {
    const connection = await getConnection();
    try {
      const { id } = req.params;
      const { adminNotes, rejectionReason } = req.body;
      const adminId = req.admin.id;

      // Получаем запрос
      const [request] = await query(
        `SELECT * FROM email_change_requests 
         WHERE id = ? AND status = 'pending'`,
        [id]
      );

      if (!request) {
        return res.status(404).json({
          success: false,
          message: "Запрос не найден или уже обработан",
        });
      }

      await connection.beginTransaction();

      // Обновляем статус запроса
      await connection.execute(
        `UPDATE email_change_requests 
         SET status = 'rejected', 
             admin_id = ?,
             admin_notes = ?,
             processed_at = NOW()
         WHERE id = ?`,
        [adminId, adminNotes || "Отклонено администратором", id]
      );

      // Логируем действие
      await connection.execute(
        `INSERT INTO admin_logs (admin_id, action_type, target_type, target_id, details) 
         VALUES (?, ?, ?, ?, ?)`,
        [
          adminId,
          "update",
          "email_request",
          id,
          JSON.stringify({
            action: "reject_email_change",
            user: request.user_login,
            reason: rejectionReason,
          }),
        ]
      );

      await connection.commit();

      // Отправляем уведомление
      try {
        await emailService.sendEmailChangeRejected({
          login: request.user_login,
          email: request.old_email,
          newEmail: request.new_email,
          rejectionReason: rejectionReason || adminNotes,
          adminNotes: adminNotes,
        });
      } catch (emailError) {
        console.warn(
          "⚠️ Не удалось отправить email уведомление:",
          emailError.message
        );
      }

      res.json({
        success: true,
        message: "Запрос на смену email отклонен",
        details: {
          requestId: id,
          user: request.user_login,
          notificationSent: true,
        },
      });
    } catch (error) {
      await connection.rollback();
      console.error("❌ Ошибка отклонения запроса на смену email:", error);
      res.status(500).json({
        success: false,
        message: "Ошибка обработки запроса",
      });
    } finally {
      connection.release();
    }
  }

  // Блокировка пользователя
  static async blockUser(req, res) {
    console.log("🔒 [AdminUsersController.blockUser] Запрос на блокировку:", {
      adminId: req.admin.id,
      username: req.admin.username,
      params: req.params,
      body: req.body,
    });

    const connection = await getConnection();
    try {
      const { login } = req.params;
      const { duration, reason, deleteSessions = false } = req.body;
      const adminId = req.admin.id;

      console.log("🔍 [AdminUsersController.blockUser] Параметры:", {
        login,
        duration,
        reason,
        deleteSessions,
        adminId,
      });

      // 1. Валидация параметров
      if (!duration || !["7d", "30d", "forever"].includes(duration)) {
        console.warn(
          "⚠️ [AdminUsersController.blockUser] Некорректный duration:",
          duration
        );

        return res.status(400).json({
          success: false,
          message:
            "Некорректная длительность блокировки. Допустимые значения: 7d, 30d, forever",
        });
      }

      // 2. Поиск пользователя
      const [user] = await connection.execute(
        'SELECT login, email, blocked, blocked_until FROM usersdata WHERE login = ? AND logic = "true"',
        [login]
      );

      console.log("🔍 [AdminUsersController.blockUser] Пользователь найден:", {
        exists: user.length > 0,
        currentBlocked: user[0]?.blocked,
        currentBlockedUntil: user[0]?.blocked_until,
      });

      if (user.length === 0) {
        console.warn(
          "⚠️ [AdminUsersController.blockUser] Пользователь не найден или не активирован:",
          login
        );

        return res.status(404).json({
          success: false,
          message: "Пользователь не найден или не активирован",
        });
      }

      const userData = user[0];

      // 3. Проверка, не заблокирован ли уже пользователь
      if (userData.blocked === 1) {
        console.warn(
          "⚠️ [AdminUsersController.blockUser] Пользователь уже заблокирован:",
          {
            login,
            blocked_until: userData.blocked_until,
          }
        );

        return res.status(400).json({
          success: false,
          message: "Пользователь уже заблокирован",
          currentStatus: {
            blocked: true,
            blocked_until: userData.blocked_until,
          },
        });
      }

      await connection.beginTransaction();
      console.log("🔁 [AdminUsersController.blockUser] Начало транзакции");

      // 4. Рассчитываем дату разблокировки
      let blockedUntil = null;
      const now = new Date();

      console.log(
        "📅 [AdminUsersController.blockUser] Рассчет даты блокировки:",
        {
          duration,
          now: now.toISOString(),
        }
      );

      switch (duration) {
        case "7d":
          blockedUntil = new Date(now);
          blockedUntil.setDate(now.getDate() + 7);
          break;
        case "30d":
          blockedUntil = new Date(now);
          blockedUntil.setDate(now.getDate() + 30);
          break;
        case "forever":
          // Используем 2099 год как "бессрочно" (согласовано с login эндпоинтом)
          blockedUntil = new Date("2099-12-31 23:59:59");
          break;
      }

      console.log("📅 [AdminUsersController.blockUser] Результат:", {
        blockedUntil: blockedUntil.toISOString(),
        isForever: duration === "forever",
      });

      // 5. Обновляем пользователя в БД
      const [updateResult] = await connection.execute(
        `UPDATE usersdata 
         SET blocked = 1, blocked_until = ?
         WHERE login = ?`,
        [blockedUntil, login]
      );

      console.log(
        "✅ [AdminUsersController.blockUser] Пользователь обновлен:",
        {
          affectedRows: updateResult.affectedRows,
          login,
          blocked: 1,
          blocked_until: blockedUntil,
        }
      );

      // 6. Удаляем сессии пользователя если нужно
      let sessionsDeleted = 0;
      if (deleteSessions) {
        try {
          const [deleteResult] = await connection.execute(
            "DELETE FROM sessionsdata WHERE login = ?",
            [login]
          );

          sessionsDeleted = deleteResult.affectedRows;
          console.log("🗑️ [AdminUsersController.blockUser] Сессии удалены:", {
            count: sessionsDeleted,
            login,
          });
        } catch (deleteError) {
          console.warn(
            "⚠️ [AdminUsersController.blockUser] Ошибка удаления сессий:",
            deleteError.message
          );
          // Не прерываем выполнение если не удалось удалить сессии
        }
      }

      // 7. Логируем действие в admin_logs
      const logDetails = {
        action: "block_user",
        duration: duration,
        reason: reason || null,
        blocked_until: blockedUntil.toISOString(),
        sessions_deleted: deleteSessions,
        sessions_deleted_count: sessionsDeleted,
        is_permanent: duration === "forever",
      };

      await connection.execute(
        `INSERT INTO admin_logs (admin_id, action_type, target_type, target_id, details) 
         VALUES (?, ?, ?, ?, ?)`,
        [adminId, "block", "user", login, JSON.stringify(logDetails)]
      );

      console.log(
        "📝 [AdminUsersController.blockUser] Действие залогировано:",
        {
          adminId,
          action: "block",
          target: login,
          details: logDetails,
        }
      );

      await connection.commit();
      console.log("✅ [AdminUsersController.blockUser] Транзакция завершена");

      // 8. Форматируем дату для ответа
      let formattedDate = "бессрочно";
      if (duration !== "forever") {
        const day = blockedUntil.getDate();
        const month = blockedUntil.toLocaleString("ru-RU", { month: "long" });
        const year = blockedUntil.getFullYear();
        formattedDate = `${day} ${month} ${year} года`;
      }

      console.log("✅ [AdminUsersController.blockUser] Блокировка успешна:", {
        login,
        duration,
        formattedDate,
        sessionsDeleted,
      });

      // 9. Возвращаем успешный ответ
      res.json({
        success: true,
        message: `Пользователь ${login} заблокирован ${
          duration === "forever" ? "бессрочно" : "до " + formattedDate
        }`,
        details: {
          login: login,
          email: userData.email,
          duration: duration,
          blocked_until: blockedUntil,
          formatted_blocked_until: formattedDate,
          reason: reason || null,
          sessions_deleted: deleteSessions,
          sessions_deleted_count: sessionsDeleted,
          blocked_by_admin: {
            id: adminId,
            username: req.admin.username,
          },
        },
      });
    } catch (error) {
      await connection.rollback();
      console.error("❌ [AdminUsersController.blockUser] Ошибка блокировки:", {
        error: error.message,
        stack: error.stack,
        login: req.params.login,
        adminId: req.admin?.id,
      });

      res.status(500).json({
        success: false,
        message: "Ошибка блокировки пользователя",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    } finally {
      connection.release();
      console.log(
        "🔌 [AdminUsersController.blockUser] Соединение с БД освобождено"
      );
    }
  }

  // Разблокировка пользователя
  static async unblockUser(req, res) {
    console.log(
      "🔓 [AdminUsersController.unblockUser] Запрос на разблокировку:",
      {
        adminId: req.admin.id,
        username: req.admin.username,
        params: req.params,
      }
    );

    const connection = await getConnection();
    try {
      const { login } = req.params;
      const adminId = req.admin.id;

      console.log("🔍 [AdminUsersController.unblockUser] Параметры:", {
        login,
        adminId,
      });

      // 1. Поиск пользователя
      const [user] = await connection.execute(
        'SELECT login, email, blocked, blocked_until FROM usersdata WHERE login = ? AND logic = "true"',
        [login]
      );

      console.log(
        "🔍 [AdminUsersController.unblockUser] Пользователь найден:",
        {
          exists: user.length > 0,
          currentBlocked: user[0]?.blocked,
          currentBlockedUntil: user[0]?.blocked_until,
        }
      );

      if (user.length === 0) {
        console.warn(
          "⚠️ [AdminUsersController.unblockUser] Пользователь не найден или не активирован:",
          login
        );

        return res.status(404).json({
          success: false,
          message: "Пользователь не найден или не активирован",
        });
      }

      const userData = user[0];

      // 2. Проверка, заблокирован ли пользователь
      if (userData.blocked !== 1) {
        console.warn(
          "⚠️ [AdminUsersController.unblockUser] Пользователь не заблокирован:",
          {
            login,
            blocked: userData.blocked,
          }
        );

        return res.status(400).json({
          success: false,
          message: "Пользователь не заблокирован",
          currentStatus: {
            blocked: false,
            blocked_until: null,
          },
        });
      }

      await connection.beginTransaction();
      console.log("🔁 [AdminUsersController.unblockUser] Начало транзакции");

      // 3. Обновляем пользователя в БД (разблокируем)
      const [updateResult] = await connection.execute(
        `UPDATE usersdata 
         SET blocked = 0, blocked_until = NULL
         WHERE login = ?`,
        [login]
      );

      console.log(
        "✅ [AdminUsersController.unblockUser] Пользователь обновлен:",
        {
          affectedRows: updateResult.affectedRows,
          login,
          blocked: 0,
          blocked_until: null,
        }
      );

      // 4. Обновляем запись в blocked_login_attempts
      // Находим последнюю запись блокировки этого пользователя
      let blockedRecordUpdated = false;
      try {
        const [blockedRecords] = await connection.execute(
          `SELECT id FROM blocked_login_attempts 
           WHERE user_login = ? 
             AND auto_unblocked = FALSE
             AND unblocked_at IS NULL
           ORDER BY attempted_at DESC 
           LIMIT 1`,
          [login]
        );

        if (blockedRecords.length > 0) {
          const blockedRecordId = blockedRecords[0].id;

          const [updateBlockedResult] = await connection.execute(
            `UPDATE blocked_login_attempts 
             SET auto_unblocked = FALSE, unblocked_at = NOW()
             WHERE id = ?`,
            [blockedRecordId]
          );

          blockedRecordUpdated = updateBlockedResult.affectedRows > 0;

          console.log(
            "📝 [AdminUsersController.unblockUser] Запись в blocked_login_attempts обновлена:",
            {
              recordId: blockedRecordId,
              updated: blockedRecordUpdated,
            }
          );
        } else {
          console.log(
            "ℹ️ [AdminUsersController.unblockUser] Запись в blocked_login_attempts не найдена для:",
            login
          );
        }
      } catch (blockedLogError) {
        console.warn(
          "⚠️ [AdminUsersController.unblockUser] Ошибка обновления blocked_login_attempts:",
          blockedLogError.message
        );
        // Не прерываем выполнение
      }

      // 5. Логируем действие в admin_logs
      const logDetails = {
        action: "unblock_user",
        previous_blocked_until: userData.blocked_until,
        blocked_record_updated: blockedRecordUpdated,
        manual_unblock: true,
      };

      await connection.execute(
        `INSERT INTO admin_logs (admin_id, action_type, target_type, target_id, details) 
         VALUES (?, ?, ?, ?, ?)`,
        [adminId, "unblock", "user", login, JSON.stringify(logDetails)]
      );

      console.log(
        "📝 [AdminUsersController.unblockUser] Действие залогировано:",
        {
          adminId,
          action: "unblock",
          target: login,
          details: logDetails,
        }
      );

      await connection.commit();
      console.log("✅ [AdminUsersController.unblockUser] Транзакция завершена");

      console.log(
        "✅ [AdminUsersController.unblockUser] Разблокировка успешна:",
        {
          login,
          previously_blocked_until: userData.blocked_until,
        }
      );

      // 6. Возвращаем успешный ответ
      res.json({
        success: true,
        message: `Пользователь ${login} разблокирован`,
        details: {
          login: login,
          email: userData.email,
          previously_blocked: true,
          previously_blocked_until: userData.blocked_until,
          blocked_record_updated: blockedRecordUpdated,
          unblocked_by_admin: {
            id: adminId,
            username: req.admin.username,
          },
        },
      });
    } catch (error) {
      await connection.rollback();
      console.error(
        "❌ [AdminUsersController.unblockUser] Ошибка разблокировки:",
        {
          error: error.message,
          stack: error.stack,
          login: req.params.login,
          adminId: req.admin?.id,
        }
      );

      res.status(500).json({
        success: false,
        message: "Ошибка разблокировки пользователя",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    } finally {
      connection.release();
      console.log(
        "🔌 [AdminUsersController.unblockUser] Соединение с БД освобождено"
      );
    }
  }
}

module.exports = AdminUsersController;
