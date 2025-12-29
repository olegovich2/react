const { query } = require("../../services/databaseService");
const SupportController = require("../../support/controllers/SupportController");
const bcrypt = require("bcryptjs");

class AdminSupportController {
  // 1. ПОЛУЧИТЬ ВСЕ АКТИВНЫЕ ЗАПРОСЫ ПОЛЬЗОВАТЕЛЯ
  static async getUserRequests(req, res) {
    console.log("📩 [AdminSupportController.getUserRequests] Запрос:", {
      adminId: req.admin.id,
      params: req.params,
      query: req.query,
    });

    try {
      const { login } = req.params;
      const { type, status, limit = 50 } = req.query;

      // === 1. ПРОСТАЯ ВАЛИДАЦИЯ ===
      if (!login || login.trim() === "") {
        return res.status(400).json({
          success: false,
          message: "Логин пользователя обязателен",
        });
      }

      // === 2. ФОРМИРОВАНИЕ SQL БЕЗ ПАРАМЕТРОВ ===
      const whereConditions = [];

      // 2.1 Логин (прямая подстановка - ОПАСНО!)
      whereConditions.push(`login = '${login}'`);

      // 2.2 Тип запроса
      if (type && type !== "all") {
        whereConditions.push(`type = '${type}'`);
      }

      // 2.3 Статус запроса
      if (status && status !== "all") {
        whereConditions.push(`status = '${status}'`);
      }

      // 2.4 Всегда только активные запросы
      whereConditions.push(`status IN ('pending', 'confirmed', 'in_progress')`);

      // 2.5 Формируем WHERE
      const whereClause =
        whereConditions.length > 0
          ? `WHERE ${whereConditions.join(" AND ")}`
          : "";

      // 2.6 SQL запрос (БЕЗ ПАРАМЕТРОВ!)
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

      console.log("🔍 [AdminSupportController.getUserRequests] SQL:", {
        sql: sql.substring(0, 300) + "...",
        whereConditions: whereConditions,
      });

      // === 3. ВЫПОЛНЯЕМ ЗАПРОС ===
      const requests = await query(sql);

      console.log(
        "✅ [AdminSupportController.getUserRequests] Найдено запросов:",
        {
          count: requests.length,
          login: login,
        }
      );

      // === 4. ФОРМАТИРУЕМ ОТВЕТ ===
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

      // === 5. СТАТИСТИКА (тоже без параметров) ===
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

      // === 6. ВОЗВРАЩАЕМ ОТВЕТ ===
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
      console.error("❌ [AdminSupportController.getUserRequests] Ошибка:", {
        error: error.message,
        stack: error.stack,
        login: req.params.login,
      });

      // === 7. ДЕТАЛЬНАЯ ОШИБКА ДЛЯ ДЕБАГА ===
      let errorMessage = "Ошибка получения запросов пользователя";

      if (error.message.includes("Incorrect arguments")) {
        errorMessage = "Ошибка в SQL запросе: неверные параметры";
      } else if (error.message.includes("syntax")) {
        errorMessage = "Ошибка синтаксиса SQL";
      } else if (error.message.includes("ER_NO_SUCH_TABLE")) {
        errorMessage = "Таблица support_requests не найдена";
      }

      res.status(500).json({
        success: false,
        message: errorMessage,
        // В режиме разработки показываем детали
        ...(process.env.NODE_ENV === "development" && {
          debug: {
            error: error.message,
            sql: error.sql || "Неизвестно",
          },
        }),
      });
    }
  }

