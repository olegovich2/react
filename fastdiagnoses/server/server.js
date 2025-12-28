const express = require("express");
const path = require("path");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const emailService = require("./src/utils/emailService");
const validator = require("validator");
const fs = require("fs").promises;
const crypto = require("crypto");
const workerService = require("./src/services/workerService");
require("dotenv").config();
const { authenticateToken } = require("./src/middleware/auth");
const passwordResetService = require("./src/services/passwordResetService");
const userTableService = require("./src/services/userTableService");
const config = require("./src/config");
const {
  ValidationError,
  validateLogin,
  validatePassword,
  validateEmail,
  validateSurvey,
  validateImageBuffer,
  validateSecretWord,
} = require("./src/utils/validators");
const {
  ensureUploadDirs,
  deleteImageFromDisk,
} = require("./src/utils/fileSystem");
const { uploadSingleImage } = require("./src/utils/uploadConfig");
const { startCleanupSchedule } = require("./src/utils/cron");
const { query, getConnection } = require("./src/services/databaseService");
const { HTML_TEMPLATES } = require("./src/templates/htmlTemplates");

// ==================== АДМИН ИМПОРТЫ ====================
const adminRoutes = require("./src/admin/routes/adminRoutes");
// ==================== ТЕХПОДДЕРЖКА ИМПОРТЫ ===================
const supportRoutes = require("./src/support/routes/supportRoutes");

const app = express();
const PORT = process.env.PORT || 5000;

// ==================== ИСПОЛЬЗУЕМ КОНФИГИ ====================
const MAX_USERS_PER_EMAIL = config.MAX_USERS_PER_EMAIL;
const UPLOAD_DIR = config.UPLOAD_DIR;
const JWT_SECRET = config.JWT_SECRET;
const JWT_SECRET_TWO = config.JWT_SECRET_TWO;

// ==================== MIDDLEWARE ====================
app.use(
  cors({
    origin:
      process.env.NODE_ENV === "production"
        ? process.env.CLIENT_URL
        : "http://localhost:5000",
    credentials: true,
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(UPLOAD_DIR));

const buildPath = path.join(__dirname, "..", "client", "build");
app.use(express.static(buildPath));

const adminBuildPath = path.join(__dirname, "..", "client-admin", "build");
app.use("/admin", express.static(adminBuildPath));

// ==================== API ENDPOINTS ====================

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Сервер работает",
    timestamp: new Date().toISOString(),
    version: "2.0.0",
    features: ["file-system-storage", "uuid-filenames"],
  });
});

// Мониторинг worker'ов
app.get("/api/admin/workers-stats", async (req, res) => {
  if (
    process.env.NODE_ENV !== "development" &&
    req.headers["x-admin-key"] !== process.env.ADMIN_KEY
  ) {
    return res.status(403).json({ success: false, message: "Доступ запрещен" });
  }

  res.json({
    success: true,
    workers: workerService.getStats(),
    memory: process.memoryUsage(),
    uptime: process.uptime(),
  });
});

