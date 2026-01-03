const { query } = require("./databaseService");
const fs = require("fs").promises;
const path = require("path");
const config = require("../config");
const logger = require("./LoggerService");

class FileDeletionService {
  /**
   * Добавляет файлы пользователя в очередь на отложенное удаление
   * @param {string} userLogin - Логин пользователя
   * @param {number} delayHours - Через сколько часов удалить (по умолчанию 24)
   * @returns {Promise<{success: boolean, count: number, scheduledAt: Date}>}
   */
  static async scheduleUserFilesDeletion(userLogin, delayHours = 24) {
    const startTime = Date.now();

    try {
      logger.warn("Планирование удаления файлов пользователя", {
        type: "file_deletion",
        action: "schedule",
        user_login: userLogin,
        delay_hours: delayHours,
        status: "started",
        timestamp: new Date().toISOString(),
      });

      // 1. Получаем все файлы пользователя из его таблицы
      const userFiles = await query(
        `SELECT file_uuid, file_path, thumbnail_path, type 
         FROM \`${userLogin}\` 
         WHERE file_path IS NOT NULL`
      );

      if (!userFiles || userFiles.length === 0) {
        logger.warn("Нет файлов для удаления у пользователя", {
          type: "file_deletion",
          action: "schedule",
          user_login: userLogin,
          status: "no_files",
          execution_time_ms: Date.now() - startTime,
          timestamp: new Date().toISOString(),
        });
        return { success: true, count: 0, scheduledAt: null };
      }

      // 2. Рассчитываем время удаления
      const scheduledAt = new Date(Date.now() + delayHours * 60 * 60 * 1000);

      // 3. Добавляем каждый файл в очередь
      let addedCount = 0;
      for (const file of userFiles) {
        try {
          // Основной файл
          if (file.file_path) {
            await query(
              `INSERT INTO file_deletion_queue 
               (user_login, table_name, file_path, file_uuid, file_type, scheduled_at, status) 
               VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
              [
                userLogin,
                userLogin,
                file.file_path,
                file.file_uuid,
                file.type || "image",
                scheduledAt,
              ]
            );
            addedCount++;
          }

          // Миниатюра (если есть)
          if (file.thumbnail_path) {
            await query(
              `INSERT INTO file_deletion_queue 
               (user_login, table_name, file_path, file_uuid, file_type, scheduled_at, status) 
               VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
              [
                userLogin,
                userLogin,
                file.thumbnail_path,
                file.file_uuid,
                "image", // thumbnail всегда image
                scheduledAt,
              ]
            );
            addedCount++;
          }
        } catch (fileError) {
          logger.error("Ошибка добавления файла в очередь", {
            type: "file_deletion",
            action: "schedule_file",
            user_login: userLogin,
            file_uuid: file.file_uuid,
            file_path: file.file_path,
            error_message: fileError.message,
            timestamp: new Date().toISOString(),
          });
        }
      }

      const executionTime = Date.now() - startTime;

      logger.warn("Файлы добавлены в очередь удаления", {
        type: "file_deletion",
        action: "schedule",
        user_login: userLogin,
        status: "completed",
        files_added: addedCount,
        delay_hours: delayHours,
        scheduled_at: scheduledAt.toISOString(),
        execution_time_ms: executionTime,
        timestamp: new Date().toISOString(),
      });

      return {
        success: true,
        count: addedCount,
        scheduledAt,
        userLogin,
        delayHours,
      };
    } catch (error) {
      logger.error("Ошибка планирования удаления файлов", {
        type: "file_deletion",
        action: "schedule",
        user_login: userLogin,
        status: "failed",
        execution_time_ms: Date.now() - startTime,
        error_message: error.message,
        stack_trace: error.stack,
        timestamp: new Date().toISOString(),
      });
      throw error;
    }
  }

