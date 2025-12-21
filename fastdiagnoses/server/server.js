const express = require("express");
const path = require("path");
const cors = require("cors");
const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const sharp = require("sharp");
const nodemailer = require("nodemailer");
const validator = require("validator");
const cron = require("node-cron");
const fs = require("fs").promises;
const crypto = require("crypto");
const multer = require("multer"); // ДОБАВЛЕНО
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;

// ==================== КОНФИГУРАЦИЯ MULTER ====================
const upload = multer({
  storage: multer.memoryStorage(), // Храним в памяти перед сохранением на диск
  limits: {
    fileSize: 15 * 1024 * 1024, // 15MB максимум
    files: 1, // Только один файл за раз
  },
  fileFilter: (req, file, cb) => {
    // Валидация MIME-типов
    const allowedMimes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/gif",
      "image/bmp",
      "image/webp",
      "image/tiff",
      "image/svg+xml",
    ];

    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new ValidationError(
          `Недопустимый тип файла: ${file.mimetype}. Разрешены: JPEG, PNG, GIF, BMP, WebP, TIFF, SVG`,
          "file"
        )
      );
    }
  },
});

// ==================== КОНФИГУРАЦИЯ ====================
const poolConfig = {
  connectionLimit: 10,
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 3306,
  database: process.env.DB_DATABASE || "diagnoses",
};

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_SECRET_TWO = process.env.JWT_SECRET_TWO;
const MAX_USERS_PER_EMAIL = 4;

// Пути для файлов
const UPLOAD_DIR = path.join(__dirname, "UploadIMG");
const THUMBNAIL_WIDTH = 300;
const THUMBNAIL_HEIGHT = 300;