// Восстановление пароля - запрос с проверкой кодового слова
app.post("/api/auth/forgot-password", async (req, res) => {
  console.log("📧 Запрос восстановления пароля");

  // Универсальное сообщение для безопасности (только для финального успеха)
  const SECURITY_SUCCESS_MESSAGE =
    "Если email зарегистрирован в системе, на него отправлена инструкция";

  // URL страницы техподдержки
  const SUPPORT_URL = "https://ваш-сайт.com/support"; // ← НАСТРОЙТЕ ЭТОТ URL

  try {
    const { email, secretWord } = req.body;
    console.log("📧 Email из запроса:", email);
    console.log(
      "🔐 Secret word из запроса:",
      secretWord ? "присутствует" : "отсутствует"
    );

    // 1. Базовая валидация email
    if (!email) {
      console.log("❌ Отсутствует email");
      return res.status(400).json({
        success: false,
        message: "Введите email адрес",
        field: "email",
      });
    }

    if (!validator.isEmail(email)) {
      console.log("❌ Невалидный email:", email);
      return res.status(400).json({
        success: false,
        message: "Введите корректный email адрес",
        field: "email",
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // 2. Проверяем наличие кодового слова
    if (!secretWord) {
      console.log("❌ Отсутствует кодовое слово");
      return res.status(400).json({
        success: false,
        message: "Введите кодовое слово",
        field: "secretWord",
      });
    }

    if (typeof secretWord !== "string") {
      console.log("❌ Неверный тип кодового слова");
      return res.status(400).json({
        success: false,
        message: "Кодовое слово должно быть текстом",
        field: "secretWord",
      });
    }

    const trimmedSecretWord = secretWord.trim();

    if (trimmedSecretWord === "") {
      console.log("❌ Пустое кодовое слово");
      return res.status(400).json({
        success: false,
        message: "Введите кодовое слово",
        field: "secretWord",
      });
    }

    // 3. Задержка для предотвращения timing-атак
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 4. Ищем пользователя ПЕРВЫМ ДЕЛОМ
    console.log(`🔍 Поиск пользователя с email: ${normalizedEmail}`);

    const userResult = await query(
      "SELECT login, email, secret_word, blocked FROM usersdata WHERE email = ? AND logic = 'true'",
      [normalizedEmail]
    );

    // 5. Проверяем результат запроса
    let user = null;

    if (userResult) {
      if (Array.isArray(userResult) && userResult.length > 0) {
        user = userResult[0];
        console.log("✅ Пользователь найден (массив):", user.login);
      } else if (userResult.login !== undefined) {
        user = userResult;
        console.log("✅ Пользователь найден (объект):", user.login);
      } else if (userResult[0] && userResult[0].login !== undefined) {
        user = userResult[0];
        console.log("✅ Пользователь найден (вложенный массив):", user.login);
      } else {
        console.log("❌ Пользователь не найден или некорректный формат данных");
      }
    }

    // 6. Получаем количество существующих попыток (если пользователь найден)
    let attemptCount = 0;
    let attemptsRecordId = null;

    if (user) {
      try {
        const attemptsResult = await query(
          "SELECT id, attempts FROM password_reset_attempts WHERE email = ?",
          [normalizedEmail]
        );

        if (attemptsResult) {
          if (Array.isArray(attemptsResult) && attemptsResult.length > 0) {
            attemptCount = attemptsResult[0].attempts || 0;
            attemptsRecordId = attemptsResult[0].id;
          } else if (attemptsResult.attempts !== undefined) {
            attemptCount = attemptsResult.attempts || 0;
            attemptsRecordId = attemptsResult.id;
          } else if (
            attemptsResult[0] &&
            attemptsResult[0].attempts !== undefined
          ) {
            attemptCount = attemptsResult[0].attempts || 0;
            attemptsRecordId = attemptsResult[0].id;
          }
        }

        console.log(
          `📊 Существующие попытки для ${normalizedEmail}: ${attemptCount}`
        );
      } catch (attemptsError) {
        console.error("❌ Ошибка получения попыток:", attemptsError.message);
      }
    }

    // 7. Если пользователя НЕТ - показываем ошибку
    if (!user) {
      console.log(`📭 Пользователь не найден: ${normalizedEmail}`);
      return res.status(404).json({
        success: false,
        message: "Пользователь с таким email не найден",
        field: "email",
      });
    }

    console.log("👤 Данные пользователя:", {
      login: user.login,
      email: user.email,
      hasSecretWord: !!user.secret_word,
      blocked: user.blocked,
    });

    // 8. Проверяем, не заблокирован ли уже пользователь
    if (user.blocked === 1) {
      console.log(`⛔ Заблокированный пользователь: ${normalizedEmail}`);
      return res.status(403).json({
        success: false,
        message: "Аккаунт заблокирован. Обратитесь в техническую поддержку.",
      });
    }

    // 9. Проверяем лимит (3 НЕУДАЧНЫЕ попытки)
    if (attemptCount >= 3) {
      console.log(
        `🔒 Блокировка пользователя ${normalizedEmail} (3 неудачные попытки)`
      );

      try {
        // Блокируем пользователя
        await query(
          `UPDATE usersdata 
           SET blocked = 1, blocked_until = '2099-12-31 23:59:59'
           WHERE email = ? AND logic = 'true'`,
          [normalizedEmail]
        );

        console.log(
          `✅ Пользователь ${normalizedEmail} заблокирован за 3 неудачные попытки`
        );

        // ОТПРАВЛЯЕМ EMAIL О БЛОКИРОВКЕ
        try {
          await emailService.sendAccountBlocked({
            login: user.login,
            email: user.email,
            reason: "Превышено количество попыток восстановления пароля",
            supportUrl: config.SUPPORT_URL,
            ipAddress: req.ip || "unknown",
            userAgent: req.headers["user-agent"] || "",
          });
          console.log(`📧 Письмо о блокировке отправлено на: ${user.email}`);
        } catch (emailError) {
          console.error(
            "❌ Ошибка отправки email о блокировке:",
            emailError.message
          );
          // Не прерываем выполнение, если email не отправился
        }
      } catch (blockError) {
        console.error("❌ Ошибка блокировки:", blockError.message);
      }

      return res.status(403).json({
        success: false,
        message:
          "Превышено количество попыток. Аккаунт заблокирован. Обратитесь в техническую поддержку.",
      });
    }

    // 10. Проверяем кодовое слово
    console.log(`🔐 Проверка кодового слова для ${normalizedEmail}`);
    console.log(
      `📝 Хэш в БД: ${user.secret_word ? "присутствует" : "отсутствует"}`
    );

    // Проверяем наличие кодового слова в БД
    if (!user.secret_word || user.secret_word.trim() === "") {
      console.log(
        `❌ Кодовое слово не установлено для пользователя: ${normalizedEmail}`
      );

      // Фиксируем попытку
      try {
        if (attemptsRecordId) {
          await query(
            "UPDATE password_reset_attempts SET attempts = attempts + 1, last_attempt = NOW() WHERE id = ?",
            [attemptsRecordId]
          );
        } else {
          await query(
            `INSERT INTO password_reset_attempts (email, attempts, last_attempt, ip_address, user_agent)
             VALUES (?, 1, NOW(), ?, ?)`,
            [
              normalizedEmail,
              req.ip || "unknown",
              req.headers["user-agent"] || "",
            ]
          );
        }
      } catch (updateError) {
        console.warn(
          "⚠️ Не удалось зафиксировать попытку:",
          updateError.message
        );
      }

      return res.status(400).json({
        success: false,
        message:
          "Для вашего аккаунта не установлено кодовое слово. Обратитесь в техническую поддержку.",
        field: "secretWord",
      });
    }

    // 11. Сравниваем кодовое слово с хэшем
    console.log(`🔍 Сравнение кодового слова с хэшем...`);
    const isValidSecretWord = await bcrypt.compare(
      trimmedSecretWord,
      user.secret_word
    );

    console.log(
      `✅ Результат сравнения: ${isValidSecretWord ? "ВЕРНО" : "НЕВЕРНО"}`
    );

    if (!isValidSecretWord) {
      console.log(`❌ Неверное кодовое слово для ${normalizedEmail}`);

      // ФИКСИРУЕМ НЕУДАЧНУЮ ПОПЫТКУ
      try {
        let newAttemptCount = attemptCount + 1;

        if (attemptsRecordId) {
          await query(
            "UPDATE password_reset_attempts SET attempts = attempts + 1, last_attempt = NOW() WHERE id = ?",
            [attemptsRecordId]
          );
        } else {
          await query(
            `INSERT INTO password_reset_attempts (email, attempts, last_attempt, ip_address, user_agent)
             VALUES (?, 1, NOW(), ?, ?)`,
            [
              normalizedEmail,
              req.ip || "unknown",
              req.headers["user-agent"] || "",
            ]
          );
          newAttemptCount = 1;
        }

        console.log(
          `📈 Неудачная попытка зафиксирована: ${newAttemptCount}/3 (неверное кодовое слово)`
        );

        // Проверяем, не достигли ли лимита
        if (newAttemptCount >= 3) {
          console.log(`🔒 Достигнут лимит неудачных попыток - блокировка`);

          try {
            // Блокируем пользователя
            await query(
              `UPDATE usersdata 
               SET blocked = 1, blocked_until = '2099-12-31 23:59:59'
               WHERE email = ? AND logic = 'true'`,
              [normalizedEmail]
            );

            console.log(`✅ Аккаунт ${normalizedEmail} заблокирован`);

            // ОТПРАВЛЯЕМ EMAIL О БЛОКИРОВКЕ
            try {
              await emailService.sendAccountBlocked({
                login: user.login,
                email: user.email,
                reason: "3 неудачные попытки восстановления пароля",
                supportUrl: config.SUPPORT_URL,
                ipAddress: req.ip || "unknown",
                userAgent: req.headers["user-agent"] || "",
              });
              console.log(
                `📧 Письмо о блокировке отправлено на: ${user.email}`
              );
            } catch (emailError) {
              console.error(
                "❌ Ошибка отправки email о блокировке:",
                emailError.message
              );
            }
          } catch (blockError) {
            console.error("❌ Ошибка при блокировке:", blockError.message);
          }

          return res.status(403).json({
            success: false,
            message:
              "Превышено количество попыток. Аккаунт заблокирован. Обратитесь в техническую поддержку.",
          });
        }
      } catch (updateError) {
        console.warn(
          "⚠️ Не удалось зафиксировать неудачную попытку:",
          updateError.message
        );
      }

      const remainingAttempts = 3 - (attemptCount + 1);

      let message = "Неверное кодовое слово";
      if (remainingAttempts > 0) {
        message += `. Осталось попыток: ${remainingAttempts}`;
      }

      return res.status(400).json({
        success: false,
        message: message,
        field: "secretWord",
      });
    }

    // 12. Если кодовое слово ВЕРНО - удаляем все попытки
    console.log(`✅ Кодовое слово верно для ${normalizedEmail}`);

    try {
      if (attemptsRecordId) {
        await query("DELETE FROM password_reset_attempts WHERE id = ?", [
          attemptsRecordId,
        ]);
        console.log(`🔄 Все неудачные попытки удалены для ${normalizedEmail}`);
      } else {
        await query("DELETE FROM password_reset_attempts WHERE email = ?", [
          normalizedEmail,
        ]);
        console.log(
          `🔄 Все неудачные попытки удалены по email: ${normalizedEmail}`
        );
      }
    } catch (deleteError) {
      console.warn("⚠️ Не удалось удалить попытки:", deleteError.message);
    }

    // 13. Создаем токен восстановления и отправляем email
    console.log(`🔑 Создание токена для ${normalizedEmail}`);

    try {
      const resetToken = await passwordResetService.createToken(user.email);
      console.log(`✅ Токен создан: ${resetToken?.substring(0, 20)}...`);

      await emailService.sendPasswordReset({
        login: user.login,
        email: user.email,
        resetToken: resetToken,
      });

      console.log(`📧 Письмо отправлено на: ${user.email}`);
    } catch (serviceError) {
      console.error("❌ Ошибка сервиса восстановления:", serviceError.message);
    }

    // 14. Возвращаем успех
    console.log(`✅ Восстановление пароля успешно для ${normalizedEmail}`);

    res.status(200).json({
      success: true,
      message: SECURITY_SUCCESS_MESSAGE,
    });
  } catch (error) {
    console.error("❌ Ошибка обработки запроса восстановления пароля:", error);
    console.error("📋 Stack trace:", error.stack);

    res.status(500).json({
      success: false,
      message: "Произошла ошибка при обработке запроса. Попробуйте позже.",
    });
  }
});

// Проверка токена восстановления
app.get("/api/auth/validate-reset-token/:token", async (req, res) => {
  try {
    const { token } = req.params;

    if (!token || token.length < 10) {
      return res.status(400).json({
        success: false,
        valid: false,
        message: "Некорректный токен",
      });
    }

    const validation = await passwordResetService.validateToken(token);

    res.json({
      success: true,
      valid: validation.valid,
      email: validation.valid ? validation.email : undefined,
      message: validation.message,
      expiresAt: validation.valid ? validation.expiresAt : undefined,
    });
  } catch (error) {
    console.error("❌ Ошибка проверки токена восстановления:", error);
    res.status(500).json({
      success: false,
      valid: false,
      message: "Ошибка проверки токена",
    });
  }
});

// Установка нового пароля
app.post("/api/auth/reset-password", async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Токен и новый пароль обязательны",
        field: !token ? "token" : "newPassword",
      });
    }

    try {
      validatePassword(newPassword);
    } catch (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError.message,
        field: "newPassword",
      });
    }

    const validation = await passwordResetService.validateToken(token);

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: validation.message || "Токен недействителен или устарел",
      });
    }

    const { email, resetId } = validation;

    const users = await query(
      "SELECT login, password FROM usersdata WHERE email = ? AND logic = 'true'",
      [email]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Пользователь не найден",
      });
    }

    const user = users[0];
    const samePassword = await bcrypt.compare(newPassword, user.password);
    if (samePassword) {
      return res.status(400).json({
        success: false,
        message: "Новый пароль должен отличаться от текущего",
        field: "newPassword",
      });
    }

    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await query(
      "UPDATE usersdata SET password = ? WHERE email = ? AND logic = 'true'",
      [hashedPassword, email]
    );

    await passwordResetService.markAsUsed(resetId);
    await query("DELETE FROM sessionsdata WHERE login = ?", [user.login]);

    try {
      await emailService.sendPasswordChanged({
        login: user.login,
        email: email,
        userIp: req.ip || req.connection.remoteAddress,
        userAgent: req.headers["user-agent"] || "Неизвестное устройство",
      });
      console.log(`📧 Уведомление об изменении пароля отправлено на ${email}`);
    } catch (emailError) {
      console.warn(
        "⚠️ Не удалось отправить email уведомление:",
        emailError.message
      );
    }

    console.log(`✅ Пароль изменен для пользователя: ${user.login}`);

    res.json({
      success: true,
      message:
        "Пароль успешно изменен. Теперь вы можете войти с новым паролем.",
      requireReauth: true,
      emailSent: true,
    });
  } catch (error) {
    console.error("❌ Ошибка установки нового пароля:", error);

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: error.message,
        field: error.field,
      });
    }

    res.status(500).json({
      success: false,
      message: "Ошибка установки нового пароля. Попробуйте позже.",
    });
  }
});

