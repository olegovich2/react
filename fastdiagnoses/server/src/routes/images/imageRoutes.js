// src/routes/images/imageRoutes.js
const express = require("express");
const path = require("path");
const crypto = require("crypto");
const fs = require("fs").promises;
const router = express.Router();

// Импорты
const { authenticateToken } = require("../../middleware/auth");
const { validateImageBuffer } = require("../../utils/validators");
const { uploadSingleImage } = require("../../utils/uploadConfig");
const userTableService = require("../../services/userTableService");
const workerService = require("../../services/workerService");
const { query, getConnection } = require("../../services/databaseService");
const config = require("../../config");
const logger = require("../../services/LoggerService");

const UPLOAD_DIR = config.UPLOAD_DIR;

// Загрузка изображения
router.post(
  "/upload",
  authenticateToken,
  uploadSingleImage,
  async (req, res) => {
    const login = req.user.login;
    const startTime = Date.now();
    let fileUuid = "";

    try {
      logger.info("Начало загрузки изображения", {
        type: "image",
        action: "upload_start",
        user_login: login,
        filename: req.file?.originalname,
        file_size: req.file?.size,
        endpoint: req.path,
        method: req.method,
        ip_address: req.ip,
        timestamp: new Date().toISOString(),
      });

      if (!req.file) {
        logger.warn("Файл не предоставлен при загрузке", {
          type: "image",
          action: "upload_failed",
          status: "no_file",
          user_login: login,
          execution_time_ms: Date.now() - startTime,
          timestamp: new Date().toISOString(),
        });

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
        logger.info("Создание таблицы пользователя при загрузке", {
          type: "image",
          action: "create_user_table",
          user_login: login,
          timestamp: new Date().toISOString(),
        });
        await userTableService.createUserTable(login);
      }

      fileUuid = crypto.randomUUID();

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

      logger.info("Изображение успешно загружено", {
        type: "image",
        action: "upload_success",
        user_login: login,
        file_uuid: fileUuid,
        filename: workerResult.filename,
        file_size: workerResult.fileSize,
        dimensions: `${workerResult.width}x${workerResult.height}`,
        worker_time_ms: workerTime,
        total_time_ms: totalTime,
        fallback_used: workerResult.fallback || false,
        execution_time_ms: totalTime,
        timestamp: new Date().toISOString(),
      });

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
      const executionTime = Date.now() - startTime;

      if (error.name === "ValidationError") {
        logger.warn("Ошибка валидации при загрузке изображения", {
          type: "image",
          action: "upload_failed",
          status: "validation_error",
          user_login: login,
          error_name: error.name,
          error_message: error.message,
          field: error.field,
          execution_time_ms: executionTime,
          timestamp: new Date().toISOString(),
        });

        return res.status(400).json({
          success: false,
          message: error.message,
          field: error.field,
        });
      }

      logger.error("Ошибка загрузки изображения", {
        type: "image",
        action: "upload_error",
        user_login: login,
        error_name: error.name,
        error_message: error.message,
        stack_trace: error.stack?.substring(0, 500),
        file_uuid: fileUuid,
        execution_time_ms: executionTime,
        timestamp: new Date().toISOString(),
      });

      // Очистка файлов при ошибке
      if (req.file && login && fileUuid) {
        try {
          const userDir = path.join(UPLOAD_DIR, login);
          const filesToDelete = await fs.readdir(userDir).catch(() => []);

          for (const file of filesToDelete) {
            if (file.includes(fileUuid)) {
              await fs.unlink(path.join(userDir, file)).catch(() => {});
            }
          }

          logger.info("Очистка файлов после ошибки загрузки", {
            type: "image",
            action: "cleanup_after_error",
            user_login: login,
            file_uuid: fileUuid,
            files_cleaned: filesToDelete.filter((f) => f.includes(fileUuid))
              .length,
            timestamp: new Date().toISOString(),
          });
        } catch (cleanupError) {
          logger.warn("Ошибка при очистке файлов", {
            type: "image",
            action: "cleanup_error",
            user_login: login,
            file_uuid: fileUuid,
            error_message: cleanupError.message,
            timestamp: new Date().toISOString(),
          });
        }
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

// Получение изображений с пагинацией
router.post("/paginated", authenticateToken, async (req, res) => {
  const startTime = Date.now();
  const login = req.user.login;

  try {
    logger.info("Начало получения изображений с пагинацией", {
      type: "image",
      action: "get_paginated_start",
      user_login: login,
      endpoint: req.path,
      method: req.method,
      page: req.body.page,
      limit: req.body.limit,
      timestamp: new Date().toISOString(),
    });

    const { page = 1, limit = 5 } = req.body;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    if (isNaN(pageNum) || pageNum < 1) {
      logger.warn("Некорректный номер страницы при пагинации", {
        type: "image",
        action: "get_paginated_failed",
        status: "invalid_page",
        user_login: login,
        provided_page: page,
        execution_time_ms: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      });

      return res.status(400).json({
        success: false,
        message: "Некорректный номер страницы",
      });
    }

    if (isNaN(limitNum) || limitNum < 1 || limitNum > 50) {
      logger.warn("Некорректный лимит при пагинации", {
        type: "image",
        action: "get_paginated_failed",
        status: "invalid_limit",
        user_login: login,
        provided_limit: limit,
        max_allowed: 50,
        execution_time_ms: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      });

      return res.status(400).json({
        success: false,
        message: "Некорректный лимит (максимум 50 записей на страницу)",
      });
    }

    const offset = (pageNum - 1) * limitNum;

    const tableExists = await userTableService.tableExists(login);

    if (!tableExists) {
      const executionTime = Date.now() - startTime;

      logger.info("Таблица пользователя не найдена при пагинации", {
        type: "image",
        action: "get_paginated_empty",
        user_login: login,
        table_exists: false,
        execution_time_ms: executionTime,
        timestamp: new Date().toISOString(),
      });

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

      const executionTime = Date.now() - startTime;

      logger.info("Изображения успешно получены с пагинацией", {
        type: "image",
        action: "get_paginated_success",
        user_login: login,
        images_count: parsedImages.length,
        total_items: totalItems,
        total_pages: totalPages,
        current_page: pageNum,
        items_per_page: limitNum,
        execution_time_ms: executionTime,
        timestamp: new Date().toISOString(),
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
    const executionTime = Date.now() - startTime;

    if (error.code === "ER_NO_SUCH_TABLE") {
      logger.warn("Таблица пользователя не найдена", {
        type: "image",
        action: "get_paginated_failed",
        status: "table_not_found",
        user_login: login,
        error_code: error.code,
        execution_time_ms: executionTime,
        timestamp: new Date().toISOString(),
      });

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

    logger.error("Ошибка получения изображений с пагинацией", {
      type: "image",
      action: "get_paginated_error",
      user_login: login,
      error_name: error.name,
      error_message: error.message,
      stack_trace: error.stack?.substring(0, 500),
      execution_time_ms: executionTime,
      timestamp: new Date().toISOString(),
    });

    res.status(500).json({
      success: false,
      message: "Ошибка получения изображений",
    });
  }
});

// Получение оригинального изображения
router.get("/original/:uuid", authenticateToken, async (req, res) => {
  const startTime = Date.now();
  const login = req.user.login;

  try {
    const { uuid } = req.params;

    logger.info("Начало получения оригинального изображения", {
      type: "image",
      action: "get_original_start",
      user_login: login,
      file_uuid: uuid,
      endpoint: req.path,
      method: req.method,
      timestamp: new Date().toISOString(),
    });

    if (!uuid) {
      logger.warn("Некорректный UUID при получении изображения", {
        type: "image",
        action: "get_original_failed",
        status: "invalid_uuid",
        user_login: login,
        provided_uuid: uuid,
        execution_time_ms: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      });

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
      const executionTime = Date.now() - startTime;

      logger.warn("Изображение не найдено в БД", {
        type: "image",
        action: "get_original_failed",
        status: "image_not_found",
        user_login: login,
        file_uuid: uuid,
        execution_time_ms: executionTime,
        timestamp: new Date().toISOString(),
      });

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

      const executionTime = Date.now() - startTime;

      logger.info("Оригинальное изображение успешно получено", {
        type: "image",
        action: "get_original_success",
        user_login: login,
        file_uuid: row.file_uuid || uuid,
        filename: row.fileNameOriginIMG,
        file_exists: true,
        execution_time_ms: executionTime,
        timestamp: new Date().toISOString(),
      });

      return res.json({
        success: true,
        originalUrl: `/uploads/${login}/originals/${filename}`,
        filename: row.fileNameOriginIMG,
        fileUuid: row.file_uuid || uuid,
        id: row.id,
      });
    } catch (fsError) {
      logger.warn("Файл не найден на диске, поиск альтернативы", {
        type: "image",
        action: "get_original_warning",
        user_login: login,
        file_uuid: uuid,
        expected_path: filePath,
        error_message: fsError.message,
        timestamp: new Date().toISOString(),
      });

      try {
        const files = await fs.readdir(
          path.join(UPLOAD_DIR, login, "originals")
        );

        const matchingFile = files.find((file) => file.includes(uuid));

        if (matchingFile) {
          const executionTime = Date.now() - startTime;

          logger.info("Альтернативный файл найден", {
            type: "image",
            action: "get_original_alternative_found",
            user_login: login,
            file_uuid: uuid,
            matched_file: matchingFile,
            execution_time_ms: executionTime,
            timestamp: new Date().toISOString(),
          });

          return res.json({
            success: true,
            originalUrl: `/uploads/${login}/originals/${matchingFile}`,
            filename: row.fileNameOriginIMG,
            fileUuid: uuid,
          });
        }
      } catch (readError) {
        logger.error("Ошибка чтения директории при поиске файла", {
          type: "image",
          action: "get_original_error",
          user_login: login,
          file_uuid: uuid,
          error_message: readError.message,
          timestamp: new Date().toISOString(),
        });
      }

      const executionTime = Date.now() - startTime;

      logger.warn("Файл не найден на диске", {
        type: "image",
        action: "get_original_failed",
        status: "file_not_found_on_disk",
        user_login: login,
        file_uuid: uuid,
        execution_time_ms: executionTime,
        timestamp: new Date().toISOString(),
      });

      res.status(404).json({
        success: false,
        message: "Файл не найден на диске",
      });
    }
  } catch (error) {
    const executionTime = Date.now() - startTime;

    if (error.code === "ER_NO_SUCH_TABLE") {
      logger.warn("Таблица пользователя не найдена при получении изображения", {
        type: "image",
        action: "get_original_failed",
        status: "table_not_found",
        user_login: login,
        error_code: error.code,
        execution_time_ms: executionTime,
        timestamp: new Date().toISOString(),
      });

      return res.status(404).json({
        success: false,
        message: `Таблица пользователя '${login}' не найдена`,
      });
    }

    logger.error("Ошибка получения оригинального изображения", {
      type: "image",
      action: "get_original_error",
      user_login: login,
      file_uuid: req.params.uuid,
      error_name: error.name,
      error_message: error.message,
      stack_trace: error.stack?.substring(0, 500),
      execution_time_ms: executionTime,
      timestamp: new Date().toISOString(),
    });

    res.status(500).json({
      success: false,
      message: "Ошибка получения изображения",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// Получение превью изображения
router.get("/thumbnail/:uuid", authenticateToken, async (req, res) => {
  const startTime = Date.now();

  try {
    const login = req.user.login;
    const { uuid } = req.params;

    logger.info("Начало получения превью изображения", {
      type: "image",
      action: "get_thumbnail_start",
      user_login: login,
      file_uuid: uuid,
      endpoint: req.path,
      method: req.method,
      timestamp: new Date().toISOString(),
    });

    if (!uuid) {
      const executionTime = Date.now() - startTime;

      logger.warn("Некорректный UUID при получении превью", {
        type: "image",
        action: "get_thumbnail_failed",
        status: "invalid_uuid",
        user_login: login,
        provided_uuid: uuid,
        execution_time_ms: executionTime,
        timestamp: new Date().toISOString(),
      });

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
      const executionTime = Date.now() - startTime;

      logger.warn("Превью не найдено в БД", {
        type: "image",
        action: "get_thumbnail_failed",
        status: "thumbnail_not_found",
        user_login: login,
        file_uuid: uuid,
        execution_time_ms: executionTime,
        timestamp: new Date().toISOString(),
      });

      return res.status(404).json({
        success: false,
        message: "Превью не найдено",
      });
    }

    const row = results[0];
    const filename = path.basename(row.thumbnail_path);

    const executionTime = Date.now() - startTime;

    logger.info("Превью успешно получено", {
      type: "image",
      action: "get_thumbnail_success",
      user_login: login,
      file_uuid: uuid,
      filename: filename,
      execution_time_ms: executionTime,
      timestamp: new Date().toISOString(),
    });

    return res.json({
      success: true,
      thumbnailUrl: `/uploads/${login}/thumbnails/${filename}`,
    });
  } catch (error) {
    const executionTime = Date.now() - startTime;

    logger.error("Ошибка получения превью изображения", {
      type: "image",
      action: "get_thumbnail_error",
      user_login: req.user?.login,
      file_uuid: req.params.uuid,
      error_name: error.name,
      error_message: error.message,
      stack_trace: error.stack?.substring(0, 500),
      execution_time_ms: executionTime,
      timestamp: new Date().toISOString(),
    });

    res.status(500).json({
      success: false,
      message: "Ошибка получения превью",
    });
  }
});

module.exports = router;