const transporter = nodemailer.createTransport({
  service: "Gmail",
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// ==================== УТИЛИТЫ ФАЙЛОВОЙ СИСТЕМЫ ====================
async function ensureUploadDirs() {
  try {
    await fs.access(UPLOAD_DIR);
  } catch {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
  }
}

async function getUserUploadDirs(login) {
  const userDir = path.join(UPLOAD_DIR, login);
  const originalsDir = path.join(userDir, "originals");
  const thumbnailsDir = path.join(userDir, "thumbnails");

  return { userDir, originalsDir, thumbnailsDir };
}

async function ensureUserUploadDirs(login) {
  const { originalsDir, thumbnailsDir } = await getUserUploadDirs(login);

  await fs.mkdir(originalsDir, { recursive: true });
  await fs.mkdir(thumbnailsDir, { recursive: true });

  return { originalsDir, thumbnailsDir };
}

async function saveImageToDisk(base64Data, originalFilename, login) {
  const fileUuid = crypto.randomUUID();
  const { originalsDir, thumbnailsDir } = await ensureUserUploadDirs(login);

  // Генерируем уникальное имя с UUID
  const extension = path.extname(originalFilename).toLowerCase() || ".jpg";
  const baseName = path.basename(originalFilename, extension);

  // Используем UUID в имени файла
  const filename = `${fileUuid}_${baseName}${extension}`;

  // Сохраняем оригинальное изображение
  const originalPath = path.join(originalsDir, filename);
  const buffer = Buffer.from(base64Data, "base64");
  await fs.writeFile(originalPath, buffer);

  // Создаем и сохраняем превью
  const thumbnailPath = path.join(thumbnailsDir, filename);

  try {
    const thumbnailBuffer = await sharp(buffer)
      .resize(THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT, {
        fit: sharp.fit.inside,
        withoutEnlargement: true,
      })
      .jpeg({ quality: 80 })
      .toBuffer();

    await fs.writeFile(thumbnailPath, thumbnailBuffer);
  } catch (error) {
    console.warn(
      "Не удалось создать превью, используем оригинал:",
      error.message
    );
    await fs.copyFile(originalPath, thumbnailPath);
  }

  // Получаем метаданные
  const metadata = await sharp(buffer).metadata();
  const fileStats = await fs.stat(originalPath);

  return {
    fileUuid,
    filename,
    originalFilename,
    fileSize: fileStats.size,
    width: metadata.width,
    height: metadata.height,
    mimeType: `image/${metadata.format || "jpeg"}`,
    fileHash: crypto.createHash("sha256").update(buffer).digest("hex"),
  };
}

async function deleteImageFromDisk(fileUuid, login) {
  try {
    const { originalsDir, thumbnailsDir } = await getUserUploadDirs(login);

    // Ищем файл по UUID (имя файла содержит UUID)
    const files = await fs.readdir(originalsDir);
    const fileToDelete = files.find((f) => f.includes(fileUuid));

    if (fileToDelete) {
      await fs.unlink(path.join(originalsDir, fileToDelete));

      // Пытаемся удалить превью
      try {
        await fs.unlink(path.join(thumbnailsDir, fileToDelete));
      } catch (error) {
        // Если превью нет, это не критично
        console.warn("Не удалось удалить превью:", error.message);
      }

      return true;
    }
    return false;
  } catch (error) {
    console.error("Ошибка удаления файла:", error);
    return false;
  }
}

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
async function cleanupExpiredRegistrations() {
  try {
    const users = await query(
      "SELECT login, email, jwt FROM usersdata WHERE logic = 'false'"
    );

    let deletedCount = 0;

    for (const user of users) {
      try {
        jwt.verify(user.jwt, JWT_SECRET);
      } catch (tokenError) {
        await query(
          "DELETE FROM usersdata WHERE login = ? AND logic = 'false'",
          [user.login]
        );
        deletedCount++;
      }
    }

    return deletedCount;
  } catch (error) {
    console.error("Ошибка при очистке неактивированных аккаунтов:", error);
    return 0;
  }
}

async function cleanupExpiredSessions() {
  try {
    const sessions = await query(
      "SELECT id, login, jwt_access FROM sessionsdata"
    );

    let deletedCount = 0;

    for (const session of sessions) {
      try {
        jwt.verify(session.jwt_access, JWT_SECRET_TWO);
      } catch (tokenError) {
        await query("DELETE FROM sessionsdata WHERE id = ?", [session.id]);
        deletedCount++;
      }
    }

    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const result = await query("DELETE FROM sessionsdata WHERE date < ?", [
      twoHoursAgo,
    ]);

    if (result.affectedRows > 0) {
      deletedCount += result.affectedRows;
    }

    return deletedCount;
  } catch (error) {
    console.error("Ошибка при очистке сессий:", error);
    return 0;
  }
}

function startCleanupSchedule() {
  // 1. Очистка сессий в 02:30 (один раз за ночь)
  cron.schedule("30 2 * * *", async () => {
    console.log("⏰ [02:30] Запуск ночной очистки сессий");

    const startTime = Date.now();
    const deletedCount = await cleanupExpiredSessions();
    const duration = Date.now() - startTime;

    console.log(
      `✅ Очистка сессий завершена за ${duration}ms. Удалено: ${deletedCount}`
    );
  });

  // 2. Очистка неактивированных аккаунтов в 03:00
  cron.schedule("0 3 * * *", async () => {
    console.log("⏰ [03:00] Запуск очистки неактивированных аккаунтов");

    const startTime = Date.now();
    const deletedCount = await cleanupExpiredRegistrations();
    const duration = Date.now() - startTime;

    console.log(
      `✅ Очистка аккаунтов завершена за ${duration}ms. Удалено: ${deletedCount}`
    );
  });

  console.log("📅 Расписание очистки активировано:");
  console.log("   • Истекшие сессии: каждый день в 02:30");
  console.log("   • Неактивированные аккаунты: каждый день в 03:00");
  console.log("   • Время сервера: " + new Date().toString());
}

// ==================== ВАЛИДАЦИЯ ====================
const ValidationError = class extends Error {
  constructor(message, field) {
    super(message);
    this.name = "ValidationError";
    this.field = field;
  }
};

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

  const dangerousChars = new RegExp("[<>/\\\\&'\"]");
  if (dangerousChars.test(login)) {
    throw new ValidationError("Логин содержит недопустимые символы", "login");
  }

  const sqlKeywords = /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|EXEC)\b)/i;
  if (sqlKeywords.test(login)) {
    throw new ValidationError("Логин содержит недопустимые слова", "login");
  }

  return login.trim();
}

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

  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);

  if (!hasUpperCase || !hasLowerCase || !hasNumbers) {
    throw new ValidationError(
      "Пароль должен содержать заглавные, строчные буквы и цифры",
      "password"
    );
  }

  const cyrillic = /[а-яА-ЯёЁ]/;
  if (cyrillic.test(password)) {
    throw new ValidationError(
      "Пароль не должен содержать кириллицу",
      "password"
    );
  }

  return password;
}

