const cron = require("node-cron");
const config = require("../config");
const cleanupService = require("../services/cleanupService");

// Запуск всех cron задач
function startCleanupSchedule() {
  console.log("📅 Расписание очистки активировано:");

  // 1. Очистка сессий
  cron.schedule(config.CRON_SCHEDULES.CLEANUP_SESSIONS, async () => {
    console.log(
      `⏰ [${config.CRON_SCHEDULES.CLEANUP_SESSIONS}] Запуск ночной очистки сессий`
    );
    await cleanupService.cleanupExpiredSessions();
  });

  // 2. Очистка неактивированных аккаунтов
  cron.schedule(config.CRON_SCHEDULES.CLEANUP_REGISTRATIONS, async () => {
    console.log(
      `⏰ [${config.CRON_SCHEDULES.CLEANUP_REGISTRATIONS}] Запуск очистки неактивированных аккаунтов`
    );
    await cleanupService.cleanupExpiredRegistrations();
  });

  // 3. Очистка токенов восстановления
  cron.schedule(config.CRON_SCHEDULES.CLEANUP_TOKENS, async () => {
    console.log(
      `⏰ [${config.CRON_SCHEDULES.CLEANUP_TOKENS}] Запуск очистки устаревших токенов восстановления`
    );
    await cleanupService.cleanupExpiredResetTokens();
  });

  // 4. НОВАЯ ЗАДАЧА: Очистка старых login_attempts - каждый день в 5:00 утра
  cron.schedule("0 5 * * *", async () => {
    console.log("⏰ [0 5 * * *] Запуск очистки старых записей login_attempts");
    await cleanupService.cleanupOldLoginAttempts();
  });

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
}

module.exports = {
  startCleanupSchedule,
};