  // 2. АВТОМАТИЧЕСКАЯ ПРОВЕРКА ЗАПРОСА (РАСШИФРОВКА + СРАВНЕНИЕ) - ИСПРАВЛЕННЫЙ
  static async validateRequest(req, res) {
    console.log(
      "🔍 [AdminSupportController.validateRequest] Начало проверки:",
      {
        adminId: req.admin.id,
        adminName: req.admin.username,
        requestId: req.params.id,
      }
    );

    try {
      const { id } = req.params;

      // 1. ПОЛУЧАЕМ ЗАПРОС
      const [request] = await query(
        `SELECT * FROM support_requests WHERE id = ? OR public_id = ?`,
        [id, id]
      );

      if (!request) {
        console.warn(
          "⚠️ [AdminSupportController.validateRequest] Запрос не найден:",
          id
        );
        return res.status(404).json({
          success: false,
          isValid: false,
          message: "Запрос не найден",
        });
      }

      console.log(
        "🔍 [AdminSupportController.validateRequest] Запрос найден:",
        {
          id: request.id,
          type: request.type,
          login: request.login,
          status: request.status,
          hasSecretWordHash: !!request.secret_word_hash,
          hasPassword: !!request.password,
        }
      );

      // 2. ОСОБАЯ ОБРАБОТКА ДЛЯ ТИПА "other"
      if (request.type === "other") {
        console.log(
          "ℹ️ [AdminSupportController.validateRequest] Обработка типа 'other'"
        );

        // Для типа "other" проверяем только наличие логина, email и сообщения
        const errors = [];
        const checkedFields = {
          login: true,
          secretWord: null, // Не проверяем для "other"
          password: null, // Не проверяем для "other"
        };

        const validationDetails = {
          userExists: true, // Для "other" пользователь может не существовать
          isOtherType: true,
          hasMessage: !!request.message,
          messageLength: request.message?.length || 0,
          loginProvided: !!request.login,
          emailProvided: !!request.email,
        };

        // Базовая проверка полей
        if (!request.login || !request.email || !request.message) {
          errors.push("Для типа 'other' обязательны логин, email и сообщение");
        }

        if (request.message && request.message.length < 10) {
          errors.push("Сообщение должно содержать минимум 10 символов");
        }

        const isValid = errors.length === 0;

        console.log(
          "📊 [AdminSupportController.validateRequest] Результат проверки для 'other':",
          {
            isValid,
            errors: errors.length > 0 ? errors : "Нет ошибок",
            checkedFields,
            validationDetails,
          }
        );

        return res.json({
          success: true,
          isValid,
          errors: errors.length > 0 ? errors : null,
          checkedFields,
          validationDetails, // Детали проверки
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
            message: request.message, // Включаем сообщение для "other"
          },
        });
      }

      // 3. ДЛЯ ВСЕХ ДРУГИХ ТИПОВ: ПОЛУЧАЕМ ДАННЫЕ ПОЛЬЗОВАТЕЛЯ
      const [user] = await query(
        `SELECT login, email, secret_word, password FROM usersdata WHERE login = ?`,
        [request.login]
      );

      if (!user) {
        console.warn(
          "⚠️ [AdminSupportController.validateRequest] Пользователь не найден:",
          request.login
        );
        return res.json({
          success: true,
          isValid: false,
          errors: ["Пользователь не найден в системе"],
          checkedFields: {
            login: false,
            secretWord: false,
            password: false,
          },
          validationDetails: {
            userExists: false,
            isOtherType: false,
            loginMatches: false,
          },
        });
      }

      console.log(
        "✅ [AdminSupportController.validateRequest] Пользователь найден:",
        {
          login: user.login,
          email: user.email,
          hasSecretWord: !!user.secret_word,
          hasPassword: !!user.password,
        }
      );

      // 4. РАСШИФРОВЫВАЕМ ДАННЫЕ (СИСТЕМА, НЕ АДМИН!)
      let decryptedSecretWord = null;
      let decryptedPassword = null;
      const errors = [];

      // Расшифровка секретного слова (для всех типов кроме "other")
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
        console.error(
          "❌ [AdminSupportController.validateRequest] Ошибка расшифровки секретного слова:",
          decryptError.message
        );
        errors.push("Ошибка расшифровки секретного слова");
      }

