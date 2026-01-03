const { query } = require("./databaseService");
const jwt = require("jsonwebtoken");
const config = require("../config");
const logger = require("./LoggerService");

// Очистка истекших сессий
async function cleanupExpiredSessions() {
  const startTime = Date.now();
  const jobName = "cleanup_sessions";

  logger.warn("Запуск очистки истекших сессий", {
    type: "cron_job",
    job_name: jobName,
    status: "started",
    timestamp: new Date().toISOString(),
  });

  try {
    let deletedCount = 0;

    // Проверяем сессии по JWT
    const sessions = await query(
      "SELECT id, login, jwt_access FROM sessionsdata"
    );

    for (const session of sessions) {
      try {
        jwt.verify(session.jwt_access, config.JWT_SECRET_TWO);
      } catch (tokenError) {
        await query("DELETE FROM sessionsdata WHERE id = ?", [session.id]);
        deletedCount++;
      }
    }

    // Удаляем сессии старше 2 часов
    const twoHoursAgo = new Date(Date.now() - config.MAX_SESSION_AGE);
    const result = await query("DELETE FROM sessionsdata WHERE date < ?", [
      twoHoursAgo,
    ]);

    deletedCount += result.affectedRows || 0;

    const executionTime = Date.now() - startTime;

    logger.warn("Очистка истекших сессий завершена", {
      type: "cron_job",
      job_name: jobName,
      status: "success",
      execution_time_ms: executionTime,
      records_deleted: deletedCount,
      timestamp: new Date().toISOString(),
    });

    return deletedCount;
  } catch (error) {
    logger.error("Ошибка при очистке сессий", {
      type: "cron_job",
      job_name: jobName,
      status: "failed",
      execution_time_ms: Date.now() - startTime,
      error_message: error.message,
      stack_trace: error.stack,
      timestamp: new Date().toISOString(),
    });
    return 0;
  }
}

// Очистка неактивированных аккаунтов
async function cleanupExpiredRegistrations() {
  const startTime = Date.now();
  const jobName = "cleanup_registrations";

  logger.warn("Запуск очистки неактивированных аккаунтов", {
    type: "cron_job",
    job_name: jobName,
    status: "started",
    timestamp: new Date().toISOString(),
  });

  try {
    const users = await query(
      "SELECT login, email, jwt FROM usersdata WHERE logic = 'false'"
    );

    let deletedCount = 0;

    for (const user of users) {
      try {
        jwt.verify(user.jwt, config.JWT_SECRET);
      } catch (tokenError) {
        await query(
          "DELETE FROM usersdata WHERE login = ? AND logic = 'false'",
          [user.login]
        );
        deletedCount++;
      }
    }

    const executionTime = Date.now() - startTime;

    logger.warn("Очистка неактивированных аккаунтов завершена", {
      type: "cron_job",
      job_name: jobName,
      status: "success",
      execution_time_ms: executionTime,
      records_deleted: deletedCount,
      timestamp: new Date().toISOString(),
    });

    return deletedCount;
  } catch (error) {
    logger.error("Ошибка при очистке неактивированных аккаунтов", {
      type: "cron_job",
      job_name: jobName,
      status: "failed",
      execution_time_ms: Date.now() - startTime,
      error_message: error.message,
      stack_trace: error.stack,
      timestamp: new Date().toISOString(),
    });
    return 0;
  }
}

