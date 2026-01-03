const cron = require("node-cron");
const config = require("../config");
const cleanupService = require("../services/cleanupService");
const logger = require("../services/LoggerService");

// Запуск всех cron задач
function startCleanupSchedule() {
  logger.warn("Активация расписания очистки", {
    type: "cron_job",
    job_name: "schedule_activation",
    status: "started",
    timestamp: new Date().toISOString(),
  });

  console.log("📅 Расписание очистки активировано:");

  // 1. Очистка сессий
  cron.schedule(config.CRON_SCHEDULES.CLEANUP_SESSIONS, async () => {
    logger.warn("Запуск cron задачи: очистка сессий", {
      type: "cron_job",
      job_name: "cleanup_sessions",
      status: "scheduled",
      schedule: config.CRON_SCHEDULES.CLEANUP_SESSIONS,
      timestamp: new Date().toISOString(),
    });
    await cleanupService.cleanupExpiredSessions();
  });

  // 2. Очистка неактивированных аккаунтов
  cron.schedule(config.CRON_SCHEDULES.CLEANUP_REGISTRATIONS, async () => {
    logger.warn("Запуск cron задачи: очистка неактивированных аккаунтов", {
      type: "cron_job",
      job_name: "cleanup_registrations",
      status: "scheduled",
      schedule: config.CRON_SCHEDULES.CLEANUP_REGISTRATIONS,
      timestamp: new Date().toISOString(),
    });
    await cleanupService.cleanupExpiredRegistrations();
  });

  // 3. Очистка токенов восстановления
  cron.schedule(config.CRON_SCHEDULES.CLEANUP_TOKENS, async () => {
    logger.warn(
      "Запуск cron задачи: очистка устаревших токенов восстановления",
      {
        type: "cron_job",
        job_name: "cleanup_tokens",
        status: "scheduled",
        schedule: config.CRON_SCHEDULES.CLEANUP_TOKENS,
        timestamp: new Date().toISOString(),
      }
    );
    await cleanupService.cleanupExpiredResetTokens();
  });

  // 4. Очистка старых login_attempts - каждый день в 5:00 утра
  cron.schedule("0 5 * * *", async () => {
    logger.warn("Запуск cron задачи: очистка старых записей login_attempts", {
      type: "cron_job",
      job_name: "cleanup_login_attempts",
      status: "scheduled",
      schedule: "0 5 * * *",
      timestamp: new Date().toISOString(),
    });
    await cleanupService.cleanupOldLoginAttempts();
  });

  // 5. Обработка очереди удаления файлов - каждые 10 минут
  cron.schedule("*/10 * * * *", async () => {
    logger.warn("Запуск cron задачи: обработка очереди удаления файлов", {
      type: "cron_job",
      job_name: "process_file_deletion_queue",
      status: "scheduled",
      schedule: "*/10 * * * *",
      timestamp: new Date().toISOString(),
    });
    try {
      const result = await cleanupService.processFileDeletionQueue();
      logger.info("Результат обработки очереди удаления файлов", {
        type: "cron_job",
        job_name: "process_file_deletion_queue",
        result: result,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Ошибка обработки очереди удаления файлов", {
        type: "cron_job",
        job_name: "process_file_deletion_queue",
        error_message: error.message,
        stack_trace: error.stack,
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Логируем активацию расписания
  logger.warn("Расписание очистки активировано", {
    type: "cron_job",
    job_name: "schedule_activation",
    status: "completed",
    schedules: {
      sessions: config.CRON_SCHEDULES.CLEANUP_SESSIONS,
      registrations: config.CRON_SCHEDULES.CLEANUP_REGISTRATIONS,
      tokens: config.CRON_SCHEDULES.CLEANUP_TOKENS,
      login_attempts: "0 5 * * *",
      file_deletion: "*/10 * * * *",
    },
    timestamp: new Date().toISOString(),
  });

  // Выводим информацию в консоль (для удобства разработки)
  console.log(
    `   • Истекшие сессии: каждый день в ${config.CRON_SCHEDULES.CLEANUP_SESSIONS}`
  );
  console.log(
    `   • Неактивированные аккаунты: каждый день в ${config.CRON_SCHEDULES.CLEANUP_REGISTRATIONS}`
  );
  console.log(
    `   • Устаревшие токены: каждый день в ${config.CRON_SCHEDULES.CLEANUP_TOKENS}`
  );
  console.log(`   • Старые login_attempts: каждый день в 0 5 * * *`);
  console.log(`   • Время сервера: ${new Date().toString()}`);
  console.log(
    `   • Очередь удаления файлов: каждые 10 минут (0,10,20,30,40,50 минуты)`
  );
}

module.exports = {
  startCleanupSchedule,
};
