// /services/FileDeletionService.js
const { query } = require("./databaseService");
const fs = require("fs").promises;
const path = require("path");
const config = require("../config");

class FileDeletionService {
  /**
   * Добавляет файлы пользователя в очередь на отложенное удаление
   * @param {string} userLogin - Логин пользователя
   * @param {number} delayHours - Через сколько часов удалить (по умолчанию 24)
   * @returns {Promise<{success: boolean, count: number, scheduledAt: Date}>}
   */
  static async scheduleUserFilesDeletion(userLogin, delayHours = 24) {
    try {
      console.log(
        `🗑️ [FileDeletionService] Планирование удаления файлов для: ${userLogin}`
      );

      // 1. Получаем все файлы пользователя из его таблицы
      const userFiles = await query(
        `SELECT file_uuid, file_path, thumbnail_path, type 
         FROM \`${userLogin}\` 
         WHERE file_path IS NOT NULL`
      );

      if (!userFiles || userFiles.length === 0) {
        console.log(
          `ℹ️ [FileDeletionService] У пользователя ${userLogin} нет файлов для удаления`
        );
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
          console.error(
            `⚠️ [FileDeletionService] Ошибка добавления файла в очередь:`,
            fileError.message
          );
          // Продолжаем с другими файлами
        }
      }

      console.log(
        `✅ [FileDeletionService] Добавлено ${addedCount} файлов в очередь удаления`
      );
      return {
        success: true,
        count: addedCount,
        scheduledAt,
        userLogin,
        delayHours,
      };
    } catch (error) {
      console.error(
        `❌ [FileDeletionService] Ошибка планирования удаления:`,
        error
      );
      throw error;
    }
  }

  /**
   * Обрабатывает файлы, готовые к удалению
   * @returns {Promise<{processed: number, failed: number}>}
   */
  static async processDeletionQueue() {
    console.log(`🔍 [FileDeletionService] Проверка очереди удаления...`);

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
        console.log(`ℹ️ [FileDeletionService] Нет файлов для удаления`);
        await connection.rollback();
        return { processed: 0, failed: 0 };
      }

      console.log(
        `📋 [FileDeletionService] Найдено ${filesToDelete.length} файлов для удаления`
      );

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
          console.log(
            `✅ [FileDeletionService] Удален файл: ${path.basename(
              file.file_path
            )}`
          );
        } catch (error) {
          console.error(
            `❌ [FileDeletionService] Ошибка удаления файла ${file.file_path}:`,
            error.message
          );

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
      console.log(
        `📊 [FileDeletionService] Итог: обработано ${processed}, ошибок ${failed}`
      );

      return { processed, failed };
    } catch (error) {
      await connection.rollback();
      console.error(
        `❌ [FileDeletionService] Критическая ошибка обработки очереди:`,
        error
      );
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Физическое удаление файла с диска
   */
  static async deleteFile(filePath) {
    try {
      // Проверяем существование файла
      await fs.access(filePath);

      // Удаляем файл
      await fs.unlink(filePath);

      // Пробуем удалить пустые директории
      await this.cleanupEmptyDirectories(path.dirname(filePath));

      return true;
    } catch (error) {
      if (error.code === "ENOENT") {
        console.log(`ℹ️ [FileDeletionService] Файл уже удален: ${filePath}`);
        return true; // Файл уже не существует - считаем удаленным
      }
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
        console.log(
          `🗂️ [FileDeletionService] Удалена пустая директория: ${dirPath}`
        );

        // Проверяем родительскую директорию
        const parentDir = path.dirname(dirPath);
        if (parentDir !== dirPath && parentDir.includes(config.UPLOAD_DIR)) {
          await this.cleanupEmptyDirectories(parentDir);
        }
      }
    } catch (error) {
      // Игнорируем ошибки очистки директорий
      console.log(
        `ℹ️ [FileDeletionService] Не удалось очистить директорию ${dirPath}:`,
        error.message
      );
    }
  }

  /**
   * Удаляет записи о файлах из таблиц пользователей
   */
  static async cleanupUserTables(files) {
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
          console.log(
            `🗑️ [FileDeletionService] Удалено ${uuids.length} записей из таблицы ${userLogin}`
          );
        }
      }
    } catch (error) {
      console.error(
        `⚠️ [FileDeletionService] Ошибка очистки таблиц пользователей:`,
        error.message
      );
      // Не прерываем выполнение, это вторичная операция
    }
  }

  /**
   * Получает статистику очереди
   */
  static async getQueueStats() {
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

      return {
        success: true,
        stats: stats[0] || {
          total: 0,
          pending: 0,
          processing: 0,
          completed: 0,
          failed: 0,
        },
      };
    } catch (error) {
      console.error(
        `❌ [FileDeletionService] Ошибка получения статистики:`,
        error
      );
      return { success: false, error: error.message };
    }
  }
}

module.exports = FileDeletionService;
