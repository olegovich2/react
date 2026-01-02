const bcrypt = require("bcryptjs");
const { query, getConnection } = require("../../services/databaseService");
const emailService = require("../../utils/emailService");
const validator = require("validator");
const logger = require("../../services/LoggerService");

class AdminUsersController {
  // Получение списка пользователей
  static async getUsers(req, res) {
    const startTime = Date.now();

    logger.info("Запрос списка пользователей", {
      admin_id: req.admin.id,
      endpoint: req.path,
      method: req.method,
    });

    const {
      search = "",
      page = 1,
      limit = 20,
      sortBy = "created_at",
      sortOrder = "DESC",
      isActive,
      isBlocked,
      hasRequests,
      requestType,
      isOverdue,
      requestStatus,
    } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offsetNum = (pageNum - 1) * limitNum;

    try {
      const whereConditions = [];

      if (search.trim() !== "") {
        const searchTerm = `%${search.trim()}%`;
        whereConditions.push(
          `(u.login LIKE '${searchTerm}' OR u.email LIKE '${searchTerm}')`
        );
      }

      if (isActive !== undefined) {
        if (isActive === "true") {
          whereConditions.push('u.logic = "true"');
        } else if (isActive === "false") {
          whereConditions.push('u.logic = "false"');
        }
      }

      if (isBlocked !== undefined) {
        if (isBlocked === "true") {
          whereConditions.push("u.blocked = 1");
        } else if (isBlocked === "false") {
          whereConditions.push("(u.blocked = 0 OR u.blocked IS NULL)");
        }
      }

      const supportRequestSubqueries = `
      (SELECT COUNT(*) FROM support_requests sr 
       WHERE sr.login = u.login 
         AND sr.status IN ('confirmed', 'in_progress')
         AND sr.type = 'password_reset') as password_reset_count,
      
      (SELECT COUNT(*) FROM support_requests sr 
       WHERE sr.login = u.login 
         AND sr.status IN ('confirmed', 'in_progress')
         AND sr.type = 'email_change') as email_change_count,
      
      (SELECT COUNT(*) FROM support_requests sr 
       WHERE sr.login = u.login 
         AND sr.status IN ('confirmed', 'in_progress')
         AND sr.type = 'unblock') as unblock_count,
      
      (SELECT COUNT(*) FROM support_requests sr 
       WHERE sr.login = u.login 
         AND sr.status IN ('confirmed', 'in_progress')
         AND sr.type = 'account_deletion') as account_deletion_count,
      
      (SELECT COUNT(*) FROM support_requests sr 
       WHERE sr.login = u.login 
         AND sr.status IN ('confirmed', 'in_progress')
         AND sr.type = 'other') as other_count,
      
      (SELECT COUNT(*) FROM support_requests sr 
       WHERE sr.login = u.login 
         AND sr.status IN ('confirmed', 'in_progress')) as total_active_requests,
      
      (SELECT COUNT(*) FROM support_requests sr 
       WHERE sr.login = u.login 
         AND sr.status IN ('confirmed', 'in_progress')
         AND sr.created_at < DATE_SUB(NOW(), INTERVAL 24 HOUR)) as overdue_count,
      
      (SELECT sr.id FROM support_requests sr 
       WHERE sr.login = u.login 
         AND sr.status IN ('confirmed', 'in_progress')
       ORDER BY sr.created_at ASC 
       LIMIT 1) as oldest_request_id,
      
      (SELECT sr.type FROM support_requests sr 
       WHERE sr.login = u.login 
         AND sr.status IN ('confirmed', 'in_progress')
       ORDER BY sr.created_at ASC 
       LIMIT 1) as oldest_request_type
    `;

      if (hasRequests === "true") {
        whereConditions.push(`EXISTS (
        SELECT 1 FROM support_requests sr 
        WHERE sr.login = u.login 
          AND sr.status IN ('confirmed', 'in_progress')
      )`);
      } else if (hasRequests === "false") {
        whereConditions.push(`NOT EXISTS (
        SELECT 1 FROM support_requests sr 
        WHERE sr.login = u.login 
          AND sr.status IN ('confirmed', 'in_progress')
      )`);
      }

      if (requestType && requestType !== "all") {
        whereConditions.push(`EXISTS (
        SELECT 1 FROM support_requests sr 
        WHERE sr.login = u.login 
          AND sr.status IN ('confirmed', 'in_progress')
          AND sr.type = '${requestType}'
      )`);
      }

      if (isOverdue === "true") {
        whereConditions.push(`EXISTS (
        SELECT 1 FROM support_requests sr 
        WHERE sr.login = u.login 
          AND sr.status IN ('confirmed', 'in_progress')
          AND sr.created_at < DATE_SUB(NOW(), INTERVAL 24 HOUR)
      )`);
      } else if (isOverdue === "false") {
        whereConditions.push(`(
        NOT EXISTS (
          SELECT 1 FROM support_requests sr 
          WHERE sr.login = u.login 
            AND sr.status IN ('confirmed', 'in_progress')
        ) OR NOT EXISTS (
          SELECT 1 FROM support_requests sr 
          WHERE sr.login = u.login 
            AND sr.status IN ('confirmed', 'in_progress')
            AND sr.created_at < DATE_SUB(NOW(), INTERVAL 24 HOUR)
        )
      )`);
      }

      if (requestStatus && requestStatus !== "all") {
        whereConditions.push(`EXISTS (
        SELECT 1 FROM support_requests sr 
        WHERE sr.login = u.login 
          AND sr.status = '${requestStatus}'
      )`);
      }

      const whereClause =
        whereConditions.length > 0
          ? `WHERE ${whereConditions.join(" AND ")}`
          : "";

      const sql = `
      SELECT 
        u.login, 
        u.email, 
        u.logic as is_active,
        u.blocked,
        u.blocked_until,
        u.created_at,
        (SELECT COUNT(*) FROM sessionsdata WHERE login = u.login) as active_sessions,
        ${supportRequestSubqueries}
        
      FROM usersdata u 
      ${whereClause}
      ORDER BY ${sortBy} ${sortOrder}
      LIMIT ${limitNum} OFFSET ${offsetNum}
    `;

      logger.debug("SQL запрос для получения пользователей", {
        sql_preview: sql.substring(0, 300) + "...",
      });

      const users = await query(sql);

      const countSql = `
      SELECT COUNT(*) as total 
      FROM usersdata u 
      ${whereClause}
    `;

      const [totalResult] = await query(countSql);
      const totalUsers = totalResult.total || 0;

      const statsSql = `
      SELECT 
        COUNT(*) as total_users,
        SUM(CASE WHEN u.logic = "true" THEN 1 ELSE 0 END) as active_users,
        SUM(CASE WHEN u.logic = "false" THEN 1 ELSE 0 END) as pending_users,
        SUM(CASE WHEN u.blocked = 1 THEN 1 ELSE 0 END) as blocked_users,
        SUM(CASE WHEN u.blocked = 0 OR u.blocked IS NULL THEN 1 ELSE 0 END) as not_blocked_users,
        
        SUM(CASE WHEN EXISTS (
          SELECT 1 FROM support_requests sr 
          WHERE sr.login = u.login 
            AND sr.status IN ('confirmed', 'in_progress')
        ) THEN 1 ELSE 0 END) as users_with_requests,
        
        SUM(CASE WHEN EXISTS (
          SELECT 1 FROM support_requests sr 
          WHERE sr.login = u.login 
            AND sr.status IN ('confirmed', 'in_progress')
            AND sr.created_at < DATE_SUB(NOW(), INTERVAL 24 HOUR)
        ) THEN 1 ELSE 0 END) as users_with_overdue_requests
        
      FROM usersdata u 
      ${whereClause}
    `;

      const [statsResult] = await query(statsSql);

      const usersWithStats = await Promise.all(
        users.map(async (user) => {
          let surveyCount = 0;
          let imageCount = 0;

          try {
            const [tableExists] = await query(
              `SELECT COUNT(*) as exists_flag 
             FROM information_schema.tables 
             WHERE table_schema = DATABASE() 
               AND table_name = ?`,
              [user.login]
            );

            if (tableExists.exists_flag > 0) {
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
            }
          } catch (statsError) {
            logger.warn("Не удалось получить статистику для пользователя", {
              login: user.login,
            });
          }

          const isBlocked = user.blocked === 1;
          let isPermanentlyBlocked = false;
          let blockedUntilFormatted = null;
          let daysRemaining = null;

          if (isBlocked && user.blocked_until) {
            const blockedUntil = new Date(user.blocked_until);
            const now = new Date();

            isPermanentlyBlocked = blockedUntil.getFullYear() >= 2099;

            if (!isPermanentlyBlocked && blockedUntil > now) {
              const diffTime = blockedUntil - now;
              daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

              const day = blockedUntil.getDate();
              const month = blockedUntil.toLocaleString("ru-RU", {
                month: "long",
              });
              const year = blockedUntil.getFullYear();
              blockedUntilFormatted = `${day} ${month} ${year} года`;
            }
          }

          return {
            id: user.login,
            login: user.login,
            email: user.email,
            isActive: user.is_active === "true",
            isBlocked: isBlocked,
            blockedUntil: user.blocked_until,
            blockedUntilFormatted: blockedUntilFormatted,
            isPermanentlyBlocked: isPermanentlyBlocked,
            daysRemaining: daysRemaining,
            createdAt: user.created_at,
            activeSessions: user.active_sessions || 0,
            hasUserTable: surveyCount > 0 || imageCount > 0,
            stats: {
              surveys: surveyCount,
              images: imageCount,
            },
            supportRequests: {
              password_reset: user.password_reset_count || 0,
              email_change: user.email_change_count || 0,
              unblock: user.unblock_count || 0,
              account_deletion: user.account_deletion_count || 0,
              other: user.other_count || 0,
              total: user.total_active_requests || 0,
              overdue: (user.overdue_count || 0) > 0,
              overdueCount: user.overdue_count || 0,
              oldestRequestId: user.oldest_request_id,
              oldestRequestType: user.oldest_request_type,
            },
          };
        })
      );

      const responseTime = Date.now() - startTime;

      logger.info("Список пользователей получен", {
        total_users: totalUsers,
        on_page: usersWithStats.length,
        response_time_ms: responseTime,
      });

      const response = {
        success: true,
        users: usersWithStats,
        pagination: {
          currentPage: pageNum,
          totalPages: Math.ceil(totalUsers / limitNum),
          totalItems: totalUsers,
          itemsPerPage: limitNum,
        },
        stats: {
          totalUsers: statsResult.total_users,
          activeUsers: statsResult.active_users,
          pendingUsers: statsResult.pending_users,
          blockedUsers: statsResult.blocked_users,
          notBlockedUsers: statsResult.not_blocked_users,
          usersWithRequests: statsResult.users_with_requests,
          usersWithOverdueRequests: statsResult.users_with_overdue_requests,
        },
        filters: {
          search,
          isActive,
          isBlocked,
          hasRequests,
          requestType,
          isOverdue,
          requestStatus,
          sortBy,
          sortOrder,
        },
        timestamp: new Date().toISOString(),
      };

      res.json(response);
    } catch (error) {
      logger.error("Ошибка получения списка пользователей", {
        error_message: error.message,
        admin_id: req.admin.id,
        response_time_ms: Date.now() - startTime,
      });

      res.status(500).json({
        success: false,
        message: "Ошибка получения списка пользователей",
        timestamp: new Date().toISOString(),
      });
    }
  }

