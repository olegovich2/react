const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { query } = require("../../services/databaseService");
const emailService = require("../../utils/emailService");
const { validateEmail, validateLogin } = require("../../utils/validators");

class SupportController {
  // Ключ шифрования (32 символа для AES-256)
  static getEncryptionKey() {
    return (
      process.env.SUPPORT_ENCRYPTION_KEY ||
      "default-tech-support-encryption-key-32-chars"
    );
  }

  // Шифрование текста
  static encryptText(text) {
    if (!text || text.trim() === "") return null;

    try {
      const algorithm = "aes-256-cbc";
      const key = crypto.scryptSync(this.getEncryptionKey(), "salt", 32);
      const iv = crypto.randomBytes(16);

      const cipher = crypto.createCipheriv(algorithm, key, iv);
      let encrypted = cipher.update(text, "utf8", "hex");
      encrypted += cipher.final("hex");

      // Сохраняем IV:зашифрованный_текст
      return iv.toString("hex") + ":" + encrypted;
    } catch (error) {
      console.error("❌ Ошибка шифрования:", error);
      return null;
    }
  }

  // Расшифровка текста
  static decryptText(encryptedText) {
    if (!encryptedText || encryptedText.trim() === "") return null;

    try {
      const algorithm = "aes-256-cbc";
      const key = crypto.scryptSync(this.getEncryptionKey(), "salt", 32);

      // Разделяем IV и зашифрованный текст
      const parts = encryptedText.split(":");
      if (parts.length !== 2) {
        throw new Error("Неверный формат зашифрованных данных");
      }

      const iv = Buffer.from(parts[0], "hex");
      const encrypted = parts[1];

      const decipher = crypto.createDecipheriv(algorithm, key, iv);
      let decrypted = decipher.update(encrypted, "hex", "utf8");
      decrypted += decipher.final("utf8");

      return decrypted;
    } catch (error) {
      console.error("❌ Ошибка расшифровки:", error);
      return null;
    }
  }

  // Генерация публичного ID
  static generatePublicId() {
    return `SUP-${Date.now().toString(36).toUpperCase()}`;
  }