// Очистка устаревших токенов восстановления
async function cleanupExpiredResetTokens() {
  const startTime = Date.now();
  const jobName = "cleanup_tokens";

  logger.warn("Запуск очистки токенов восстановления", {
    type: "cron_job",
    job_name: jobName,
    status: "started",
    timestamp: new Date().toISOString(),
  });

  try {
    const result = await query(
      "DELETE FROM password_resets WHERE expires_at < NOW() OR used = TRUE"
    );

    const deletedCount = result.affectedRows || 0;
    const executionTime = Date.now() - startTime;

    logger.warn("Очистка токенов восстановления завершена", {
      type: "cron_job",
      job_name: jobName,
      status: "success",
      execution_time_ms: executionTime,
      records_deleted: deletedCount,
      timestamp: new Date().toISOString(),
    });

    return deletedCount;
  } catch (error) {
    logger.error("Ошибка очистки токенов восстановления", {
      type: "cron_job",
      job_name: jobName,
      status: "failed",
      execution_time_ms: Date.now() - startTime,
      error_message: error.message,
      stack_trace: error.stack,
      timestamp: new Date().toISOString(),
    });
    return 0;
  }
}

// Очистка старых записей login_attempts (старше 90 дней)
async function cleanupOldLoginAttempts() {
  const startTime = Date.now();
  const jobName = "cleanup_login_attempts";

  logger.warn("Запуск очистки старых login_attempts", {
    type: "cron_job",
    job_name: jobName,
    status: "started",
    timestamp: new Date().toISOString(),
  });

  try {
    // Удаляем записи старше 90 дней
    const result = await query(
      "DELETE FROM login_attempts WHERE created_at < DATE_SUB(NOW(), INTERVAL 90 DAY)"
    );

    const deletedCount = result.affectedRows || 0;
    const executionTime = Date.now() - startTime;

    logger.warn("Очистка старых login_attempts завершена", {
      type: "cron_job",
      job_name: jobName,
      status: "success",
      execution_time_ms: executionTime,
      records_deleted: deletedCount,
      timestamp: new Date().toISOString(),
    });

    return deletedCount;
  } catch (error) {
    logger.error("Ошибка очистки старых login_attempts", {
      type: "cron_job",
      job_name: jobName,
      status: "failed",
      execution_time_ms: Date.now() - startTime,
      error_message: error.message,
      stack_trace: error.stack,
      timestamp: new Date().toISOString(),
    });
    return 0;
  }
}

// Обработка очереди отложенного удаления файлов
async function processFileDeletionQueue() {
  const startTime = Date.now();
  const jobName = "process_file_deletion_queue";

  logger.warn("Запуск обработки очереди удаления файлов", {
    type: "cron_job",
    job_name: jobName,
    status: "started",
    timestamp: new Date().toISOString(),
  });

  try {
    // Импортируем динамически, чтобы избежать циклических зависимостей
    const FileDeletionService = require("./FileDeletionService");

    // Обрабатываем очередь
    const result = await FileDeletionService.processDeletionQueue();

    const executionTime = Date.now() - startTime;

    logger.warn("Обработка очереди удаления завершена", {
      type: "cron_job",
      job_name: jobName,
      status: "success",
      execution_time_ms: executionTime,
      files_processed: result.processed || 0,
      files_failed: result.failed || 0,
      timestamp: new Date().toISOString(),
    });

    // Получаем статистику для дополнительных логов
    try {
      const stats = await FileDeletionService.getQueueStats();
      if (stats.success) {
        logger.info("Статистика очереди удаления файлов", {
          type: "cron_job",
          job_name: jobName,
          stats: stats.stats,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (statsError) {
      logger.error("Не удалось получить статистику очереди", {
        type: "cron_job",
        job_name: jobName,
        error_message: statsError.message,
        timestamp: new Date().toISOString(),
      });
    }

    return result;
  } catch (error) {
    logger.error("Ошибка обработки очереди удаления", {
      type: "cron_job",
      job_name: jobName,
      status: "failed",
      execution_time_ms: Date.now() - startTime,
      error_message: error.message,
      stack_trace: error.stack,
      timestamp: new Date().toISOString(),
    });
    return { processed: 0, failed: 0, error: error.message };
  }
}

module.exports = {
  cleanupExpiredSessions,
  cleanupExpiredRegistrations,
  cleanupExpiredResetTokens,
  cleanupOldLoginAttempts,
  processFileDeletionQueue,
};