// Проверка JWT
app.post("/api/auth/verify", authenticateToken, (req, res) => {
  res.json({
    success: true,
    user: {
      login: req.user.login,
      sessionId: req.user.sessionId,
    },
  });
});

// Регистрация
app.post("/api/auth/register", async (req, res) => {
  try {
    // Валидация входных данных (используем существующие валидаторы)
    const login = validateLogin(req.body.login);
    const password = validatePassword(req.body.password);
    const email = validateEmail(req.body.email);
    const secretWord = validateSecretWord(req.body.secretWord); // ← НОВОЕ: валидация кодового слова

    // Проверка лимита пользователей на email
    const emailUsage = await query(
      "SELECT COUNT(*) as count FROM usersdata WHERE email = ?",
      [email]
    );

    const userCount = emailUsage[0].count || 0;

    if (userCount >= MAX_USERS_PER_EMAIL) {
      // Проверяем только активных пользователей
      const updatedEmailUsage = await query(
        "SELECT COUNT(*) as count FROM usersdata WHERE email = ? AND logic = 'true'",
        [email]
      );

      const activeUserCount = updatedEmailUsage[0].count || 0;

      if (activeUserCount >= MAX_USERS_PER_EMAIL) {
        return res.status(400).json({
          success: false,
          message: `На этот email уже зарегистрировано максимальное количество пользователей (${MAX_USERS_PER_EMAIL}). Удалите неиспользуемые аккаунты или используйте другой email.`,
          field: "email",
        });
      }
    }

    // Проверка существования логина
    const existingLogin = await query(
      "SELECT login FROM usersdata WHERE login = ?",
      [login]
    );

    if (existingLogin.length > 0) {
      throw new ValidationError("Логин уже занят", "login");
    }

    // Хэширование пароля
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Хэширование кодового слова (используем такую же соль как для пароля)
    const hashedSecretWord = await bcrypt.hash(secretWord, salt);

    // Создание токена подтверждения
    const confirmToken = jwt.sign(
      { login, email, purpose: "registration" },
      JWT_SECRET,
      { expiresIn: "24h" }
    );

    // Вставка данных в БД с кодовым словом
    await query(
      `INSERT INTO usersdata (login, password, email, jwt, logic, secret_word) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [login, hashedPassword, email, confirmToken, "false", hashedSecretWord]
    );

    // Получение статистики по активным пользователям
    const updatedCount = await query(
      "SELECT COUNT(*) as count FROM usersdata WHERE email = ? AND logic = 'true'",
      [email]
    );

    const activeUserCount = updatedCount[0].count || 0;

    // Отправка email подтверждения
    await emailService.sendRegistrationConfirm({
      login: login,
      email: email,
      activeUserCount: activeUserCount,
      maxUsers: MAX_USERS_PER_EMAIL,
      confirmToken: confirmToken,
    });

    // Логирование успешной регистрации
    console.log(`✅ Новый пользователь зарегистрирован: ${login} (${email})`);

    res.json({
      success: true,
      message: `Регистрация успешна. На этот email активно ${activeUserCount}/${MAX_USERS_PER_EMAIL} пользователей. Проверьте email для подтверждения.`,
      stats: {
        currentUsers: activeUserCount,
        maxUsers: MAX_USERS_PER_EMAIL,
        remainingSlots: MAX_USERS_PER_EMAIL - activeUserCount,
      },
    });
  } catch (error) {
    console.error("Registration error:", error);

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: error.message,
        field: error.field,
      });
    }

    // Логирование неизвестной ошибки
    console.error("Неизвестная ошибка при регистрации:", {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });

    res.status(500).json({
      success: false,
      message: "Ошибка при регистрации. Попробуйте позже.",
    });
  }
});

// Подтверждение email
app.get("/api/auth/confirm/:token", async (req, res) => {
  try {
    const { token } = req.params;
    const decoded = jwt.verify(token, JWT_SECRET);

    if (decoded.purpose !== "registration") {
      return res.send(HTML_TEMPLATES.ERROR_INVALID_TOKEN);
    }

    const result = await query(
      "UPDATE usersdata SET logic = 'true' WHERE login = ? AND email = ? AND logic = 'false'",
      [decoded.login, decoded.email]
    );

    if (result.affectedRows === 0) {
      return res.send(HTML_TEMPLATES.ERROR_USER_NOT_FOUND);
    }

    await userTableService.createUserTable(decoded.login);

    res.send(HTML_TEMPLATES.SUCCESS_CONFIRMED);
  } catch (error) {
    if (
      error.name === "JsonWebTokenError" ||
      error.name === "TokenExpiredError"
    ) {
      return res.send(HTML_TEMPLATES.ERROR_EXPIRED_TOKEN);
    }

    console.error("Confirm email error:", error);
    res.send(HTML_TEMPLATES.ERROR_SERVER);
  }
});

// Вход пользователя
app.post("/api/auth/login", async (req, res) => {
  try {
    const login = validateLogin(req.body.login);
    const password = validatePassword(req.body.password);

    // Получаем IP и User-Agent для логирования
    const userIp = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers["user-agent"] || "Unknown";

    // Получаем пользователя ВМЕСТЕ с блокировочными полями
    const users = await query(
      "SELECT *, blocked, blocked_until FROM usersdata WHERE login = ?",
      [login]
    );

    if (users.length === 0) {
      // Логирование НЕУДАЧНОЙ попытки - пользователь не существует
      // await query(
      //   "INSERT INTO login_attempts (login, ip_address, success, user_agent) VALUES (?, ?, ?, ?)",
      //   [login, userIp, 0, userAgent]
      // );

      await new Promise((resolve) => setTimeout(resolve, 1000));
      return res.status(401).json({
        success: false,
        message: "Неверный логин или пароль",
      });
    }

    const user = users[0];

    // ========== ПРОВЕРКА БЛОКИРОВКИ ==========
    if (user.blocked === 1 && user.blocked_until) {
      const now = new Date();
      const blockUntil = new Date(user.blocked_until);

      // Проверяем, не истёк ли срок блокировки
      if (blockUntil > now) {
        // Всё ещё заблокирован
        let message = "Аккаунт заблокирован";

        // Проверяем бессрочную блокировку (2099 год)
        if (blockUntil.getFullYear() >= 2099) {
          message += " бессрочно.";
        } else {
          // Форматируем дату в русском формате (день месяц год)
          const day = blockUntil.getDate();
          const month = blockUntil.toLocaleString("ru-RU", { month: "long" });
          const year = blockUntil.getFullYear();
          message += ` до ${day} ${month} ${year} года.`;
        }

        // Логируем попытку входа заблокированного пользователя
        // В НОВУЮ таблицу blocked_login_attempts
        await query(
          `INSERT INTO blocked_login_attempts 
           (user_login, ip_address, user_agent, blocked_until) 
           VALUES (?, ?, ?, ?)`,
          [login, userIp, userAgent, user.blocked_until]
        );

        // ЧИСТЫЙ ответ без доп полей
        return res.status(403).json({
          success: false,
          message: message,
        });
      } else {
        // Срок блокировки истёк → авторазблокировка
        console.log(`🔄 Авторазблокировка пользователя ${login}, срок истёк`);

        // Разблокируем пользователя
        await query(
          "UPDATE usersdata SET blocked = 0, blocked_until = NULL WHERE login = ?",
          [login]
        );

        // Логируем авторазблокировку
        // 1. В blocked_login_attempts помечаем как auto_unblocked
        await query(
          `UPDATE blocked_login_attempts 
           SET auto_unblocked = TRUE, unblocked_at = NOW()
           WHERE user_login = ? 
           AND auto_unblocked = FALSE
           AND unblocked_at IS NULL
           ORDER BY attempted_at DESC LIMIT 1`,
          [login]
        );

        // 2. И в admin_logs для полного аудита
        // await query(
        //   `INSERT INTO admin_logs (admin_id, action_type, target_type, target_id, details)
        //    VALUES (?, ?, ?, ?, ?)`,
        //   [
        //     0, // system
        //     "auto_unblock",
        //     "user",
        //     login,
        //     JSON.stringify({
        //       original_block_until: user.blocked_until,
        //       reason: "block_expired",
        //       auto_unblocked: true,
        //     }),
        //   ]
        // );

        // Обновляем объект пользователя
        user.blocked = 0;
        user.blocked_until = null;
      }
    }
    // ========== КОНЕЦ ПРОВЕРКИ БЛОКИРОВКИ ==========

    // Проверка активации аккаунта (logic поле)
    if (user.logic !== "true") {
      // Логирование НЕУДАЧНОЙ попытки - аккаунт не активирован
      // await query(
      //   "INSERT INTO login_attempts (login, ip_address, success, user_agent) VALUES (?, ?, ?, ?)",
      //   [login, userIp, 0, userAgent]
      // );

      return res.status(403).json({
        success: false,
        message: "Аккаунт не активирован. Проверьте email для подтверждения.",
      });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      // Логирование НЕУДАЧНОЙ попытки - неверный пароль
      // await query(
      //   "INSERT INTO login_attempts (login, ip_address, success, user_agent) VALUES (?, ?, ?, ?)",
      //   [login, userIp, 0, userAgent]
      // );

      await new Promise((resolve) => setTimeout(resolve, 1000));
      return res.status(401).json({
        success: false,
        message: "Неверный логин или пароль",
      });
    }

    // УСПЕШНЫЙ ВХОД
    // Логирование УСПЕШНОЙ попытки входа
    // await query(
    //   "INSERT INTO login_attempts (login, ip_address, success, user_agent) VALUES (?, ?, ?, ?)",
    //   [login, userIp, 1, userAgent]
    // );

    // Обновляем последний вход
    await query("UPDATE usersdata SET last_login = NOW() WHERE login = ?", [
      login,
    ]);

    // Генерация токена
    const sessionToken = jwt.sign({ login: user.login }, JWT_SECRET_TWO, {
      expiresIn: "2h",
    });

    // Сохраняем сессию
    await query("INSERT INTO sessionsdata (login, jwt_access) VALUES (?, ?)", [
      user.login,
      sessionToken,
    ]);

    // Ограничиваем количество сессий (последние 5)
    await query(
      `DELETE FROM sessionsdata 
       WHERE login = ? AND id NOT IN (
         SELECT id FROM (
           SELECT id FROM sessionsdata 
           WHERE login = ? 
           ORDER BY date DESC 
           LIMIT 5
         ) AS latest
       )`,
      [user.login, user.login]
    );

    // Успешный ответ
    res.json({
      success: true,
      token: sessionToken,
      user: {
        login: user.login,
        email: user.email,
      },
    });
  } catch (error) {
    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: error.message,
        field: error.field,
      });
    }

    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "Ошибка входа. Попробуйте позже.",
    });
  }
});

