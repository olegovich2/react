const express = require("express");
const path = require("path");
const cors = require("cors");
const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const sharp = require("sharp");
const nodemailer = require("nodemailer");
const validator = require("validator"); // Для профессиональной валидации
const cron = require("node-cron"); // Для периодических задач
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;

// ==================== КОНФИГУРАЦИЯ ====================
const poolConfig = {
  connectionLimit: 10,
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "M3x6_rx8rx7",
  port: process.env.DB_PORT || 3306,
  database: process.env.DB_DATABASE || "diagnoses",
};

const JWT_SECRET = process.env.JWT_SECRET || "registration-secret-key";
const JWT_SECRET_TWO = process.env.JWT_SECRET_TWO || "session-secret-key";
const MAX_USERS_PER_EMAIL = 4; // Максимум 4 пользователя на один email

// Email transporter
const transporter = nodemailer.createTransport({
  service: "Gmail",
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER || "trmailforupfile@gmail.com",
    pass: process.env.EMAIL_PASS || "xbhu rhhb eysz emtc",
  },
});

// ==================== БАЗА ДАННЫХ ====================
const pool = mysql.createPool(poolConfig);

async function getConnection() {
  return await pool.getConnection();
}

async function query(sql, params = []) {
  const connection = await getConnection();
  try {
    const [results] = await connection.execute(sql, params);
    return results;
  } finally {
    connection.release();
  }
}

// ==================== ФУНКЦИИ ОЧИСТКИ ====================

/**
 * Очистка неактивированных аккаунтов старше 24 часов
 */
async function cleanupExpiredRegistrations() {
  try {
    console.log("🧹 Запуск очистки неактивированных аккаунтов...");

    const users = await query(
      "SELECT login, email, jwt FROM usersdata WHERE logic = 'false'"
    );

    let deletedCount = 0;

    for (const user of users) {
      try {
        // Проверяем, истек ли токен регистрации
        jwt.verify(user.jwt, JWT_SECRET);
      } catch (tokenError) {
        // Токен истек - удаляем пользователя
        await query(
          "DELETE FROM usersdata WHERE login = ? AND logic = 'false'",
          [user.login]
        );
        deletedCount++;
        console.log(
          `🗑️ Удален неактивированный аккаунт: ${user.login} (email: ${user.email})`
        );
      }
    }

    if (deletedCount > 0) {
      console.log(`✅ Очистка завершена. Удалено аккаунтов: ${deletedCount}`);
    } else {
      console.log("✅ Нет неактивированных аккаунтов для удаления.");
    }

    return deletedCount;
  } catch (error) {
    console.error("❌ Ошибка при очистке неактивированных аккаунтов:", error);
    return 0;
  }
}

/**
 * Очистка истекших сессий - теперь работает с колонкой date
 */
async function cleanupExpiredSessions() {
  try {
    console.log("🧹 Запуск очистки истекших сессий...");

    // Получаем все сессии
    const sessions = await query(
      "SELECT id, login, jwt_access, date FROM sessionsdata"
    );

    let deletedCount = 0;

    // Проверяем каждую сессию на истекший токен
    for (const session of sessions) {
      try {
        // Проверяем, истек ли сессионный токен
        jwt.verify(session.jwt_access, JWT_SECRET_TWO);
      } catch (tokenError) {
        // Токен истек - удаляем сессию
        await query("DELETE FROM sessionsdata WHERE id = ?", [session.id]);
        deletedCount++;
        console.log(
          `🗑️ Удалена истекшая сессия: ${session.login} (ID: ${session.id})`
        );
      }
    }

    // Дополнительно: удаляем сессии старше 2 часов (на всякий случай)
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const result = await query("DELETE FROM sessionsdata WHERE date < ?", [
      twoHoursAgo,
    ]);

    if (result.affectedRows > 0) {
      deletedCount += result.affectedRows;
      console.log(
        `🗑️ Дополнительно удалено сессий старше 2 часов: ${result.affectedRows}`
      );
    }

    if (deletedCount > 0) {
      console.log(
        `✅ Очистка сессий завершена. Всего удалено: ${deletedCount}`
      );
    } else {
      console.log("✅ Нет истекших сессий для удаления.");
    }

    return deletedCount;
  } catch (error) {
    console.error("❌ Ошибка при очистке сессий:", error);
    return 0;
  }
}

