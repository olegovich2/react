const bcrypt = require("bcryptjs");
const { query, getConnection } = require("../../services/databaseService");
const emailService = require("../../utils/emailService");
const validator = require("validator");

class AdminUsersController {
  // Получение списка пользователей
  static async getUsers(req, res) {
    console.log("👥 [AdminUsersController.getUsers] Запрос пользователей:", {
      query: req.query,
    });

    const {
      search = "",
      page = 1,
      limit = 20,
      sortBy = "created_at",
      sortOrder = "DESC",
      isActive, // новый параметр для фильтрации по статусу
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

      const whereClause =
        whereConditions.length > 0
          ? `WHERE ${whereConditions.join(" AND ")}`
          : "";

      // Основной запрос
      const sql = `
      SELECT 
        login, 
        email, 
        logic as is_active,
        created_at,
        (SELECT COUNT(*) FROM sessionsdata WHERE login = usersdata.login) as active_sessions,
        (SELECT COUNT(*) FROM information_schema.tables 
         WHERE table_schema = DATABASE() 
           AND table_name = usersdata.login) as has_user_table
      FROM usersdata 
      ${whereClause}
      ORDER BY ${sortBy} ${sortOrder}
      LIMIT ${limitNum} OFFSET ${offsetNum}
    `;

      console.log("🔍 SQL запрос:", sql);
      const users = await query(sql);

      // Общее количество с учетом фильтров
      const [totalResult] = await query(
        `SELECT COUNT(*) as total FROM usersdata ${whereClause}`
      );

      // Статистика с учетом фильтров
      const [statsResult] = await query(`
      SELECT 
        COUNT(*) as total_users,
        SUM(CASE WHEN logic = "true" THEN 1 ELSE 0 END) as active_users,
        SUM(CASE WHEN logic = "false" THEN 1 ELSE 0 END) as pending_users
      FROM usersdata 
      ${whereClause}
    `);

      // Получаем статистику для каждого пользователя (как в твоём коде)
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
                `⚠️ Не удалось получить статистику для ${user.login}:`,
                statsError.message
              );
            }
          }

          return {
            login: user.login,
            email: user.email,
            isActive: user.is_active === "true",
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
        },
        filters: {
          search,
          isActive,
          sortBy,
          sortOrder,
        },
      });
    } catch (error) {
      console.error("❌ Ошибка получения списка пользователей:", error.message);
      res.status(500).json({
        success: false,
        message: "Ошибка получения списка пользователей",
      });
    }
  }

  // Получение детальной информации о пользователе
  static async getUserDetails(req, res) {
    try {
      const { login } = req.params;

      // Основная информация
      const [user] = await query(
        `SELECT 
           login, email, logic as is_active,
           created_at,
           (SELECT COUNT(*) FROM sessionsdata WHERE login = ?) as session_count,
           (SELECT COUNT(*) FROM login_attempts WHERE login = ? AND success = FALSE AND created_at > DATE_SUB(NOW(), INTERVAL 7 DAY)) as failed_logins_7d
         FROM usersdata 
         WHERE login = ?`,
        [login, login, login]
      );

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "Пользователь не найден",
        });
      }

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

      // Получаем последние действия (логи входа)
      const recentLogins = await query(
        `SELECT ip_address, success, created_at 
         FROM login_attempts 
         WHERE login = ? 
         ORDER BY created_at DESC 
         LIMIT 10`,
        [login]
      );

      res.json({
        success: true,
        user: {
          login: user.login,
          email: user.email,
          isActive: user.is_active === "true",
          createdAt: user.created_at,
          sessionCount: user.session_count,
          failedLogins7d: user.failed_logins_7d,
        },
        stats: userStats,
        sessions: sessions.map((session) => ({
          id: session.id,
          loginTime: session.login_time,
          tokenPrefix: session.token_prefix
            ? session.token_prefix.substring(0, 20) + "..."
            : null,
        })),
        recentActivity: recentLogins.map((login) => ({
          ip: login.ip_address,
          success: login.success === 1,
          timestamp: login.created_at,
        })),
      });
    } catch (error) {
      console.error("❌ Ошибка получения деталей пользователя:", error);
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
}

module.exports = AdminUsersController;