function validateEmail(email) {
  if (!email || email.trim().length === 0) {
    throw new ValidationError("Email обязателен", "email");
  }

  if (!validator.isEmail(email)) {
    throw new ValidationError("Некорректный формат email", "email");
  }

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

function validateSurvey(survey) {
  if (!survey || typeof survey !== "object") {
    throw new ValidationError("Некорректные данные опроса", "survey");
  }

  const surveyStr = JSON.stringify(survey);
  if (surveyStr.length > 100000) {
    throw new ValidationError("Данные опроса слишком большие", "survey");
  }

  return survey;
}

// ДОБАВЛЕНА функция для валидации Buffer (для multer)
function validateImageBuffer(buffer, filename) {
  if (!buffer || !Buffer.isBuffer(buffer)) {
    throw new ValidationError("Некорректные данные изображения", "file");
  }

  if (!filename || filename.trim().length === 0) {
    throw new ValidationError("Имя файла обязательно", "filename");
  }

  if (buffer.length > 15 * 1024 * 1024) {
    throw new ValidationError("Файл слишком большой (максимум 15MB)", "file");
  }

  if (buffer.length === 0) {
    throw new ValidationError("Файл пустой", "file");
  }

  const allowedExtensions = [
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".bmp",
    ".tiff",
    ".webp",
    ".svg",
  ];
  const fileExtension = path.extname(filename).toLowerCase();

  if (!allowedExtensions.includes(fileExtension)) {
    throw new ValidationError(
      `Недопустимый формат файла. Разрешенные форматы: ${allowedExtensions.join(
        ", "
      )}`,
      "filename"
    );
  }

  return { buffer, filename };
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

// Обслуживание загруженных изображений
app.use("/uploads", express.static(UPLOAD_DIR));

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
    const decoded = jwt.verify(token, JWT_SECRET_TWO);

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

    const sessionAge = Date.now() - new Date(session[0].date).getTime();
    const MAX_SESSION_AGE = 2 * 60 * 60 * 1000;

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

// ==================== СОЗДАНИЕ ТАБЛИЦЫ ПОЛЬЗОВАТЕЛЯ ====================
async function createUserTable(login) {
  try {
    await query(
      `CREATE TABLE IF NOT EXISTS \`${login}\` (
        id INT AUTO_INCREMENT PRIMARY KEY,
        file_uuid VARCHAR(36) NOT NULL,
        fileNameOriginIMG VARCHAR(255) NOT NULL,
        file_path VARCHAR(500) NOT NULL,
        thumbnail_path VARCHAR(500) NOT NULL,
        comment TEXT,
        file_size BIGINT NOT NULL,
        mime_type VARCHAR(100) NOT NULL,
        file_hash VARCHAR(64) NOT NULL,
        width INT NOT NULL,
        height INT NOT NULL,
        survey LONGTEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        type ENUM('survey', 'image') DEFAULT 'survey',
        UNIQUE KEY idx_file_uuid_unique (file_uuid),
        INDEX idx_filename (fileNameOriginIMG),
        INDEX idx_created_at (created_at DESC),
        INDEX idx_type (type),
        INDEX idx_created_type (created_at, type)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    );

    await ensureUserUploadDirs(login);

    return true;
  } catch (error) {
    console.error(`Ошибка создания таблицы для ${login}:`, error);
    throw error;
  }
}

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
    const login = validateLogin(req.body.login);
    const password = validatePassword(req.body.password);
    const email = validateEmail(req.body.email);

    const emailUsage = await query(
      "SELECT COUNT(*) as count FROM usersdata WHERE email = ?",
      [email]
    );

    const userCount = emailUsage[0].count || 0;

    if (userCount >= MAX_USERS_PER_EMAIL) {
      await cleanupExpiredRegistrations();

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

    const existingLogin = await query(
      "SELECT login FROM usersdata WHERE login = ?",
      [login]
    );

    if (existingLogin.length > 0) {
      throw new ValidationError("Логин уже занят", "login");
    }

    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    const confirmToken = jwt.sign(
      { login, email, purpose: "registration" },
      JWT_SECRET,
      { expiresIn: "24h" }
    );

    await query(
      `INSERT INTO usersdata (login, password, email, jwt, logic) 
       VALUES (?, ?, ?, ?, ?)`,
      [login, hashedPassword, email, confirmToken, "false"]
    );

    const updatedCount = await query(
      "SELECT COUNT(*) as count FROM usersdata WHERE email = ? AND logic = 'true'",
      [email]
    );

    const activeUserCount = updatedCount[0].count || 0;

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

// 3. Подтверждение email
app.get("/api/auth/confirm/:token", async (req, res) => {
  try {
    const { token } = req.params;
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
          <p><a href="${
            process.env.CLIENT_URL || "http://localhost:5000"
          }/register">Зарегистрироваться снова</a></p>
        </body>
        </html>
      `);
    }

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
          <p><a href="${
            process.env.CLIENT_URL || "http://localhost:5000"
          }/login">Перейти к входу</a></p>
        </body>
        </html>
      `);
    }

    await createUserTable(decoded.login);

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
        <p><a href="${
          process.env.CLIENT_URL || "http://localhost:5000"
        }/login">Перейти к входу сейчас</a></p>
        <script>
          setTimeout(() => {
            window.location.href = '${
              process.env.CLIENT_URL || "http://localhost:5000"
            }/login';
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
          <p><a href="${
            process.env.CLIENT_URL || "http://localhost:5000"
          }/register">Зарегистрироваться снова</a></p>
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
        <p><a href="${
          process.env.CLIENT_URL || "http://localhost:5000"
        }">Вернуться на главную</a></p>
      </body>
      </html>
    `);
  }
});