// Выход
app.post("/api/auth/logout", authenticateToken, async (req, res) => {
  try {
    await query("DELETE FROM sessionsdata WHERE jwt_access = ?", [
      req.user.token,
    ]);

    res.json({
      success: true,
      message: "Выход выполнен успешно",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Ошибка выхода",
    });
  }
});

// Сохранение опроса
app.post("/api/surveys/save", authenticateToken, async (req, res) => {
  try {
    const survey = validateSurvey(req.body.survey);
    const login = req.user.login;

    if (!survey) {
      return res.status(400).json({
        success: false,
        message: "Данные опроса отсутствуют",
      });
    }

    const tableExists = await userTableService.tableExists(login);
    if (!tableExists) {
      await userTableService.createUserTable(login);
    }

    await query(
      `INSERT INTO \`${login}\` (survey, type) VALUES (?, 'survey')`,
      [JSON.stringify(survey)]
    );

    res.json({
      success: true,
      message: "Опрос сохранен успешно",
    });
  } catch (error) {
    console.error("Save survey error:", error);
    res.status(500).json({
      success: false,
      message: "Ошибка сохранения опроса",
    });
  }
});

// Загрузка изображения
app.post(
  "/api/images/upload",
  authenticateToken,
  uploadSingleImage,
  async (req, res) => {
    const login = req.user.login;
    const startTime = Date.now();
    let fileUuid = "";
    try {
      console.log(`📥 Загрузка изображения от ${login}`, {
        filename: req.file?.originalname,
        size: (req.file?.size / 1024 / 1024).toFixed(2) + " MB",
      });

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "Файл не предоставлен или превышен размер (максимум 15MB)",
          field: "file",
        });
      }

      const { filename, comment } = req.body;
      const file = req.file;

      const validated = validateImageBuffer(
        file.buffer,
        filename || file.originalname
      );

      const tableExists = await userTableService.tableExists(login);

      if (!tableExists) {
        await userTableService.createUserTable(login);
      }

      fileUuid = crypto.randomUUID();

      console.log(`🔄 Отправка задачи в воркер: ${fileUuid}`);

      const workerResult = await workerService.addTask({
        buffer: file.buffer,
        originalFilename: validated.filename,
        userDir: path.join(UPLOAD_DIR, login),
        fileUuid,
      });

      const workerTime = Date.now() - startTime;

      if (!workerResult.success) {
        throw new Error(`Worker ошибка: ${workerResult.error}`);
      }

      console.log(
        `✅ Worker обработал за ${workerTime}ms:`,
        workerResult.filename
      );

      await query(
        `INSERT INTO \`${login}\` (
        file_uuid, fileNameOriginIMG, file_path, thumbnail_path, 
        comment, file_size, mime_type, 
        file_hash, width, height, type
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          fileUuid,
          workerResult.originalFilename,
          workerResult.filename,
          workerResult.filename,
          comment || "",
          workerResult.fileSize,
          workerResult.mimeType,
          workerResult.fileHash,
          workerResult.width,
          workerResult.height,
          "image",
        ]
      );

      const totalTime = Date.now() - startTime;

      console.log(`✅ Изображение полностью обработано за ${totalTime}ms`);
      console.log(`📊 Статистика воркеров:`, workerService.getStats());

      res.json({
        success: true,
        message: "Изображение загружено успешно",
        fileUuid,
        filename: workerResult.filename,
        thumbnailUrl: `/uploads/${login}/thumbnails/${workerResult.filename}`,
        originalUrl: `/uploads/${login}/originals/${workerResult.filename}`,
        dimensions: {
          width: workerResult.width,
          height: workerResult.height,
        },
        processingStats: {
          workerTime: `${workerTime}ms`,
          totalTime: `${totalTime}ms`,
          fallbackUsed: workerResult.fallback || false,
        },
      });
    } catch (error) {
      console.error("❌ Ошибка загрузки изображения:", error);

      if (req.file && login) {
        try {
          const userDir = path.join(UPLOAD_DIR, login);
          const filesToDelete = await fs.readdir(userDir).catch(() => []);

          for (const file of filesToDelete) {
            if (file.includes(fileUuid)) {
              await fs.unlink(path.join(userDir, file)).catch(() => {});
            }
          }
        } catch (cleanupError) {
          console.warn("⚠️ Ошибка очистки:", cleanupError.message);
        }
      }

      if (error.name === "ValidationError") {
        return res.status(400).json({
          success: false,
          message: error.message,
          field: error.field,
        });
      }

      res.status(500).json({
        success: false,
        message: "Ошибка загрузки изображения. Попробуйте позже.",
        technical:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }
);

// Поиск диагнозов
app.post("/api/diagnoses/search", async (req, res) => {
  try {
    const { titles } = req.body;

    if (!titles || !Array.isArray(titles) || titles.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Нет данных для поиска",
      });
    }

    const validatedTitles = titles.map((title) => {
      if (typeof title !== "string" || title.length > 100) {
        throw new ValidationError("Некорректный диагноз для поиска", "titles");
      }
      return title.trim();
    });

    const placeholders = validatedTitles.map(() => "?").join(",");
    const sql = `SELECT * FROM alldiagnoses WHERE nameOfDisease IN (${placeholders})`;

    const results = await query(sql, validatedTitles);

    const diagnoses = [];
    const diagnosticsSet = new Set();
    const treatmentsSet = new Set();

    results.forEach((row) => {
      diagnoses.push(row.nameofDiseaseRu);

      if (row.diagnostics) {
        row.diagnostics.split(",").forEach((d) => {
          const trimmed = d.trim();
          if (trimmed) diagnosticsSet.add(trimmed);
        });
      }

      if (row.treatment) {
        row.treatment.split(",").forEach((t) => {
          const trimmed = t.trim();
          if (trimmed) treatmentsSet.add(trimmed);
        });
      }
    });

    res.json({
      success: true,
      titles: [...new Set(diagnoses)],
      diagnostic: Array.from(diagnosticsSet),
      treatment: Array.from(treatmentsSet),
    });
  } catch (error) {
    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    console.error("Search diagnoses error:", error);
    res.status(500).json({
      success: false,
      message: "Ошибка поиска диагнозов",
    });
  }
});

// Получение опросов с пагинацией
app.post("/api/surveys/paginated", authenticateToken, async (req, res) => {
  try {
    const login = req.user.login;
    const { page = 1, limit = 5 } = req.body;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    if (isNaN(pageNum) || pageNum < 1) {
      return res.status(400).json({
        success: false,
        message: "Некорректный номер страницы",
      });
    }

    if (isNaN(limitNum) || limitNum < 1 || limitNum > 50) {
      return res.status(400).json({
        success: false,
        message: "Некорректный лимит (максимум 50 записей на страницу)",
      });
    }

    const offset = (pageNum - 1) * limitNum;

    const tableExists = await userTableService.tableExists(login);

    if (!tableExists) {
      return res.json({
        success: true,
        surveys: [],
        pagination: {
          currentPage: pageNum,
          totalPages: 0,
          totalItems: 0,
          itemsPerPage: limitNum,
          hasNextPage: false,
          hasPrevPage: false,
        },
      });
    }

    const countResult = await query(
      `SELECT COUNT(*) as total FROM \`${login}\` WHERE survey IS NOT NULL`
    );
    const totalItems = countResult[0].total || 0;
    const totalPages = Math.ceil(totalItems / limitNum);

    const sqlQuery = `
      SELECT id, survey, created_at FROM \`${login}\` 
      WHERE survey IS NOT NULL 
      ORDER BY created_at DESC, id DESC 
      LIMIT ${limitNum} OFFSET ${offset}
    `;

    const surveys = await query(sqlQuery);

    const parsedSurveys = surveys.map((row) => {
      try {
        const surveyData = JSON.parse(row.survey);
        return {
          id: row.id,
          date: row.created_at,
          survey: surveyData,
        };
      } catch {
        return {
          id: row.id,
          date: row.created_at,
          survey: { date: row.created_at },
        };
      }
    });

    res.json({
      success: true,
      surveys: parsedSurveys,
      pagination: {
        currentPage: pageNum,
        totalPages: totalPages,
        totalItems: totalItems,
        itemsPerPage: limitNum,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1,
      },
    });
  } catch (error) {
    console.error("Ошибка получения опросов с пагинацией:", error);

    if (error.code === "ER_NO_SUCH_TABLE") {
      return res.json({
        success: true,
        surveys: [],
        pagination: {
          currentPage: 1,
          totalPages: 0,
          totalItems: 0,
          itemsPerPage: parseInt(req.body.limit) || 5,
          hasNextPage: false,
          hasPrevPage: false,
        },
      });
    }

    res.status(500).json({
      success: false,
      message: "Ошибка получения опросов",
    });
  }
});