/**
 * Запуск периодической очистки (очистка сессий с 2 до 3 ночи)
 */
function startCleanupSchedule() {
  // 📅 Расписание очистки:
  // 1. Неактивированные аккаунты - каждый день в 3:00
  // 2. Истекшие сессии - каждый час с 2:00 до 3:00 ночи

  // Очистка неактивированных аккаунтов в 3:00 каждые сутки
  cron.schedule("0 3 * * *", async () => {
    console.log("⏰ [03:00] Запуск очистки неактивированных аккаунтов...");
    await cleanupExpiredRegistrations();
    console.log("✅ Очистка неактивированных аккаунтов завершена.");
  });

  // Очистка сессий с 2:00 до 3:00 ночи каждый час
  cron.schedule("0 2 * * *", async () => {
    console.log("⏰ [02:00] Запуск ночной очистки сессий...");
    await cleanupExpiredSessions();
    console.log("✅ Ночная очистка сессий завершена.");
  });

  // Дополнительная очистка сессий в 2:30 на всякий случай
  cron.schedule("30 2 * * *", async () => {
    console.log("⏰ [02:30] Запуск дополнительной очистки сессий...");
    await cleanupExpiredSessions();
    console.log("✅ Дополнительная очистка сессий завершена.");
  });

  // Также запускаем при старте сервера (один раз)
  setTimeout(async () => {
    console.log("🚀 Запуск начальной очистки при старте сервера...");
    await cleanupExpiredRegistrations();
    await cleanupExpiredSessions();
    console.log("✅ Начальная очистка завершена.");
  }, 15000); // Через 15 секунд после старта

  console.log("📅 Расписание очистки активировано:");
  console.log("   • Неактивированные аккаунты: каждый день в 03:00");
  console.log("   • Истекшие сессии: каждый день с 02:00 до 03:00");
}

// ==================== ВАЛИДАЦИЯ (НА СЕРВЕРЕ!) ====================

const ValidationError = class extends Error {
  constructor(message, field) {
    super(message);
    this.name = "ValidationError";
    this.field = field;
  }
};

/**
 * Валидация логина на сервере
 */
function validateLogin(login) {
  if (!login || login.trim().length === 0) {
    throw new ValidationError("Логин обязателен", "login");
  }

  if (login.length < 4) {
    throw new ValidationError("Логин должен быть не менее 4 символов", "login");
  }

  if (login.length > 20) {
    throw new ValidationError(
      "Логин должен быть не более 20 символов",
      "login"
    );
  }

  // Проверка на опасные символы
  const dangerousChars = new RegExp("[<>/\\\\&'\"]");
  if (dangerousChars.test(login)) {
    throw new ValidationError("Логин содержит недопустимые символы", "login");
  }

  // Проверка на SQL инъекции
  const sqlKeywords = /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|EXEC)\b)/i;
  if (sqlKeywords.test(login)) {
    throw new ValidationError("Логин содержит недопустимые слова", "login");
  }

  return login.trim();
}

/**
 * Валидация пароля на сервере
 */
function validatePassword(password) {
  if (!password || password.length === 0) {
    throw new ValidationError("Пароль обязателен", "password");
  }

  if (password.length < 6) {
    throw new ValidationError(
      "Пароль должен быть не менее 6 символов",
      "password"
    );
  }

  if (password.length > 50) {
    throw new ValidationError(
      "Пароль должен быть не более 50 символов",
      "password"
    );
  }

  // Проверка сложности
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);

  if (!hasUpperCase || !hasLowerCase || !hasNumbers) {
    throw new ValidationError(
      "Пароль должен содержать заглавные, строчные буквы и цифры",
      "password"
    );
  }

  // Проверка на кириллицу
  const cyrillic = /[а-яА-ЯёЁ]/;
  if (cyrillic.test(password)) {
    throw new ValidationError(
      "Пароль не должен содержать кириллицу",
      "password"
    );
  }

  return password;
}

/**
 * Валидация email на сервере
 */
