const { query } = require("../../services/databaseService");
const SupportController = require("../../support/controllers/SupportController");
const bcrypt = require("bcryptjs");
const emailService = require("../../utils/emailService");
const logger = require("../../services/LoggerService");

class AdminSupportController {
  // 1. ПОЛУЧИТЬ ВСЕ АКТИВНЫЕ ЗАПРОСЫ ПОЛЬЗОВАТЕЛЯ
  static async getUserRequests(req, res) {
    logger.info("Запрос всех активных запросов пользователя", {
      adminId: req.admin.id,
      login: req.params.login,
      query: req.query,
      endpoint: req.path,
      method: req.method,
    });

    try {
      const { login } = req.params;
      const { type, status, limit = 50 } = req.query;

      if (!login || login.trim() === "") {
        logger.warn("Не указан логин пользователя", {
          adminId: req.admin.id,
          endpoint: req.path,
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
        whereConditions,
        limit,
      });

      const requests = await query(sql);

      logger.info("Найдено запросов пользователя", {
        login,
        count: requests.length,
        hasOverdue: requests.some((r) => r.is_overdue === 1),
        request_types: [...new Set(requests.map((r) => r.type))],
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

      logger.debug("Статистика запросов пользователя", {
        login,
        total: stats.total,
        byType: stats.byType,
        byStatus: stats.byStatus,
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
        stack_trace: error.stack?.substring(0, 500),
        login: req.params.login,
        adminId: req.admin.id,
        endpoint: req.path,
      });

      let errorMessage = "Ошибка получения запросов пользователя";

      res.status(500).json({
        success: false,
        message: errorMessage,
        ...(process.env.NODE_ENV === "development" && {
          debug: {
            error: error.message,
            sql: error.sql || "Неизвестно",
          },
        }),
      });
    }
  }

  // 2. АВТОМАТИЧЕСКАЯ ПРОВЕРКА ЗАПРОСА
  static async validateRequest(req, res) {
    const startTime = Date.now();

    logger.info("Начало автоматической проверки запроса", {
      adminId: req.admin.id,
      adminName: req.admin.username,
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

      logger.debug("Запрос найден для валидации", {
        requestId: request.id,
        type: request.type,
        login: request.login,
        status: request.status,
        email: request.email,
      });

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
        logger.info("Обработка запроса типа 'other'", {
          requestId: request.id,
          login: request.login,
        });

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
          checkedFields,
          userExists: validationDetails.userExists,
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

      logger.debug("Пользователь найден для проверки", {
        login: user.login,
        hasEmail: !!user.email,
        hasSecretWord: !!user.secret_word,
        hasPassword: !!user.password,
      });

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
          error_message: decryptError.message,
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
            error_message: decryptError.message,
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
            logger.debug("Секретное слово совпадает", {
              requestId: request.id,
            });
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
            error_message: bcryptError.message,
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
            logger.debug("Пароль совпадает", { requestId: request.id });
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
            error_message: bcryptError.message,
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
          logger.debug("Статус запроса обновлен на 'in_progress'", {
            requestId: request.id,
          });
        } catch (updateError) {
          logger.warn("Не удалось обновить статус запроса", {
            error_message: updateError.message,
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
        stack_trace: error.stack?.substring(0, 500),
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

      logger.debug("Заявка поддержки найдена", {
        requestId: request.id,
        type: request.type,
        status: request.status,
        login: request.login,
        isOverdue: request.is_overdue === 1,
      });

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

      logger.debug("Логи заявки загружены", {
        requestId: request.id,
        logs_count: logs.length,
      });

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
        logger.debug("Добавление дополнительной информации для типа 'other'", {
          requestId: request.id,
        });

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
      });

      res.json({
        success: true,
        data: responseData,
      });
    } catch (error) {
      logger.error("Ошибка получения информации о заявке", {
        error_message: error.message,
        stack_trace: error.stack?.substring(0, 500),
        requestId: req.params.id,
        adminId: req.admin?.id,
        endpoint: req.path,
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
      adminName: req.admin.username,
      requestId: req.params.id,
      action: req.body.action,
      endpoint: req.path,
      method: req.method,
    });

    const connection = await getConnection();
    try {
      const { id } = req.params;
      const { action, reason, emailResponse } = req.body;

      if (!action || !["approve", "reject"].includes(action)) {
        logger.warn("Неверное действие при обработке запроса", {
          action,
          allowed: ["approve", "reject"],
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

      logger.debug("Запрос поддержки найден для обработки", {
        requestId: supportRequest.id,
        type: supportRequest.type,
        login: supportRequest.login,
        email: supportRequest.email,
        status: supportRequest.status,
        action: action,
      });

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

      // ИСПРАВЛЕНО: action_type → action
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

      logger.debug("Действие залогировано в admin_logs", {
        adminId: req.admin.id,
        action: action,
        requestId: supportRequest.id,
      });

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
              passwordGenerated: !!newPassword,
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
                error_message: emailError.message,
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
                error_message: emailError.message,
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
                error_message: emailError.message,
                login: supportRequest.login,
                emails: [supportRequest.email, supportRequest.new_email],
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
                error_message: emailError.message,
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
                error_message: emailError.message,
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
                error_message: emailError.message,
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
                deletionDate: deletionDate.toISOString(),
              });
            } catch (emailError) {
              logger.error("Ошибка отправки предупреждения об удалении", {
                error_message: emailError.message,
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
                deletion_date: deletionDate.toISOString(),
              });
            } catch (deletionError) {
              logger.error("Ошибка планирования удаления файлов", {
                error_message: deletionError.message,
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
                error: deletionError.message,
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
                error_message: emailError.message,
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
                logger.debug("Найден реальный email пользователя", {
                  login: supportRequest.login,
                  realEmail: realEmail,
                  requestEmail: supportRequest.email,
                });
              } else {
                logger.warn("Пользователь не найден или нет email", {
                  login: supportRequest.login,
                  foundInDB: userData ? userData.length : 0,
                });
              }
            } catch (dbError) {
              logger.error("Ошибка получения данных пользователя", {
                error_message: dbError.message,
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
                    error_message: emailError.message,
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
                  reason: "Пользователь не найден или нет email",
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
                error_message: dbError.message,
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
                  error_message: emailError.message,
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
                reason: "Пользователь не найден или нет email",
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
          logger.debug("Логи email отправлены", {
            requestId: supportRequest.id,
            emailResultsCount: emailResults.length,
          });
        } catch (logError) {
          logger.warn("Не удалось залогировать email", {
            error_message: logError.message,
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
        stack_trace: error.stack?.substring(0, 500),
        requestId: req.params.id,
        adminId: req.admin?.id,
        response_time_ms: Date.now() - startTime,
        endpoint: req.path,
      });

      res.status(500).json({
        success: false,
        message: "Ошибка обработки запроса",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    } finally {
      connection.release();
      logger.debug("Соединение с БД освобождено", {
        requestId: req.params.id,
        adminId: req.admin.id,
      });
    }
  }
}

// Экспортируем getConnection
const getConnection = async () => {
  try {
    const {
      getConnection: getDbConnection,
    } = require("../../services/databaseService");
    return await getDbConnection();
  } catch (error) {
    logger.error("Ошибка получения соединения с БД", {
      error_message: error.message,
      stack_trace: error.stack?.substring(0, 500),
    });
    throw error;
  }
};

module.exports = AdminSupportController;