  // Логирование действий
  static async logAction(
    requestId,
    action,
    oldValue = null,
    newValue = null,
    actor = "system"
  ) {
    try {
      await query(
        `INSERT INTO support_request_logs 
         (request_id, action, old_value, new_value, actor_type, actor_id) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [requestId, action, oldValue, newValue, "system", actor]
      );
    } catch (error) {
      console.error("❌ Ошибка логирования:", error);
    }
  }

  // 1. ОТПРАВКА ЗАЯВКИ
  static async submitRequest(req, res) {
    try {
      console.log("📨 Получена новая заявка:", {
        type: req.body.type,
        login: req.body.login,
        email: req.body.email?.substring(0, 3) + "...",
        secretWord: req.body.secretWord ? "***" : "не указано",
      });

      const { type, login, email, secretWord, message, newEmail, password } =
        req.body;

      // Проверка типа заявки
      const validTypes = [
        "password_reset",
        "email_change",
        "unblock",
        "account_deletion",
        "other",
      ];
      if (!validTypes.includes(type)) {
        return res.status(400).json({
          success: false,
          message: "Неверный тип заявки",
        });
      }

      // РАЗДЕЛЬНАЯ ВАЛИДАЦИЯ ДЛЯ РАЗНЫХ ТИПОВ ЗАЯВОК

      // ========== ВАЛИДАЦИЯ ДЛЯ ТИПА "other" ==========
      if (type === "other") {
        // Для типа "other" проверяем только основные поля
        if (!login || !email || !message) {
          return res.status(400).json({
            success: false,
            message:
              "Для типа 'Другая проблема' заполните логин, email и сообщение",
          });
        }

        // Валидация email и логина
        try {
          validateEmail(email);
          validateLogin(login);
        } catch (error) {
          return res.status(400).json({
            success: false,
            message: error.message,
            field: error.field,
          });
        }

        // Проверяем длину сообщения
        if (message.length < 10) {
          return res.status(400).json({
            success: false,
            message: "Опишите проблему подробнее (минимум 10 символов)",
            field: "message",
          });
        }

        // ========== ВАЛИДАЦИЯ ДЛЯ ВСЕХ ОСТАЛЬНЫХ ТИПОВ ==========
      } else {
        // Для всех остальных типов проверяем все обязательные поля
        if (!type || !login || !email || !secretWord || !message) {
          return res.status(400).json({
            success: false,
            message: "Заполните все обязательные поля",
          });
        }

        // Валидация email и логина
        try {
          validateEmail(email);
          validateLogin(login);
        } catch (error) {
          return res.status(400).json({
            success: false,
            message: error.message,
            field: error.field,
          });
        }

        // Проверка кодового слова для не-"other" типов
        if (!secretWord.trim()) {
          return res.status(400).json({
            success: false,
            message: "Кодовое слово обязательно",
            field: "secretWord",
          });
        }

        if (secretWord.length < 3) {
          return res.status(400).json({
            success: false,
            message: "Кодовое слово должно быть не менее 3 символов",
            field: "secretWord",
          });
        }

        // Проверяем длину сообщения
        if (message.length < 10) {
          return res.status(400).json({
            success: false,
            message: "Опишите проблему подробнее (минимум 10 символов)",
            field: "message",
          });
        }
      }

      // ДОПОЛНИТЕЛЬНАЯ ВАЛИДАЦИЯ ДЛЯ КОНКРЕТНЫХ ТИПОВ

      // Для смены email требуется новый email
      if (type === "email_change") {
        if (!newEmail) {
          return res.status(400).json({
            success: false,
            message: "Для смены email укажите новый email",
            field: "newEmail",
          });
        }

        try {
          validateEmail(newEmail);
        } catch (error) {
          return res.status(400).json({
            success: false,
            message: "Неверный формат нового email",
            field: "newEmail",
          });
        }

        if (newEmail === email) {
          return res.status(400).json({
            success: false,
            message: "Новый email должен отличаться от текущего",
            field: "newEmail",
          });
        }
      }

      // Для определенных типов требуется пароль
      if (
        ["email_change", "unblock", "account_deletion"].includes(type) &&
        !password
      ) {
        return res.status(400).json({
          success: false,
          message: "Для этого типа заявки требуется пароль",
          field: "password",
        });
      }

      // ========== СПЕЦИАЛЬНАЯ ОБРАБОТКА ДЛЯ ТИПА "other" ==========
      let userEmailForSending = email; // email для отправки письма
      let shouldSendEmail = true;
      let autoResolve = false;
      let adminNotes = null;

      if (type === "other") {
        try {
          // Проверяем существование пользователя по логину
          const [user] = await query(
            "SELECT login, email FROM usersdata WHERE login = ?",
            [login]
          );

          if (user) {
            // ✅ Логин верный - используем email из формы
            userEmailForSending = email; // ИЗМЕНЕНИЕ: email из формы
            shouldSendEmail = true;
            autoResolve = false;
            console.log(
              "✅ [submitRequest] Логин найден, используем email из формы:",
              {
                login: login,
                formEmail: email,
              }
            );
          } else {
            // ❌ Логин НЕверный - не отправляем письмо, сразу резолвим
            shouldSendEmail = false;
            autoResolve = true;
            adminNotes = "Автоматически разрешено: пользователь не найден"; // ИЗМЕНЕНИЕ: текст

            console.log(
              "⚠️ [submitRequest] Логин не найден, заявка будет автоматически разрешена:",
              {
                login: login,
                formEmail: email,
              }
            );
          }
        } catch (dbError) {
          console.error(
            "❌ [submitRequest] Ошибка проверки пользователя:",
            dbError.message
          );
          // В случае ошибки БД продолжаем как обычно
          userEmailForSending = email;
          shouldSendEmail = true;
          autoResolve = false;
          adminNotes = "Ошибка проверки пользователя в БД";
        }
      } else {
        // Для всех других типов проверяем существование пользователя
        try {
          const userExists = await query(
            "SELECT login FROM usersdata WHERE login = ? AND email = ?",
            [login, email]
          );

          if (userExists.length === 0) {
            return res.status(400).json({
              success: false,
              message: "Пользователь с таким логином и email не найден",
            });
          }
        } catch (error) {
          console.log(
            "⚠️ Пропускаем проверку существования пользователя:",
            error.message
          );
        }
      }

      // ШИФРОВАНИЕ ДАННЫХ
      // ИЗМЕНЕНИЕ: для "other" не шифруем кодовое слово, оставляем null
      const encryptedSecretWord =
        type !== "other" ? SupportController.encryptText(secretWord) : "";

      let encryptedPassword = null;

      if (["email_change", "unblock", "account_deletion"].includes(type)) {
        encryptedPassword = SupportController.encryptText(password);
      }

      // ГЕНЕРАЦИЯ ID И ТОКЕНА
      const requestId = crypto.randomUUID();
      const publicId = SupportController.generatePublicId();

      const initialStatus = autoResolve ? "resolved" : "pending";
      const finalEmailForDb = email; // Сохраняем email из формы

      let confirmToken = null;
      if (shouldSendEmail) {
        confirmToken = jwt.sign(
          {
            requestId,
            email: userEmailForSending,
            purpose: "support_confirm",
          },
          process.env.JWT_SECRET || "your-secret-key",
          { expiresIn: "24h" }
        );
      }

      // СОХРАНЕНИЕ ЗАЯВКИ В БД
      await query(
        `INSERT INTO support_requests 
           (id, public_id, type, login, email, secret_word_hash, password, message, new_email, status, admin_notes) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          requestId,
          publicId,
          type,
          login,
          finalEmailForDb, // Сохраняем email из формы
          encryptedSecretWord,
          encryptedPassword,
          message,
          type === "email_change" ? newEmail : null,
          initialStatus,
          adminNotes,
        ]
      );

      // СОХРАНЕНИЕ ТОКЕНА ПОДТВЕРЖДЕНИЯ (только если нужно отправлять письмо)
      if (shouldSendEmail && confirmToken) {
        await query(
          `INSERT INTO support_confirmation_tokens 
             (token, request_id, email, expires_at) 
             VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL 24 HOUR))`,
          [confirmToken, requestId, userEmailForSending]
        );
      }

      // ОТПРАВКА EMAIL ПОДТВЕРЖДЕНИЯ (только если нужно)
      if (shouldSendEmail && !autoResolve && confirmToken) {
        try {
          await emailService.sendSupportRequestCreated({
            login,
            email: userEmailForSending, // ← Отправляем на email из формы
            requestId: publicId,
            confirmToken,
            requestType: type,
          });

          console.log(
            "📧 [submitRequest] Письмо подтверждения отправлено на email из формы:",
            {
              login: login,
              email: userEmailForSending,
            }
          );
        } catch (emailError) {
          console.error("❌ Ошибка отправки email:", emailError);
        }
      }

      // ЛОГИРОВАНИЕ
      if (autoResolve) {
        // Логируем автоматическое разрешение
        await SupportController.logAction(
          requestId,
          "auto_resolved",
          "pending",
          "resolved",
          `system:user_not_found`
        );
        console.log(
          `⚠️ Заявка автоматически разрешена: ${publicId} - пользователь ${login} не найден`
        );
      } else {
        await SupportController.logAction(
          requestId,
          "created",
          null,
          publicId,
          `user:${login}`
        );
        console.log(`✅ Заявка создана: ${publicId} (${type}) для ${login}`);
      }

      // УСПЕШНЫЙ ОТВЕТ
      res.status(201).json({
        success: true,
        message: autoResolve
          ? "Заявка автоматически обработана (пользователь не найден)"
          : "Заявка успешно создана. Проверьте email для подтверждения.",
        data: {
          requestId: publicId,
          email: shouldSendEmail ? userEmailForSending : null,
          status: initialStatus,
          note: autoResolve
            ? "Заявка автоматически обработана"
            : "Ссылка подтверждения отправлена на email",
        },
      });
    } catch (error) {
      console.error("💥 Ошибка при создании заявки:", error);

      res.status(500).json({
        success: false,
        message: "Ошибка при создании заявки. Попробуйте позже.",
        ...(process.env.NODE_ENV === "development" && { error: error.message }),
      });
    }
  }

  // 2. ПОДТВЕРЖДЕНИЕ EMAIL
  static async confirmEmail(req, res) {
    try {
      const { token } = req.params;
      console.log(
        `🔑 Подтверждение email по токену: ${token?.substring(0, 20)}...`
      );

      // ВАЛИДАЦИЯ ТОКЕНА
      if (!token) {
        return res.status(400).json({
          success: false,
          message: "Токен подтверждения не предоставлен",
        });
      }

      // ПРОВЕРКА ТОКЕНА В БД
      const tokenRecord = await query(
        `SELECT t.*, r.public_id, r.login, r.email, r.type 
         FROM support_confirmation_tokens t
         JOIN support_requests r ON t.request_id = r.id
         WHERE t.token = ? AND t.is_used = FALSE AND t.expires_at > NOW()`,
        [token]
      );

      if (tokenRecord.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Неверный или просроченный токен подтверждения",
        });
      }

      const { request_id, public_id, login, email, type } = tokenRecord[0];

      // ОБНОВЛЕНИЕ СТАТУСА ЗАЯВКИ
      await query("UPDATE support_requests SET status = ? WHERE id = ?", [
        "confirmed",
        request_id,
      ]);

      // ОТМЕЧАЕМ ТОКЕН КАК ИСПОЛЬЗОВАННЫЙ
      await query(
        "UPDATE support_confirmation_tokens SET is_used = TRUE, used_at = NOW() WHERE token = ?",
        [token]
      );

      // ОТПРАВКА УВЕДОМЛЕНИЯ О ПОДТВЕРЖДЕНИИ
      try {
        await emailService.sendSupportRequestConfirmed({
          login,
          email,
          requestId: public_id,
          requestType: type,
        });
      } catch (emailError) {
        console.error("❌ Ошибка отправки email подтверждения:", emailError);
      }

      // ЛОГИРОВАНИЕ
      await SupportController.logAction(
        request_id,
        "email_confirmed",
        "pending",
        "confirmed",
        `user:${login}`
      );

      console.log(`✅ Заявка подтверждена: ${public_id} (${login})`);

      // ПЕРЕНАПРАВЛЕНИЕ ИЛИ JSON ОТВЕТ
      if (req.accepts("html")) {
        const frontendUrl = process.env.CLIENT_URL || "http://localhost:3000";
        res.redirect(
          `${frontendUrl}/support/confirm/success?requestId=${public_id}`
        );
      } else {
        res.json({
          success: true,
          message: "Email успешно подтвержден. Заявка принята в работу.",
          data: {
            requestId: public_id,
            type: type,
            login: login,
            status: "confirmed",
          },
        });
      }
    } catch (error) {
      console.error("💥 Ошибка при подтверждении email:", error);

      res.status(500).json({
        success: false,
        message: "Ошибка при подтверждении email",
        ...(process.env.NODE_ENV === "development" && { error: error.message }),
      });
    }
  }

  // 3. ПРОВЕРКА СТАТУСА ЗАЯВКИ
  static async getRequestStatus(req, res) {
    try {
      const { publicId } = req.params;
      console.log(`🔍 Проверка статуса заявки: ${publicId}`);

      if (!publicId) {
        return res.status(400).json({
          success: false,
          message: "Не указан номер заявки",
        });
      }

      // ПОЛУЧЕНИЕ ДАННЫХ О ЗАЯВКЕ
      const request = await query(
        `SELECT 
        id,
        public_id, 
        type, 
        status, 
        created_at, 
        updated_at,
        resolved_at
       FROM support_requests 
       WHERE public_id = ?`,
        [publicId]
      );

      if (request.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Заявка не найдена",
        });
      }

      const requestData = request[0];

      // ЛОГИРОВАНИЕ ПРОСМОТРА
      await SupportController.logAction(
        requestData.id,
        "viewed",
        null,
        null,
        "public"
      );

      // ПРЕОБРАЗОВАНИЕ ТИПОВ И СТАТУСОВ
      const typeNames = {
        password_reset: "Смена пароля",
        email_change: "Смена email",
        unblock: "Разблокировка аккаунта",
        account_deletion: "Удаление аккаунта",
        other: "Другая проблема",
      };

      const statusNames = {
        pending: "Ожидает подтверждения email",
        confirmed: "Подтверждена, в очереди",
        in_progress: "В работе",
        resolved: "Решена",
        rejected: "Отклонена",
        cancelled: "Отменена",
      };

      // ОТВЕТ
      res.json({
        success: true,
        data: {
          requestId: requestData.public_id,
          type: typeNames[requestData.type] || requestData.type,
          status: statusNames[requestData.status] || requestData.status,
          created: requestData.created_at,
          updated: requestData.updated_at,
          resolved: requestData.resolved_at,
          rawStatus: requestData.status,
        },
      });
    } catch (error) {
      console.error("💥 Ошибка при проверке статуса:", error);

      res.status(500).json({
        success: false,
        message: "Ошибка при проверке статуса заявки",
        ...(process.env.NODE_ENV === "development" && { error: error.message }),
      });
    }
  }

  // 4. ПОЛУЧЕНИЕ ТИПОВ ЗАЯВОК
  static async getRequestTypes(req, res) {
    try {
      const types = [
        {
          value: "password_reset",
          label: "Смена пароля",
          description: "Забыл пароль от аккаунта",
        },
        {
          value: "email_change",
          label: "Смена email",
          description: "Хочу изменить email аккаунта",
        },
        {
          value: "unblock",
          label: "Разблокировка аккаунта",
          description: "Меня заблокировали в системе",
        },
        {
          value: "account_deletion",
          label: "Удаление аккаунта",
          description: "Хочу удалить свой аккаунта",
        },
        {
          value: "other",
          label: "Другая проблема",
          description: "Любая другая проблема или вопрос",
        },
      ];

      res.json({
        success: true,
        data: types,
      });
    } catch (error) {
      console.error("💥 Ошибка при получении типов заявок:", error);
      res.status(500).json({
        success: false,
        message: "Ошибка сервера",
      });
    }
  }

  // 5. ДЛЯ АДМИНКИ: РАСШИФРОВКА ДАННЫХ
  static async getRequestDetails(req, res) {
    try {
      const { requestId } = req.params;

      // Только для админов (добавить проверку isAdmin)
      const request = await query(
        `SELECT 
          id, public_id, type, login, email, 
          secret_word_hash, password, message, new_email,
          status, created_at, admin_notes
         FROM support_requests 
         WHERE id = ? OR public_id = ?`,
        [requestId, requestId]
      );

      if (request.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Заявка не найдена",
        });
      }

      const requestData = request[0];

      // РАСШИФРОВКА данных для админа
      const decryptedData = {
        ...requestData,
        secretWord: requestData.secret_word_hash
          ? this.decryptText(requestData.secret_word_hash)
          : null,
        password: this.decryptText(requestData.password),
        // Скрываем оригинальные зашифрованные данные
        secret_word_hash: undefined,
        password: undefined,
      };

      // ЛОГИРОВАНИЕ просмотра админом
      await SupportController.logAction(
        requestData.id,
        "admin_viewed",
        null,
        null,
        `admin:${req.admin?.id || "unknown"}`
      );

      res.json({
        success: true,
        data: decryptedData,
      });
    } catch (error) {
      console.error("💥 Ошибка при получении деталей заявки:", error);
      res.status(500).json({
        success: false,
        message: "Ошибка сервера",
      });
    }
  }
}

module.exports = SupportController;
