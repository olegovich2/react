const express = require("express");
const router = express.Router();

// Импорты
const { authenticateToken } = require("../../middleware/auth");
const { query } = require("../../services/databaseService");
const { deleteImageFromDisk } = require("../../utils/fileSystem");
const logger = require("../../services/LoggerService");

// Удаление записи (опроса или изображения)
router.delete("/:id", authenticateToken, async (req, res) => {
  const startTime = Date.now();
  const login = req.user.login;
  const { id } = req.params;

  try {
    logger.info("Начало удаления записи пользователя", {
      type: "user_data",
      action: "delete_start",
      user_login: login,
      record_id: id,
      endpoint: req.path,
      method: req.method,
      ip_address: req.ip,
      timestamp: new Date().toISOString(),
    });

    if (!id || isNaN(parseInt(id))) {
      logger.warn("Некорректный ID при удалении записи", {
        type: "user_data",
        action: "delete_failed",
        status: "invalid_id",
        user_login: login,
        record_id: id,
        execution_time_ms: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      });

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
      logger.warn("Запись не найдена при удалении", {
        type: "user_data",
        action: "delete_failed",
        status: "record_not_found",
        user_login: login,
        record_id: id,
        execution_time_ms: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      });

      return res.status(404).json({
        success: false,
        message: "Запись не найдена",
      });
    }

    const record = fileInfo[0];
    let fileDeleted = false;
    let fileDeletionError = null;

    // Удаляем файл с диска если это изображение
    if (record.type === "image" && record.file_uuid) {
      try {
        await deleteImageFromDisk(record.file_uuid, login);
        fileDeleted = true;

        logger.info("Файл изображения удален с диска", {
          type: "user_data",
          action: "file_deletion",
          user_login: login,
          record_id: id,
          file_uuid: record.file_uuid,
          file_type: record.type,
          status: "success",
          timestamp: new Date().toISOString(),
        });
      } catch (fileError) {
        fileDeletionError = fileError.message;

        logger.warn("Ошибка удаления файла с диска", {
          type: "user_data",
          action: "file_deletion",
          status: "failed",
          user_login: login,
          record_id: id,
          file_uuid: record.file_uuid,
          file_type: record.type,
          error_message: fileError.message,
          timestamp: new Date().toISOString(),
        });
      }
    }

    // Удаляем запись из БД
    const result = await query(`DELETE FROM \`${login}\` WHERE id = ?`, [id]);

    if (result.affectedRows === 0) {
      logger.warn("Запись не найдена в БД при удалении", {
        type: "user_data",
        action: "delete_failed",
        status: "db_record_not_found",
        user_login: login,
        record_id: id,
        execution_time_ms: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      });

      return res.status(404).json({
        success: false,
        message: "Запись не найдена",
      });
    }

    const executionTime = Date.now() - startTime;

    logger.info("Запись успешно удалена", {
      type: "user_data",
      action: "delete_success",
      user_login: login,
      record_id: id,
      record_type: record.type,
      file_uuid: record.file_uuid || null,
      file_deleted: fileDeleted,
      file_deletion_error: fileDeletionError,
      db_affected_rows: result.affectedRows,
      execution_time_ms: executionTime,
      timestamp: new Date().toISOString(),
    });

    res.json({
      success: true,
      message: "Запись успешно удалена",
      details: {
        recordType: record.type,
        fileDeleted: fileDeleted,
        fileDeletionError: fileDeletionError,
      },
    });
  } catch (error) {
    logger.error("Ошибка удаления записи пользователя", {
      type: "user_data",
      action: "delete_error",
      user_login: login,
      record_id: id,
      error_name: error.name,
      error_message: error.message,
      stack_trace: error.stack,
      execution_time_ms: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    });

    res.status(500).json({
      success: false,
      message: "Ошибка удаления записи",
    });
  }
});

module.exports = router;
