const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const router = express.Router();

// Импорты
const { authenticateToken } = require("../../middleware/auth");
const { query } = require("../../services/databaseService");
const {
  ValidationError,
  validateLogin,
  validatePassword,
  validateEmail,
  validateSecretWord,
} = require("../../utils/validators");
const { JWT_SECRET, JWT_SECRET_TWO } = require("../../config");
const emailService = require("../../utils/emailService");
const userTableService = require("../../services/userTableService");
const { HTML_TEMPLATES } = require("../../templates/htmlTemplates");
const config = require("../../config");
const logger = require("../../services/LoggerService"); // Добавляем logger

// Проверка JWT
router.post("/verify", authenticateToken, (req, res) => {
  res.json({
    success: true,
    user: {
      login: req.user.login,
      sessionId: req.user.sessionId,
    },
  });
});

// Вход пользователя
router.post("/login", async (req, res) => {
  const startTime = Date.now();
  const login = req.body.login;

  try {
    logger.info("Начало процесса входа пользователя", {
      type: "auth",
      action: "login_start",
      user_login: login,
      endpoint: req.path,
      method: req.method,
      ip_address: req.ip,
      timestamp: new Date().toISOString(),
    });

    const validatedLogin = validateLogin(login);
    const password = validatePassword(req.body.password);

    // Получаем IP и User-Agent для логирования
    const userIp = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers["user-agent"] || "Unknown";

    // Получаем пользователя ВМЕСТЕ с блокировочными полями
    const users = await query(
      "SELECT *, blocked, blocked_until FROM usersdata WHERE login = ?",
      [validatedLogin]
    );

    if (users.length === 0) {
      await new Promise((resolve) => setTimeout(resolve, 1000));

      logger.warn("Попытка входа с несуществующим логином", {
        type: "auth",
        action: "login_failed",
        status: "user_not_found",
        user_login: validatedLogin,
        ip_address: userIp,
        user_agent: userAgent,
        execution_time_ms: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      });

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
        await query(
          `INSERT INTO blocked_login_attempts 
           (user_login, ip_address, user_agent, blocked_until) 
           VALUES (?, ?, ?, ?)`,
          [validatedLogin, userIp, userAgent, user.blocked_until]
        );

        logger.warn("Попытка входа заблокированного пользователя", {
          type: "auth",
          action: "login_blocked",
          user_login: validatedLogin,
          ip_address: userIp,
          user_agent: userAgent,
          blocked_until: user.blocked_until,
          message: message,
          execution_time_ms: Date.now() - startTime,
          timestamp: new Date().toISOString(),
        });

        return res.status(403).json({
          success: false,
          message: message,
        });
      } else {
        // Срок блокировки истёк → авторазблокировка
        logger.info("Авторазблокировка пользователя", {
          type: "auth",
          action: "auto_unblock",
          user_login: validatedLogin,
          blocked_until: user.blocked_until,
          current_time: now.toISOString(),
          timestamp: new Date().toISOString(),
        });

        // Разблокируем пользователя
        await query(
          "UPDATE usersdata SET blocked = 0, blocked_until = NULL WHERE login = ?",
          [validatedLogin]
        );

        // Логируем авторазблокировку
        await query(
          `UPDATE blocked_login_attempts 
           SET auto_unblocked = TRUE, unblocked_at = NOW()
           WHERE user_login = ? 
           AND auto_unblocked = FALSE
           AND unblocked_at IS NULL
           ORDER BY attempted_at DESC LIMIT 1`,
          [validatedLogin]
        );

        // Обновляем объект пользователя
        user.blocked = 0;
        user.blocked_until = null;
      }
    }
    // ========== КОНЕЦ ПРОВЕРКИ БЛОКИРОВКИ ==========

    // Проверка активации аккаунта (logic поле)
    if (user.logic !== "true") {
      logger.warn("Попытка входа в неактивированный аккаунт", {
        type: "auth",
        action: "login_failed",
        status: "account_not_activated",
        user_login: validatedLogin,
        user_email: user.email,
        execution_time_ms: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      });

      return res.status(403).json({
        success: false,
        message: "Аккаунт не активирован. Проверьте email для подтверждения.",
      });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      await new Promise((resolve) => setTimeout(resolve, 1000));

      logger.warn("Неверный пароль при входе", {
        type: "auth",
        action: "login_failed",
        status: "invalid_password",
        user_login: validatedLogin,
        ip_address: userIp,
        execution_time_ms: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      });

      return res.status(401).json({
        success: false,
        message: "Неверный логин или пароль",
      });
    }

    // УСПЕШНЫЙ ВХОД
    // Обновляем последний вход
    await query("UPDATE usersdata SET last_login = NOW() WHERE login = ?", [
      validatedLogin,
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

    const executionTime = Date.now() - startTime;

    logger.info("Успешный вход пользователя", {
      type: "auth",
      action: "login_success",
      user_login: user.login,
      user_email: user.email,
      ip_address: userIp,
      execution_time_ms: executionTime,
      timestamp: new Date().toISOString(),
    });

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
    logger.error("Ошибка при входе пользователя", {
      type: "auth",
      action: "login_error",
      user_login: login,
      error_name: error.name,
      error_message: error.message,
      stack_trace: error.stack,
      execution_time_ms: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    });

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: error.message,
        field: error.field,
      });
    }

    res.status(500).json({
      success: false,
      message: "Ошибка входа. Попробуйте позже.",
    });
  }
});

