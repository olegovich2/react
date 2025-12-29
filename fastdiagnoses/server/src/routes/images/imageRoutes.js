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
const { deleteImageFromDisk } = require("../../utils/fileSystem");
const config = require("../../config");

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

// Получение изображений с пагинацией
router.post("/paginated", authenticateToken, async (req, res) => {
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

// Получение оригинального изображения
router.get("/original/:uuid", authenticateToken, async (req, res) => {
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

// Получение превью изображения
router.get("/thumbnail/:uuid", authenticateToken, async (req, res) => {
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

module.exports = router;