// Получение конкретного опроса
app.get("/api/surveys/:id", authenticateToken, async (req, res) => {
  try {
    const login = req.user.login;
    const { id } = req.params;

    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({
        success: false,
        message: "Некорректный ID",
      });
    }

    const sql = `SELECT survey FROM \`${login}\` WHERE id = ? AND survey IS NOT NULL`;
    const results = await query(sql, [parseInt(id)]);

    if (results.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Опрос не найден",
      });
    }

    res.json({
      success: true,
      survey: JSON.parse(results[0].survey),
    });
  } catch (error) {
    console.error("Ошибка получения опроса:", error);

    if (error.code === "ER_NO_SUCH_TABLE") {
      return res.status(404).json({
        success: false,
        message: "Пользователь не найден или у вас нет опросов",
      });
    }

    res.status(500).json({
      success: false,
      message: "Ошибка получения опроса",
    });
  }
});

// Получение оригинального изображения
app.get("/api/images/original/:uuid", authenticateToken, async (req, res) => {
  const login = req.user.login;
  try {
    const { uuid } = req.params;

    if (!uuid) {
      return res.status(400).json({
        success: false,
        message: "Некорректный UUID",
      });
    }

    const sql = `SELECT 
      fileNameOriginIMG, 
      file_path,
      file_uuid,
      id
     FROM \`${login}\` WHERE file_uuid = ? AND fileNameOriginIMG IS NOT NULL`;

    const results = await query(sql, [uuid]);

    if (results.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Изображение не найдено",
      });
    }

    const row = results[0];

    let filename = row.file_path || "";

    if (filename.includes("/") || filename.includes("\\")) {
      filename = path.basename(filename);
    }

    const filePath = path.join(UPLOAD_DIR, login, "originals", filename);

    try {
      await fs.access(filePath);

      return res.json({
        success: true,
        originalUrl: `/uploads/${login}/originals/${filename}`,
        filename: row.fileNameOriginIMG,
        fileUuid: row.file_uuid || uuid,
        id: row.id,
      });
    } catch (fsError) {
      console.error(`❌ Файл не найден на диске: ${filePath}`, fsError);

      try {
        const files = await fs.readdir(
          path.join(UPLOAD_DIR, login, "originals")
        );

        const matchingFile = files.find((file) => file.includes(uuid));

        if (matchingFile) {
          return res.json({
            success: true,
            originalUrl: `/uploads/${login}/originals/${matchingFile}`,
            filename: row.fileNameOriginIMG,
            fileUuid: uuid,
          });
        }
      } catch (readError) {
        console.error("Ошибка чтения директории:", readError);
      }

      res.status(404).json({
        success: false,
        message: "Файл не найден на диске",
      });
    }
  } catch (error) {
    console.error("Ошибка получения оригинального изображения:", error);

    if (error.code === "ER_NO_SUCH_TABLE") {
      return res.status(404).json({
        success: false,
        message: `Таблица пользователя '${login}' не найдена`,
      });
    }

    if (error.code === "ER_PARSE_ERROR") {
      console.error("СИНТАКСИЧЕСКАЯ ОШИБКА SQL! Проверь SQL запрос");
    }

    res.status(500).json({
      success: false,
      message: "Ошибка получения изображения",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// Удаление записи
app.delete("/api/data/:id", authenticateToken, async (req, res) => {
  try {
    const login = req.user.login;
    const { id } = req.params;

    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({
        success: false,
        message: "Некорректный ID",
      });
    }

    const fileInfo = await query(
      `SELECT file_uuid, type FROM \`${login}\` WHERE id = ?`,
      [id]
    );

    if (fileInfo.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Запись не найдена",
      });
    }

    if (fileInfo[0].type === "image" && fileInfo[0].file_uuid) {
      await deleteImageFromDisk(fileInfo[0].file_uuid, login);
    }

    const result = await query(`DELETE FROM \`${login}\` WHERE id = ?`, [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Запись не найдена",
      });
    }

    res.json({
      success: true,
      message: "Запись успешно удалена",
    });
  } catch (error) {
    console.error("Ошибка удаления записи:", error);
    res.status(500).json({
      success: false,
      message: "Ошибка удаления записи",
    });
  }
});

