// src/routes/user/userRoutes.js
const express = require("express");
const bcrypt = require("bcryptjs");
const router = express.Router();

// Импорты
const { authenticateToken } = require("../../middleware/auth");
const { query, getConnection } = require("../../services/databaseService");
const { validatePassword } = require("../../utils/validators");
const emailService = require("../../utils/emailService");
const config = require("../../config");
const logger = require("../../services/LoggerService");

// ИМПОРТ fs - ВАЖНО! Добавлены все необходимые импорты
const fs = require("fs").promises;
const path = require("path");

// Получение информации о пользователе
router.get("/user-info", authenticateToken, async (req, res) => {
  const startTime = Date.now();
  const login = req.user.login;

  try {
    logger.info("Начало получения информации о пользователе", {
      type: "user",
      action: "get_user_info_start",
      user_login: login,
      endpoint: req.path,
      method: req.method,
      ip_address: req.ip,
      timestamp: new Date().toISOString(),
    });

    const userInfo = await query(
      "SELECT login, email FROM usersdata WHERE login = ? AND logic = 'true'",
      [login]
    );

    if (userInfo.length === 0) {
      const executionTime = Date.now() - startTime;

      logger.warn("Пользователь не найден при запросе информации", {
        type: "user",
        action: "get_user_info_failed",
        status: "user_not_found",
        user_login: login,
        execution_time_ms: executionTime,
        timestamp: new Date().toISOString(),
      });

      return res.status(404).json({
        success: false,
        message: "Пользователь не найден",
      });
    }

    const executionTime = Date.now() - startTime;

    logger.info("Информация о пользователе успешно получена", {
      type: "user",
      action: "get_user_info_success",
      user_login: login,
      user_email: userInfo[0].email,
      execution_time_ms: executionTime,
      timestamp: new Date().toISOString(),
    });

    res.json({
      success: true,
      user: {
        login: userInfo[0].login,
        email: userInfo[0].email,
      },
    });
  } catch (error) {
    const executionTime = Date.now() - startTime;

    logger.error("Ошибка получения информации о пользователе", {
      type: "user",
      action: "get_user_info_error",
      user_login: login,
      error_name: error.name,
      error_message: error.message,
      stack_trace: error.stack?.substring(0, 500),
      execution_time_ms: executionTime,
      timestamp: new Date().toISOString(),
    });

    res.status(500).json({
      success: false,
      message: "Ошибка получения информации",
    });
  }
});