function validateEmail(email) {
  if (!email || email.trim().length === 0) {
    throw new ValidationError("Email обязателен", "email");
  }

  // Используем профессиональную библиотеку validator
  if (!validator.isEmail(email)) {
    throw new ValidationError("Некорректный формат email", "email");
  }

  // Проверка на disposable email
  const disposableDomains = [
    "tempmail",
    "throwaway",
    "guerrillamail",
    "mailinator",
    "yopmail",
    "trashmail",
    "fakeinbox",
    "10minutemail",
  ];

  const domain = email.split("@")[1];
  if (disposableDomains.some((d) => domain.includes(d))) {
    throw new ValidationError("Временные email не поддерживаются", "email");
  }

  return email.trim().toLowerCase();
}

/**
 * Валидация данных опроса
 */
function validateSurvey(survey) {
  if (!survey || typeof survey !== "object") {
    throw new ValidationError("Некорректные данные опроса", "survey");
  }

  // Проверка на чрезмерно большой размер
  const surveyStr = JSON.stringify(survey);
  if (surveyStr.length > 100000) {
    // 100KB максимум
    throw new ValidationError("Данные опроса слишком большие", "survey");
  }

  return survey;
}

/**
 * Валидация изображения (Base64)
 */
function validateImageBase64(base64Data, filename) {
  if (!base64Data || typeof base64Data !== "string") {
    throw new ValidationError("Некорректные данные изображения", "file");
  }

  if (!filename || filename.length === 0) {
    throw new ValidationError("Имя файла обязательно", "filename");
  }

  // Проверка размера (максимум 10MB в Base64)
  if (base64Data.length > 15 * 1024 * 1024) {
    throw new ValidationError("Файл слишком большой (максимум 10MB)", "file");
  }

  // Проверка формата Base64
  const base64Regex = /^[A-Za-z0-9+/]+={0,2}$/;
  if (!base64Regex.test(base64Data.replace(/\s/g, ""))) {
    throw new ValidationError("Некорректный формат Base64", "file");
  }

  // Проверка расширения файла
  const allowedExtensions = [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".tiff"];
  if (!allowedExtensions.some((ext) => filename.toLowerCase().endsWith(ext))) {
    throw new ValidationError(
      `Недопустимый формат файла. Разрешенные форматы: ${allowedExtensions.join(
        ", "
      )}`,
      "filename"
    );
  }

  return { base64Data, filename };
}

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

// Статика React
const buildPath = path.join(__dirname, "..", "build");
app.use(express.static(buildPath));

// ==================== АУТЕНТИФИКАЦИЯ ====================
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Токен отсутствует или имеет неверный формат",
      });
    }

    const token = authHeader.split(" ")[1];

    // Верификация токена
    const decoded = jwt.verify(token, JWT_SECRET_TWO);

    // Проверка сессии в БД (используем колонку date)
    const session = await query(
      "SELECT * FROM sessionsdata WHERE jwt_access = ? AND login = ?",
      [token, decoded.login]
    );

    if (session.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Сессия не найдена или устарела",
      });
    }

    // Проверка срока действия сессии (дополнительно к JWT expiry)
    const sessionAge = Date.now() - new Date(session[0].date).getTime();
    const MAX_SESSION_AGE = 2 * 60 * 60 * 1000; // 2 часа

    if (sessionAge > MAX_SESSION_AGE) {
      await query("DELETE FROM sessionsdata WHERE jwt_access = ?", [token]);
      return res.status(401).json({
        success: false,
        message: "Сессия истекла",
      });
    }

    req.user = {
      login: decoded.login,
      token,
      sessionId: session[0].id,
    };

    next();
  } catch (error) {
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        message: "Неверный токен",
      });
    }
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Токен истек",
      });
    }

    console.error("Auth middleware error:", error);
    res.status(500).json({
      success: false,
      message: "Ошибка аутентификации",
    });
  }
};

// ==================== API ENDPOINTS ====================

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Сервер работает",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  });
});

// 1. Проверка JWT
app.post("/api/auth/verify", authenticateToken, (req, res) => {
  res.json({
    success: true,
    user: {
      login: req.user.login,
      sessionId: req.user.sessionId,
    },
  });
});

