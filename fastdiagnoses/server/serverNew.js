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
} = require("./src/utils/validators");
const {
  ensureUploadDirs,
  deleteImageFromDisk,
} = require("./src/utils/fileSystem");
const { uploadSingleImage } = require("./src/utils/uploadConfig");
const { startCleanupSchedule } = require("./src/utils/cron");
const { query, getConnection } = require("./src/services/databaseService");
const { HTML_TEMPLATES } = require("./src/templates/htmlTemplates");

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

const buildPath = path.join(__dirname, "..", "build");
app.use(express.static(buildPath));

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

// Восстановление пароля - запрос
app.post("/api/auth/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || !validator.isEmail(email)) {
      return res.status(400).json({
        success: false,
        message: "Введите корректный email адрес",
        field: "email",
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const users = await query(
      "SELECT login, email FROM usersdata WHERE email = ? AND logic = 'true'",
      [normalizedEmail]
    );

    if (users.length === 0) {
      console.log(
        `📭 Запрос восстановления пароля для несуществующего email: ${normalizedEmail}`
      );
      await new Promise((resolve) => setTimeout(resolve, 1000));

      return res.json({
        success: true,
        message:
          "Если email зарегистрирован в системе, на него отправлена инструкция",
      });
    }

    const user = users[0];
    const resetToken = await passwordResetService.createToken(user.email);

    await emailService.sendPasswordReset({
      login: user.login,
      email: user.email,
      resetToken: resetToken,
    });

    console.log(
      `📧 Ссылка для восстановления пароля отправлена на: ${user.email}`
    );

    res.json({
      success: true,
      message:
        "Если email зарегистрирован в системе, на него отправлена инструкция",
    });
  } catch (error) {
    console.error("❌ Ошибка обработки запроса восстановления пароля:", error);
    res.json({
      success: true,
      message:
        "Если email зарегистрирован в системе, на него отправлена инструкция",
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
    const login = validateLogin(req.body.login);
    const password = validatePassword(req.body.password);
    const email = validateEmail(req.body.email);

    const emailUsage = await query(
      "SELECT COUNT(*) as count FROM usersdata WHERE email = ?",
      [email]
    );

    const userCount = emailUsage[0].count || 0;

    if (userCount >= MAX_USERS_PER_EMAIL) {
      // Вызываем функцию очистки из вынесенного модуля (пока оставляем как есть)
      // await cleanupExpiredRegistrations();

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

    await emailService.sendRegistrationConfirm({
      login: login,
      email: email,
      activeUserCount: activeUserCount,
      maxUsers: MAX_USERS_PER_EMAIL,
      confirmToken: confirmToken,
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

// Смена пароля
app.post(
  "/api/settings/change-password",
  authenticateToken,
  async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      const login = req.user.login;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          success: false,
          message: "Текущий и новый пароль обязательны",
          field: !currentPassword ? "currentPassword" : "newPassword",
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

      const user = await query(
        "SELECT password, email FROM usersdata WHERE login = ? AND logic = 'true'",
        [login]
      );

      if (user.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Пользователь не найден",
        });
      }

      const userEmail = user[0].email;

      const validPassword = await bcrypt.compare(
        currentPassword,
        user[0].password
      );
      if (!validPassword) {
        await new Promise((resolve) => setTimeout(resolve, 1000));

        return res.status(401).json({
          success: false,
          message: "Неверный текущий пароль",
          field: "currentPassword",
        });
      }

      const samePassword = await bcrypt.compare(newPassword, user[0].password);
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
        "UPDATE usersdata SET password = ? WHERE login = ? AND logic = 'true'",
        [hashedPassword, login]
      );

      await query("DELETE FROM sessionsdata WHERE login = ?", [login]);

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

      console.log(`🔐 Пароль изменен для пользователя: ${login}`);
      console.log(`🗑️ Удалены все сессии пользователя: ${login}`);

      res.json({
        success: true,
        message: "Пароль успешно изменен",
        requireReauth: true,
        emailSent: true,
      });
    } catch (error) {
      console.error("Ошибка смены пароля:", error);

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

// Отправка запроса на смену email администратору
app.post(
  "/api/settings/email-change-request",
  authenticateToken,
  async (req, res) => {
    try {
      const { currentEmail, newEmail, reason } = req.body;
      const login = req.user.login;

      if (!currentEmail || !newEmail || !reason) {
        return res.status(400).json({
          success: false,
          message: "Все поля обязательны для заполнения",
        });
      }

      try {
        validateEmail(currentEmail);
        validateEmail(newEmail);
      } catch (validationError) {
        return res.status(400).json({
          success: false,
          message: validationError.message,
          field: validationError.field,
        });
      }

      const user = await query(
        "SELECT email FROM usersdata WHERE login = ? AND logic = 'true'",
        [login]
      );

      if (user.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Пользователь не найден",
        });
      }

      const actualEmail = user[0].email;

      if (actualEmail !== currentEmail) {
        return res.status(400).json({
          success: false,
          message: "Текущий email не совпадает с email в системе",
          field: "currentEmail",
        });
      }

      if (currentEmail === newEmail) {
        return res.status(400).json({
          success: false,
          message: "Новый email должен отличаться от текущего",
          field: "newEmail",
        });
      }

      try {
        await emailService.sendEmailChangeRequest({
          login: login,
          actualEmail: actualEmail,
          currentEmail: currentEmail,
          newEmail: newEmail,
          reason: reason,
          userIp: req.ip || req.connection.remoteAddress,
          userAgent: req.headers["user-agent"] || "Неизвестное устройство",
        });

        console.log(
          `📧 Запрос на смену email отправлен администратору для пользователя: ${login}`
        );
        console.log(`📧 От: ${actualEmail} → Кому: ${newEmail}`);
      } catch (emailError) {
        console.error(
          "❌ Ошибка отправки email администратору:",
          emailError.message
        );
      }

      res.json({
        success: true,
        message:
          "Запрос на смену email отправлен администратору. Вы получите уведомление после обработки.",
        notification:
          "Администратор получил ваш запрос и свяжется с вами после обработки.",
      });
    } catch (error) {
      console.error("Ошибка обработки запроса смены email:", error);

      if (error.name === "ValidationError") {
        return res.status(400).json({
          success: false,
          message: error.message,
          field: error.field,
        });
      }

      res.status(500).json({
        success: false,
        message: "Ошибка обработки запроса",
      });
    }
  }
);

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
