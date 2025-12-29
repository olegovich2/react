// src/routes/auth/authRoutes.js
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
        await query(
          `INSERT INTO blocked_login_attempts 
           (user_login, ip_address, user_agent, blocked_until) 
           VALUES (?, ?, ?, ?)`,
          [login, userIp, userAgent, user.blocked_until]
        );

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
        await query(
          `UPDATE blocked_login_attempts 
           SET auto_unblocked = TRUE, unblocked_at = NOW()
           WHERE user_login = ? 
           AND auto_unblocked = FALSE
           AND unblocked_at IS NULL
           ORDER BY attempted_at DESC LIMIT 1`,
          [login]
        );

        // Обновляем объект пользователя
        user.blocked = 0;
        user.blocked_until = null;
      }
    }
    // ========== КОНЕЦ ПРОВЕРКИ БЛОКИРОВКИ ==========

    // Проверка активации аккаунта (logic поле)
    if (user.logic !== "true") {
      return res.status(403).json({
        success: false,
        message: "Аккаунт не активирован. Проверьте email для подтверждения.",
      });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return res.status(401).json({
        success: false,
        message: "Неверный логин или пароль",
      });
    }

    // УСПЕШНЫЙ ВХОД
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
    console.error("Login error:", error);

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
  try {
    const login = validateLogin(req.body.login);
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

    // Хэширование кодового слова
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

    res.status(500).json({
      success: false,
      message: "Ошибка при регистрации. Попробуйте позже.",
    });
  }
});

// Подтверждение email
router.get("/confirm/:token", async (req, res) => {
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

// Выход
router.post("/logout", authenticateToken, async (req, res) => {
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

module.exports = router;