  /**
   * Обрабатывает файлы, готовые к удалению
   * @returns {Promise<{processed: number, failed: number}>}
   */
  static async processDeletionQueue() {
    const startTime = Date.now();

    logger.warn("Проверка очереди удаления файлов", {
      type: "file_deletion",
      action: "process_queue",
      status: "started",
      timestamp: new Date().toISOString(),
    });

    const connection = await require("./databaseService").getConnection();
    try {
      await connection.beginTransaction();

      // 1. Берем файлы для обработки (максимум 20 за раз)
      const [filesToDelete] = await connection.execute(`
        SELECT id, user_login, file_path, file_uuid, retry_count 
        FROM file_deletion_queue 
        WHERE status = 'pending' 
          AND scheduled_at <= NOW()
          AND retry_count < 3
        ORDER BY scheduled_at ASC
        LIMIT 20
        FOR UPDATE SKIP LOCKED
      `);

      if (filesToDelete.length === 0) {
        logger.info("Нет файлов для удаления в очереди", {
          type: "file_deletion",
          action: "process_queue",
          status: "empty",
          execution_time_ms: Date.now() - startTime,
          timestamp: new Date().toISOString(),
        });
        await connection.rollback();
        return { processed: 0, failed: 0 };
      }

      logger.info("Найдены файлы для удаления", {
        type: "file_deletion",
        action: "process_queue",
        files_count: filesToDelete.length,
        timestamp: new Date().toISOString(),
      });

      let processed = 0;
      let failed = 0;

      // 2. Обрабатываем каждый файл
      for (const file of filesToDelete) {
        try {
          // Обновляем статус на "обрабатывается"
          await connection.execute(
            `UPDATE file_deletion_queue 
             SET status = 'processing', updated_at = NOW() 
             WHERE id = ?`,
            [file.id]
          );

          // Пытаемся удалить файл
          await this.deleteFile(file.file_path);

          // Помечаем как успешно удаленный
          await connection.execute(
            `UPDATE file_deletion_queue 
             SET status = 'completed', 
                 processed_at = NOW(),
                 updated_at = NOW() 
             WHERE id = ?`,
            [file.id]
          );

          processed++;

          logger.info("Файл успешно удален", {
            type: "file_deletion",
            action: "delete_file",
            file_id: file.id,
            user_login: file.user_login,
            file_path: file.file_path,
            file_name: path.basename(file.file_path),
            status: "success",
            timestamp: new Date().toISOString(),
          });
        } catch (error) {
          logger.error("Ошибка удаления файла", {
            type: "file_deletion",
            action: "delete_file",
            file_id: file.id,
            user_login: file.user_login,
            file_path: file.file_path,
            retry_count: file.retry_count,
            error_message: error.message,
            timestamp: new Date().toISOString(),
          });

          // Увеличиваем счетчик попыток
          await connection.execute(
            `UPDATE file_deletion_queue 
             SET status = 'failed',
                 retry_count = retry_count + 1,
                 error_message = ?,
                 updated_at = NOW()
             WHERE id = ?`,
            [error.message.substring(0, 500), file.id]
          );

          failed++;
        }
      }

      // 3. Удаляем записи о файлах из таблицы пользователя
      await this.cleanupUserTables(filesToDelete);

      await connection.commit();

      const executionTime = Date.now() - startTime;

      logger.warn("Обработка очереди удаления завершена", {
        type: "file_deletion",
        action: "process_queue",
        status: "completed",
        files_processed: processed,
        files_failed: failed,
        execution_time_ms: executionTime,
        timestamp: new Date().toISOString(),
      });

      return { processed, failed };
    } catch (error) {
      logger.error("Критическая ошибка обработки очереди удаления", {
        type: "file_deletion",
        action: "process_queue",
        status: "failed",
        execution_time_ms: Date.now() - startTime,
        error_message: error.message,
        stack_trace: error.stack,
        timestamp: new Date().toISOString(),
      });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Физическое удаление файла с диска
   */
  static async deleteFile(filePath) {
    const startTime = Date.now();

    try {
      // Проверяем существование файла
      await fs.access(filePath);

      // Удаляем файл
      await fs.unlink(filePath);

      // Пробуем удалить пустые директории
      await this.cleanupEmptyDirectories(path.dirname(filePath));

      logger.info("Файл физически удален с диска", {
        type: "file_deletion",
        action: "delete_physical",
        file_path: filePath,
        file_name: path.basename(filePath),
        execution_time_ms: Date.now() - startTime,
        status: "success",
        timestamp: new Date().toISOString(),
      });

      return true;
    } catch (error) {
      if (error.code === "ENOENT") {
        logger.warn("Файл уже удален с диска", {
          type: "file_deletion",
          action: "delete_physical",
          file_path: filePath,
          file_name: path.basename(filePath),
          execution_time_ms: Date.now() - startTime,
          status: "already_deleted",
          timestamp: new Date().toISOString(),
        });
        return true;
      }

      logger.error("Ошибка физического удаления файла", {
        type: "file_deletion",
        action: "delete_physical",
        file_path: filePath,
        file_name: path.basename(filePath),
        execution_time_ms: Date.now() - startTime,
        error_message: error.message,
        error_code: error.code,
        timestamp: new Date().toISOString(),
      });
      throw error;
    }
  }

  /**
   * Рекурсивно удаляет пустые директории
   */
  static async cleanupEmptyDirectories(dirPath) {
    try {
      const files = await fs.readdir(dirPath);

      if (files.length === 0) {
        // Директория пуста - удаляем
        await fs.rmdir(dirPath);

        logger.info("Удалена пустая директория", {
          type: "file_deletion",
          action: "cleanup_directory",
          directory_path: dirPath,
          timestamp: new Date().toISOString(),
        });

        // Проверяем родительскую директорию
        const parentDir = path.dirname(dirPath);
        if (parentDir !== dirPath && parentDir.includes(config.UPLOAD_DIR)) {
          await this.cleanupEmptyDirectories(parentDir);
        }
      }
    } catch (error) {
      logger.warn("Не удалось очистить директорию", {
        type: "file_deletion",
        action: "cleanup_directory",
        directory_path: dirPath,
        error_message: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Удаляет записи о файлах из таблиц пользователей
   */
  static async cleanupUserTables(files) {
    const startTime = Date.now();

    try {
      // Группируем по пользователям
      const usersMap = new Map();

      for (const file of files) {
        if (file.file_uuid) {
          if (!usersMap.has(file.user_login)) {
            usersMap.set(file.user_login, []);
          }
          usersMap.get(file.user_login).push(file.file_uuid);
        }
      }

      // Удаляем записи для каждого пользователя
      for (const [userLogin, uuids] of usersMap) {
        if (uuids.length > 0) {
          await query(
            `DELETE FROM \`${userLogin}\` 
             WHERE file_uuid IN (${uuids.map(() => "?").join(",")})`,
            uuids
          );

          logger.info("Удалены записи из таблицы пользователя", {
            type: "file_deletion",
            action: "cleanup_user_table",
            user_login: userLogin,
            records_deleted: uuids.length,
            execution_time_ms: Date.now() - startTime,
            timestamp: new Date().toISOString(),
          });
        }
      }
    } catch (error) {
      logger.error("Ошибка очистки таблиц пользователей", {
        type: "file_deletion",
        action: "cleanup_user_table",
        status: "failed",
        execution_time_ms: Date.now() - startTime,
        error_message: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Получает статистику очереди
   */
  static async getQueueStats() {
    const startTime = Date.now();

    try {
      const [stats] = await query(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
          SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
          MIN(scheduled_at) as earliest_scheduled,
          MAX(scheduled_at) as latest_scheduled
        FROM file_deletion_queue
      `);

      const result = {
        success: true,
        stats: stats[0] || {
          total: 0,
          pending: 0,
          processing: 0,
          completed: 0,
          failed: 0,
        },
      };

      logger.info("Получена статистика очереди удаления", {
        type: "file_deletion",
        action: "get_stats",
        execution_time_ms: Date.now() - startTime,
        stats: result.stats,
        timestamp: new Date().toISOString(),
      });

      return result;
    } catch (error) {
      logger.error("Ошибка получения статистики очереди удаления", {
        type: "file_deletion",
        action: "get_stats",
        status: "failed",
        execution_time_ms: Date.now() - startTime,
        error_message: error.message,
        timestamp: new Date().toISOString(),
      });
      return { success: false, error: error.message };
    }
  }
}

module.exports = FileDeletionService;
