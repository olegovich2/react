const { query, getConnection } = require("../../services/databaseService");
const fs = require("fs").promises;
const path = require("path");
const { exec } = require("child_process");
const util = require("util");
const execPromise = util.promisify(exec);

class AdminBackupsController {
  // Получение списка бэкапов
  static async getBackups(req, res) {
    console.log(
      "💾 [AdminBackupsController.getBackups] Запрос списка бэкапов:",
      {
        adminId: req.admin.id,
      }
    );

    try {
      const { page = 1, limit = 20 } = req.query;
      const offset = (parseInt(page) - 1) * parseInt(limit);

      // Получаем бэкапы из БД
      const backups = await query(
        `SELECT * FROM system_backups 
         ORDER BY created_at DESC 
         LIMIT ? OFFSET ?`,
        [parseInt(limit), offset]
      );

      // Общее количество
      const [totalResult] = await query(
        "SELECT COUNT(*) as total FROM system_backups"
      );

      // Статистика
      const [statsResult] = await query(`
        SELECT 
          status,
          COUNT(*) as count,
          SUM(file_size) as total_size
        FROM system_backups
        GROUP BY status
      `);

      // Использование диска
      const diskStats = await this.getDiskUsage();

      res.json({
        success: true,
        backups: backups.map((backup) => ({
          id: backup.id,
          name: backup.backup_name,
          type: backup.backup_type,
          size: backup.file_size,
          formattedSize: this.formatBytes(backup.file_size),
          status: backup.status,
          createdAt: backup.created_at,
          completedAt: backup.completed_at,
          notes: backup.notes,
          path: backup.file_path,
        })),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalResult.total,
          totalPages: Math.ceil(totalResult.total / limit),
        },
        stats: {
          byStatus: statsResult.reduce((acc, stat) => {
            acc[stat.status] = {
              count: stat.count,
              totalSize: stat.total_size,
              formattedSize: this.formatBytes(stat.total_size),
            };
            return acc;
          }, {}),
          totalSize: statsResult.reduce(
            (sum, stat) => sum + (stat.total_size || 0),
            0
          ),
        },
        diskUsage: diskStats,
      });
    } catch (error) {
      console.error("❌ Ошибка получения списка бэкапов:", error);
      res.status(500).json({
        success: false,
        message: "Ошибка получения списка бэкапов",
      });
    }
  }

  // Создание нового бэкапа
  static async createBackup(req, res) {
    console.log("🆕 [AdminBackupsController.createBackup] Создание бэкапа:", {
      adminId: req.admin.id,
      body: req.body,
    });

    const connection = await getConnection();
    try {
      const { backupName, backupType = "full", notes } = req.body;
      const adminId = req.admin.id;

      const backupNameFinal =
        backupName ||
        `backup_${new Date().toISOString().replace(/[:.]/g, "-")}`;

      await connection.beginTransaction();

      // Создаем запись в БД
      const [result] = await connection.execute(
        `INSERT INTO system_backups (backup_name, backup_type, status, created_by, notes)
         VALUES (?, ?, 'pending', ?, ?)`,
        [backupNameFinal, backupType, adminId, notes || "Ручное создание"]
      );

      const backupId = result.insertId;

      // Логируем начало создания
      await this.logAdminAction(adminId, "create", "backup", backupId, {
        backupName: backupNameFinal,
        backupType,
      });

      await connection.commit();

      // Запускаем создание бэкапа в фоне
      this.createBackupAsync(backupId, backupNameFinal, backupType, adminId);

      res.json({
        success: true,
        message: "Создание бэкапа запущено",
        backupId: backupId,
        backupName: backupNameFinal,
      });
    } catch (error) {
      await connection.rollback();
      console.error("❌ Ошибка создания бэкапа:", error);
      res.status(500).json({
        success: false,
        message: "Ошибка создания бэкапа",
      });
    } finally {
      connection.release();
    }
  }

  // Асинхронное создание бэкапа
  static async createBackupAsync(backupId, backupName, backupType, adminId) {
    console.log(
      "⚙️ [AdminBackupsController.createBackupAsync] Запуск асинхронного бэкапа:",
      {
        backupId,
        backupName,
      }
    );

    const connection = await getConnection();
    try {
      // Обновляем статус на "in_progress"
      await connection.execute(
        "UPDATE system_backups SET status = 'in_progress', started_at = NOW() WHERE id = ?",
        [backupId]
      );

      // Путь для сохранения бэкапов
      const backupsDir = path.join(__dirname, "../../../backups");
      await fs.mkdir(backupsDir, { recursive: true });

      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const backupFileName = `${backupName}_${timestamp}.sql`;
      const backupPath = path.join(backupsDir, backupFileName);

      // Получаем конфигурацию БД
      const dbConfig = require("../../config");

      // Команда для mysqldump
      const dumpCommand = `mysqldump --host=${dbConfig.DB_HOST} --user=${dbConfig.DB_USER} --password=${dbConfig.DB_PASSWORD} ${dbConfig.DB_NAME} > "${backupPath}"`;

      console.log("💾 Выполняем дамп БД...");
      const { stdout, stderr } = await execPromise(dumpCommand);

      if (
        stderr &&
        !stderr.includes("Using a password on the command line interface")
      ) {
        throw new Error(stderr);
      }

      // Проверяем размер файла
      const stats = await fs.stat(backupPath);
      const fileSize = stats.size;

      // Создаем zip-архив
      const zipFileName = backupFileName.replace(".sql", ".zip");
      const zipPath = path.join(backupsDir, zipFileName);

      const zipCommand = `zip -j "${zipPath}" "${backupPath}"`;
      await execPromise(zipCommand);

      // Удаляем оригинальный SQL файл
      await fs.unlink(backupPath);

      const zipStats = await fs.stat(zipPath);
      const finalSize = zipStats.size;

      // Обновляем запись в БД
      await connection.execute(
        `UPDATE system_backups 
         SET status = 'completed', 
             file_path = ?,
             file_size = ?,
             completed_at = NOW()
         WHERE id = ?`,
        [zipPath, finalSize, backupId]
      );

      // Логируем успех
      await this.logAdminAction(adminId, "complete", "backup", backupId, {
        backupName,
        fileSize: finalSize,
        formattedSize: this.formatBytes(finalSize),
      });

      console.log("✅ Бэкап успешно создан:", {
        backupId,
        fileSize: finalSize,
        path: zipPath,
      });
    } catch (error) {
      console.error("❌ Ошибка при создании бэкапа:", error);

      try {
        await connection.execute(
          "UPDATE system_backups SET status = 'failed', error_message = ? WHERE id = ?",
          [error.message, backupId]
        );

        await this.logAdminAction(adminId, "error", "backup", backupId, {
          error: error.message,
        });
      } catch (updateError) {
        console.error("❌ Ошибка обновления статуса бэкапа:", updateError);
      }
    } finally {
      connection.release();
    }
  }

  // Восстановление из бэкапа
  static async restoreBackup(req, res) {
    console.log(
      "🔄 [AdminBackupsController.restoreBackup] Восстановление из бэкапа:",
      {
        adminId: req.admin.id,
        params: req.params,
      }
    );

    try {
      const { id } = req.params;
      const adminId = req.admin.id;

      // Получаем информацию о бэкапе
      const [backup] = await query(
        "SELECT * FROM system_backups WHERE id = ? AND status = 'completed'",
        [id]
      );

      if (!backup) {
        return res.status(404).json({
          success: false,
          message: "Бэкап не найден или не завершен",
        });
      }

      // Запрашиваем подтверждение
      if (req.body.confirm !== true) {
        return res.json({
          success: true,
          requiresConfirmation: true,
          message:
            "Восстановление из бэкапа перезапишет текущие данные. Вы уверены?",
          backup: {
            id: backup.id,
            name: backup.backup_name,
            size: this.formatBytes(backup.file_size),
            createdAt: backup.created_at,
          },
        });
      }

      // Запускаем восстановление в фоне
      this.restoreBackupAsync(id, backup.file_path, adminId);

      // Логируем начало восстановления
      await this.logAdminAction(adminId, "restore_start", "backup", id, {
        backupName: backup.backup_name,
      });

      res.json({
        success: true,
        message: "Восстановление из бэкапа запущено",
        backupId: id,
      });
    } catch (error) {
      console.error("❌ Ошибка запуска восстановления:", error);
      res.status(500).json({
        success: false,
        message: "Ошибка запуска восстановления",
      });
    }
  }

  // Удаление бэкапа
  static async deleteBackup(req, res) {
    console.log("🗑️ [AdminBackupsController.deleteBackup] Удаление бэкапа:", {
      adminId: req.admin.id,
      params: req.params,
    });

    try {
      const { id } = req.params;
      const adminId = req.admin.id;

      // Получаем информацию о бэкапе
      const [backup] = await query(
        "SELECT * FROM system_backups WHERE id = ?",
        [id]
      );

      if (!backup) {
        return res.status(404).json({
          success: false,
          message: "Бэкап не найден",
        });
      }

      // Удаляем файл
      if (backup.file_path) {
        try {
          await fs.unlink(backup.file_path);
        } catch (fsError) {
          console.warn("⚠️ Не удалось удалить файл бэкапа:", fsError.message);
        }
      }

      // Удаляем запись из БД
      await query("DELETE FROM system_backups WHERE id = ?", [id]);

      // Логируем удаление
      await this.logAdminAction(adminId, "delete", "backup", id, {
        backupName: backup.backup_name,
        fileSize: backup.file_size,
      });

      res.json({
        success: true,
        message: "Бэкап успешно удален",
      });
    } catch (error) {
      console.error("❌ Ошибка удаления бэкапа:", error);
      res.status(500).json({
        success: false,
        message: "Ошибка удаления бэкапа",
      });
    }
  }

  // Статистика использования диска
  static async getDiskUsage() {
    try {
      const backupsDir = path.join(__dirname, "../../../backups");

      // Проверяем существование директории
      try {
        await fs.access(backupsDir);
      } catch {
        await fs.mkdir(backupsDir, { recursive: true });
        return {
          totalSpace: 0,
          usedSpace: 0,
          freeSpace: 0,
          backupsCount: 0,
        };
      }

      // Получаем список файлов
      const files = await fs.readdir(backupsDir);
      let totalSize = 0;
      const backupFiles = [];

      for (const file of files) {
        if (file.endsWith(".zip")) {
          const filePath = path.join(backupsDir, file);
          try {
            const stats = await fs.stat(filePath);
            totalSize += stats.size;
            backupFiles.push({
              name: file,
              size: stats.size,
              modified: stats.mtime,
            });
          } catch (error) {
            console.warn(
              `⚠️ Не удалось получить информацию о файле ${file}:`,
              error.message
            );
          }
        }
      }

      // Получаем информацию о диске (для Linux/Unix)
      let totalSpace = 0;
      let freeSpace = 0;
      try {
        const { stdout } = await execPromise(`df -k "${backupsDir}" | tail -1`);
        const parts = stdout.trim().split(/\s+/);
        if (parts.length >= 4) {
          totalSpace = parseInt(parts[1]) * 1024; // Байты
          freeSpace = parseInt(parts[3]) * 1024; // Байты
        }
      } catch {
        // Если не удалось получить инфу о диске
        totalSpace = 10 * 1024 * 1024 * 1024; // 10 GB по умолчанию
        freeSpace = totalSpace - totalSize;
      }

      return {
        totalSpace,
        usedSpace: totalSize,
        freeSpace,
        formattedTotal: this.formatBytes(totalSpace),
        formattedUsed: this.formatBytes(totalSize),
        formattedFree: this.formatBytes(freeSpace),
        usagePercentage:
          totalSpace > 0 ? Math.round((totalSize / totalSpace) * 100) : 0,
        backupsCount: backupFiles.length,
        backupFiles: backupFiles.slice(0, 10), // Последние 10 файлов
      };
    } catch (error) {
      console.error("❌ Ошибка получения статистики диска:", error);
      return {
        totalSpace: 0,
        usedSpace: 0,
        freeSpace: 0,
        formattedTotal: "0 B",
        formattedUsed: "0 B",
        formattedFree: "0 B",
        usagePercentage: 0,
        backupsCount: 0,
        backupFiles: [],
      };
    }
  }

  // Вспомогательные методы
  static formatBytes(bytes) {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }

  static async logAdminAction(
    adminId,
    actionType,
    targetType,
    targetId,
    details
  ) {
    try {
      await query(
        `INSERT INTO admin_logs (admin_id, action_type, target_type, target_id, details) 
         VALUES (?, ?, ?, ?, ?)`,
        [adminId, actionType, targetType, targetId, JSON.stringify(details)]
      );
    } catch (error) {
      console.error("Ошибка логирования действия админа:", error);
    }
  }
}

module.exports = AdminBackupsController;