// 2. Регистрация с email подтверждением
app.post("/api/auth/register", async (req, res) => {
  try {
    // Валидация на сервере
    const login = validateLogin(req.body.login);
    const password = validatePassword(req.body.password);
    const email = validateEmail(req.body.email);

    // 🔥 Проверяем количество пользователей на email
    const emailUsage = await query(
      "SELECT COUNT(*) as count FROM usersdata WHERE email = ?",
      [email]
    );

    const userCount = emailUsage[0].count || 0;

    // Если уже 4 пользователя на этот email
    if (userCount >= MAX_USERS_PER_EMAIL) {
      // Попробуем очистить неактивированные аккаунты перед отказом
      await cleanupExpiredRegistrations();

      // Проверяем снова после очистки
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

    // Проверяем уникальность логина
    const existingLogin = await query(
      "SELECT login FROM usersdata WHERE login = ?",
      [login]
    );

    if (existingLogin.length > 0) {
      throw new ValidationError("Логин уже занят", "login");
    }

    // Хеширование пароля
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Генерация токена подтверждения
    const confirmToken = jwt.sign(
      { login, email, purpose: "registration" },
      JWT_SECRET,
      { expiresIn: "24h" }
    );

    // Создание пользователя (пока не активен)
    await query(
      `INSERT INTO usersdata (login, password, email, jwt, logic) 
       VALUES (?, ?, ?, ?, ?)`,
      [login, hashedPassword, email, confirmToken, "false"]
    );

    // Обновляем счетчик
    const updatedCount = await query(
      "SELECT COUNT(*) as count FROM usersdata WHERE email = ? AND logic = 'true'",
      [email]
    );

    const activeUserCount = updatedCount[0].count || 0;

    // Отправка email подтверждения
    const confirmUrl = `${
      process.env.CLIENT_URL || "http://localhost:5000"
    }/confirm/${confirmToken}`;

    await transporter.sendMail({
      from: `"QuickDiagnosis" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Подтверждение регистрации в QuickDiagnosis",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Подтверждение регистрации</h2>
          <p>Здравствуйте, ${login}!</p>
          <p>Для завершения регистрации в медицинской системе QuickDiagnosis, пожалуйста, подтвердите ваш email.</p>
          <p><strong>Информация о лимите:</strong> На этот email активно ${activeUserCount} из ${MAX_USERS_PER_EMAIL} возможных пользователей.</p>
          <p style="text-align: center; margin: 30px 0;">
            <a href="${confirmUrl}" 
               style="background-color: #4CAF50; color: white; padding: 12px 24px; 
                      text-decoration: none; border-radius: 4px; font-weight: bold;">
              Подтвердить Email
            </a>
          </p>
          <p>Ссылка действительна в течение 24 часов.</p>
          <p>Если вы не регистрировались в QuickDiagnosis, проигнорируйте это письмо.</p>
          <hr>
          <p style="color: #666; font-size: 12px;">
            Это автоматическое письмо, пожалуйста, не отвечайте на него.
          </p>
        </div>
      `,
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

// 3. Подтверждение email - возвращаем HTML страницу
app.get("/api/auth/confirm/:token", async (req, res) => {
  try {
    const { token } = req.params;

    // Верификация токена
    const decoded = jwt.verify(token, JWT_SECRET);

    if (decoded.purpose !== "registration") {
      return res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Ошибка подтверждения</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
            .error { color: #d32f2f; }
            .success { color: #4caf50; }
            a { color: #2196f3; text-decoration: none; }
            a:hover { text-decoration: underline; }
          </style>
        </head>
        <body>
          <h1 class="error">Ошибка подтверждения</h1>
          <p>Неверный тип токена</p>
          <p><a href="http://localhost:5000/register">Зарегистрироваться снова</a></p>
        </body>
        </html>
      `);
    }

    // Активация пользователя
    const result = await query(
      "UPDATE usersdata SET logic = 'true' WHERE login = ? AND email = ? AND logic = 'false'",
      [decoded.login, decoded.email]
    );

    if (result.affectedRows === 0) {
      return res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Ошибка подтверждения</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
            .error { color: #d32f2f; }
            .success { color: #4caf50; }
            a { color: #2196f3; text-decoration: none; }
            a:hover { text-decoration: underline; }
          </style>
        </head>
        <body>
          <h1 class="error">Ошибка подтверждения</h1>
          <p>Пользователь не найден или уже активирован</p>
          <p><a href="http://localhost:5000/login">Перейти к входу</a></p>
        </body>
        </html>
      `);
    }

    // Создание личной таблицы для пользователя
    await query(
      `CREATE TABLE IF NOT EXISTS \`${decoded.login}\` (
        id INT AUTO_INCREMENT PRIMARY KEY,
        survey LONGTEXT NULL,
        fileNameOriginIMG LONGTEXT NULL,
        originIMG LONGTEXT NULL,
        comment LONGTEXT NULL,
        smallIMG LONGTEXT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    );

    // Возвращаем HTML страницу с успехом и авто-редиректом
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Email подтвержден</title>
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
          .error { color: #d32f2f; }
          .success { color: #4caf50; }
          a { color: #2196f3; text-decoration: none; }
          a:hover { text-decoration: underline; }
          .loader { margin: 20px auto; width: 50px; height: 50px; border: 5px solid #f3f3f3; border-top: 5px solid #4caf50; border-radius: 50%; animation: spin 1s linear infinite; }
          @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        </style>
      </head>
      <body>
        <h1 class="success">Email подтвержден!</h1>
        <p>Теперь вы можете войти в систему</p>
        <div class="loader"></div>
        <p>Автоматический переход через 5 секунд...</p>
        <p><a href="http://localhost:5000/login">Перейти к входу сейчас</a></p>
        <script>
          setTimeout(() => {
            window.location.href = 'http://localhost:5000/login';
          }, 5000);
        </script>
      </body>
      </html>
    `);
  } catch (error) {
    if (
      error.name === "JsonWebTokenError" ||
      error.name === "TokenExpiredError"
    ) {
      return res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Ошибка подтверждения</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
            .error { color: #d32f2f; }
            .success { color: #4caf50; }
            a { color: #2196f3; text-decoration: none; }
            a:hover { text-decoration: underline; }
          </style>
        </head>
        <body>
          <h1 class="error">Ссылка устарела</h1>
          <p>Ссылка подтверждения недействительна или устарела</p>
          <p><a href="http://localhost:5000/register">Зарегистрироваться снова</a></p>
        </body>
        </html>
      `);
    }

    console.error("Confirm email error:", error);
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Ошибка сервера</title>
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
          .error { color: #d32f2f; }
          a { color: #2196f3; text-decoration: none; }
          a:hover { text-decoration: underline; }
        </style>
      </head>
      <body>
        <h1 class="error">Ошибка подтверждения email</h1>
        <p>Попробуйте позже</p>
        <p><a href="http://localhost:5000">Вернуться на главную</a></p>
      </body>
      </html>
    `);
  }
});

// 4. Вход пользователя
app.post("/api/auth/login", async (req, res) => {
  try {
    // Валидация
    const login = validateLogin(req.body.login);
    const password = validatePassword(req.body.password);

    // Поиск пользователя
    const users = await query("SELECT * FROM usersdata WHERE login = ?", [
      login,
    ]);

    if (users.length === 0) {
      // Задержка для защиты от брутфорса
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return res.status(401).json({
        success: false,
        message: "Неверный логин или пароль",
      });
    }

    const user = users[0];

    // Проверка активации
    if (user.logic !== "true") {
      return res.status(403).json({
        success: false,
        message: "Аккаунт не активирован. Проверьте email для подтверждения.",
      });
    }

    // Проверка пароля
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      // Логирование неудачной попытки входа
      await query(
        "INSERT INTO login_attempts (login, ip_address, success) VALUES (?, ?, ?)",
        [login, req.ip, false]
      );

      await new Promise((resolve) => setTimeout(resolve, 1000));
      return res.status(401).json({
        success: false,
        message: "Неверный логин или пароль",
      });
    }

    // Генерация сессионного токена
    const sessionToken = jwt.sign({ login: user.login }, JWT_SECRET_TWO, {
      expiresIn: "2h",
    });

    // Сохранение сессии
    await query("INSERT INTO sessionsdata (login, jwt_access) VALUES (?, ?)", [
      user.login,
      sessionToken,
    ]);

    // Удаление старых сессий (оставляем последние 5) - используем колонку date
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

// 5. Выход
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

// 6. Сохранение опроса
app.post("/api/surveys/save", authenticateToken, async (req, res) => {
  try {
    const survey = validateSurvey(req.body.survey);
    const { login } = req.user;
    // Проверяем что survey есть
    if (!survey) {
      return res.status(400).json({
        success: false,
        message: "Данные опроса отсутствуют",
      });
    }
    // Проверяем существует ли таблица пользователя
    const tableExists = await query(
      "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = ? AND table_name = ?",
      [process.env.DB_DATABASE || "diagnoses", login]
    );

    // Создаем таблицу если не существует
    if (tableExists[0].count === 0) {
      await query(
        `CREATE TABLE IF NOT EXISTS \`${login}\` (
          id INT AUTO_INCREMENT PRIMARY KEY,
          survey LONGTEXT NULL,
          fileNameOriginIMG LONGTEXT NULL,
          originIMG LONGTEXT NULL,
          comment LONGTEXT NULL,
          smallIMG LONGTEXT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
      );
    }

    // Вставляем данные
    await query(`INSERT INTO \`${login}\` (survey) VALUES (?)`, [
      JSON.stringify(survey),
    ]);

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

// 7. Загрузка изображения (исправленная)
app.post("/api/images/upload", authenticateToken, async (req, res) => {
  try {
    console.log("📤 Начало загрузки изображения...");
    const { filename, file, comment } = req.body;
    const { login } = req.user;

    console.log(`👤 Пользователь: ${login}`);
    console.log(
      `📁 Файл: ${filename}, размер данных: ${file ? file.length : 0} символов`
    );

    // Валидация
    const validated = validateImageBase64(file, filename);
    console.log("✅ Валидация пройдена");

    // Создание превью
    console.log("🖼️  Создание превью...");
    const buffer = Buffer.from(validated.base64Data, "base64");
    const resizedBuffer = await sharp(buffer).resize(100, 100).toBuffer();
    const smallImage = resizedBuffer.toString("base64");
    console.log("✅ Превью создано");

    // Сохранение (ИСПРАВЛЕНО - используем обратные кавычки)
    console.log("💾 Сохранение в БД...");
    await query(
      `INSERT INTO \`${login}\` (fileNameOriginIMG, originIMG, comment, smallIMG) 
       VALUES (?, ?, ?, ?)`,
      [validated.filename, validated.base64Data, comment || "", smallImage]
    );

    console.log("✅ Изображение успешно сохранено");

    res.json({
      success: true,
      message: "Изображение загружено успешно",
    });
  } catch (error) {
    console.error("❌ Upload image error:", error);
    console.error("❌ Stack trace:", error.stack);

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: error.message,
        field: error.field,
      });
    }

    // Проверяем специфичные ошибки
    if (error.message && error.message.includes("sharp")) {
      console.error(
        "⚠️  Проблема с библиотекой sharp. Установите: npm install sharp"
      );
      return res.status(500).json({
        success: false,
        message: "Ошибка обработки изображения. Установите библиотеку sharp.",
      });
    }

    if (error.code === "ER_NO_SUCH_TABLE") {
      console.error(
        `⚠️  Таблица пользователя ${req.user?.login} не существует`
      );
      return res.status(404).json({
        success: false,
        message: "Таблица пользователя не найдена",
      });
    }

    res.status(500).json({
      success: false,
      message: "Ошибка загрузки изображения",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// 8. Поиск диагнозов
app.post("/api/diagnoses/search", async (req, res) => {
  try {
    const { titles } = req.body;

    if (!titles || !Array.isArray(titles) || titles.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Нет данных для поиска",
      });
    }

    // Валидация каждого элемента
    const validatedTitles = titles.map((title) => {
      if (typeof title !== "string" || title.length > 100) {
        throw new ValidationError("Некорректный диагноз для поиска", "titles");
      }
      return title.trim();
    });

    const placeholders = validatedTitles.map(() => "?").join(",");
    const sql = `SELECT * FROM alldiagnoses WHERE nameOfDisease IN (${placeholders})`;

    const results = await query(sql, validatedTitles);

    // Форматирование результатов
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

// 9. Получение данных пользователя
app.post("/api/surveys", authenticateToken, async (req, res) => {
  try {
    const { login } = req.user;

    // Используем динамическое имя таблицы в SQL строке
    const [surveys, images] = await Promise.all([
      query(
        `SELECT id, survey FROM \`${login}\` WHERE survey IS NOT NULL ORDER BY id DESC`,
        [] // Без параметров
      ),
      query(
        `SELECT id, fileNameOriginIMG, originIMG, comment, smallIMG FROM \`${login}\` WHERE fileNameOriginIMG IS NOT NULL ORDER BY id DESC`,
        [] // Без параметров
      ),
    ]);

    const parsedSurveys = surveys.map((row) => ({
      id: row.id,
      date: JSON.parse(row.survey).date,
      survey: JSON.parse(row.survey),
    }));

    const parsedImages = images.map((row) => ({
      id: row.id,
      fileName: row.fileNameOriginIMG,
      originIMG: row.originIMG,
      comment: row.comment,
      smallImage: row.smallIMG,
    }));

    res.json({
      success: true,
      surveys: parsedSurveys,
      images: parsedImages,
    });
  } catch (error) {
    console.error("Get surveys error:", error);

    // Проверка на отсутствие таблицы
    if (error.code === "ER_NO_SUCH_TABLE") {
      return res.json({
        success: true,
        surveys: [],
        images: [],
        message: "У вас пока нет сохраненных данных",
      });
    }

    res.status(500).json({
      success: false,
      message: "Ошибка получения данных",
    });
  }
});

// 10. Удаление
app.delete("/api/surveys/:id", authenticateToken, async (req, res) => {
  try {
    const { login } = req.user;
    const { id } = req.params;

    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({
        success: false,
        message: "Некорректный ID",
      });
    }

    // Используем обратные кавычки для имени таблицы
    const result = await query(`DELETE FROM \`${login}\` WHERE id = ?`, [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Запись не найдена",
      });
    }

    res.json({
      success: true,
      message: "Удалено успешно",
    });
  } catch (error) {
    console.error("Delete error:", error);

    // Проверка на отсутствие таблицы
    if (error.code === "ER_NO_SUCH_TABLE") {
      return res.status(404).json({
        success: false,
        message: "Таблица пользователя не найдена",
      });
    }

    res.status(500).json({
      success: false,
      message: "Ошибка удаления",
    });
  }
});

// 11. Получение изображения
app.get("/api/images/:id", authenticateToken, async (req, res) => {
  try {
    const { login } = req.user;
    const { id } = req.params;

    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({
        success: false,
        message: "Некорректный ID",
      });
    }

    const results = await query(
      "SELECT fileNameOriginIMG, originIMG FROM ?? WHERE id = ?",
      [login, id]
    );

    if (results.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Изображение не найдено",
      });
    }

    res.json({
      success: true,
      filename: results[0].fileNameOriginIMG,
      image: results[0].originIMG,
    });
  } catch (error) {
    console.error("Get image error:", error);
    res.status(500).json({
      success: false,
      message: "Ошибка получения изображения",
    });
  }
});

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
app.get("*", (req, res) => {
  res.sendFile(path.join(buildPath, "index.html"));
});

// ==================== ЗАПУСК СЕРВЕРА ====================
app.listen(PORT, () => {
  console.log(`🚀 Secure API Server запущен на порту ${PORT}`);
  console.log(`📁 Обслуживаю React из: ${buildPath}`);
  console.log(`🌐 Откройте: http://localhost:${PORT}`);
  console.log(`🔑 API Base: http://localhost:${PORT}/api`);
  console.log(`🔒 Режим: ${process.env.NODE_ENV || "development"}`);
  console.log(`👥 Максимум пользователей на email: ${MAX_USERS_PER_EMAIL}`);
  console.log(
    `📧 Ссылки подтверждения ведут на: http://localhost:5000/confirm/[token]`
  );

  // Запускаем очистку
  startCleanupSchedule();
});