// Получение изображений с пагинацией
app.post("/api/images/paginated", authenticateToken, async (req, res) => {
  try {
    const login = req.user.login;
    const { page = 1, limit = 5 } = req.body;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    if (isNaN(pageNum) || pageNum < 1) {
      return res.status(400).json({
        success: false,
        message: "Некорректный номер страницы",
      });
    }

    if (isNaN(limitNum) || limitNum < 1 || limitNum > 50) {
      return res.status(400).json({
        success: false,
        message: "Некорректный лимит (максимум 50 записей на страницу)",
      });
    }

    const offset = (pageNum - 1) * limitNum;

    const tableExists = await userTableService.tableExists(login);

    if (!tableExists) {
      return res.json({
        success: true,
        images: [],
        pagination: {
          currentPage: pageNum,
          totalPages: 0,
          totalItems: 0,
          itemsPerPage: limitNum,
          hasNextPage: false,
          hasPrevPage: false,
        },
      });
    }

    const countResult = await query(
      `SELECT COUNT(*) as total FROM \`${login}\` WHERE fileNameOriginIMG IS NOT NULL`
    );
    const totalItems = countResult[0].total || 0;
    const totalPages = Math.ceil(totalItems / limitNum);

    const sql = `
      SELECT 
        id, 
        file_uuid,
        fileNameOriginIMG, 
        file_path, 
        thumbnail_path,
        comment, 
        file_size,
        width,
        height,
        created_at 
      FROM \`${login}\` 
      WHERE fileNameOriginIMG IS NOT NULL 
      ORDER BY created_at DESC, id DESC 
      LIMIT ${limitNum} OFFSET ${offset}
    `;

    const connection = await getConnection();
    try {
      const [images] = await connection.execute(sql);

      const parsedImages = images.map((row) => {
        let storedFilename = row.file_path || "";
        let thumbnailFilename = row.thumbnail_path || "";

        if (
          storedFilename &&
          (storedFilename.includes("/") || storedFilename.includes("\\"))
        ) {
          storedFilename = storedFilename.replace(/\\/g, "/");
          storedFilename = path.basename(storedFilename);
        }

        if (
          thumbnailFilename &&
          (thumbnailFilename.includes("/") || thumbnailFilename.includes("\\"))
        ) {
          thumbnailFilename = thumbnailFilename.replace(/\\/g, "/");
          thumbnailFilename = path.basename(thumbnailFilename);
        }

        if (!storedFilename && row.file_uuid && row.fileNameOriginIMG) {
          const extension = path.extname(row.fileNameOriginIMG) || ".jpg";
          const baseName = path.basename(row.fileNameOriginIMG, extension);
          const safeBaseName = baseName.replace(
            /[^a-zA-Z0-9а-яА-ЯёЁ._-]/g,
            "_"
          );
          storedFilename = `${row.file_uuid}_${safeBaseName}${extension}`;
        }

        if (!thumbnailFilename && storedFilename) {
          thumbnailFilename = storedFilename;
        }

        const originalUrl = storedFilename
          ? `/uploads/${login}/originals/${storedFilename}`
          : null;
        const thumbnailUrl = thumbnailFilename
          ? `/uploads/${login}/thumbnails/${thumbnailFilename}`
          : originalUrl;

        return {
          id: row.id,
          fileUuid: row.file_uuid,
          fileName: row.fileNameOriginIMG || "unknown.jpg",
          storedFilename: storedFilename,
          originalUrl: originalUrl,
          thumbnailUrl: thumbnailUrl,
          comment: row.comment || "",
          fileSize: row.file_size,
          dimensions:
            row.width && row.height ? `${row.width}x${row.height}` : null,
          created_at: row.created_at,
          isFileOnDisk: true,
        };
      });

      res.json({
        success: true,
        images: parsedImages,
        pagination: {
          currentPage: pageNum,
          totalPages: totalPages,
          totalItems: totalItems,
          itemsPerPage: limitNum,
          hasNextPage: pageNum < totalPages,
          hasPrevPage: pageNum > 1,
        },
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error("Ошибка получения изображений с пагинацией:", error);

    if (error.code === "ER_NO_SUCH_TABLE") {
      return res.json({
        success: true,
        images: [],
        pagination: {
          currentPage: 1,
          totalPages: 0,
          totalItems: 0,
          itemsPerPage: parseInt(req.body.limit) || 5,
          hasNextPage: false,
          hasPrevPage: false,
        },
        message: "Таблица пользователя не найдена",
      });
    }

    res.status(500).json({
      success: false,
      message: "Ошибка получения изображений",
    });
  }
});

// Получение превью изображения
app.get("/api/images/thumbnail/:uuid", authenticateToken, async (req, res) => {
  try {
    const login = req.user.login;
    const { uuid } = req.params;

    if (!uuid) {
      return res.status(400).json({
        success: false,
        message: "Некорректный UUID",
      });
    }

    const results = await query(
      `SELECT thumbnail_path FROM ?? WHERE file_uuid = ?`,
      [login, uuid]
    );

    if (results.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Превью не найдено",
      });
    }

    const row = results[0];
    const filename = path.basename(row.thumbnail_path);

    return res.json({
      success: true,
      thumbnailUrl: `/uploads/${login}/thumbnails/${filename}`,
    });
  } catch (error) {
    console.error("Ошибка получения превью:", error);
    res.status(500).json({
      success: false,
      message: "Ошибка получения превью",
    });
  }
});

// Получение информации о пользователе
app.get("/api/settings/user-info", authenticateToken, async (req, res) => {
  try {
    const login = req.user.login;

    const userInfo = await query(
      "SELECT login, email FROM usersdata WHERE login = ? AND logic = 'true'",
      [login]
    );

    if (userInfo.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Пользователь не найден",
      });
    }

    res.json({
      success: true,
      user: {
        login: userInfo[0].login,
        email: userInfo[0].email,
      },
    });
  } catch (error) {
    console.error("Ошибка получения информации пользователя:", error);
    res.status(500).json({
      success: false,
      message: "Ошибка получения информации",
    });
  }
});