  // Получение детальной информации о пользователе
  static async getUserDetails(req, res) {
    const startTime = Date.now();

    logger.info("Запрос детальной информации о пользователе", {
      admin_id: req.admin.id,
      endpoint: req.path,
      method: req.method,
    });

    try {
      const { login } = req.params;

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

      if (!user || user.length === 0) {
        logger.warn("Пользователь не найден", {
          login,
          admin_id: req.admin.id,
        });

        return res.status(404).json({
          success: false,
          message: "Пользователь не найден",
        });
      }

      const userData = user[0];

      const isBlocked = userData.blocked === 1;
      let isPermanentlyBlocked = false;
      let blockedUntilFormatted = null;
      let daysRemaining = null;
      let blockStatus = "active";

      if (isBlocked && userData.blocked_until) {
        const blockedUntil = new Date(userData.blocked_until);
        const now = new Date();

        isPermanentlyBlocked = blockedUntil.getFullYear() >= 2099;

        if (isPermanentlyBlocked) {
          blockStatus = "permanently_blocked";
          blockedUntilFormatted = "бессрочно";
        } else if (blockedUntil > now) {
          blockStatus = "temporarily_blocked";

          const diffTime = blockedUntil - now;
          daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          const day = blockedUntil.getDate();
          const month = blockedUntil.toLocaleString("ru-RU", { month: "long" });
          const year = blockedUntil.getFullYear();
          blockedUntilFormatted = `${day} ${month} ${year} года`;
        } else {
          blockStatus = "expired_block";
          blockedUntilFormatted = "срок истёк";
        }
      }

      const [tableExists] = await query(
        `SELECT COUNT(*) as exists_flag 
         FROM information_schema.tables 
         WHERE table_schema = DATABASE() 
           AND table_name = ?`,
        [login]
      );

      let userStats = {};
      if (tableExists.exists_flag > 0) {
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

      const sessions = await query(
        `SELECT id, date as login_time, jwt_access as token_prefix
         FROM sessionsdata 
         WHERE login = ? 
         ORDER BY date DESC 
         LIMIT 5`,
        [login]
      );

      const recentAdminLogins = await query(
        `SELECT ip_address, success, created_at 
         FROM login_attempts 
         WHERE login = ? 
           AND success = TRUE
         ORDER BY created_at DESC 
         LIMIT 10`,
        [login]
      );

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

      const adminActions = await query(
        `SELECT 
           al.action,
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

      const responseTime = Date.now() - startTime;

      logger.info("Детальная информация о пользователе получена", {
        login,
        block_status: blockStatus,
        response_time_ms: responseTime,
      });

      res.json({
        success: true,
        user: {
          login: userData.login,
          email: userData.email,
          isActive: userData.is_active === "true",
          isBlocked: isBlocked,
          blockStatus: blockStatus,
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
          action: action.action,
          admin: action.admin_name || "System",
          details: action.details ? JSON.parse(action.details) : null,
          timestamp: action.created_at,
        })),
      });
    } catch (error) {
      logger.error("Ошибка получения деталей пользователя", {
        error_message: error.message,
        login: req.params.login,
        admin_id: req.admin?.id,
        response_time_ms: Date.now() - startTime,
      });

      res.status(500).json({
        success: false,
        message: "Ошибка получения информации о пользователе",
      });
    }
  }

  // Сброс пароля пользователя
  static async resetUserPassword(req, res) {
    const startTime = Date.now();

    logger.info("Сброс пароля пользователя", {
      admin_id: req.admin.id,
      login: req.params.login,
      endpoint: req.path,
      method: req.method,
    });

    const connection = await getConnection();
    try {
      const { login } = req.params;
      const { notifyUser = true, newPassword } = req.body;
      const adminId = req.admin.id;

      const [user] = await query(
        'SELECT login, email FROM usersdata WHERE login = ? AND logic = "true"',
        [login]
      );

      if (!user) {
        logger.warn("Пользователь не найден для сброса пароля", {
          login,
          admin_id: adminId,
        });

        return res.status(404).json({
          success: false,
          message: "Пользователь не найден или не активирован",
        });
      }

      await connection.beginTransaction();

      const generatedPassword =
        newPassword || Math.random().toString(36).slice(-8) + "A1!";
      const salt = await bcrypt.genSalt(12);
      const hashedPassword = await bcrypt.hash(generatedPassword, salt);

      await connection.execute(
        "UPDATE usersdata SET password = ? WHERE login = ?",
        [hashedPassword, login]
      );

      await connection.execute("DELETE FROM sessionsdata WHERE login = ?", [
        login,
      ]);

      await connection.execute(
        `INSERT INTO admin_logs (admin_id, action, target_type, target_id, details) 
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

      if (notifyUser) {
        try {
          await emailService.sendPasswordResetByAdmin({
            login: user.login,
            email: user.email,
            adminName: req.admin.username,
            newPassword: generatedPassword,
            resetByAdmin: true,
          });

          logger.info("Email уведомление о сбросе пароля отправлено", {
            login,
            email: user.email,
          });
        } catch (emailError) {
          logger.warn("Не удалось отправить email уведомление", {
            login,
            email: user.email,
          });
        }
      }

      const responseTime = Date.now() - startTime;

      logger.info("Пароль пользователя сброшен", {
        login,
        admin_id: adminId,
        user_notified: notifyUser,
        response_time_ms: responseTime,
      });

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

      logger.error("Ошибка сброса пароля пользователя", {
        error_message: error.message,
        login: req.params.login,
        admin_id: req.admin.id,
        response_time_ms: Date.now() - startTime,
      });

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
    const startTime = Date.now();

    logger.info("Смена email пользователя", {
      admin_id: req.admin.id,
      login: req.params.login,
      endpoint: req.path,
      method: req.method,
    });

    const connection = await getConnection();
    try {
      const { login } = req.params;
      const { newEmail, reason } = req.body;
      const adminId = req.admin.id;

      if (!newEmail || !validator.isEmail(newEmail)) {
        logger.warn("Некорректный email для смены", {
          login,
          new_email: newEmail,
          admin_id: adminId,
        });

        return res.status(400).json({
          success: false,
          message: "Некорректный email адрес",
        });
      }

      const [user] = await query(
        'SELECT login, email FROM usersdata WHERE login = ? AND logic = "true"',
        [login]
      );

      if (!user) {
        logger.warn("Пользователь не найден для смены email", {
          login,
          admin_id: adminId,
        });

        return res.status(404).json({
          success: false,
          message: "Пользователь не найден или не активирован",
        });
      }

      const [emailCheck] = await query(
        "SELECT COUNT(*) as count FROM usersdata WHERE email = ? AND login != ?",
        [newEmail, login]
      );

      if (emailCheck.count > 0) {
        logger.warn("Email уже используется другим пользователем", {
          login,
          new_email: newEmail,
          admin_id: adminId,
        });

        return res.status(400).json({
          success: false,
          message: "Этот email уже используется другим пользователем",
        });
      }

      await connection.beginTransaction();

      const oldEmail = user.email;

      await connection.execute(
        "UPDATE usersdata SET email = ? WHERE login = ?",
        [newEmail, login]
      );

      await connection.execute(
        `INSERT INTO admin_logs (admin_id, action, target_type, target_id, details) 
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

      try {
        await emailService.sendEmailChangedNotification({
          login: user.login,
          oldEmail: oldEmail,
          newEmail: newEmail,
          changedBy: "administrator",
          adminName: req.admin.username,
        });

        if (validator.isEmail(oldEmail)) {
          await emailService.sendEmailChangeAlert({
            login: user.login,
            email: oldEmail,
            newEmail: newEmail,
            changedBy: "administrator",
          });
        }

        logger.info("Уведомления об изменении email отправлены", {
          login,
          old_email: oldEmail,
          new_email: newEmail,
        });
      } catch (emailError) {
        logger.warn("Не удалось отправить email уведомления", {
          login,
          emails: [oldEmail, newEmail],
        });
      }

      const responseTime = Date.now() - startTime;

      logger.info("Email пользователя изменен", {
        login,
        admin_id: adminId,
        old_email: oldEmail,
        new_email: newEmail,
        response_time_ms: responseTime,
      });

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

      logger.error("Ошибка смены email пользователя", {
        error_message: error.message,
        login: req.params.login,
        admin_id: req.admin.id,
        response_time_ms: Date.now() - startTime,
      });

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
    const startTime = Date.now();

    logger.info("Удаление пользователя", {
      admin_id: req.admin.id,
      login: req.params.login,
      endpoint: req.path,
      method: req.method,
    });

    const connection = await getConnection();
    try {
      const { login } = req.params;
      const { deleteFiles = true, backupUserData = true } = req.body;
      const adminId = req.admin.id;

      const [user] = await query(
        "SELECT login, email FROM usersdata WHERE login = ?",
        [login]
      );

      if (!user) {
        logger.warn("Пользователь не найден для удаления", {
          login,
          admin_id: adminId,
        });

        return res.status(404).json({
          success: false,
          message: "Пользователь не найден",
        });
      }

      await connection.beginTransaction();

      let backupCreated = false;
      if (backupUserData) {
        backupCreated = true;
      }

      try {
        await connection.execute(`DROP TABLE IF EXISTS \`${login}\``);
      } catch (tableError) {
        logger.warn("Таблица пользователя не найдена", {
          table_name: login,
        });
      }

      await connection.execute("DELETE FROM sessionsdata WHERE login = ?", [
        login,
      ]);

      await connection.execute("DELETE FROM login_attempts WHERE login = ?", [
        login,
      ]);

      await connection.execute("DELETE FROM usersdata WHERE login = ?", [
        login,
      ]);

      await connection.execute(
        "DELETE FROM email_change_requests WHERE user_login = ?",
        [login]
      );

      await connection.execute(
        `INSERT INTO admin_logs (admin_id, action, target_type, target_id, details) 
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
            logger.info("Файлы пользователя удалены", {
              login,
            });
          }
        } catch (fsError) {
          logger.warn("Ошибка удаления файлов пользователя", {
            login,
          });
        }
      }

      const responseTime = Date.now() - startTime;

      logger.info("Пользователь успешно удален", {
        login,
        admin_id: adminId,
        backup_created: backupCreated,
        files_deleted: deleteFiles,
        response_time_ms: responseTime,
      });

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

      logger.error("Ошибка удаления пользователя", {
        error_message: error.message,
        login: req.params.login,
        admin_id: req.admin.id,
        response_time_ms: Date.now() - startTime,
      });

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
    const startTime = Date.now();

    logger.info("Запросы на смену email", {
      admin_id: req.admin.id,
      endpoint: req.path,
      method: req.method,
    });

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

      const [statsResult] = await query(
        `SELECT 
           status,
           COUNT(*) as count
         FROM email_change_requests
         GROUP BY status`
      );

      const responseTime = Date.now() - startTime;

      logger.info("Запросы на смену email получены", {
        total: requests.length,
        status_filter: status,
        response_time_ms: responseTime,
      });

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
      logger.error("Ошибка получения запросов на смену email", {
        error_message: error.message,
        admin_id: req.admin.id,
        response_time_ms: Date.now() - startTime,
      });

      res.status(500).json({
        success: false,
        message: "Ошибка получения запросов",
      });
    }
  }

  // Одобрение запроса на смену email
  static async approveEmailRequest(req, res) {
    const startTime = Date.now();

    logger.info("Одобрение запроса на смену email", {
      admin_id: req.admin.id,
      request_id: req.params.id,
      endpoint: req.path,
      method: req.method,
    });

    const connection = await getConnection();
    try {
      const { id } = req.params;
      const { adminNotes } = req.body;
      const adminId = req.admin.id;

      const [request] = await query(
        `SELECT ecr.*, u.email as current_email
         FROM email_change_requests ecr
         JOIN usersdata u ON ecr.user_login = u.login
         WHERE ecr.id = ? AND ecr.status = 'pending'`,
        [id]
      );

      if (!request) {
        logger.warn("Запрос на смену email не найден", {
          request_id: id,
          admin_id: adminId,
        });

        return res.status(404).json({
          success: false,
          message: "Запрос не найден или уже обработан",
        });
      }

      await connection.beginTransaction();

      await connection.execute(
        "UPDATE usersdata SET email = ? WHERE login = ?",
        [request.new_email, request.user_login]
      );

      await connection.execute(
        `UPDATE email_change_requests 
         SET status = 'approved', 
             admin_id = ?,
             admin_notes = ?,
             processed_at = NOW()
         WHERE id = ?`,
        [adminId, adminNotes || "Одобрено администратором", id]
      );

      await connection.execute(
        `INSERT INTO admin_logs (admin_id, action, target_type, target_id, details) 
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

      try {
        await emailService.sendEmailChangeApproved({
          login: request.user_login,
          oldEmail: request.old_email,
          newEmail: request.new_email,
          adminNotes: adminNotes,
        });

        logger.info("Уведомление об одобрении смены email отправлено", {
          user_login: request.user_login,
          old_email: request.old_email,
          new_email: request.new_email,
        });
      } catch (emailError) {
        logger.warn("Не удалось отправить email уведомление", {
          user_login: request.user_login,
        });
      }

      const responseTime = Date.now() - startTime;

      logger.info("Запрос на смену email одобрен", {
        request_id: id,
        admin_id: adminId,
        user_login: request.user_login,
        response_time_ms: responseTime,
      });

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

      logger.error("Ошибка одобрения запроса на смену email", {
        error_message: error.message,
        request_id: req.params.id,
        admin_id: req.admin.id,
        response_time_ms: Date.now() - startTime,
      });

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
    const startTime = Date.now();

    logger.info("Отклонение запроса на смену email", {
      admin_id: req.admin.id,
      request_id: req.params.id,
      endpoint: req.path,
      method: req.method,
    });

    const connection = await getConnection();
    try {
      const { id } = req.params;
      const { adminNotes, rejectionReason } = req.body;
      const adminId = req.admin.id;

      const [request] = await query(
        `SELECT * FROM email_change_requests 
         WHERE id = ? AND status = 'pending'`,
        [id]
      );

      if (!request) {
        logger.warn("Запрос на смену email не найден для отклонения", {
          request_id: id,
          admin_id: adminId,
        });

        return res.status(404).json({
          success: false,
          message: "Запрос не найден или уже обработан",
        });
      }

      await connection.beginTransaction();

      await connection.execute(
        `UPDATE email_change_requests 
         SET status = 'rejected', 
             admin_id = ?,
             admin_notes = ?,
             processed_at = NOW()
         WHERE id = ?`,
        [adminId, adminNotes || "Отклонено администратором", id]
      );

      await connection.execute(
        `INSERT INTO admin_logs (admin_id, action, target_type, target_id, details) 
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

      try {
        await emailService.sendEmailChangeRejected({
          login: request.user_login,
          email: request.old_email,
          newEmail: request.new_email,
          rejectionReason: rejectionReason || adminNotes,
          adminNotes: adminNotes,
        });

        logger.info("Уведомление об отклонении смены email отправлено", {
          user_login: request.user_login,
          email: request.old_email,
        });
      } catch (emailError) {
        logger.warn("Не удалось отправить email уведомление", {
          user_login: request.user_login,
        });
      }

      const responseTime = Date.now() - startTime;

      logger.info("Запрос на смену email отклонен", {
        request_id: id,
        admin_id: adminId,
        user_login: request.user_login,
        response_time_ms: responseTime,
      });

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

      logger.error("Ошибка отклонения запроса на смену email", {
        error_message: error.message,
        request_id: req.params.id,
        admin_id: req.admin.id,
        response_time_ms: Date.now() - startTime,
      });

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
    const startTime = Date.now();

    logger.info("Блокировка пользователя", {
      admin_id: req.admin.id,
      login: req.params.login,
      endpoint: req.path,
      method: req.method,
    });

    const connection = await getConnection();
    try {
      const { login } = req.params;
      const { duration, reason, deleteSessions = false } = req.body;
      const adminId = req.admin.id;

      if (!duration || !["7d", "30d", "forever"].includes(duration)) {
        logger.warn("Некорректная длительность блокировки", {
          login,
          duration,
          admin_id: adminId,
        });

        return res.status(400).json({
          success: false,
          message:
            "Некорректная длительность блокировки. Допустимые значения: 7d, 30d, forever",
        });
      }

      const [user] = await connection.execute(
        'SELECT login, email, blocked, blocked_until FROM usersdata WHERE login = ? AND logic = "true"',
        [login]
      );

      if (user.length === 0) {
        logger.warn("Пользователь не найден для блокировки", {
          login,
          admin_id: adminId,
        });

        return res.status(404).json({
          success: false,
          message: "Пользователь не найден или не активирован",
        });
      }

      const userData = user[0];

      if (userData.blocked === 1) {
        logger.warn("Пользователь уже заблокирован", {
          login,
          blocked_until: userData.blocked_until,
          admin_id: adminId,
        });

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

      let blockedUntil = null;
      const now = new Date();

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
          blockedUntil = new Date("2099-12-31 23:59:59");
          break;
      }

      const [updateResult] = await connection.execute(
        `UPDATE usersdata 
         SET blocked = 1, blocked_until = ?
         WHERE login = ?`,
        [blockedUntil, login]
      );

      let sessionsDeleted = 0;
      if (deleteSessions) {
        try {
          const [deleteResult] = await connection.execute(
            "DELETE FROM sessionsdata WHERE login = ?",
            [login]
          );

          sessionsDeleted = deleteResult.affectedRows;
        } catch (deleteError) {
          logger.warn("Ошибка удаления сессий", {
            login,
          });
        }
      }

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
        `INSERT INTO admin_logs (admin_id, action, target_type, target_id, details) 
         VALUES (?, ?, ?, ?, ?)`,
        [adminId, "block", "user", login, JSON.stringify(logDetails)]
      );

      await connection.commit();

      let formattedDate = "бессрочно";
      if (duration !== "forever") {
        const day = blockedUntil.getDate();
        const month = blockedUntil.toLocaleString("ru-RU", { month: "long" });
        const year = blockedUntil.getFullYear();
        formattedDate = `${day} ${month} ${year} года`;
      }

      const responseTime = Date.now() - startTime;

      logger.info("Пользователь заблокирован", {
        login,
        duration,
        formatted_date: formattedDate,
        sessions_deleted: sessionsDeleted,
        admin_id: adminId,
        response_time_ms: responseTime,
      });

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

      logger.error("Ошибка блокировки пользователя", {
        error_message: error.message,
        login: req.params.login,
        admin_id: req.admin?.id,
        response_time_ms: Date.now() - startTime,
      });

      res.status(500).json({
        success: false,
        message: "Ошибка блокировки пользователя",
      });
    } finally {
      connection.release();
    }
  }

  // Разблокировка пользователя
  static async unblockUser(req, res) {
    const startTime = Date.now();

    logger.info("Разблокировка пользователя", {
      admin_id: req.admin.id,
      login: req.params.login,
      endpoint: req.path,
      method: req.method,
    });

    const connection = await getConnection();
    try {
      const { login } = req.params;
      const adminId = req.admin.id;

      const [user] = await connection.execute(
        'SELECT login, email, blocked, blocked_until FROM usersdata WHERE login = ? AND logic = "true"',
        [login]
      );

      if (user.length === 0) {
        logger.warn("Пользователь не найден для разблокировки", {
          login,
          admin_id: adminId,
        });

        return res.status(404).json({
          success: false,
          message: "Пользователь не найден или не активирован",
        });
      }

      const userData = user[0];

      if (userData.blocked !== 1) {
        logger.warn("Пользователь не заблокирован", {
          login,
          blocked: userData.blocked,
          admin_id: adminId,
        });

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

      const [updateResult] = await connection.execute(
        `UPDATE usersdata 
         SET blocked = 0, blocked_until = NULL
         WHERE login = ?`,
        [login]
      );

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
        }
      } catch (blockedLogError) {
        logger.warn("Ошибка обновления blocked_login_attempts", {
          login,
        });
      }

      const logDetails = {
        action: "unblock_user",
        previous_blocked_until: userData.blocked_until,
        blocked_record_updated: blockedRecordUpdated,
        manual_unblock: true,
      };

      await connection.execute(
        `INSERT INTO admin_logs (admin_id, action, target_type, target_id, details) 
         VALUES (?, ?, ?, ?, ?)`,
        [adminId, "unblock", "user", login, JSON.stringify(logDetails)]
      );

      await connection.commit();

      const responseTime = Date.now() - startTime;

      logger.info("Пользователь разблокирован", {
        login,
        previously_blocked_until: userData.blocked_until,
        blocked_record_updated: blockedRecordUpdated,
        admin_id: adminId,
        response_time_ms: responseTime,
      });

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

      logger.error("Ошибка разблокировки пользователя", {
        error_message: error.message,
        login: req.params.login,
        admin_id: req.admin?.id,
        response_time_ms: Date.now() - startTime,
      });

      res.status(500).json({
        success: false,
        message: "Ошибка разблокировки пользователя",
      });
    } finally {
      connection.release();
    }
  }
}

module.exports = AdminUsersController;