// Смена пароля с кодовым словом
router.post("/change-password", authenticateToken, async (req, res) => {
  const startTime = Date.now();
  const login = req.user.login;

  try {
    logger.info("Начало смены пароля с проверкой кодового слова", {
      type: "user",
      action: "change_password_start",
      user_login: login,
      endpoint: req.path,
      method: req.method,
      ip_address: req.ip,
      timestamp: new Date().toISOString(),
    });

    const { currentPassword, newPassword, secretWord } = req.body;

    // 1. Базовая валидация
    if (!currentPassword || !newPassword || !secretWord) {
      const executionTime = Date.now() - startTime;

      logger.warn("Отсутствуют обязательные поля при смене пароля", {
        type: "user",
        action: "change_password_failed",
        status: "missing_fields",
        user_login: login,
        missing_field: !currentPassword
          ? "currentPassword"
          : !newPassword
          ? "newPassword"
          : "secretWord",
        execution_time_ms: executionTime,
        timestamp: new Date().toISOString(),
      });

      return res.status(400).json({
        success: false,
        message: !currentPassword
          ? "Введите текущий пароль"
          : !newPassword
          ? "Введите новый пароль"
          : "Введите кодовое слово",
        field: !currentPassword
          ? "currentPassword"
          : !newPassword
          ? "newPassword"
          : "secretWord",
      });
    }

    if (typeof secretWord !== "string") {
      const executionTime = Date.now() - startTime;

      logger.warn("Кодовое слово не является строкой", {
        type: "user",
        action: "change_password_failed",
        status: "invalid_secret_word_type",
        user_login: login,
        execution_time_ms: executionTime,
        timestamp: new Date().toISOString(),
      });

      return res.status(400).json({
        success: false,
        message: "Кодовое слово должно быть текстом",
        field: "secretWord",
      });
    }

    const trimmedSecretWord = secretWord.trim();
    if (trimmedSecretWord === "") {
      const executionTime = Date.now() - startTime;

      logger.warn("Кодовое слово пустое", {
        type: "user",
        action: "change_password_failed",
        status: "empty_secret_word",
        user_login: login,
        execution_time_ms: executionTime,
        timestamp: new Date().toISOString(),
      });

      return res.status(400).json({
        success: false,
        message: "Введите кодовое слово",
        field: "secretWord",
      });
    }

    // 2. Проверка сложности нового пароля
    try {
      validatePassword(newPassword);
    } catch (validationError) {
      const executionTime = Date.now() - startTime;

      logger.warn("Ошибка валидации нового пароля", {
        type: "user",
        action: "change_password_failed",
        status: "password_validation_error",
        user_login: login,
        error_message: validationError.message,
        field: validationError.field,
        execution_time_ms: executionTime,
        timestamp: new Date().toISOString(),
      });

      return res.status(400).json({
        success: false,
        message: validationError.message,
        field: "newPassword",
      });
    }

    // 3. Задержка для предотвращения timing-атак
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 4. Получаем данные пользователя
    const user = await query(
      "SELECT login, email, password, secret_word, blocked FROM usersdata WHERE login = ? AND logic = 'true'",
      [login]
    );

    if (!user || user.length === 0) {
      const executionTime = Date.now() - startTime;

      logger.warn("Пользователь не найден при смене пароля", {
        type: "user",
        action: "change_password_failed",
        status: "user_not_found",
        user_login: login,
        execution_time_ms: executionTime,
        timestamp: new Date().toISOString(),
      });

      return res.status(404).json({
        success: false,
        message: "Пользователь не найден",
      });
    }

    const userData = user[0];
    const userEmail = userData.email;

    // 5. Проверяем, не заблокирован ли пользователь
    if (userData.blocked === 1) {
      const executionTime = Date.now() - startTime;

      logger.warn("Попытка смены пароля заблокированным пользователем", {
        type: "user",
        action: "change_password_failed",
        status: "account_blocked",
        user_login: login,
        user_email: userEmail,
        execution_time_ms: executionTime,
        timestamp: new Date().toISOString(),
      });

      return res.status(403).json({
        success: false,
        message: "Аккаунт заблокирован. Обратитесь в техническую поддержку.",
      });
    }

    // 6. Получаем количество существующих попыток смены пароля по EMAIL
    let attemptCount = 0;
    let attemptsRecordId = null;

    try {
      const attemptsResult = await query(
        "SELECT id, attempts FROM password_reset_attempts WHERE email = ?",
        [userEmail]
      );

      if (attemptsResult && attemptsResult.length > 0) {
        attemptCount = attemptsResult[0].attempts || 0;
        attemptsRecordId = attemptsResult[0].id;
      }
    } catch (attemptsError) {
      logger.warn("Ошибка получения попыток смены пароля", {
        type: "user",
        action: "change_password_warning",
        user_login: login,
        error_message: attemptsError.message,
        timestamp: new Date().toISOString(),
      });
    }

    // 7. Проверяем лимит (3 НЕУДАЧНЫЕ попытки)
    if (attemptCount >= 3) {
      logger.warn(
        "Блокировка пользователя за 3 неудачные попытки смены пароля",
        {
          type: "user",
          action: "account_blocked",
          user_login: login,
          user_email: userEmail,
          attempt_count: attemptCount,
          max_attempts: 3,
          ip_address: req.ip,
          timestamp: new Date().toISOString(),
        }
      );

      try {
        // Блокируем пользователя
        await query(
          `UPDATE usersdata 
           SET blocked = 1, blocked_until = '2099-12-31 23:59:59'
           WHERE login = ? AND logic = 'true'`,
          [login]
        );

        // ОТПРАВЛЯЕМ EMAIL О БЛОКИРОВКЕ
        try {
          await emailService.sendAccountBlocked({
            login: userData.login,
            email: userEmail,
            reason: "Превышено количество попыток смены пароля",
            supportUrl: config.SUPPORT_URL,
            ipAddress: req.ip || "unknown",
            userAgent: req.headers["user-agent"] || "",
          });
        } catch (emailError) {
          logger.warn("Ошибка отправки email о блокировке", {
            type: "user",
            action: "block_email_error",
            user_login: login,
            user_email: userEmail,
            error_message: emailError.message,
            timestamp: new Date().toISOString(),
          });
        }
      } catch (blockError) {
        logger.error("Ошибка блокировки пользователя", {
          type: "user",
          action: "block_error",
          user_login: login,
          error_message: blockError.message,
          timestamp: new Date().toISOString(),
        });
      }

      const executionTime = Date.now() - startTime;

      logger.info(
        "Пользователь заблокирован за превышение попыток смены пароля",
        {
          type: "user",
          action: "change_password_failed",
          status: "max_attempts_exceeded",
          user_login: login,
          user_email: userEmail,
          execution_time_ms: executionTime,
          timestamp: new Date().toISOString(),
        }
      );

      return res.status(401).json({
        success: false,
        message:
          "Превышено количество попыток. Аккаунт заблокирован. Обратитесь в техническую поддержку.",
      });
    }

    // 8. Проверяем наличие кодового слова в БД
    if (!userData.secret_word || userData.secret_word.trim() === "") {
      // Фиксируем попытку по EMAIL
      try {
        if (attemptsRecordId) {
          await query(
            "UPDATE password_reset_attempts SET attempts = attempts + 1, last_attempt = NOW() WHERE id = ?",
            [attemptsRecordId]
          );
        } else {
          await query(
            `INSERT INTO password_reset_attempts (email, attempts, last_attempt, ip_address, user_agent)
             VALUES (?, 1, NOW(), ?, ?)`,
            [userEmail, req.ip || "unknown", req.headers["user-agent"] || ""]
          );
        }
      } catch (updateError) {
        logger.warn("Не удалось зафиксировать попытку", {
          type: "user",
          action: "attempt_record_error",
          user_login: login,
          error_message: updateError.message,
          timestamp: new Date().toISOString(),
        });
      }

      const executionTime = Date.now() - startTime;

      logger.warn("Кодовое слово не установлено для пользователя", {
        type: "user",
        action: "change_password_failed",
        status: "secret_word_not_set",
        user_login: login,
        user_email: userEmail,
        execution_time_ms: executionTime,
        timestamp: new Date().toISOString(),
      });

      return res.status(400).json({
        success: false,
        message:
          "Для вашего аккаунта не установлено кодовое слово. Обратитесь в техническую поддержку.",
        field: "secretWord",
      });
    }

    // 9. Проверяем кодовое слово
    const isValidSecretWord = await bcrypt.compare(
      trimmedSecretWord,
      userData.secret_word
    );

    if (!isValidSecretWord) {
      // ФИКСИРУЕМ НЕУДАЧНУЮ ПОПЫТКУ по EMAIL
      try {
        let newAttemptCount = attemptCount + 1;

        if (attemptsRecordId) {
          await query(
            "UPDATE password_reset_attempts SET attempts = attempts + 1, last_attempt = NOW() WHERE id = ?",
            [attemptsRecordId]
          );
        } else {
          await query(
            `INSERT INTO password_reset_attempts (email, attempts, last_attempt, ip_address, user_agent)
             VALUES (?, 1, NOW(), ?, ?)`,
            [userEmail, req.ip || "unknown", req.headers["user-agent"] || ""]
          );
          newAttemptCount = 1;
        }

        // Проверяем, не достигли ли лимита
        if (newAttemptCount >= 3) {
          logger.warn(
            "Достигнут лимит неудачных попыток смены пароля - блокировка",
            {
              type: "user",
              action: "account_blocked",
              user_login: login,
              user_email: userEmail,
              attempt_count: newAttemptCount,
              max_attempts: 3,
              timestamp: new Date().toISOString(),
            }
          );

          try {
            // Блокируем пользователя
            await query(
              `UPDATE usersdata 
               SET blocked = 1, blocked_until = '2099-12-31 23:59:59'
               WHERE login = ? AND logic = 'true'`,
              [login]
            );

            // ОТПРАВЛЯЕМ EMAIL О БЛОКИРОВКЕ
            try {
              await emailService.sendAccountBlocked({
                login: userData.login,
                email: userEmail,
                reason: "3 неудачные попытки смены пароля",
                supportUrl: config.SUPPORT_URL,
                ipAddress: req.ip || "unknown",
                userAgent: req.headers["user-agent"] || "",
              });
            } catch (emailError) {
              logger.warn("Ошибка отправки email о блокировке", {
                type: "user",
                action: "block_email_error",
                user_login: login,
                user_email: userEmail,
                error_message: emailError.message,
                timestamp: new Date().toISOString(),
              });
            }
          } catch (blockError) {
            logger.error("Ошибка при блокировке пользователя", {
              type: "user",
              action: "block_error",
              user_login: login,
              error_message: blockError.message,
              timestamp: new Date().toISOString(),
            });
          }

          const executionTime = Date.now() - startTime;

          logger.info("Пользователь заблокирован за неверное кодовое слово", {
            type: "user",
            action: "change_password_failed",
            status: "max_attempts_exceeded_secret_word",
            user_login: login,
            user_email: userEmail,
            execution_time_ms: executionTime,
            timestamp: new Date().toISOString(),
          });

          return res.status(401).json({
            success: false,
            message:
              "Превышено количество попыток. Аккаунт заблокирован. Обратитесь в техническую поддержку.",
          });
        }
      } catch (updateError) {
        logger.warn("Не удалось зафиксировать неудачную попытку", {
          type: "user",
          action: "attempt_record_error",
          user_login: login,
          error_message: updateError.message,
          timestamp: new Date().toISOString(),
        });
      }

      const remainingAttempts = 3 - (attemptCount + 1);
      let message = "Неверное кодовое слово";
      if (remainingAttempts > 0) {
        message += `. Осталось попыток: ${remainingAttempts}`;
      }

      const executionTime = Date.now() - startTime;

      logger.warn("Неверное кодовое слово при смене пароля", {
        type: "user",
        action: "change_password_failed",
        status: "invalid_secret_word",
        user_login: login,
        user_email: userEmail,
        remaining_attempts: remainingAttempts,
        execution_time_ms: executionTime,
        timestamp: new Date().toISOString(),
      });

      return res.status(400).json({
        success: false,
        message: message,
        field: "secretWord",
      });
    }

    // 10. Если кодовое слово ВЕРНО - удаляем все попытки по EMAIL
    try {
      await query("DELETE FROM password_reset_attempts WHERE email = ?", [
        userEmail,
      ]);
    } catch (deleteError) {
      logger.warn("Не удалось удалить попытки смены пароля", {
        type: "user",
        action: "delete_attempts_error",
        user_login: login,
        user_email: userEmail,
        error_message: deleteError.message,
        timestamp: new Date().toISOString(),
      });
    }

    // 11. Проверяем текущий пароль
    const validPassword = await bcrypt.compare(
      currentPassword,
      userData.password
    );

    if (!validPassword) {
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const executionTime = Date.now() - startTime;

      logger.warn("Неверный текущий пароль при смене пароля", {
        type: "user",
        action: "change_password_failed",
        status: "invalid_current_password",
        user_login: login,
        user_email: userEmail,
        execution_time_ms: executionTime,
        timestamp: new Date().toISOString(),
      });

      return res.status(400).json({
        success: false,
        message: "Неверный текущий пароль",
        field: "currentPassword",
      });
    }

    // 12. Проверяем, что новый пароль отличается от текущего
    const samePassword = await bcrypt.compare(newPassword, userData.password);
    if (samePassword) {
      const executionTime = Date.now() - startTime;

      logger.warn("Новый пароль совпадает с текущим", {
        type: "user",
        action: "change_password_failed",
        status: "same_password",
        user_login: login,
        user_email: userEmail,
        execution_time_ms: executionTime,
        timestamp: new Date().toISOString(),
      });

      return res.status(400).json({
        success: false,
        message: "Новый пароль должен отличаться от текущего",
        field: "newPassword",
      });
    }

    // 13. Хэшируем новый пароль
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // 14. Обновляем пароль в базе
    await query(
      "UPDATE usersdata SET password = ? WHERE login = ? AND logic = 'true'",
      [hashedPassword, login]
    );

    // 15. Удаляем все сессии пользователя
    await query("DELETE FROM sessionsdata WHERE login = ?", [login]);

    // 16. Отправляем email уведомление
    try {
      await emailService.sendPasswordChanged({
        login: login,
        email: userEmail,
        userIp: req.ip || req.connection.remoteAddress,
        userAgent: req.headers["user-agent"] || "Неизвестное устройство",
      });
    } catch (emailError) {
      logger.warn("Ошибка отправки email уведомления о смене пароля", {
        type: "user",
        action: "password_change_email_error",
        user_login: login,
        user_email: userEmail,
        error_message: emailError.message,
        timestamp: new Date().toISOString(),
      });
    }

    // 17. Возвращаем успех
    const executionTime = Date.now() - startTime;

    logger.info("Пароль успешно изменен", {
      type: "user",
      action: "change_password_success",
      user_login: login,
      user_email: userEmail,
      email_sent: true,
      sessions_deleted: true,
      execution_time_ms: executionTime,
      timestamp: new Date().toISOString(),
    });

    res.json({
      success: true,
      message: "Пароль успешно изменен",
      requireReauth: true,
      emailSent: true,
    });
  } catch (error) {
    const executionTime = Date.now() - startTime;

    if (error.name === "ValidationError") {
      logger.warn("Ошибка валидации при смене пароля", {
        type: "user",
        action: "change_password_failed",
        status: "validation_error",
        user_login: login,
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

    logger.error("Ошибка смены пароля", {
      type: "user",
      action: "change_password_error",
      user_login: login,
      error_name: error.name,
      error_message: error.message,
      stack_trace: error.stack?.substring(0, 500),
      execution_time_ms: executionTime,
      timestamp: new Date().toISOString(),
    });

    res.status(500).json({
      success: false,
      message: "Ошибка смены пароля",
    });
  }
});

// Удаление аккаунта (оптимальная версия)
router.delete("/delete-account", authenticateToken, async (req, res) => {
  const startTime = Date.now();
  const login = req.user.login;
  let connection;

  try {
    logger.info("Начало удаления аккаунта", {
      type: "user",
      action: "delete_account_start",
      user_login: login,
      endpoint: req.path,
      method: req.method,
      ip_address: req.ip,
      timestamp: new Date().toISOString(),
    });

    const userDir = path.join(config.UPLOAD_DIR, login);

    connection = await getConnection();
    await connection.beginTransaction();

    // Удаляем данные пользователя
    await connection.execute(`DROP TABLE IF EXISTS \`${login}\``);
    await connection.execute("DELETE FROM sessionsdata WHERE login = ?", [
      login,
    ]);

    const [userResult] = await connection.execute(
      "DELETE FROM usersdata WHERE login = ? AND logic = 'true'",
      [login]
    );

    if (userResult.affectedRows === 0) {
      throw new Error("Пользователь не найден в базе данных");
    }

    await connection.execute("DELETE FROM login_attempts WHERE login = ?", [
      login,
    ]);

    await connection.execute(
      "DELETE FROM password_resets WHERE email IN (SELECT email FROM usersdata WHERE login = ?)",
      [login]
    );

    // Удаляем файлы пользователя
    try {
      await fs.access(userDir);
      await fs.rm(userDir, { recursive: true, force: true });

      logger.info("Директория пользователя удалена", {
        type: "user",
        action: "delete_account_directory",
        user_login: login,
        directory_path: userDir,
        timestamp: new Date().toISOString(),
      });
    } catch (dirError) {
      logger.warn("Директория пользователя не найдена", {
        type: "user",
        action: "delete_account_directory_missing",
        user_login: login,
        directory_path: userDir,
        error_message: dirError.message,
        timestamp: new Date().toISOString(),
      });
    }

    await connection.commit();

    const executionTime = Date.now() - startTime;

    logger.info("Аккаунт успешно удален", {
      type: "user",
      action: "delete_account_success",
      user_login: login,
      tables_dropped: true,
      sessions_deleted: true,
      user_data_deleted: true,
      login_attempts_deleted: true,
      password_resets_deleted: true,
      execution_time_ms: executionTime,
      timestamp: new Date().toISOString(),
    });

    res.json({
      success: true,
      message: "Аккаунт успешно удален",
    });
  } catch (error) {
    const executionTime = Date.now() - startTime;

    if (connection) {
      await connection.rollback();
    }

    if (error.message.includes("не найден")) {
      logger.warn("Пользователь не найден при удалении аккаунта", {
        type: "user",
        action: "delete_account_failed",
        status: "user_not_found",
        user_login: login,
        execution_time_ms: executionTime,
        timestamp: new Date().toISOString(),
      });

      return res.status(404).json({
        success: false,
        message: "Пользователь не найден",
      });
    }

    logger.error("Ошибка удаления аккаунта", {
      type: "user",
      action: "delete_account_error",
      user_login: login,
      error_name: error.name,
      error_message: error.message,
      stack_trace: error.stack?.substring(0, 500),
      execution_time_ms: executionTime,
      timestamp: new Date().toISOString(),
    });

    res.status(500).json({
      success: false,
      message: "Ошибка удаления аккаунта",
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

module.exports = router;