// Смена пароля с кодовым словом
app.post(
  "/api/settings/change-password",
  authenticateToken,
  async (req, res) => {
    console.log("🔐 Запрос смены пароля с проверкой кодового слова");

    try {
      const { currentPassword, newPassword, secretWord } = req.body;
      console.log(
        "🔐 Secret word из запроса:",
        secretWord ? "присутствует" : "отсутствует"
      );

      const login = req.user.login;
      console.log("👤 Пользователь:", login);

      // 1. Базовая валидация
      if (!currentPassword || !newPassword || !secretWord) {
        return res.status(400).json({
          success: false,
          message: !currentPassword
            ? "Введите текущий пароль"
            : !newPassword
            ? "Введите новый пароль"
            : "Введите кодовое слово",
          field: !currentPassword
            ? "currentPassword"
            : !newPassword
            ? "newPassword"
            : "secretWord",
        });
      }

      if (typeof secretWord !== "string") {
        return res.status(400).json({
          success: false,
          message: "Кодовое слово должно быть текстом",
          field: "secretWord",
        });
      }

      const trimmedSecretWord = secretWord.trim();
      if (trimmedSecretWord === "") {
        return res.status(400).json({
          success: false,
          message: "Введите кодовое слово",
          field: "secretWord",
        });
      }

      // 2. Проверка сложности нового пароля
      try {
        validatePassword(newPassword);
      } catch (validationError) {
        return res.status(400).json({
          success: false,
          message: validationError.message,
          field: "newPassword",
        });
      }

      // 3. Задержка для предотвращения timing-атак
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // 4. Получаем данные пользователя
      console.log(`🔍 Поиск пользователя: ${login}`);
      const user = await query(
        "SELECT login, email, password, secret_word, blocked FROM usersdata WHERE login = ? AND logic = 'true'",
        [login]
      );

      if (!user || user.length === 0) {
        console.log(`❌ Пользователь не найден: ${login}`);
        return res.status(404).json({
          success: false,
          message: "Пользователь не найден",
        });
      }

      const userData = user[0];
      const userEmail = userData.email;
      console.log("✅ Пользователь найден:", {
        login: userData.login,
        email: userEmail,
        hasSecretWord: !!userData.secret_word,
        blocked: userData.blocked,
      });

      // 5. Проверяем, не заблокирован ли пользователь
      if (userData.blocked === 1) {
        console.log(`⛔ Заблокированный пользователь: ${login}`);
        return res.status(403).json({
          success: false,
          message: "Аккаунт заблокирован. Обратитесь в техническую поддержку.",
        });
      }

      // 6. Получаем количество существующих попыток смены пароля по EMAIL
      let attemptCount = 0;
      let attemptsRecordId = null;

      try {
        const attemptsResult = await query(
          "SELECT id, attempts FROM password_reset_attempts WHERE email = ?",
          [userEmail]
        );

        if (attemptsResult && attemptsResult.length > 0) {
          attemptCount = attemptsResult[0].attempts || 0;
          attemptsRecordId = attemptsResult[0].id;
        }

        console.log(
          `📊 Существующие попытки смены пароля для ${userEmail}: ${attemptCount}`
        );
      } catch (attemptsError) {
        console.error("❌ Ошибка получения попыток:", attemptsError.message);
      }

      // 7. Проверяем лимит (3 НЕУДАЧНЫЕ попытки)
      if (attemptCount >= 3) {
        console.log(
          `🔒 Блокировка пользователя ${login} (3 неудачные попытки смены пароля)`
        );

        try {
          // Блокируем пользователя
          await query(
            `UPDATE usersdata 
             SET blocked = 1, blocked_until = '2099-12-31 23:59:59'
             WHERE login = ? AND logic = 'true'`,
            [login]
          );

          console.log(
            `✅ Пользователь ${login} заблокирован за 3 неудачные попытки`
          );

          // ОТПРАВЛЯЕМ EMAIL О БЛОКИРОВКЕ
          try {
            await emailService.sendAccountBlocked({
              login: userData.login,
              email: userEmail,
              reason: "Превышено количество попыток смены пароля",
              supportUrl: config.SUPPORT_URL,
              ipAddress: req.ip || "unknown",
              userAgent: req.headers["user-agent"] || "",
            });
            console.log(`📧 Письмо о блокировке отправлено на: ${userEmail}`);
          } catch (emailError) {
            console.error(
              "❌ Ошибка отправки email о блокировке:",
              emailError.message
            );
          }
        } catch (blockError) {
          console.error("❌ Ошибка блокировки:", blockError.message);
        }

        return res.status(401).json({
          success: false,
          message:
            "Превышено количество попыток. Аккаунт заблокирован. Обратитесь в техническую поддержку.",
        });
      }

      // 8. Проверяем наличие кодового слова в БД
      if (!userData.secret_word || userData.secret_word.trim() === "") {
        console.log(
          `❌ Кодовое слово не установлено для пользователя: ${login}`
        );

        // Фиксируем попытку по EMAIL
        try {
          if (attemptsRecordId) {
            await query(
              "UPDATE password_reset_attempts SET attempts = attempts + 1, last_attempt = NOW() WHERE id = ?",
              [attemptsRecordId]
            );
          } else {
            await query(
              `INSERT INTO password_reset_attempts (email, attempts, last_attempt, ip_address, user_agent)
               VALUES (?, 1, NOW(), ?, ?)`,
              [userEmail, req.ip || "unknown", req.headers["user-agent"] || ""]
            );
          }
        } catch (updateError) {
          console.warn(
            "⚠️ Не удалось зафиксировать попытку:",
            updateError.message
          );
        }

        return res.status(400).json({
          success: false,
          message:
            "Для вашего аккаунта не установлено кодовое слово. Обратитесь в техническую поддержку.",
          field: "secretWord",
        });
      }

      // 9. Проверяем кодовое слово
      console.log(`🔐 Проверка кодового слова для ${login}`);
      const isValidSecretWord = await bcrypt.compare(
        trimmedSecretWord,
        userData.secret_word
      );

      console.log(
        `✅ Результат сравнения: ${isValidSecretWord ? "ВЕРНО" : "НЕВЕРНО"}`
      );

      if (!isValidSecretWord) {
        console.log(`❌ Неверное кодовое слово для ${login}`);

        // ФИКСИРУЕМ НЕУДАЧНУЮ ПОПЫТКУ по EMAIL
        try {
          let newAttemptCount = attemptCount + 1;

          if (attemptsRecordId) {
            await query(
              "UPDATE password_reset_attempts SET attempts = attempts + 1, last_attempt = NOW() WHERE id = ?",
              [attemptsRecordId]
            );
          } else {
            await query(
              `INSERT INTO password_reset_attempts (email, attempts, last_attempt, ip_address, user_agent)
               VALUES (?, 1, NOW(), ?, ?)`,
              [userEmail, req.ip || "unknown", req.headers["user-agent"] || ""]
            );
            newAttemptCount = 1;
          }

          console.log(
            `📈 Неудачная попытка зафиксирована: ${newAttemptCount}/3 (неверное кодовое слово)`
          );

          // Проверяем, не достигли ли лимита
          if (newAttemptCount >= 3) {
            console.log(`🔒 Достигнут лимит неудачных попыток - блокировка`);

            try {
              // Блокируем пользователя
              await query(
                `UPDATE usersdata 
                 SET blocked = 1, blocked_until = '2099-12-31 23:59:59'
                 WHERE login = ? AND logic = 'true'`,
                [login]
              );

              console.log(`✅ Аккаунт ${login} заблокирован`);

              // ОТПРАВЛЯЕМ EMAIL О БЛОКИРОВКЕ
              try {
                await emailService.sendAccountBlocked({
                  login: userData.login,
                  email: userEmail,
                  reason: "3 неудачные попытки смены пароля",
                  supportUrl: config.SUPPORT_URL,
                  ipAddress: req.ip || "unknown",
                  userAgent: req.headers["user-agent"] || "",
                });
                console.log(
                  `📧 Письмо о блокировке отправлено на: ${userEmail}`
                );
              } catch (emailError) {
                console.error(
                  "❌ Ошибка отправки email о блокировке:",
                  emailError.message
                );
              }
            } catch (blockError) {
              console.error("❌ Ошибка при блокировке:", blockError.message);
            }

            return res.status(401).json({
              success: false,
              message:
                "Превышено количество попыток. Аккаунт заблокирован. Обратитесь в техническую поддержку.",
            });
          }
        } catch (updateError) {
          console.warn(
            "⚠️ Не удалось зафиксировать неудачную попытку:",
            updateError.message
          );
        }

        const remainingAttempts = 3 - (attemptCount + 1);
        let message = "Неверное кодовое слово";
        if (remainingAttempts > 0) {
          message += `. Осталось попыток: ${remainingAttempts}`;
        }

        return res.status(400).json({
          success: false,
          message: message,
          field: "secretWord",
        });
      }

      // 10. Если кодовое слово ВЕРНО - удаляем все попытки по EMAIL
      console.log(`✅ Кодовое слово верно для ${login}`);
      try {
        await query("DELETE FROM password_reset_attempts WHERE email = ?", [
          userEmail,
        ]);
        console.log(`🔄 Все неудачные попытки удалены для ${userEmail}`);
      } catch (deleteError) {
        console.warn("⚠️ Не удалось удалить попытки:", deleteError.message);
      }

      // 11. Проверяем текущий пароль
      console.log(`🔑 Проверка текущего пароля для ${login}`);
      const validPassword = await bcrypt.compare(
        currentPassword,
        userData.password
      );

      if (!validPassword) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        console.log(`❌ Неверный текущий пароль для ${login}`);

        return res.status(400).json({
          success: false,
          message: "Неверный текущий пароль",
          field: "currentPassword",
        });
      }

      // 12. Проверяем, что новый пароль отличается от текущего
      const samePassword = await bcrypt.compare(newPassword, userData.password);
      if (samePassword) {
        console.log(`⚠️ Новый пароль совпадает с текущим для ${login}`);
        return res.status(400).json({
          success: false,
          message: "Новый пароль должен отличаться от текущего",
          field: "newPassword",
        });
      }

      // 13. Хэшируем новый пароль
      const salt = await bcrypt.genSalt(12);
      const hashedPassword = await bcrypt.hash(newPassword, salt);

      // 14. Обновляем пароль в базе
      await query(
        "UPDATE usersdata SET password = ? WHERE login = ? AND logic = 'true'",
        [hashedPassword, login]
      );
      console.log(`✅ Пароль обновлен для пользователя: ${login}`);

      // 15. Удаляем все сессии пользователя
      await query("DELETE FROM sessionsdata WHERE login = ?", [login]);
      console.log(`🗑️ Удалены все сессии пользователя: ${login}`);

      // 16. Отправляем email уведомление
      try {
        await emailService.sendPasswordChanged({
          login: login,
          email: userEmail,
          userIp: req.ip || req.connection.remoteAddress,
          userAgent: req.headers["user-agent"] || "Неизвестное устройство",
        });

        console.log(`📧 Уведомление о смене пароля отправлено на ${userEmail}`);
      } catch (emailError) {
        console.error(
          "❌ Ошибка отправки email уведомления:",
          emailError.message
        );
      }

      // 17. Возвращаем успех
      console.log(`✅ Смена пароля успешно завершена для ${login}`);

      res.json({
        success: true,
        message: "Пароль успешно изменен",
        requireReauth: true,
        emailSent: true,
      });
    } catch (error) {
      console.error("❌ Ошибка смены пароля:", error);
      console.error("📋 Stack trace:", error.stack);

      if (error.name === "ValidationError") {
        return res.status(400).json({
          success: false,
          message: error.message,
          field: error.field,
        });
      }

      res.status(500).json({
        success: false,
        message: "Ошибка смены пароля",
      });
    }
  }
);

