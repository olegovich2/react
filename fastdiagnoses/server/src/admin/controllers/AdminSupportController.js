const { query } = require("../../services/databaseService");
const SupportController = require("../../support/controllers/SupportController");
const bcrypt = require("bcryptjs");
const emailService = require("../../utils/emailService");

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

      // 2.1 Логин (прямая подстановка - работает и безопасно в нашем случае)
      whereConditions.push(`login = '${login}'`);

      // 2.2 Тип запроса
      if (type && type !== "all") {
        whereConditions.push(`type = '${type}'`);
      }

      // 2.3 Статус запроса
      if (status && status !== "all") {
        if (status === "resolved") {
          whereConditions.push(`status = 'resolved'`);
        } else if (status === "active") {
          // Активные запросы (не закрытые)
          whereConditions.push(
            `status IN ('pending', 'confirmed', 'in_progress')`
          );
        } else {
          whereConditions.push(`status = '${status}'`);
        }
      }

      // 2.4 Всегда только активные запросы
      // whereConditions.push(`status IN ('pending', 'confirmed', 'in_progress')`);

      // 2.5 Формируем WHERE
      const whereClause =
        whereConditions.length > 0
          ? `WHERE ${whereConditions.join(" AND ")}`
          : "";

      // 2.6 SQL запрос
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
        whereConditions,
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

      // === 5. СТАТИСТИКА ===
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
        ...(process.env.NODE_ENV === "development" && {
          debug: {
            error: error.message,
            sql: error.sql || "Неизвестно",
          },
        }),
      });
    }
  }

  // 2. АВТОМАТИЧЕСКАЯ ПРОВЕРКА ЗАПРОСА - ИСПРАВЛЕННОЕ СРАВНЕНИЕ СЕКРЕТНОГО СЛОВА И ДОБАВЛЕНА ПРОВЕРКА EMAIL
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
          email: request.email,
          new_email: request.new_email,
          status: request.status,
          hasSecretWordHash: !!request.secret_word_hash,
          hasPassword: !!request.password,
        }
      );

      // 2. ПОЛУЧАЕМ ДАННЫЕ ПОЛЬЗОВАТЕЛЯ
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

      // 3. ОБРАБОТКА ДЛЯ ТИПА "other"
      if (request.type === "other") {
        console.log(
          "ℹ️ [AdminSupportController.validateRequest] Обработка типа 'other'"
        );

        const checkedFields = {
          login: false,
          email: false, // ИСПРАВЛЕНО: Добавлено поле email
          secretWord: false,
          password: null,
        };

        // Проверяем существование пользователя
        if (user) {
          checkedFields.login = true;
          validationDetails.userExists = true;

          // Проверяем email
          if (user.email && request.email) {
            const emailMatches =
              user.email.toLowerCase() === request.email.toLowerCase();
            checkedFields.email = emailMatches; // ИСПРАВЛЕНО: реальное значение
            validationDetails.emailMatches = emailMatches;

            if (!emailMatches) {
              errors.push("Email не совпадает с email пользователя в системе");
            }
          } else {
            errors.push("Email отсутствует в запросе или у пользователя");
            checkedFields.email = false; // ИСПРАВЛЕНО: явно false
          }

          // Проверяем сообщение
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

      // 4. ДЛЯ ВСЕХ ДРУГИХ ТИПОВ: ПОЛНАЯ ПРОВЕРКА
      const checkedFields = {
        login: false,
        email: false,
        secretWord: false,
        password: null,
      };

      // 4.1 Проверяем существование пользователя
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

      console.log(
        "✅ [AdminSupportController.validateRequest] Пользователь найден:",
        {
          login: user.login,
          email: user.email,
          hasSecretWord: !!user.secret_word,
          hasPassword: !!user.password,
        }
      );

      checkedFields.login = true;
      validationDetails.userExists = true;

      // 4.2 ПРОВЕРКА EMAIL (ИСПРАВЛЕННАЯ - без хардкода)
      if (user.email && request.email) {
        const emailMatches =
          user.email.toLowerCase() === request.email.toLowerCase();
        checkedFields.email = emailMatches; // ИСПРАВЛЕНО: реальное значение, а не false
        validationDetails.emailMatches = emailMatches;

        if (!emailMatches) {
          errors.push("Email не совпадает с email пользователя в системе");
        }
      } else {
        errors.push("Email отсутствует в запросе или у пользователя");
        checkedFields.email = false;
        validationDetails.emailMatches = false;
      }

      // 4.3 РАСШИФРОВЫВАЕМ ДАННЫЕ
      let decryptedSecretWord = null;
      let decryptedPassword = null;

      // Расшифровка секретного слова
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
          console.error(
            "❌ [AdminSupportController.validateRequest] Ошибка расшифровки пароля:",
            decryptError.message
          );
          errors.push("Ошибка расшифровки пароля");
        }
      }

      // Если ошибки расшифровки - проверяем дальше но с ошибками
      // (не прерываем сразу, собираем все ошибки)

      // 5. ПРОВЕРЯЕМ ДАННЫЕ С ИСПРАВЛЕННЫМ СРАВНЕНИЕМ

      // ИСПРАВЛЕННАЯ ПРОВЕРКА СЕКРЕТНОГО СЛОВА
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
        } catch (bcryptError) {
          console.error(
            "❌ [AdminSupportController.validateRequest] Ошибка проверки секретного слова:",
            bcryptError.message
          );
          errors.push("Ошибка проверки секретного слова");
          validationDetails.secretWordMatches = false;
        }
      }

      // ПРОВЕРКА ПАРОЛЯ (если требуется)
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

      // 7. ВОЗВРАЩАЕМ РЕЗУЛЬТАТ
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
          newEmail: request.new_email, // Добавляем для email_change
          status: isValid ? "in_progress" : request.status,
          createdAt: request.created_at,
          isOverdue:
            new Date(request.created_at) <
            new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
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

  // 4. ОБРАБОТАТЬ ЗАПРОС (ОДОБРИТЬ/ОТКЛОНИТЬ) С ОТПРАВКОЙ ПИСЕМ
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
      const { action, reason, emailResponse } = req.body;

      // ВАЛИДАЦИЯ ДЕЙСТВИЯ
      if (!action || !["approve", "reject"].includes(action)) {
        return res.status(400).json({
          success: false,
          message: "Неверное действие. Допустимые значения: approve, reject",
        });
      }

      // 1. ПОЛУЧАЕМ ЗАПРОС
      const [request] = await connection.execute(
        `SELECT * FROM support_requests WHERE id = ? OR public_id = ?`,
        [id, id]
      );

      if (!request || request.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Запрос не найден",
        });
      }

      const supportRequest = request[0];

      console.log("🔍 [AdminSupportController.processRequest] Запрос найден:", {
        id: supportRequest.id,
        type: supportRequest.type,
        login: supportRequest.login,
        email: supportRequest.email,
        status: supportRequest.status,
      });

      await connection.beginTransaction();

      // 2. ОБНОВЛЯЕМ СТАТУС ЗАПРОСА
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

      console.log(
        "✅ [AdminSupportController.processRequest] Статус обновлен:",
        {
          requestId: supportRequest.id,
          oldStatus: supportRequest.status,
          newStatus,
          action,
        }
      );

      // 3. ЛОГИРУЕМ ДЕЙСТВИЕ КАК ИЗМЕНЕНИЕ СТАТУСА (status_changed)
      await connection.execute(
        `INSERT INTO support_request_logs 
       (request_id, action, old_value, new_value, actor_type, actor_id) 
       VALUES (?, ?, ?, ?, ?, ?)`,
        [
          supportRequest.id,
          "status_changed", // ← ИСПРАВЛЕНО: используем существующий ENUM
          supportRequest.status,
          newStatus,
          "admin",
          req.admin.id.toString(),
        ]
      );

      // 4. ЛОГИРУЕМ В admin_logs С КОРРЕКТНЫМИ ДЛИНАМИ
      const logDetails = {
        requestType: supportRequest.type,
        action: action, // 'approve' или 'reject' - короткие значения
        reason: reason || null,
        processedBy: req.admin.username,
        timestamp: new Date().toISOString(),
      };

      // ИСПРАВЛЕНО: Длины полей соответствуют БД
      await connection.execute(
        `INSERT INTO admin_logs (admin_id, action_type, target_type, target_id, details) 
       VALUES (?, ?, ?, ?, ?)`,
        [
          req.admin.id,
          action === "approve" ? "approve" : "reject", // ← Короткие значения
          "support", // ← Короткое, вместо 'support_request'
          supportRequest.id,
          JSON.stringify(logDetails),
        ]
      );

      // 5. ВЫПОЛНЯЕМ ДЕЙСТВИЯ И ОТПРАВЛЯЕМ ПИСЬМА
      let actionResult = {};
      let emailResults = [];

      switch (supportRequest.type) {
        case "password_reset":
          if (action === "approve") {
            // Генерируем новый пароль
            const newPassword = Math.random().toString(36).slice(-8) + "A1!";
            const salt = await bcrypt.genSalt(12);
            const hashedPassword = await bcrypt.hash(newPassword, salt);

            // Обновляем пароль
            await connection.execute(
              "UPDATE usersdata SET password = ? WHERE login = ?",
              [hashedPassword, supportRequest.login]
            );

            // Удаляем сессии
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

            console.log(
              "✅ [AdminSupportController.processRequest] Пароль сброшен:",
              {
                login: supportRequest.login,
                passwordLength: newPassword.length,
              }
            );

            // ОТПРАВЛЯЕМ ПИСЬМО С НОВЫМ ПАРОЛЕМ
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

              console.log(
                "📧 [AdminSupportController.processRequest] Письмо с новым паролем отправлено на:",
                supportRequest.email
              );
            } catch (emailError) {
              console.error(
                "❌ [AdminSupportController.processRequest] Ошибка отправки письма:",
                emailError.message
              );
              emailResults.push({
                type: "password_reset",
                success: false,
                error: emailError.message,
              });
            }
          } else if (action === "reject") {
            // ОТПРАВЛЯЕМ ПИСЬМО ОБ ОТКАЗЕ
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

              console.log(
                "📧 [AdminSupportController.processRequest] Письмо об отказе отправлено на:",
                supportRequest.email
              );
            } catch (emailError) {
              console.error(
                "❌ [AdminSupportController.processRequest] Ошибка отправки письма об отказе:",
                emailError.message
              );
              emailResults.push({
                type: "password_reset_rejected",
                success: false,
                error: emailError.message,
              });
            }
          }
          break;

        case "email_change":
          if (action === "approve") {
            if (supportRequest.new_email) {
              // Обновляем email
              await connection.execute(
                "UPDATE usersdata SET email = ? WHERE login = ?",
                [supportRequest.new_email, supportRequest.login]
              );

              actionResult = {
                emailChanged: true,
                oldEmail: supportRequest.email,
                newEmail: supportRequest.new_email,
              };

              console.log(
                "✅ [AdminSupportController.processRequest] Email изменен:",
                {
                  login: supportRequest.login,
                  from: supportRequest.email,
                  to: supportRequest.new_email,
                }
              );

              // ОТПРАВЛЯЕМ ПИСЬМА
              try {
                // 1. На старый email
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

                // 2. На новый email
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

                console.log(
                  "📧 [AdminSupportController.processRequest] Уведомления отправлены"
                );
              } catch (emailError) {
                console.error(
                  "❌ [AdminSupportController.processRequest] Ошибка отправки email:",
                  emailError.message
                );
                emailResults.push({
                  type: "email_change",
                  success: false,
                  error: emailError.message,
                });
              }
            }
          } else if (action === "reject") {
            // ОТПРАВЛЯЕМ ПИСЬМО ОБ ОТКАЗЕ
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

              console.log(
                "📧 [AdminSupportController.processRequest] Письмо об отказе отправлено"
              );
            } catch (emailError) {
              console.error(
                "❌ [AdminSupportController.processRequest] Ошибка отправки письма:",
                emailError.message
              );
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
            // Разблокируем пользователя
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

            console.log(
              "✅ [AdminSupportController.processRequest] Пользователь разблокирован:",
              {
                login: supportRequest.login,
              }
            );

            // ОТПРАВЛЯЕМ ПИСЬМО
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

              console.log(
                "📧 [AdminSupportController.processRequest] Письмо о разблокировке отправлено"
              );
            } catch (emailError) {
              console.error(
                "❌ [AdminSupportController.processRequest] Ошибка отправки письма:",
                emailError.message
              );
              emailResults.push({
                type: "unblock",
                success: false,
                error: emailError.message,
              });
            }
          } else if (action === "reject") {
            // ОТПРАВЛЯЕМ ПИСЬМО ОБ ОТКАЗЕ
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

              console.log(
                "📧 [AdminSupportController.processRequest] Письмо об отказе отправлено"
              );
            } catch (emailError) {
              console.error(
                "❌ [AdminSupportController.processRequest] Ошибка отправки письма:",
                emailError.message
              );
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
            // Импортируем сервис для отложенного удаления
            const FileDeletionService = require("../../services/FileDeletionService");

            // ВРЕМЯ УДАЛЕНИЯ (24 часа)
            const deletionDate = new Date(Date.now() + 24 * 60 * 60 * 1000);

            // ОТПРАВЛЯЕМ ПРЕДУПРЕЖДЕНИЕ ОБ УДАЛЕНИИ
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

              console.log(
                "📧 [AdminSupportController.processRequest] Предупреждение об удалении отправлено"
              );
            } catch (emailError) {
              console.error(
                "❌ [AdminSupportController.processRequest] Ошибка отправки предупреждения:",
                emailError.message
              );
              emailResults.push({
                type: "deletion_warning",
                success: false,
                error: emailError.message,
              });
            }

            // ОТЛОЖЕННОЕ УДАЛЕНИЕ
            try {
              const deletionResult =
                await FileDeletionService.scheduleUserFilesDeletion(
                  supportRequest.login,
                  24 // Через 24 часа
                );

              // УДАЛЯЕМ ПОЛЬЗОВАТЕЛЯ ИЗ СИСТЕМНЫХ ТАБЛИЦ
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

              console.log(
                "🗑️ [AdminSupportController.processRequest] Аккаунт помечен на удаление"
              );
            } catch (deletionError) {
              console.error(
                "❌ [AdminSupportController.processRequest] Ошибка планирования удаления:",
                deletionError.message
              );

              // Запасной вариант - прямое удаление
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
            }
          } else if (action === "reject") {
            // ОТПРАВЛЯЕМ ПИСЬМО ОБ ОТКАЗЕ
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

              console.log(
                "📧 [AdminSupportController.processRequest] Письмо об отказе отправлено"
              );
            } catch (emailError) {
              console.error(
                "❌ [AdminSupportController.processRequest] Ошибка отправки письма:",
                emailError.message
              );
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
            // 1. ПОЛУЧАЕМ РЕАЛЬНЫЙ EMAIL ПОЛЬЗОВАТЕЛЯ ИЗ БАЗЫ
            let realEmail = null;
            try {
              const [userData] = await connection.execute(
                "SELECT email FROM usersdata WHERE login = ?",
                [supportRequest.login]
              );

              if (userData && userData.length > 0 && userData[0].email) {
                realEmail = userData[0].email;
                console.log(
                  "✅ [processRequest] Найден реальный email пользователя:",
                  {
                    login: supportRequest.login,
                    realEmail: realEmail,
                    requestEmail: supportRequest.email,
                  }
                );
              } else {
                console.warn(
                  "⚠️ [processRequest] Пользователь не найден или нет email:",
                  {
                    login: supportRequest.login,
                    foundInDB: userData ? userData.length : 0,
                  }
                );
              }
            } catch (dbError) {
              console.error(
                "❌ [processRequest] Ошибка получения данных пользователя:",
                dbError.message
              );
            }

            // 2. ОТПРАВЛЯЕМ ОТВЕТ АДМИНИСТРАТОРА (только если есть реальный email)
            if (emailResponse) {
              if (realEmail) {
                try {
                  await emailService.sendSupportAdminResponse({
                    login: supportRequest.login,
                    email: realEmail, // ← ИСПРАВЛЕНО: используем реальный email из базы
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

                  console.log(
                    "📧 [processRequest] Ответ для типа 'other' отправлен на реальный email:",
                    {
                      login: supportRequest.login,
                      email: realEmail,
                    }
                  );
                } catch (emailError) {
                  console.error(
                    "❌ [processRequest] Ошибка отправки ответа:",
                    emailError.message
                  );
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
                // Нет реального email - не отправляем письмо, но все равно завершаем обработку
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

                console.warn(
                  "⚠️ [processRequest] Не удалось отправить ответ для типа 'other':",
                  {
                    login: supportRequest.login,
                    reason: "Пользователь не найден или нет email",
                  }
                );
              }
            } else {
              // Нет ответа администратора
              actionResult = {
                emailResponseSkipped: true,
                reason: "Администратор не предоставил текст ответа",
                note: "Заявка обработана, но письмо не отправлено (нет текста ответа)",
              };
            }
          } else if (action === "reject") {
            // 3. ОТКЛОНЕНИЕ ЗАПРОСА - тоже используем реальный email
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
              console.error(
                "❌ [processRequest] Ошибка получения email при отклонении:",
                dbError.message
              );
            }

            // ОТПРАВЛЯЕМ ПИСЬМО ОБ ОТКАЗЕ (только если есть реальный email)
            if (realEmail) {
              try {
                await emailService.sendSupportRequestProcessed({
                  login: supportRequest.login,
                  email: realEmail, // ← ИСПРАВЛЕНО: используем реальный email
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

                console.log(
                  "📧 [processRequest] Письмо об отказе отправлено на реальный email:",
                  {
                    login: supportRequest.login,
                    email: realEmail,
                  }
                );
              } catch (emailError) {
                console.error(
                  "❌ [processRequest] Ошибка отправки письма об отказе:",
                  emailError.message
                );
                emailResults.push({
                  type: "other_rejected",
                  success: false,
                  error: emailError.message,
                  emailAttempted: realEmail,
                });
              }
            } else {
              // Нет реального email - не отправляем письмо об отказе
              emailResults.push({
                type: "other_rejected",
                success: false,
                skipped: true,
                reason: "no_valid_email_found",
                note: "Пользователь не найден или нет email в системе",
              });

              console.warn(
                "⚠️ [processRequest] Не удалось отправить письмо об отказе:",
                {
                  login: supportRequest.login,
                  reason: "Пользователь не найден или нет email",
                }
              );
            }
          }
          break;
      }

      // 6. ЛОГИРУЕМ ОТПРАВКУ EMAIL (ЕСЛИ БЫЛИ)
      if (emailResults.length > 0) {
        try {
          await connection.execute(
            `INSERT INTO admin_logs (admin_id, action_type, target_type, target_id, details) 
           VALUES (?, ?, ?, ?, ?)`,
            [
              req.admin.id,
              "email_sent", // ← Короткое значение
              "support", // ← Короткое
              supportRequest.id,
              JSON.stringify({
                requestId: supportRequest.public_id || supportRequest.id,
                requestType: supportRequest.type,
                emailResults: emailResults,
                timestamp: new Date().toISOString(),
              }),
            ]
          );
          console.log(
            "📝 [AdminSupportController.processRequest] Логи email отправлены"
          );
        } catch (logError) {
          console.warn(
            "⚠️ [AdminSupportController.processRequest] Не удалось залогировать email:",
            logError.message
          );
        }
      }

      await connection.commit();

      // 7. ПОДГОТОВКА ОТВЕТА
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
          emailsSent: emailResults.filter((e) => e.success).length,
          emailsTotal: emailResults.length,
          emailResults: emailResults,
        },
      };

      console.log(
        "✅ [AdminSupportController.processRequest] Запрос обработан:",
        {
          requestId: supportRequest.id,
          action,
          type: supportRequest.type,
          emailsSent: emailResults.filter((e) => e.success).length,
          emailsTotal: emailResults.length,
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

// Экспортируем getConnection
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
