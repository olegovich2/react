const { query } = require("../../services/databaseService");
const SupportController = require("../../support/controllers/SupportController");
const bcrypt = require("bcryptjs");
const emailService = require("../../utils/emailService");
const logger = require("../../services/LoggerService");

class AdminSupportController {
  // 1. ПОЛУЧИТЬ ВСЕ АКТИВНЫЕ ЗАПРОСЫ ПОЛЬЗОВАТЕЛЯ
  static async getUserRequests(req, res) {
    const startTime = Date.now();

    logger.info("Запрос всех активных запросов пользователя", {
      adminId: req.admin.id,
      login: req.params.login,
      endpoint: req.path,
      method: req.method,
    });

    try {
      const { login } = req.params;
      const { type, status, limit = 50 } = req.query;

      if (!login || login.trim() === "") {
        logger.warn("Не указан логин пользователя", {
          adminId: req.admin.id,
        });

        return res.status(400).json({
          success: false,
          message: "Логин пользователя обязателен",
        });
      }

      const whereConditions = [];
      whereConditions.push(`login = '${login}'`);

      if (type && type !== "all") {
        whereConditions.push(`type = '${type}'`);
      }

      if (status && status !== "all") {
        if (status === "resolved") {
          whereConditions.push(`status = 'resolved'`);
        } else if (status === "active") {
          whereConditions.push(
            `status IN ('pending', 'confirmed', 'in_progress')`
          );
        } else {
          whereConditions.push(`status = '${status}'`);
        }
      }

      const whereClause =
        whereConditions.length > 0
          ? `WHERE ${whereConditions.join(" AND ")}`
          : "";

      const sql = `
      SELECT 
        id,
        public_id,
        type,
        login,
        email,
        status,
        created_at,
        updated_at,
        new_email,
        message,
        admin_notes,
        CASE 
          WHEN created_at < DATE_SUB(NOW(), INTERVAL 24 HOUR) 
          THEN 1 ELSE 0 
        END as is_overdue
      FROM support_requests 
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ${parseInt(limit)}
    `;

      logger.debug("SQL запрос для получения запросов пользователя", {
        login,
        sql_preview: sql.substring(0, 200),
      });

      const requests = await query(sql);

      logger.info("Найдено запросов пользователя", {
        login,
        count: requests.length,
      });

      const formattedRequests = requests.map((request) => ({
        id: request.id,
        publicId: request.public_id,
        type: request.type,
        login: request.login,
        email: request.email,
        status: request.status,
        createdAt: request.created_at,
        updatedAt: request.updated_at,
        isOverdue: request.is_overdue === 1,
        newEmail: request.new_email,
        message: request.message,
        adminNotes: request.admin_notes,
      }));

      const statsSql = `
      SELECT 
        type,
        status,
        COUNT(*) as count
      FROM support_requests 
      WHERE login = '${login}'
      GROUP BY type, status
    `;

      const statsRows = await query(statsSql);
      const stats = {
        total: requests.length,
        byType: {},
        byStatus: {},
      };

      statsRows.forEach((row) => {
        stats.byType[row.type] = (stats.byType[row.type] || 0) + row.count;
        stats.byStatus[row.status] =
          (stats.byStatus[row.status] || 0) + row.count;
      });

      const responseTime = Date.now() - startTime;

      logger.info("Запросы пользователя получены", {
        login,
        total: stats.total,
        response_time_ms: responseTime,
      });

      res.json({
        success: true,
        data: {
          user: { login },
          requests: formattedRequests,
          stats,
          filters: { type, status },
        },
      });
    } catch (error) {
      logger.error("Ошибка получения запросов пользователя", {
        error_message: error.message,
        login: req.params.login,
        adminId: req.admin.id,
      });

      let errorMessage = "Ошибка получения запросов пользователя";

      res.status(500).json({
        success: false,
        message: errorMessage,
      });
    }
  }