// Регистрация
router.post("/register", async (req, res) => {
  const startTime = Date.now();
  const login = req.body.login;

  try {
    logger.info("Начало процесса регистрации пользователя", {
      type: "auth",
      action: "register_start",
      user_login: login,
      user_email: req.body.email,
      endpoint: req.path,
      method: req.method,
      ip_address: req.ip,
      timestamp: new Date().toISOString(),
    });

    const validatedLogin = validateLogin(login);
    const password = validatePassword(req.body.password);
    const email = validateEmail(req.body.email);
    const secretWord = validateSecretWord(req.body.secretWord);

    // Используем конфиг
    const MAX_USERS_PER_EMAIL = config.MAX_USERS_PER_EMAIL;

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
        logger.warn("Превышен лимит пользователей на email", {
          type: "auth",
          action: "register_failed",
          status: "email_limit_exceeded",
          user_login: validatedLogin,
          user_email: email,
          max_users: MAX_USERS_PER_EMAIL,
          active_users: activeUserCount,
          execution_time_ms: Date.now() - startTime,
          timestamp: new Date().toISOString(),
        });

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
      [validatedLogin]
    );

    if (existingLogin.length > 0) {
      logger.warn("Попытка регистрации с существующим логином", {
        type: "auth",
        action: "register_failed",
        status: "login_exists",
        user_login: validatedLogin,
        execution_time_ms: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      });

      throw new ValidationError("Логин уже занят", "login");
    }

    // Хэширование пароля
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Хэширование кодового слова
    const hashedSecretWord = await bcrypt.hash(secretWord, salt);

    // Создание токена подтверждения
    const confirmToken = jwt.sign(
      { login: validatedLogin, email, purpose: "registration" },
      JWT_SECRET,
      { expiresIn: "24h" }
    );

    // Вставка данных в БД с кодовым словом
    await query(
      `INSERT INTO usersdata (login, password, email, jwt, logic, secret_word) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        validatedLogin,
        hashedPassword,
        email,
        confirmToken,
        "false",
        hashedSecretWord,
      ]
    );

    // Получение статистики по активным пользователям
    const updatedCount = await query(
      "SELECT COUNT(*) as count FROM usersdata WHERE email = ? AND logic = 'true'",
      [email]
    );

    const activeUserCount = updatedCount[0].count || 0;

    // Отправка email подтверждения
    await emailService.sendRegistrationConfirm({
      login: validatedLogin,
      email: email,
      activeUserCount: activeUserCount,
      maxUsers: MAX_USERS_PER_EMAIL,
      confirmToken: confirmToken,
    });

    const executionTime = Date.now() - startTime;

    logger.info("Успешная регистрация пользователя", {
      type: "auth",
      action: "register_success",
      user_login: validatedLogin,
      user_email: email,
      active_users: activeUserCount,
      max_users: MAX_USERS_PER_EMAIL,
      execution_time_ms: executionTime,
      timestamp: new Date().toISOString(),
    });

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
    logger.error("Ошибка при регистрации пользователя", {
      type: "auth",
      action: "register_error",
      user_login: login,
      user_email: req.body.email,
      error_name: error.name,
      error_message: error.message,
      stack_trace: error.stack,
      execution_time_ms: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    });

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: error.message,
        field: error.field,
      });
    }

    res.status(500).json({
      success: false,
      message: "Ошибка при регистрации. Попробуйте позже.",
    });
  }
});

// Подтверждение email
router.get("/confirm/:token", async (req, res) => {
  const startTime = Date.now();
  const { token } = req.params;

  try {
    logger.info("Начало подтверждения email", {
      type: "auth",
      action: "confirm_start",
      token_length: token.length,
      endpoint: req.path,
      timestamp: new Date().toISOString(),
    });

    const decoded = jwt.verify(token, JWT_SECRET);

    if (decoded.purpose !== "registration") {
      logger.warn("Неверное назначение токена подтверждения", {
        type: "auth",
        action: "confirm_failed",
        status: "invalid_token_purpose",
        token_purpose: decoded.purpose,
        expected_purpose: "registration",
        user_login: decoded.login,
        execution_time_ms: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      });

      return res.send(HTML_TEMPLATES.ERROR_INVALID_TOKEN);
    }

    const result = await query(
      "UPDATE usersdata SET logic = 'true' WHERE login = ? AND email = ? AND logic = 'false'",
      [decoded.login, decoded.email]
    );

    if (result.affectedRows === 0) {
      logger.warn("Пользователь не найден для подтверждения", {
        type: "auth",
        action: "confirm_failed",
        status: "user_not_found",
        user_login: decoded.login,
        user_email: decoded.email,
        execution_time_ms: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      });

      return res.send(HTML_TEMPLATES.ERROR_USER_NOT_FOUND);
    }

    // Создаем таблицу пользователя
    await userTableService.createUserTable(decoded.login);

    const executionTime = Date.now() - startTime;

    logger.info("Email успешно подтвержден", {
      type: "auth",
      action: "confirm_success",
      user_login: decoded.login,
      user_email: decoded.email,
      execution_time_ms: executionTime,
      timestamp: new Date().toISOString(),
    });

    res.send(HTML_TEMPLATES.SUCCESS_CONFIRMED);
  } catch (error) {
    logger.error("Ошибка подтверждения email", {
      type: "auth",
      action: "confirm_error",
      token_length: token.length,
      error_name: error.name,
      error_message: error.message,
      stack_trace: error.stack,
      execution_time_ms: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    });

    if (
      error.name === "JsonWebTokenError" ||
      error.name === "TokenExpiredError"
    ) {
      return res.send(HTML_TEMPLATES.ERROR_EXPIRED_TOKEN);
    }

    res.send(HTML_TEMPLATES.ERROR_SERVER);
  }
});

// Выход
router.post("/logout", authenticateToken, async (req, res) => {
  const startTime = Date.now();

  try {
    logger.info("Начало процесса выхода пользователя", {
      type: "auth",
      action: "logout_start",
      user_login: req.user.login,
      session_id: req.user.sessionId,
      endpoint: req.path,
      method: req.method,
      timestamp: new Date().toISOString(),
    });

    await query("DELETE FROM sessionsdata WHERE jwt_access = ?", [
      req.user.token,
    ]);

    const executionTime = Date.now() - startTime;

    logger.info("Успешный выход пользователя", {
      type: "auth",
      action: "logout_success",
      user_login: req.user.login,
      execution_time_ms: executionTime,
      timestamp: new Date().toISOString(),
    });

    res.json({
      success: true,
      message: "Выход выполнен успешно",
    });
  } catch (error) {
    logger.error("Ошибка при выходе пользователя", {
      type: "auth",
      action: "logout_error",
      user_login: req.user.login,
      error_message: error.message,
      execution_time_ms: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    });

    res.status(500).json({
      success: false,
      message: "Ошибка выхода",
    });
  }
});

module.exports = router;