// Удаление аккаунта
app.delete(
  "/api/settings/delete-account",
  authenticateToken,
  async (req, res) => {
    const connection = await getConnection();

    try {
      const login = req.user.login;

      console.log(`🗑️ Начало удаления аккаунта: ${login}`);

      await connection.beginTransaction();

      try {
        await connection.execute(`DROP TABLE IF EXISTS \`${login}\``);
        console.log(`✅ Таблица пользователя ${login} удалена`);
      } catch (tableError) {
        console.warn(
          `⚠️ Таблица пользователя ${login} не найдена:`,
          tableError.message
        );
      }

      const sessionResult = await connection.execute(
        "DELETE FROM sessionsdata WHERE login = ?",
        [login]
      );
      console.log(`✅ Удалено сессий: ${sessionResult[0].affectedRows}`);

      const userResult = await connection.execute(
        "DELETE FROM usersdata WHERE login = ? AND logic = 'true'",
        [login]
      );

      if (userResult[0].affectedRows === 0) {
        throw new Error("Пользователь не найден в usersdata");
      }
      console.log(`✅ Пользователь ${login} удален из usersdata`);

      const userDir = path.join(UPLOAD_DIR, login);
      try {
        await fs.access(userDir);
        await fs.rm(userDir, { recursive: true, force: true });
        console.log(`✅ Директория пользователя удалена: ${userDir}`);
      } catch (fsError) {
        console.warn(
          `⚠️ Директория пользователя не найдена: ${fsError.message}`
        );
      }

      await connection.commit();

      console.log(`✅ Аккаунт ${login} полностью удален`);

      res.json({
        success: true,
        message: "Аккаунт успешно удален",
      });
    } catch (error) {
      await connection.rollback();

      console.error("❌ Ошибка удаления аккаунта:", error);

      res.status(500).json({
        success: false,
        message: "Ошибка удаления аккаунта",
        details:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    } finally {
      connection.release();
    }
  }
);

// ==================== АДМИН API ====================
app.use("/api/admin", adminRoutes);

// =====================ТЕХПОДДЕРЖКА API ====================
app.use("/api/support", supportRoutes);

// ==================== ОБРАБОТКА ОШИБОК ====================
app.use((err, req, res, next) => {
  console.error("Global error handler:", err);

  if (err.name === "ValidationError") {
    return res.status(400).json({
      success: false,
      message: err.message,
      field: err.field,
    });
  }

  if (err.name === "JsonWebTokenError") {
    return res.status(401).json({
      success: false,
      message: "Ошибка аутентификации",
    });
  }

  res.status(500).json({
    success: false,
    message: "Внутренняя ошибка сервера",
  });
});

// ==================== ВСЕ ОСТАЛЬНЫЕ ЗАПРОСЫ → REACT ====================
app.get("/admin*", (req, res) => {
  res.sendFile(path.join(adminBuildPath, "index.html"));
});

app.get("*", (req, res) => {
  res.sendFile(path.join(buildPath, "index.html"));
});

// ==================== ИНИЦИАЛИЗАЦИЯ И ЗАПУСК СЕРВЕРА ====================
async function initializeServer() {
  try {
    await ensureUploadDirs();

    await emailService.initialize();

    await workerService.initWorkers();

    app.listen(PORT, () => {
      console.log(`🚀 Сервер запущен на порту ${PORT}`);
      console.log(`⏰ Текущее время сервера: ${new Date().toLocaleString()}`);

      startCleanupSchedule();
    });
  } catch (error) {
    console.error("Ошибка инициализации:", error);
    process.exit(1);
  }
}

// ==================== GRACEFUL SHUTDOWN HANDLERS ====================
process.on("SIGTERM", async () => {
  console.log("🛑 Получен SIGTERM, завершаю работу...");
  await workerService.shutdown();
  await emailService.close();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("🛑 Получен SIGINT, завершаю работу...");
  await workerService.shutdown();
  await emailService.close();
  process.exit(0);
});

process.on("uncaughtException", async (error) => {
  console.error("💥 Необработанное исключение:", error);
  await workerService.shutdown();
  await emailService.close();
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("💥 Необработанный промис:", reason);
});

initializeServer();