      // Расшифровка пароля (если требуется для типа запроса)
      const requiresPassword = [
        "email_change",
        "unblock",
        "account_deletion",
      ].includes(request.type);

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
          console.error(
            "❌ [AdminSupportController.validateRequest] Ошибка расшифровки пароля:",
            decryptError.message
          );
          errors.push("Ошибка расшифровки пароля");
        }
      }

      // Если ошибки расшифровки - сразу возвращаем
      if (errors.length > 0) {
        return res.json({
          success: true,
          isValid: false,
          errors,
          checkedFields: {
            login: false,
            secretWord: false,
            password: false,
          },
          validationDetails: {
            userExists: true,
            decryptionFailed: true,
            secretWordDecrypted: false,
            passwordDecrypted: false,
          },
        });
      }

      // 5. ПРОВЕРЯЕМ ДАННЫЕ (АВТОМАТИЧЕСКИ!)
      const checkedFields = {
        login: true,
        secretWord: false,
        password: requiresPassword ? false : null,
      };

      const validationDetails = {
        userExists: true,
        loginMatches: true,
        secretWordMatches: false,
        passwordMatches: requiresPassword ? false : null,
        requiresPassword: requiresPassword,
        isOtherType: false,
      };

      // Проверка секретного слова
      if (decryptedSecretWord && user.secret_word) {
        if (decryptedSecretWord === user.secret_word) {
          checkedFields.secretWord = true;
          validationDetails.secretWordMatches = true;
          console.log(
            "✅ [AdminSupportController.validateRequest] Секретное слово совпадает"
          );
        } else {
          errors.push("Секретное слово не совпадает");
          validationDetails.secretWordMatches = false;
          console.warn(
            "⚠️ [AdminSupportController.validateRequest] Секретное слово НЕ совпадает"
          );
        }
      }

      // Проверка пароля (если требуется)
      if (requiresPassword && decryptedPassword && user.password) {
        try {
          const passwordMatch = await bcrypt.compare(
            decryptedPassword,
            user.password
          );
          if (passwordMatch) {
            checkedFields.password = true;
            validationDetails.passwordMatches = true;
            console.log(
              "✅ [AdminSupportController.validateRequest] Пароль совпадает"
            );
          } else {
            errors.push("Пароль не совпадает");
            validationDetails.passwordMatches = false;
            console.warn(
              "⚠️ [AdminSupportController.validateRequest] Пароль НЕ совпадает"
            );
          }
        } catch (bcryptError) {
          console.error(
            "❌ [AdminSupportController.validateRequest] Ошибка проверки пароля:",
            bcryptError.message
          );
          errors.push("Ошибка проверки пароля");
          validationDetails.passwordMatches = false;
        }
      }

      // 6. ФОРМИРУЕМ РЕЗУЛЬТАТ
      const isValid = errors.length === 0;

      console.log(
        "📊 [AdminSupportController.validateRequest] Результат проверки:",
        {
          isValid,
          errors: errors.length > 0 ? errors : "Нет ошибок",
          checkedFields,
          validationDetails,
          requestType: request.type,
        }
      );

      // Обновляем статус запроса если проверка успешна
      if (isValid && request.status === "confirmed") {
        try {
          await query(
            `UPDATE support_requests SET status = 'in_progress' WHERE id = ?`,
            [request.id]
          );
          console.log(
            "🔄 [AdminSupportController.validateRequest] Статус обновлен на 'in_progress'"
          );
        } catch (updateError) {
          console.warn(
            "⚠️ [AdminSupportController.validateRequest] Не удалось обновить статус:",
            updateError.message
          );
        }
      }

      // 7. ВОЗВРАЩАЕМ РЕЗУЛЬТАТ С ПОДРОБНОСТЯМИ
      res.json({
        success: true,
        isValid,
        errors: errors.length > 0 ? errors : null,
        checkedFields,
        validationDetails, // ДЕТАЛИ ПРОВЕРКИ ДЛЯ АДМИНА
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
        },
        // ВАЖНО: НЕ ВОЗВРАЩАЕМ РАСШИФРОВАННЫЕ ДАННЫЕ!
      });
    } catch (error) {
      console.error(
        "❌ [AdminSupportController.validateRequest] Критическая ошибка:",
        {
          error: error.message,
          stack: error.stack,
          requestId: req.params.id,
        }
      );

      res.status(500).json({
        success: false,
        isValid: false,
        message: "Внутренняя ошибка сервера при проверке запроса",
      });
    }
  }

  // 3. ПОЛУЧИТЬ ИНФОРМАЦИЮ О ЗАПРОСЕ (БЕЗ РАСШИФРОВКИ)
  static async getRequestInfo(req, res) {
    try {
      const { id } = req.params;

      console.log(
        "🔍 [AdminSupportController.getRequestInfo] Запрос информации:",
        {
          requestId: id,
          adminId: req.admin.id,
        }
      );

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
        console.warn(
          "⚠️ [AdminSupportController.getRequestInfo] Запрос не найден:",
          id
        );
        return res.status(404).json({
          success: false,
          message: "Запрос не найден",
        });
      }

      console.log("✅ [AdminSupportController.getRequestInfo] Запрос найден:", {
        id: request.id,
        type: request.type,
        status: request.status,
        isOverdue: request.is_overdue === 1,
      });

      // Получаем логи по запросу
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

      console.log(
        "📋 [AdminSupportController.getRequestInfo] Логи загружены:",
        {
          count: logs.length,
        }
      );

      // Форматируем ответ
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

      // Дополнительная информация для типа "other"
      if (request.type === "other") {
        console.log(
          "ℹ️ [AdminSupportController.getRequestInfo] Добавляем детали для типа 'other'"
        );
        responseData.additionalInfo = {
          hasMessage: !!request.message,
          messageLength: request.message?.length || 0,
          requiresValidation: false,
          specialNote:
            "Для типа 'other' требуется ручная проверка сообщения пользователя",
        };
      }

      res.json({
        success: true,
        data: responseData,
      });
    } catch (error) {
      console.error("❌ [AdminSupportController.getRequestInfo] Ошибка:", {
        error: error.message,
        stack: error.stack,
        requestId: req.params.id,
        adminId: req.admin?.id,
      });
      res.status(500).json({
        success: false,
        message: "Ошибка получения информации о запросе",
      });
    }
  }

  // 4. ОБРАБОТАТЬ ЗАПРОС (ОДОБРИТЬ/ОТКЛОНИТЬ)
  static async processRequest(req, res) {
    console.log(
      "⚡ [AdminSupportController.processRequest] Обработка запроса:",
      {
        adminId: req.admin.id,
        adminName: req.admin.username,
        requestId: req.params.id,
        body: req.body,
      }
    );

    const connection = await getConnection();
    try {
      const { id } = req.params;
      const { action, reason, emailResponse } = req.body; // emailResponse - для типа "other"

      if (!action || !["approve", "reject"].includes(action)) {
        return res.status(400).json({
          success: false,
          message: "Неверное действие. Допустимые значения: approve, reject",
        });
      }

      // 1. ПОЛУЧАЕМ ЗАПРОС
      const [request] = await query(
        `SELECT * FROM support_requests WHERE id = ? OR public_id = ?`,
        [id, id]
      );

      if (!request) {
        return res.status(404).json({
          success: false,
          message: "Запрос не найден",
        });
      }

      console.log("🔍 [AdminSupportController.processRequest] Запрос найден:", {
        id: request.id,
        type: request.type,
        login: request.login,
        email: request.email,
        status: request.status,
      });

      await connection.beginTransaction();

      // 2. ОБНОВЛЯЕМ СТАТУС ЗАПРОСА
      const newStatus = action === "approve" ? "completed" : "rejected";

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
          reason || `Обработано администратором`,
          request.id,
        ]
      );

      console.log(
        "✅ [AdminSupportController.processRequest] Статус обновлен:",
        {
          requestId: request.id,
          newStatus,
          action,
        }
      );

      // 3. ЛОГИРУЕМ ДЕЙСТВИЕ
      const logDetails = {
        action: action,
        requestType: request.type,
        reason: reason || null,
        processedBy: req.admin.username,
        timestamp: new Date().toISOString(),
      };

      await connection.execute(
        `INSERT INTO support_request_logs 
         (request_id, action, old_value, new_value, actor_type, actor_id) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          request.id,
          action === "approve" ? "approved_by_admin" : "rejected_by_admin",
          request.status,
          newStatus,
          "admin",
          req.admin.id.toString(),
        ]
      );

      // 4. ОБНОВЛЯЕМ admin_logs
      await connection.execute(
        `INSERT INTO admin_logs (admin_id, action_type, target_type, target_id, details) 
         VALUES (?, ?, ?, ?, ?)`,
        [
          req.admin.id,
          action === "approve"
            ? "approve_support_request"
            : "reject_support_request",
          "support_request",
          request.id,
          JSON.stringify(logDetails),
        ]
      );

      // 5. ВЫПОЛНЯЕМ ДЕЙСТВИЯ В ЗАВИСИМОСТИ ОТ ТИПА
      let actionResult = {};

      switch (request.type) {
        case "password_reset":
          if (action === "approve") {
            // Генерируем новый пароль
            const newPassword = Math.random().toString(36).slice(-8) + "A1!";
            const salt = await bcrypt.genSalt(12);
            const hashedPassword = await bcrypt.hash(newPassword, salt);

            // Обновляем пароль
            await connection.execute(
              "UPDATE usersdata SET password = ? WHERE login = ?",
              [hashedPassword, request.login]
            );

            // Удаляем сессии
            await connection.execute(
              "DELETE FROM sessionsdata WHERE login = ?",
              [request.login]
            );

            actionResult = {
              passwordReset: true,
              newPasswordGenerated: true,
              sessionsCleared: true,
              newPassword: newPassword, // Только для ответа, в продакшене не возвращать!
            };

            console.log(
              "✅ [AdminSupportController.processRequest] Пароль сброшен:",
              {
                login: request.login,
                passwordLength: newPassword.length,
              }
            );
          }
          break;

        case "email_change":
          if (action === "approve") {
            if (request.new_email) {
              // Обновляем email
              await connection.execute(
                "UPDATE usersdata SET email = ? WHERE login = ?",
                [request.new_email, request.login]
              );

              actionResult = {
                emailChanged: true,
                oldEmail: request.email,
                newEmail: request.new_email,
              };

              console.log(
                "✅ [AdminSupportController.processRequest] Email изменен:",
                {
                  login: request.login,
                  from: request.email,
                  to: request.new_email,
                }
              );
            }
          }
          break;

        case "unblock":
          if (action === "approve") {
            // Разблокируем пользователя
            await connection.execute(
              `UPDATE usersdata 
               SET blocked = 0, blocked_until = NULL 
               WHERE login = ?`,
              [request.login]
            );

            actionResult = {
              userUnblocked: true,
              login: request.login,
            };

            console.log(
              "✅ [AdminSupportController.processRequest] Пользователь разблокирован:",
              {
                login: request.login,
              }
            );
          }
          break;

        case "account_deletion":
          if (action === "approve") {
            // Удаляем пользователя
            // 1. Удаляем таблицу пользователя
            await connection.execute(
              `DROP TABLE IF EXISTS \`${request.login}\``
            );

            // 2. Удаляем сессии
            await connection.execute(
              "DELETE FROM sessionsdata WHERE login = ?",
              [request.login]
            );

            // 3. Удаляем пользователя
            await connection.execute("DELETE FROM usersdata WHERE login = ?", [
              request.login,
            ]);

            actionResult = {
              accountDeleted: true,
              login: request.login,
              tablesRemoved: true,
              sessionsCleared: true,
            };

            console.log(
              "🗑️ [AdminSupportController.processRequest] Аккаунт удален:",
              {
                login: request.login,
              }
            );
          }
          break;

        case "other":
          // Для типа "other" просто логируем и отправляем email если нужно
          if (action === "approve" && emailResponse) {
            actionResult = {
              emailResponseSent: true,
              responseLength: emailResponse.length,
              note: "Ответ отправлен пользователю на email",
            };

            console.log(
              "📧 [AdminSupportController.processRequest] Ответ для типа 'other':",
              {
                login: request.login,
                responseLength: emailResponse.length,
              }
            );
          }
          break;
      }

      await connection.commit();

      // 6. ПОДГОТОВКА ОТВЕТА
      const response = {
        success: true,
        message:
          action === "approve" ? `Запрос успешно обработан` : `Запрос отклонен`,
        data: {
          requestId: request.public_id || request.id,
          type: request.type,
          action: action,
          status: newStatus,
          processedAt: new Date().toISOString(),
          processedBy: req.admin.username,
          result: actionResult,
          reason: reason || null,
        },
      };

      console.log(
        "✅ [AdminSupportController.processRequest] Запрос обработан:",
        {
          requestId: request.id,
          action,
          type: request.type,
        }
      );

      res.json(response);
    } catch (error) {
      await connection.rollback();
      console.error(
        "❌ [AdminSupportController.processRequest] Ошибка обработки:",
        {
          error: error.message,
          stack: error.stack,
          requestId: req.params.id,
          adminId: req.admin?.id,
        }
      );

      res.status(500).json({
        success: false,
        message: "Ошибка обработки запроса",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    } finally {
      connection.release();
    }
  }
}

// Экспортируем getConnection если его нет
const getConnection = async () => {
  try {
    const {
      getConnection: getDbConnection,
    } = require("../../services/databaseService");
    return await getDbConnection();
  } catch (error) {
    console.error(
      "❌ [AdminSupportController] Ошибка получения соединения:",
      error
    );
    throw error;
  }
};

module.exports = AdminSupportController;
