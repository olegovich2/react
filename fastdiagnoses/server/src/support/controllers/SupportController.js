const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { query } = require("../../services/databaseService"); // Ваш пул соединений
const emailService = require("../../utils/emailService"); // Ваш emailService
const { validateEmail, validateLogin } = require("../../utils/validators"); // Существующие валидаторы

const SupportController = {
  // Генерация публичного ID
  generatePublicId() {
    return `SUP-${Date.now().toString(36).toUpperCase()}`;
  },

  // Логирование действий
  async logAction(
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
  },

  // 1. ОТПРАВКА ЗАЯВКИ
  async submitRequest(req, res) {
    try {
      console.log("📨 Получена новая заявка:", req.body);

      const { type, login, email, secretWord, message, newEmail, blockReason } =
        req.body;

      // ВАЛИДАЦИЯ
      if (!type || !login || !email || !secretWord || !message) {
        return res.status(400).json({
          success: false,
          message: "Заполните все обязательные поля",
        });
      }

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

      // Дополнительная валидация для email_change
      if (type === "email_change" && !newEmail) {
        return res.status(400).json({
          success: false,
          message: "Для смены email укажите новый email",
          field: "newEmail",
        });
      }

      if (type === "email_change") {
        try {
          validateEmail(newEmail);
        } catch (error) {
          return res.status(400).json({
            success: false,
            message: "Неверный формат нового email",
            field: "newEmail",
          });
        }
      }

      // ПРОВЕРКА СУЩЕСТВУЕТ ЛИ ПОЛЬЗОВАТЕЛЬ (опционально, но желательно)
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

      // ХЭШИРОВАНИЕ КОДОВОГО СЛОВА
      const salt = await bcrypt.genSalt(12);
      const secretWordHash = await bcrypt.hash(secretWord, salt);

      // ГЕНЕРАЦИЯ ID И ТОКЕНА
      const requestId = crypto.randomUUID();
      const publicId = this.generatePublicId();

      const confirmToken = jwt.sign(
        {
          requestId,
          email,
          purpose: "support_confirm",
        },
        process.env.JWT_SECRET || "your-secret-key",
        { expiresIn: "24h" }
      );

      // СОХРАНЕНИЕ ЗАЯВКИ В БД
      await query(
        `INSERT INTO support_requests 
         (id, public_id, type, login, email, secret_word_hash, message, new_email, block_reason, status) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
        [
          requestId,
          publicId,
          type,
          login,
          email,
          secretWordHash,
          message,
          type === "email_change" ? newEmail : null,
          type === "unblock" ? blockReason : null,
        ]
      );

      // СОХРАНЕНИЕ ТОКЕНА ПОДТВЕРЖДЕНИЯ
      await query(
        `INSERT INTO support_confirmation_tokens 
         (token, request_id, email, expires_at) 
         VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL 24 HOUR))`,
        [confirmToken, requestId, email]
      );

      // ОТПРАВКА EMAIL ПОДТВЕРЖДЕНИЯ
      try {
        await emailService.sendSupportRequestCreated({
          login,
          email,
          requestId: publicId,
          confirmToken,
          requestType: type,
        });
      } catch (emailError) {
        console.error("❌ Ошибка отправки email:", emailError);
        // Не прерываем процесс, только логируем
      }

      // ЛОГИРОВАНИЕ
      await this.logAction(
        requestId,
        "created",
        null,
        publicId,
        `user:${login}`
      );

      console.log(`✅ Заявка создана: ${publicId} (${type}) для ${login}`);

      // УСПЕШНЫЙ ОТВЕТ
      res.status(201).json({
        success: true,
        message: "Заявка успешно создана. Проверьте email для подтверждения.",
        data: {
          requestId: publicId,
          email: email,
          note: "Ссылка подтверждения отправлена на email",
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
  },

  // 2. ПОДТВЕРЖДЕНИЕ EMAIL
  async confirmEmail(req, res) {
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
      await this.logAction(
        request_id,
        "email_confirmed",
        "pending",
        "confirmed",
        `user:${login}`
      );

      console.log(`✅ Заявка подтверждена: ${public_id} (${login})`);

      // ПЕРЕНАПРАВЛЕНИЕ ИЛИ JSON ОТВЕТ
      if (req.accepts("html")) {
        // Для браузера - редирект на страницу успеха
        const frontendUrl = process.env.CLIENT_URL || "http://localhost:3000";
        res.redirect(
          `${frontendUrl}/support/confirm/success?requestId=${public_id}`
        );
      } else {
        // Для API - JSON ответ
        res.json({
          success: true,
          message: "Email успешно подтвержден. Заявка принята в работу.",
          data: {
            requestId: public_id,
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
  },

  // 3. ПРОВЕРКА СТАТУСА ЗАЯВКИ
  async getRequestStatus(req, res) {
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
      await this.logAction(requestData.id, "viewed", null, null, "public");

      // ПРЕОБРАЗОВАНИЕ ТИПОВ И СТАТУСОВ ДЛЯ ЧЕЛОВЕКА
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
          rawStatus: requestData.status, // Для фронтенда
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
  },

  // 4. ПОЛУЧЕНИЕ ТИПОВ ЗАЯВОК (для фронтенда)
  async getRequestTypes(req, res) {
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
          description: "Хочу удалить свой аккаунт",
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
  },
};

module.exports = SupportController;