  // 2. АВТОМАТИЧЕСКАЯ ПРОВЕРКА ЗАПРОСА
  static async validateRequest(req, res) {
    const startTime = Date.now();

    logger.info("Начало автоматической проверки запроса", {
      adminId: req.admin.id,
      requestId: req.params.id,
      endpoint: req.path,
      method: req.method,
    });

    try {
      const { id } = req.params;

      const [request] = await query(
        `SELECT * FROM support_requests WHERE id = ? OR public_id = ?`,
        [id, id]
      );

      if (!request) {
        logger.warn("Запрос не найден при валидации", {
          requestId: id,
          adminId: req.admin.id,
        });

        return res.status(404).json({
          success: false,
          isValid: false,
          message: "Запрос не найден",
        });
      }

      const [user] = await query(
        `SELECT login, email, secret_word, password FROM usersdata WHERE login = ?`,
        [request.login]
      );

      const errors = [];
      const validationDetails = {
        userExists: false,
        emailMatches: false,
        secretWordMatches: false,
        passwordMatches: null,
        isOtherType: request.type === "other",
        hasMessage: !!request.message,
        messageLength: request.message?.length || 0,
      };

      if (request.type === "other") {
        const checkedFields = {
          login: false,
          email: false,
          secretWord: false,
          password: null,
        };

        if (user) {
          checkedFields.login = true;
          validationDetails.userExists = true;

          if (user.email && request.email) {
            const emailMatches =
              user.email.toLowerCase() === request.email.toLowerCase();
            checkedFields.email = emailMatches;
            validationDetails.emailMatches = emailMatches;

            if (!emailMatches) {
              errors.push("Email не совпадает с email пользователя в системе");
            }
          } else {
            errors.push("Email отсутствует в запросе или у пользователя");
            checkedFields.email = false;
          }

          if (!request.message || request.message.trim() === "") {
            errors.push("Сообщение обязательно для типа 'other'");
          } else if (request.message.length < 10) {
            errors.push("Сообщение должно содержать минимум 10 символов");
          }
        } else {
          errors.push("Пользователь не найден в системе");
          validationDetails.userExists = false;
          checkedFields.login = false;
          checkedFields.email = false;
        }

        const isValid = errors.length === 0;

        logger.info("Результат проверки для типа 'other'", {
          requestId: request.id,
          isValid,
          errors_count: errors.length,
        });

        return res.json({
          success: true,
          isValid,
          errors: errors.length > 0 ? errors : null,
          checkedFields,
          validationDetails,
          requestInfo: {
            id: request.id,
            publicId: request.public_id,
            type: request.type,
            login: request.login,
            email: request.email,
            status: isValid ? "in_progress" : request.status,
            createdAt: request.created_at,
            isOverdue:
              new Date(request.created_at) <
              new Date(Date.now() - 24 * 60 * 60 * 1000),
            message: request.message,
          },
        });
      }

      const checkedFields = {
        login: false,
        email: false,
        secretWord: false,
        password: null,
      };

      if (!user) {
        logger.warn("Пользователь не найден при валидации запроса", {
          login: request.login,
          requestId: request.id,
        });

        return res.json({
          success: true,
          isValid: false,
          errors: ["Пользователь не найден в системе"],
          checkedFields: {
            login: false,
            email: false,
            secretWord: false,
            password: false,
          },
          validationDetails: {
            userExists: false,
            emailMatches: false,
            secretWordMatches: false,
            passwordMatches: false,
          },
        });
      }

      checkedFields.login = true;
      validationDetails.userExists = true;

      if (user.email && request.email) {
        const emailMatches =
          user.email.toLowerCase() === request.email.toLowerCase();
        checkedFields.email = emailMatches;
        validationDetails.emailMatches = emailMatches;

        if (!emailMatches) {
          errors.push("Email не совпадает с email пользователя в системе");
        }
      } else {
        errors.push("Email отсутствует в запросе или у пользователя");
        checkedFields.email = false;
        validationDetails.emailMatches = false;
      }

      let decryptedSecretWord = null;
      let decryptedPassword = null;

      try {
        if (request.secret_word_hash) {
          decryptedSecretWord = SupportController.decryptText(
            request.secret_word_hash
          );
          if (!decryptedSecretWord) {
            errors.push("Ошибка расшифровки секретного слова");
          }
        } else {
          errors.push("Секретное слово отсутствует в запросе");
        }
      } catch (decryptError) {
        logger.error("Ошибка расшифровки секретного слова", {
          requestId: request.id,
        });
        errors.push("Ошибка расшифровки секретного слова");
      }

      const requiresPassword = [
        "email_change",
        "unblock",
        "account_deletion",
      ].includes(request.type);

      checkedFields.password = requiresPassword ? false : null;
      validationDetails.passwordMatches = requiresPassword ? false : null;

      if (requiresPassword) {
        try {
          if (request.password) {
            decryptedPassword = SupportController.decryptText(request.password);
            if (!decryptedPassword) {
              errors.push("Ошибка расшифровки пароля");
            }
          } else {
            errors.push("Пароль отсутствует в запросе");
          }
        } catch (decryptError) {
          logger.error("Ошибка расшифровки пароля", {
            requestId: request.id,
          });
          errors.push("Ошибка расшифровки пароля");
        }
      }

      if (
        decryptedSecretWord &&
        user.secret_word &&
        !errors.includes("Ошибка расшифровки секретного слова")
      ) {
        try {
          const secretWordMatch = await bcrypt.compare(
            decryptedSecretWord,
            user.secret_word
          );

          if (secretWordMatch) {
            checkedFields.secretWord = true;
            validationDetails.secretWordMatches = true;
          } else {
            errors.push("Секретное слово не совпадает");
            validationDetails.secretWordMatches = false;
            logger.warn("Секретное слово не совпадает", {
              requestId: request.id,
              login: request.login,
            });
          }
        } catch (bcryptError) {
          logger.error("Ошибка проверки секретного слова", {
            requestId: request.id,
          });
          errors.push("Ошибка проверки секретного слова");
          validationDetails.secretWordMatches = false;
        }
      }

      if (
        requiresPassword &&
        decryptedPassword &&
        user.password &&
        !errors.includes("Ошибка расшифровки пароля")
      ) {
        try {
          const passwordMatch = await bcrypt.compare(
            decryptedPassword,
            user.password
          );
          if (passwordMatch) {
            checkedFields.password = true;
            validationDetails.passwordMatches = true;
          } else {
            errors.push("Пароль не совпадает");
            validationDetails.passwordMatches = false;
            logger.warn("Пароль не совпадает", {
              requestId: request.id,
              login: request.login,
            });
          }
        } catch (bcryptError) {
          logger.error("Ошибка проверки пароля", {
            requestId: request.id,
          });
          errors.push("Ошибка проверки пароля");
          validationDetails.passwordMatches = false;
        }
      }

      const isValid = errors.length === 0;
      const responseTime = Date.now() - startTime;

      logger.info("Валидация запроса завершена", {
        requestId: request.id,
        type: request.type,
        isValid,
        errors_count: errors.length,
        response_time_ms: responseTime,
        adminId: req.admin.id,
      });

      if (isValid && request.status === "confirmed") {
        try {
          await query(
            `UPDATE support_requests SET status = 'in_progress' WHERE id = ?`,
            [request.id]
          );
        } catch (updateError) {
          logger.warn("Не удалось обновить статус запроса", {
            requestId: request.id,
          });
        }
      }

      res.json({
        success: true,
        isValid,
        errors: errors.length > 0 ? errors : null,
        checkedFields,
        validationDetails,
        requestInfo: {
          id: request.id,
          publicId: request.public_id,
          type: request.type,
          login: request.login,
          email: request.email,
          newEmail: request.new_email,
          status: isValid ? "in_progress" : request.status,
          createdAt: request.created_at,
          isOverdue:
            new Date(request.created_at) <
            new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      });
    } catch (error) {
      logger.error("Критическая ошибка при валидации запроса", {
        error_message: error.message,
        requestId: req.params.id,
        adminId: req.admin?.id,
        response_time_ms: Date.now() - startTime,
      });

      res.status(500).json({
        success: false,
        isValid: false,
        message: "Внутренняя ошибка сервера при проверке запроса",
      });
    }
  }

  // 3. ПОЛУЧИТЬ ИНФОРМАЦИЮ О ЗАПРОСЕ (БЕЗ РАСШИФРОВКИ)
  static async getRequestInfo(req, res) {
    const startTime = Date.now();

    logger.info("Запрос информации о заявке поддержки", {
      requestId: req.params.id,
      adminId: req.admin.id,
      endpoint: req.path,
      method: req.method,
    });

    try {
      const { id } = req.params;

      const [request] = await query(
        `SELECT 
          id,
          public_id,
          type,
          login,
          email,
          status,
          created_at,
          updated_at,
          new_email,
          message,
          admin_notes,
          admin_id,
          resolved_at,
          CASE 
            WHEN created_at < DATE_SUB(NOW(), INTERVAL 24 HOUR) 
            THEN 1 ELSE 0 
          END as is_overdue
         FROM support_requests 
         WHERE id = ? OR public_id = ?`,
        [id, id]
      );

      if (!request) {
        logger.warn("Заявка поддержки не найдена", {
          requestId: id,
          adminId: req.admin.id,
        });

        return res.status(404).json({
          success: false,
          message: "Запрос не найден",
        });
      }

      const logs = await query(
        `SELECT 
          action,
          old_value,
          new_value,
          actor_type,
          actor_id,
          created_at
         FROM support_request_logs 
         WHERE request_id = ?
         ORDER BY created_at DESC
         LIMIT 10`,
        [request.id]
      );

      const responseData = {
        request: {
          id: request.id,
          publicId: request.public_id,
          type: request.type,
          login: request.login,
          email: request.email,
          status: request.status,
          createdAt: request.created_at,
          updatedAt: request.updated_at,
          isOverdue: request.is_overdue === 1,
          newEmail: request.new_email,
          message: request.message,
          adminNotes: request.admin_notes,
          adminId: request.admin_id,
          resolvedAt: request.resolved_at,
        },
        logs: logs.map((log) => ({
          action: log.action,
          oldValue: log.old_value,
          newValue: log.new_value,
          actorType: log.actor_type,
          actorId: log.actor_id,
          createdAt: log.created_at,
        })),
      };

      if (request.type === "other") {
        responseData.additionalInfo = {
          hasMessage: !!request.message,
          messageLength: request.message?.length || 0,
          requiresValidation: false,
          specialNote:
            "Для типа 'other' требуется ручная проверка сообщения пользователя",
        };
      }

      logger.info("Информация о заявке успешно получена", {
        requestId: request.id,
        type: request.type,
        logs_count: logs.length,
        response_time_ms: Date.now() - startTime,
      });

      res.json({
        success: true,
        data: responseData,
      });
    } catch (error) {
      logger.error("Ошибка получения информации о заявке", {
        error_message: error.message,
        requestId: req.params.id,
        adminId: req.admin?.id,
        response_time_ms: Date.now() - startTime,
      });

      res.status(500).json({
        success: false,
        message: "Ошибка получения информации о запросе",
      });
    }
  }

  // 4. ОБРАБОТАТЬ ЗАПРОС (ОДОБРИТЬ/ОТКЛОНИТЬ) С ОТПРАВКОЙ ПИСЕМ
  static async processRequest(req, res) {
    const startTime = Date.now();

    logger.info("Начало обработки запроса поддержки", {
      adminId: req.admin.id,
      requestId: req.params.id,
      action: req.body.action,
      endpoint: req.path,
      method: req.method,
    });

    const connection =
      await require("../../services/databaseService").getConnection();
    try {
      const { id } = req.params;
      const { action, reason, emailResponse } = req.body;

      if (!action || !["approve", "reject"].includes(action)) {
        logger.warn("Неверное действие при обработке запроса", {
          action,
          requestId: id,
        });

        return res.status(400).json({
          success: false,
          message: "Неверное действие. Допустимые значения: approve, reject",
        });
      }

      const [request] = await connection.execute(
        `SELECT * FROM support_requests WHERE id = ? OR public_id = ?`,
        [id, id]
      );

      if (!request || request.length === 0) {
        logger.warn("Запрос поддержки не найден при обработке", {
          requestId: id,
          adminId: req.admin.id,
        });

        return res.status(404).json({
          success: false,
          message: "Запрос не найден",
        });
      }

      const supportRequest = request[0];

      await connection.beginTransaction();

      const newStatus = action === "approve" ? "resolved" : "rejected";

      await connection.execute(
        `UPDATE support_requests 
       SET status = ?, 
           admin_id = ?, 
           admin_notes = ?, 
           resolved_at = NOW(),
           updated_at = NOW()
       WHERE id = ?`,
        [
          newStatus,
          req.admin.id,
          reason || `Обработано администратором ${req.admin.username}`,
          supportRequest.id,
        ]
      );

      logger.info("Статус запроса обновлен", {
        requestId: supportRequest.id,
        oldStatus: supportRequest.status,
        newStatus,
        action,
        adminId: req.admin.id,
      });

      await connection.execute(
        `INSERT INTO support_request_logs 
       (request_id, action, old_value, new_value, actor_type, actor_id) 
       VALUES (?, ?, ?, ?, ?, ?)`,
        [
          supportRequest.id,
          "status_changed",
          supportRequest.status,
          newStatus,
          "admin",
          req.admin.id.toString(),
        ]
      );

      const logDetails = {
        requestType: supportRequest.type,
        action: action,
        reason: reason || null,
        processedBy: req.admin.username,
        timestamp: new Date().toISOString(),
      };

      await connection.execute(
        `INSERT INTO admin_logs (admin_id, action, target_type, target_id, details) 
       VALUES (?, ?, ?, ?, ?)`,
        [
          req.admin.id,
          action === "approve" ? "approve" : "reject",
          "support",
          supportRequest.id,
          JSON.stringify(logDetails),
        ]
      );

      let actionResult = {};
      let emailResults = [];

      switch (supportRequest.type) {
        case "password_reset":
          if (action === "approve") {
            const newPassword = Math.random().toString(36).slice(-8) + "A1!";
            const salt = await bcrypt.genSalt(12);
            const hashedPassword = await bcrypt.hash(newPassword, salt);

            await connection.execute(
              "UPDATE usersdata SET password = ? WHERE login = ?",
              [hashedPassword, supportRequest.login]
            );

            await connection.execute(
              "DELETE FROM sessionsdata WHERE login = ?",
              [supportRequest.login]
            );

            actionResult = {
              passwordReset: true,
              newPasswordGenerated: true,
              sessionsCleared: true,
              newPassword: newPassword,
            };

            logger.info("Пароль пользователя сброшен", {
              login: supportRequest.login,
              requestId: supportRequest.id,
            });

            try {
              await emailService.sendSupportRequestProcessed({
                login: supportRequest.login,
                email: supportRequest.email,
                requestId: supportRequest.public_id || supportRequest.id,
                requestType: supportRequest.type,
                action: action,
                reason: reason,
                adminName: req.admin.username,
                password: newPassword,
              });

              emailResults.push({
                type: "password_reset",
                success: true,
                passwordSent: true,
              });

              logger.info("Письмо с новым паролем отправлено", {
                email: supportRequest.email,
                login: supportRequest.login,
              });
            } catch (emailError) {
              logger.error("Ошибка отправки письма с паролем", {
                email: supportRequest.email,
                login: supportRequest.login,
              });
              emailResults.push({
                type: "password_reset",
                success: false,
                error: emailError.message,
              });
            }
          } else if (action === "reject") {
            try {
              await emailService.sendSupportRequestProcessed({
                login: supportRequest.login,
                email: supportRequest.email,
                requestId: supportRequest.public_id || supportRequest.id,
                requestType: supportRequest.type,
                action: action,
                reason: reason,
                adminName: req.admin.username,
              });

              emailResults.push({
                type: "password_reset_rejected",
                success: true,
              });

              logger.info("Письмо об отказе в сбросе пароля отправлено", {
                email: supportRequest.email,
                login: supportRequest.login,
              });
            } catch (emailError) {
              logger.error("Ошибка отправки письма об отказе", {
                email: supportRequest.email,
                login: supportRequest.login,
              });
              emailResults.push({
                type: "password_reset_rejected",
                success: false,
                error: emailError.message,
              });
            }
          }
          break;

        case "email_change":
          if (action === "approve" && supportRequest.new_email) {
            await connection.execute(
              "UPDATE usersdata SET email = ? WHERE login = ?",
              [supportRequest.new_email, supportRequest.login]
            );

            actionResult = {
              emailChanged: true,
              oldEmail: supportRequest.email,
              newEmail: supportRequest.new_email,
            };

            logger.info("Email пользователя изменен", {
              login: supportRequest.login,
              oldEmail: supportRequest.email,
              newEmail: supportRequest.new_email,
              requestId: supportRequest.id,
            });

            try {
              await emailService.sendSupportEmailChangeNotification({
                login: supportRequest.login,
                email: supportRequest.email,
                requestId: supportRequest.public_id || supportRequest.id,
                adminName: req.admin.username,
                oldEmail: supportRequest.email,
                newEmail: supportRequest.new_email,
                isNewEmail: false,
              });

              emailResults.push({
                type: "email_change_old",
                email: supportRequest.email,
                success: true,
              });

              await emailService.sendSupportEmailChangeNotification({
                login: supportRequest.login,
                email: supportRequest.new_email,
                requestId: supportRequest.public_id || supportRequest.id,
                adminName: req.admin.username,
                oldEmail: supportRequest.email,
                newEmail: supportRequest.new_email,
                isNewEmail: true,
              });

              emailResults.push({
                type: "email_change_new",
                email: supportRequest.new_email,
                success: true,
              });

              logger.info("Уведомления об изменении email отправлены", {
                login: supportRequest.login,
                oldEmail: supportRequest.email,
                newEmail: supportRequest.new_email,
              });
            } catch (emailError) {
              logger.error("Ошибка отправки уведомлений об изменении email", {
                login: supportRequest.login,
              });
              emailResults.push({
                type: "email_change",
                success: false,
                error: emailError.message,
              });
            }
          } else if (action === "reject") {
            try {
              await emailService.sendSupportRequestProcessed({
                login: supportRequest.login,
                email: supportRequest.email,
                requestId: supportRequest.public_id || supportRequest.id,
                requestType: supportRequest.type,
                action: action,
                reason: reason,
                adminName: req.admin.username,
              });

              emailResults.push({
                type: "email_change_rejected",
                success: true,
              });

              logger.info("Письмо об отказе в изменении email отправлено", {
                email: supportRequest.email,
                login: supportRequest.login,
              });
            } catch (emailError) {
              logger.error("Ошибка отправки письма об отказе", {
                email: supportRequest.email,
                login: supportRequest.login,
              });
              emailResults.push({
                type: "email_change_rejected",
                success: false,
                error: emailError.message,
              });
            }
          }
          break;

        case "unblock":
          if (action === "approve") {
            await connection.execute(
              `UPDATE usersdata 
             SET blocked = 0, blocked_until = NULL 
             WHERE login = ?`,
              [supportRequest.login]
            );

            actionResult = {
              userUnblocked: true,
              login: supportRequest.login,
            };

            logger.info("Пользователь разблокирован", {
              login: supportRequest.login,
              requestId: supportRequest.id,
              adminId: req.admin.id,
            });

            try {
              await emailService.sendSupportRequestProcessed({
                login: supportRequest.login,
                email: supportRequest.email,
                requestId: supportRequest.public_id || supportRequest.id,
                requestType: supportRequest.type,
                action: action,
                reason: reason,
                adminName: req.admin.username,
              });

              emailResults.push({
                type: "unblock",
                success: true,
              });

              logger.info("Письмо о разблокировке отправлено", {
                email: supportRequest.email,
                login: supportRequest.login,
              });
            } catch (emailError) {
              logger.error("Ошибка отправки письма о разблокировке", {
                email: supportRequest.email,
                login: supportRequest.login,
              });
              emailResults.push({
                type: "unblock",
                success: false,
                error: emailError.message,
              });
            }
          } else if (action === "reject") {
            try {
              await emailService.sendSupportRequestProcessed({
                login: supportRequest.login,
                email: supportRequest.email,
                requestId: supportRequest.public_id || supportRequest.id,
                requestType: supportRequest.type,
                action: action,
                reason: reason,
                adminName: req.admin.username,
              });

              emailResults.push({
                type: "unblock_rejected",
                success: true,
              });

              logger.info("Письмо об отказе в разблокировке отправлено", {
                email: supportRequest.email,
                login: supportRequest.login,
              });
            } catch (emailError) {
              logger.error("Ошибка отправки письма об отказе", {
                email: supportRequest.email,
                login: supportRequest.login,
              });
              emailResults.push({
                type: "unblock_rejected",
                success: false,
                error: emailError.message,
              });
            }
          }
          break;

        case "account_deletion":
          if (action === "approve") {
            const FileDeletionService = require("../../services/FileDeletionService");
            const deletionDate = new Date(Date.now() + 24 * 60 * 60 * 1000);

            try {
              await emailService.sendSupportAccountDeletionWarning({
                login: supportRequest.login,
                email: supportRequest.email,
                requestId: supportRequest.public_id || supportRequest.id,
                adminName: req.admin.username,
                reason: reason,
                deletionDate: deletionDate,
              });

              emailResults.push({
                type: "deletion_warning",
                success: true,
                deletionDate: deletionDate,
              });

              logger.info("Предупреждение об удалении аккаунта отправлено", {
                email: supportRequest.email,
                login: supportRequest.login,
              });
            } catch (emailError) {
              logger.error("Ошибка отправки предупреждения об удалении", {
                email: supportRequest.email,
                login: supportRequest.login,
              });
              emailResults.push({
                type: "deletion_warning",
                success: false,
                error: emailError.message,
              });
            }

            try {
              const deletionResult =
                await FileDeletionService.scheduleUserFilesDeletion(
                  supportRequest.login,
                  24
                );

              await connection.execute(
                "DELETE FROM sessionsdata WHERE login = ?",
                [supportRequest.login]
              );

              await connection.execute(
                "DELETE FROM usersdata WHERE login = ?",
                [supportRequest.login]
              );

              actionResult = {
                accountMarkedForDeletion: true,
                login: supportRequest.login,
                scheduledDeletion: deletionDate,
                filesInQueue: deletionResult.count,
                immediateCleanup: {
                  sessionsCleared: true,
                  userDataRemoved: true,
                },
                note: `Аккаунт помечен на удаление. Файлы (${deletionResult.count}) будут удалены через 24 часа.`,
              };

              logger.info("Аккаунт помечен на удаление", {
                login: supportRequest.login,
                files_count: deletionResult.count,
              });
            } catch (deletionError) {
              logger.error("Ошибка планирования удаления файлов", {
                login: supportRequest.login,
              });

              await connection.execute(
                `DROP TABLE IF EXISTS \`${supportRequest.login}\``
              );

              await connection.execute(
                "DELETE FROM sessionsdata WHERE login = ?",
                [supportRequest.login]
              );

              await connection.execute(
                "DELETE FROM usersdata WHERE login = ?",
                [supportRequest.login]
              );

              actionResult = {
                accountDeleted: true,
                login: supportRequest.login,
                tablesRemoved: true,
                sessionsCleared: true,
                fallbackMode: true,
                error: deletionError.message,
              };

              logger.warn("Аккаунт удален в режиме fallback", {
                login: supportRequest.login,
              });
            }
          } else if (action === "reject") {
            try {
              await emailService.sendSupportRequestProcessed({
                login: supportRequest.login,
                email: supportRequest.email,
                requestId: supportRequest.public_id || supportRequest.id,
                requestType: supportRequest.type,
                action: action,
                reason: reason,
                adminName: req.admin.username,
              });

              emailResults.push({
                type: "deletion_rejected",
                success: true,
              });

              logger.info("Письмо об отказе в удалении аккаунта отправлено", {
                email: supportRequest.email,
                login: supportRequest.login,
              });
            } catch (emailError) {
              logger.error("Ошибка отправки письма об отказе", {
                email: supportRequest.email,
                login: supportRequest.login,
              });
              emailResults.push({
                type: "deletion_rejected",
                success: false,
                error: emailError.message,
              });
            }
          }
          break;

        case "other":
          if (action === "approve") {
            let realEmail = null;
            try {
              const [userData] = await connection.execute(
                "SELECT email FROM usersdata WHERE login = ?",
                [supportRequest.login]
              );

              if (userData && userData.length > 0 && userData[0].email) {
                realEmail = userData[0].email;
              }
            } catch (dbError) {
              logger.error("Ошибка получения данных пользователя", {
                login: supportRequest.login,
              });
            }

            if (emailResponse) {
              if (realEmail) {
                try {
                  await emailService.sendSupportAdminResponse({
                    login: supportRequest.login,
                    email: realEmail,
                    requestId: supportRequest.public_id || supportRequest.id,
                    adminName: req.admin.username,
                    adminResponse: emailResponse,
                    reason: reason,
                    note: "Ответ отправлен на email, указанный в профиле пользователя",
                  });

                  emailResults.push({
                    type: "other_response",
                    success: true,
                    responseLength: emailResponse.length,
                    emailUsed: realEmail,
                    source: "database",
                  });

                  actionResult = {
                    emailResponseSent: true,
                    responseLength: emailResponse.length,
                    emailUsed: realEmail,
                    emailSource: "database",
                    note: `Ответ отправлен на email пользователя: ${realEmail}`,
                  };

                  logger.info("Ответ для типа 'other' отправлен", {
                    login: supportRequest.login,
                    email: realEmail,
                    response_length: emailResponse.length,
                  });
                } catch (emailError) {
                  logger.error("Ошибка отправки ответа", {
                    login: supportRequest.login,
                    email: realEmail,
                  });
                  emailResults.push({
                    type: "other_response",
                    success: false,
                    error: emailError.message,
                    emailAttempted: realEmail,
                  });
                  actionResult = {
                    emailResponseFailed: true,
                    error: emailError.message,
                    note: "Не удалось отправить ответ на email пользователя",
                  };
                }
              } else {
                actionResult = {
                  emailResponseSkipped: true,
                  reason:
                    "Пользователь не найден или у пользователя нет email в системе",
                  note: "Заявка обработана, но письмо не отправлено (не удалось получить email пользователя)",
                };

                emailResults.push({
                  type: "other_response",
                  success: false,
                  skipped: true,
                  reason: "no_valid_email_found",
                  note: "Пользователь не найден или нет email в системе",
                });

                logger.warn("Не удалось отправить ответ для типа 'other'", {
                  login: supportRequest.login,
                });
              }
            } else {
              actionResult = {
                emailResponseSkipped: true,
                reason: "Администратор не предоставил текст ответа",
                note: "Заявка обработана, но письмо не отправлено (нет текста ответа)",
              };
            }
          } else if (action === "reject") {
            let realEmail = null;
            try {
              const [userData] = await connection.execute(
                "SELECT email FROM usersdata WHERE login = ?",
                [supportRequest.login]
              );

              if (userData && userData.length > 0 && userData[0].email) {
                realEmail = userData[0].email;
              }
            } catch (dbError) {
              logger.error("Ошибка получения email при отклонении", {
                login: supportRequest.login,
              });
            }

            if (realEmail) {
              try {
                await emailService.sendSupportRequestProcessed({
                  login: supportRequest.login,
                  email: realEmail,
                  requestId: supportRequest.public_id || supportRequest.id,
                  requestType: supportRequest.type,
                  action: action,
                  reason: reason,
                  adminName: req.admin.username,
                });

                emailResults.push({
                  type: "other_rejected",
                  success: true,
                  emailUsed: realEmail,
                  source: "database",
                });

                logger.info("Письмо об отказе для типа 'other' отправлено", {
                  login: supportRequest.login,
                  email: realEmail,
                });
              } catch (emailError) {
                logger.error("Ошибка отправки письма об отказе", {
                  login: supportRequest.login,
                  email: realEmail,
                });
                emailResults.push({
                  type: "other_rejected",
                  success: false,
                  error: emailError.message,
                  emailAttempted: realEmail,
                });
              }
            } else {
              emailResults.push({
                type: "other_rejected",
                success: false,
                skipped: true,
                reason: "no_valid_email_found",
                note: "Пользователь не найден или нет email в системе",
              });

              logger.warn("Не удалось отправить письмо об отказе", {
                login: supportRequest.login,
              });
            }
          }
          break;
      }

      if (emailResults.length > 0) {
        try {
          await connection.execute(
            `INSERT INTO admin_logs (admin_id, action, target_type, target_id, details) 
           VALUES (?, ?, ?, ?, ?)`,
            [
              req.admin.id,
              "email_sent",
              "support",
              supportRequest.id,
              JSON.stringify({
                requestId: supportRequest.public_id || supportRequest.id,
                requestType: supportRequest.type,
                emailResults: emailResults,
                timestamp: new Date().toISOString(),
              }),
            ]
          );
        } catch (logError) {
          logger.warn("Не удалось залогировать email", {
            requestId: supportRequest.id,
          });
        }
      }

      await connection.commit();

      const responseTime = Date.now() - startTime;
      const successfulEmails = emailResults.filter((e) => e.success).length;

      logger.info("Обработка запроса завершена", {
        requestId: supportRequest.id,
        type: supportRequest.type,
        action: action,
        response_time_ms: responseTime,
        emails_sent: successfulEmails,
        emails_total: emailResults.length,
        adminId: req.admin.id,
      });

      const response = {
        success: true,
        message:
          action === "approve" ? `Запрос успешно обработан` : `Запрос отклонен`,
        data: {
          requestId: supportRequest.public_id || supportRequest.id,
          type: supportRequest.type,
          action: action,
          status: newStatus,
          processedAt: new Date().toISOString(),
          processedBy: req.admin.username,
          result: actionResult,
          reason: reason || null,
          emailsSent: successfulEmails,
          emailsTotal: emailResults.length,
          emailResults: emailResults,
        },
      };

      res.json(response);
    } catch (error) {
      await connection.rollback();

      logger.error("Критическая ошибка обработки запроса поддержки", {
        error_message: error.message,
        requestId: req.params.id,
        adminId: req.admin?.id,
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
}

module.exports = AdminSupportController;