// 4. Вход пользователя
app.post("/api/auth/login", async (req, res) => {
  try {
    const login = validateLogin(req.body.login);
    const password = validatePassword(req.body.password);

    const users = await query("SELECT * FROM usersdata WHERE login = ?", [
      login,
    ]);

    if (users.length === 0) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return res.status(401).json({
        success: false,
        message: "Неверный логин или пароль",
      });
    }

    const user = users[0];

    if (user.logic !== "true") {
      return res.status(403).json({
        success: false,
        message: "Аккаунт не активирован. Проверьте email для подтверждения.",
      });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
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

    const sessionToken = jwt.sign({ login: user.login }, JWT_SECRET_TWO, {
      expiresIn: "2h",
    });

    await query("INSERT INTO sessionsdata (login, jwt_access) VALUES (?, ?)", [
      user.login,
      sessionToken,
    ]);

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
    const login = req.user.login;

    if (!survey) {
      return res.status(400).json({
        success: false,
        message: "Данные опроса отсутствуют",
      });
    }

    // Проверяем существование таблицы
    const tableExists = await query(
      "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = ? AND table_name = ?",
      [process.env.DB_DATABASE || "diagnoses", login]
    );

    if (tableExists[0].count === 0) {
      await createUserTable(login);
    }

    // Сохраняем опрос
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

// 7. Загрузка изображения (ОБНОВЛЕННАЯ версия с Multer)
app.post(
  "/api/images/upload",
  authenticateToken,
  upload.single("image"),
  async (req, res) => {
    const login = req.user.login;

    try {
      console.log(
        `📥 Получен запрос на загрузку изображения от пользователя: ${login}`
      );

      // Проверяем, что файл был загружен через multer
      if (!req.file) {
        console.error("❌ Multer не обработал файл");
        return res.status(400).json({
          success: false,
          message: "Файл не предоставлен или превышен размер (максимум 15MB)",
          field: "file",
        });
      }

      const { filename, comment } = req.body;
      const file = req.file;

      console.log(`📄 Данные файла:`, {
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: (file.size / 1024 / 1024).toFixed(2) + " MB",
        providedFilename: filename,
      });

      // Валидация буфера
      const validated = validateImageBuffer(
        file.buffer,
        filename || file.originalname
      );

      // Проверяем существование таблицы пользователя
      const tableExists = await query(
        "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = ? AND table_name = ?",
        [process.env.DB_DATABASE || "diagnoses", login]
      );

      if (tableExists[0].count === 0) {
        console.log(`📊 Создаем таблицу для пользователя: ${login}`);
        await createUserTable(login);
      }

      // Сохраняем файл на диск и получаем метаданные
      // Конвертируем Buffer в base64 для совместимости с существующей функцией
      const base64Data = file.buffer.toString("base64");
      console.log(`💾 Сохранение файла на диск...`);

      const fileInfo = await saveImageToDisk(
        base64Data,
        validated.filename,
        login
      );

      console.log(
        `✅ Файл сохранен: ${fileInfo.filename} (${fileInfo.fileSize} bytes)`
      );

      // Сохраняем информацию в БД (БЕЗ Base64!)
      await query(
        `INSERT INTO \`${login}\` (
          file_uuid, fileNameOriginIMG, file_path, thumbnail_path, 
          comment, file_size, mime_type, 
          file_hash, width, height, type
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          fileInfo.fileUuid,
          fileInfo.originalFilename,
          fileInfo.filename,
          fileInfo.filename,
          comment || "",
          fileInfo.fileSize,
          fileInfo.mimeType,
          fileInfo.fileHash,
          fileInfo.width,
          fileInfo.height,
          "image",
        ]
      );

      console.log(`💾 Запись добавлена в БД для пользователя: ${login}`);

      res.json({
        success: true,
        message: "Изображение загружено успешно",
        fileUuid: fileInfo.fileUuid,
        filename: fileInfo.filename,
        thumbnailUrl: `/uploads/${login}/thumbnails/${fileInfo.filename}`,
        originalUrl: `/uploads/${login}/originals/${fileInfo.filename}`,
        dimensions: {
          width: fileInfo.width,
          height: fileInfo.height,
        },
        uploadStats: {
          method: "formdata",
          originalSize: file.size,
          processedSize: fileInfo.fileSize,
          compressionRatio:
            file.size > 0
              ? (((file.size - fileInfo.fileSize) / file.size) * 100).toFixed(1)
              : 0,
        },
      });
    } catch (error) {
      console.error("❌ Ошибка загрузки изображения:", error);

      // Удаляем файлы с диска, если они были частично сохранены
      if (req.file && login) {
        try {
          const { originalsDir, thumbnailsDir } = await getUserUploadDirs(
            login
          );
          const tempFilename = `${Date.now()}_${req.file.originalname}`;
          const tempPaths = [
            path.join(originalsDir, tempFilename),
            path.join(thumbnailsDir, tempFilename),
          ];

          for (const filePath of tempPaths) {
            try {
              await fs.unlink(filePath);
            } catch (unlinkError) {
              // Игнорируем ошибки удаления
            }
          }
        } catch (cleanupError) {
          console.warn(
            "⚠️ Не удалось очистить временные файлы:",
            cleanupError.message
          );
        }
      }

      // Обработка конкретных ошибок валидации
      if (error.name === "ValidationError") {
        return res.status(400).json({
          success: false,
          message: error.message,
          field: error.field,
        });
      }

      if (error.message && error.message.includes("sharp")) {
        console.error("🔧 Ошибка Sharp:", error);
        return res.status(500).json({
          success: false,
          message:
            "Ошибка обработки изображения. Пожалуйста, попробуйте другой файл.",
          technical:
            process.env.NODE_ENV === "development" ? error.message : undefined,
        });
      }

      if (error.code === "ER_NO_SUCH_TABLE") {
        return res.status(404).json({
          success: false,
          message: "Таблица пользователя не найдена",
        });
      }

      // Общая ошибка
      res.status(500).json({
        success: false,
        message: "Ошибка загрузки изображения. Попробуйте позже.",
        technical:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  }
);

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

// 9. Получение опросов с пагинацией
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

    const tableExists = await query(
      "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = ? AND table_name = ?",
      [process.env.DB_DATABASE || "diagnoses", login]
    );

    if (tableExists[0].count === 0) {
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

// 10. Получение конкретного опроса (ИСПРАВЛЕННАЯ ВЕРСИЯ)
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

    // ВАЖНО: Используем правильную подготовку запроса
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

    // Обработка специфических ошибок
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

// 11. Получение оригинального изображения (ИСПРАВЛЕННАЯ ВЕРСИЯ)
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

    // Только один параметр - uuid
    const results = await query(sql, [uuid]);

    if (results.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Изображение не найдено",
      });
    }

    const row = results[0];

    // Извлекаем имя файла из пути
    let filename = row.file_path || "";

    // Если путь содержит слеши, берем только имя файла
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

      // Пробуем найти файл по UUID в имени
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

    // Подробная информация об ошибке
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

// 12. Удаление записи
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

    // Сначала получаем информацию о файле
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

    // Если это изображение, удаляем файл с диска
    if (fileInfo[0].type === "image" && fileInfo[0].file_uuid) {
      await deleteImageFromDisk(fileInfo[0].file_uuid, login);
    }

    // Удаляем запись из БД
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

// 13. Получение изображений с пагинацией (ИСПРАВЛЕННАЯ ВЕРСИЯ)
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

    const tableExists = await query(
      "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = ? AND table_name = ?",
      [process.env.DB_DATABASE || "diagnoses", login]
    );

    if (tableExists[0].count === 0) {
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

    // Получаем общее количество изображений
    const countResult = await query(
      `SELECT COUNT(*) as total FROM \`${login}\` WHERE fileNameOriginIMG IS NOT NULL`
    );
    const totalItems = countResult[0].total || 0;
    const totalPages = Math.ceil(totalItems / limitNum);

    // ВАЖНО: НЕ используем подготовленные параметры для LIMIT и OFFSET
    // Вместо этого формируем SQL строку
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

    // Выполняем запрос БЕЗ параметров
    const connection = await getConnection();
    try {
      const [images] = await connection.execute(sql);

      // Обрабатываем изображения
      const parsedImages = images.map((row) => {
        // Извлекаем имя файла из пути
        let storedFilename = row.file_path || "";
        let thumbnailFilename = row.thumbnail_path || "";

        // Если file_path содержит полный путь, извлекаем только имя файла
        if (
          storedFilename &&
          (storedFilename.includes("/") || storedFilename.includes("\\"))
        ) {
          storedFilename = storedFilename.replace(/\\/g, "/");
          storedFilename = path.basename(storedFilename);
        }

        // Если thumbnail_path содержит полный путь
        if (
          thumbnailFilename &&
          (thumbnailFilename.includes("/") || thumbnailFilename.includes("\\"))
        ) {
          thumbnailFilename = thumbnailFilename.replace(/\\/g, "/");
          thumbnailFilename = path.basename(thumbnailFilename);
        }

        // Если имя файла не определено, создаем его из UUID и оригинального имени
        if (!storedFilename && row.file_uuid && row.fileNameOriginIMG) {
          const extension = path.extname(row.fileNameOriginIMG) || ".jpg";
          const baseName = path.basename(row.fileNameOriginIMG, extension);
          const safeBaseName = baseName.replace(
            /[^a-zA-Z0-9а-яА-ЯёЁ._-]/g,
            "_"
          );
          storedFilename = `${row.file_uuid}_${safeBaseName}${extension}`;
        }

        // Для thumbnail используем то же имя, если не задано отдельно
        if (!thumbnailFilename && storedFilename) {
          thumbnailFilename = storedFilename;
        }

        // Формируем URL
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

// 14. Получение превью изображения
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

// ==================== ИНИЦИАЛИЗАЦИЯ И ЗАПУСК СЕРВЕРА ====================
async function initializeServer() {
  try {
    await ensureUploadDirs();

    app.listen(PORT, () => {
      console.log(`🚀 Сервер запущен на порту ${PORT}`);
      console.log(`⏰ Текущее время сервера: ${new Date().toLocaleString()}`);

      startCleanupSchedule(); // ТОЛЬКО расписание, без immediate очистки
    });
  } catch (error) {
    console.error("Ошибка инициализации:", error);
    process.exit(1);
  }
}

initializeServer();
