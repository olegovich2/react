const express = require("express");
const bcrypt = require("bcryptjs");
const validator = require("validator");
const router = express.Router();

// Импорты
const passwordResetService = require("../../services/passwordResetService");
const emailService = require("../../utils/emailService");
const { query } = require("../../services/databaseService");
const { validatePassword } = require("../../utils/validators");
const config = require("../../config");
const logger = require("../../services/LoggerService");

// Восстановление пароля - запрос с проверкой кодового слова
router.post("/forgot-password", async (req, res) => {
  const startTime = Date.now();
  const email = req.body.email;

  try {
    logger.info("Начало процесса восстановления пароля", {
      type: "password_reset",
      action: "forgot_password_start",
      user_email: email,
      endpoint: req.path,
      method: req.method,
      ip_address: req.ip,
      timestamp: new Date().toISOString(),
    });

    const { secretWord } = req.body;

    // Универсальное сообщение для безопасности (только для финального успеха)
    const SECURITY_SUCCESS_MESSAGE =
      "Если email зарегистрирован в системе, на него отправлена инструкция";

    // 1. Базовая валидация email
    if (!email) {
      logger.warn("Отсутствует email в запросе восстановления пароля", {
        type: "password_reset",
        action: "forgot_password_failed",
        status: "missing_email",
        field: "email",
        execution_time_ms: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      });

      return res.status(400).json({
        success: false,
        message: "Введите email адрес",
        field: "email",
      });
    }

    if (!validator.isEmail(email)) {
      logger.warn("Невалидный email в запросе восстановления пароля", {
        type: "password_reset",
        action: "forgot_password_failed",
        status: "invalid_email",
        user_email: email,
        field: "email",
        execution_time_ms: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      });

      return res.status(400).json({
        success: false,
        message: "Введите корректный email адрес",
        field: "email",
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // 2. Проверяем наличие кодового слова
    if (!secretWord) {
      logger.warn("Отсутствует кодовое слово", {
        type: "password_reset",
        action: "forgot_password_failed",
        status: "missing_secret_word",
        user_email: normalizedEmail,
        field: "secretWord",
        execution_time_ms: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      });

      return res.status(400).json({
        success: false,
        message: "Введите кодовое слово",
        field: "secretWord",
      });
    }

    if (typeof secretWord !== "string") {
      logger.warn("Неверный тип кодового слова", {
        type: "password_reset",
        action: "forgot_password_failed",
        status: "invalid_secret_word_type",
        user_email: normalizedEmail,
        field: "secretWord",
        execution_time_ms: Date.now() - startTime,
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
      logger.warn("Пустое кодовое слово", {
        type: "password_reset",
        action: "forgot_password_failed",
        status: "empty_secret_word",
        user_email: normalizedEmail,
        field: "secretWord",
        execution_time_ms: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      });

      return res.status(400).json({
        success: false,
        message: "Введите кодовое слово",
        field: "secretWord",
      });
    }

    // 3. Задержка для предотвращения timing-атак
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 4. Ищем пользователя
    const userResult = await query(
      "SELECT login, email, secret_word, blocked FROM usersdata WHERE email = ? AND logic = 'true'",
      [normalizedEmail]
    );

    // 5. Проверяем результат запроса
    let user = null;

    if (userResult) {
      if (Array.isArray(userResult) && userResult.length > 0) {
        user = userResult[0];
      } else if (userResult.login !== undefined) {
        user = userResult;
      } else if (userResult[0] && userResult[0].login !== undefined) {
        user = userResult[0];
      }
    }

    // 6. Получаем количество существующих попыток
    let attemptCount = 0;
    let attemptsRecordId = null;

    if (user) {
      try {
        const attemptsResult = await query(
          "SELECT id, attempts FROM password_reset_attempts WHERE email = ?",
          [normalizedEmail]
        );

        if (attemptsResult) {
          if (Array.isArray(attemptsResult) && attemptsResult.length > 0) {
            attemptCount = attemptsResult[0].attempts || 0;
            attemptsRecordId = attemptsResult[0].id;
          } else if (attemptsResult.attempts !== undefined) {
            attemptCount = attemptsResult.attempts || 0;
            attemptsRecordId = attemptsResult.id;
          } else if (
            attemptsResult[0] &&
            attemptsResult[0].attempts !== undefined
          ) {
            attemptCount = attemptsResult[0].attempts || 0;
            attemptsRecordId = attemptsResult[0].id;
          }
        }
      } catch (attemptsError) {
        logger.error("Ошибка получения попыток восстановления пароля", {
          type: "password_reset",
          action: "attempts_query_error",
          user_email: normalizedEmail,
          error_message: attemptsError.message,
          execution_time_ms: Date.now() - startTime,
          timestamp: new Date().toISOString(),
        });
      }
    }

    // 7. Если пользователя НЕТ - показываем ошибку
    if (!user) {
      logger.warn("Пользователь не найден для восстановления пароля", {
        type: "password_reset",
        action: "forgot_password_failed",
        status: "user_not_found",
        user_email: normalizedEmail,
        execution_time_ms: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      });

      return res.status(404).json({
        success: false,
        message: "Пользователь с таким email не найден",
        field: "email",
      });
    }

    // 8. Проверяем, не заблокирован ли уже пользователь
    if (user.blocked === 1) {
      logger.warn(
        "Попытка восстановления пароля заблокированного пользователя",
        {
          type: "password_reset",
          action: "forgot_password_failed",
          status: "account_blocked",
          user_login: user.login,
          user_email: normalizedEmail,
          execution_time_ms: Date.now() - startTime,
          timestamp: new Date().toISOString(),
        }
      );

      return res.status(403).json({
        success: false,
        message: "Аккаунт заблокирован. Обратитесь в техническую поддержку.",
      });
    }

    // 9. Проверяем лимит (3 НЕУДАЧНЫЕ попытки)
    if (attemptCount >= 3) {
      logger.warn("Превышен лимит попыток восстановления пароля", {
        type: "password_reset",
        action: "account_blocked",
        user_login: user.login,
        user_email: normalizedEmail,
        attempt_count: attemptCount,
        max_attempts: 3,
        execution_time_ms: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      });

      try {
        // Блокируем пользователя
        await query(
          `UPDATE usersdata 
           SET blocked = 1, blocked_until = '2099-12-31 23:59:59'
           WHERE email = ? AND logic = 'true'`,
          [normalizedEmail]
        );

        // ОТПРАВЛЯЕМ EMAIL О БЛОКИРОВКЕ
        try {
          await emailService.sendAccountBlocked({
            login: user.login,
            email: user.email,
            reason: "Превышено количество попыток восстановления пароля",
            supportUrl: config.SUPPORT_URL,
            ipAddress: req.ip || "unknown",
            userAgent: req.headers["user-agent"] || "",
          });

          logger.info("Email о блокировке отправлен", {
            type: "password_reset",
            action: "block_email_sent",
            user_login: user.login,
            user_email: normalizedEmail,
            timestamp: new Date().toISOString(),
          });
        } catch (emailError) {
          logger.error("Ошибка отправки email о блокировке", {
            type: "password_reset",
            action: "block_email_error",
            user_email: normalizedEmail,
            error_message: emailError.message,
            timestamp: new Date().toISOString(),
          });
        }
      } catch (blockError) {
        logger.error("Ошибка блокировки пользователя", {
          type: "password_reset",
          action: "block_error",
          user_email: normalizedEmail,
          error_message: blockError.message,
          timestamp: new Date().toISOString(),
        });
      }

      return res.status(403).json({
        success: false,
        message:
          "Превышено количество попыток. Аккаунт заблокирован. Обратитесь в техническую поддержку.",
      });
    }

    // 10. Проверяем наличие кодового слова в БД
    if (!user.secret_word || user.secret_word.trim() === "") {
      logger.warn("Кодовое слово не установлено для пользователя", {
        type: "password_reset",
        action: "forgot_password_failed",
        status: "secret_word_not_set",
        user_login: user.login,
        user_email: normalizedEmail,
        execution_time_ms: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      });

      // Фиксируем попытку
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
            [
              normalizedEmail,
              req.ip || "unknown",
              req.headers["user-agent"] || "",
            ]
          );
        }
      } catch (updateError) {
        logger.warn("Не удалось зафиксировать попытку восстановления", {
          type: "password_reset",
          action: "attempt_log_error",
          user_email: normalizedEmail,
          error_message: updateError.message,
          timestamp: new Date().toISOString(),
        });
      }

      return res.status(400).json({
        success: false,
        message:
          "Для вашего аккаунта не установлено кодовое слово. Обратитесь в техническую поддержку.",
        field: "secretWord",
      });
    }

    // 11. Сравниваем кодовое слово с хэшем
    const isValidSecretWord = await bcrypt.compare(
      trimmedSecretWord,
      user.secret_word
    );

    if (!isValidSecretWord) {
      logger.warn("Неверное кодовое слово при восстановлении пароля", {
        type: "password_reset",
        action: "forgot_password_failed",
        status: "invalid_secret_word",
        user_login: user.login,
        user_email: normalizedEmail,
        attempt_count: attemptCount + 1,
        execution_time_ms: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      });

      // ФИКСИРУЕМ НЕУДАЧНУЮ ПОПЫТКУ
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
            [
              normalizedEmail,
              req.ip || "unknown",
              req.headers["user-agent"] || "",
            ]
          );
          newAttemptCount = 1;
        }

        // Проверяем, не достигли ли лимита
        if (newAttemptCount >= 3) {
          try {
            // Блокируем пользователя
            await query(
              `UPDATE usersdata 
               SET blocked = 1, blocked_until = '2099-12-31 23:59:59'
               WHERE email = ? AND logic = 'true'`,
              [normalizedEmail]
            );

            logger.warn("Аккаунт заблокирован после 3 неудачных попыток", {
              type: "password_reset",
              action: "account_blocked",
              user_login: user.login,
              user_email: normalizedEmail,
              attempt_count: newAttemptCount,
              timestamp: new Date().toISOString(),
            });

            // ОТПРАВЛЯЕМ EMAIL О БЛОКИРОВКЕ
            try {
              await emailService.sendAccountBlocked({
                login: user.login,
                email: user.email,
                reason: "3 неудачные попытки восстановления пароля",
                supportUrl: config.SUPPORT_URL,
                ipAddress: req.ip || "unknown",
                userAgent: req.headers["user-agent"] || "",
              });
            } catch (emailError) {
              logger.error("Ошибка отправки email о блокировке", {
                type: "password_reset",
                action: "block_email_error",
                user_email: normalizedEmail,
                error_message: emailError.message,
                timestamp: new Date().toISOString(),
              });
            }
          } catch (blockError) {
            logger.error("Ошибка при блокировке аккаунта", {
              type: "password_reset",
              action: "block_error",
              user_email: normalizedEmail,
              error_message: blockError.message,
              timestamp: new Date().toISOString(),
            });
          }

          return res.status(403).json({
            success: false,
            message:
              "Превышено количество попыток. Аккаунт заблокирован. Обратитесь в техническую поддержку.",
          });
        }
      } catch (updateError) {
        logger.warn("Не удалось зафиксировать неудачную попытку", {
          type: "password_reset",
          action: "attempt_log_error",
          user_email: normalizedEmail,
          error_message: updateError.message,
          timestamp: new Date().toISOString(),
        });
      }

      const remainingAttempts = 3 - (attemptCount + 1);

      let message = "Неверное кодовое слово";
      if (remainingAttempts > 0) {
        message += `. Осталось попыток: ${remainingAttempts}`;
      }

      return res.status(400).json({
        success: false,
        message: message,
        field: "secretWord",
      });
    }

    // 12. Если кодовое слово ВЕРНО - удаляем все попытки
    logger.info("Кодовое слово проверено успешно", {
      type: "password_reset",
      action: "secret_word_validated",
      user_login: user.login,
      user_email: normalizedEmail,
      execution_time_ms: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    });

    try {
      if (attemptsRecordId) {
        await query("DELETE FROM password_reset_attempts WHERE id = ?", [
          attemptsRecordId,
        ]);
      } else {
        await query("DELETE FROM password_reset_attempts WHERE email = ?", [
          normalizedEmail,
        ]);
      }
    } catch (deleteError) {
      logger.warn("Не удалось удалить записи о попытках", {
        type: "password_reset",
        action: "attempts_cleanup_error",
        user_email: normalizedEmail,
        error_message: deleteError.message,
        timestamp: new Date().toISOString(),
      });
    }

    // 13. Создаем токен восстановления и отправляем email
    try {
      const resetToken = await passwordResetService.createToken(user.email);

      await emailService.sendPasswordReset({
        login: user.login,
        email: user.email,
        resetToken: resetToken,
      });

      logger.info("Email восстановления пароля отправлен", {
        type: "password_reset",
        action: "reset_email_sent",
        user_login: user.login,
        user_email: normalizedEmail,
        timestamp: new Date().toISOString(),
      });
    } catch (serviceError) {
      logger.error("Ошибка сервиса восстановления пароля", {
        type: "password_reset",
        action: "reset_token_error",
        user_email: normalizedEmail,
        error_message: serviceError.message,
        stack_trace: serviceError.stack,
        timestamp: new Date().toISOString(),
      });
    }

    // 14. Возвращаем успех
    const executionTime = Date.now() - startTime;

    logger.info("Восстановление пароля успешно инициировано", {
      type: "password_reset",
      action: "forgot_password_success",
      user_login: user.login,
      user_email: normalizedEmail,
      execution_time_ms: executionTime,
      timestamp: new Date().toISOString(),
    });

    res.status(200).json({
      success: true,
      message: SECURITY_SUCCESS_MESSAGE,
    });
  } catch (error) {
    logger.error("Критическая ошибка восстановления пароля", {
      type: "password_reset",
      action: "forgot_password_error",
      user_email: email,
      error_name: error.name,
      error_message: error.message,
      stack_trace: error.stack,
      execution_time_ms: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    });

    res.status(500).json({
      success: false,
      message: "Произошла ошибка при обработке запроса. Попробуйте позже.",
    });
  }
});

// Проверка токена восстановления
router.get("/validate-reset-token/:token", async (req, res) => {
  const startTime = Date.now();
  const { token } = req.params;

  try {
    logger.info("Начало проверки токена восстановления", {
      type: "password_reset",
      action: "validate_token_start",
      token_length: token?.length,
      endpoint: req.path,
      timestamp: new Date().toISOString(),
    });

    if (!token || token.length < 10) {
      logger.warn("Некорректный токен восстановления", {
        type: "password_reset",
        action: "validate_token_failed",
        status: "invalid_token",
        token_length: token?.length,
        execution_time_ms: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      });

      return res.status(400).json({
        success: false,
        valid: false,
        message: "Некорректный токен",
      });
    }

    const validation = await passwordResetService.validateToken(token);

    const executionTime = Date.now() - startTime;

    if (validation.valid) {
      logger.info("Токен восстановления проверен успешно", {
        type: "password_reset",
        action: "validate_token_success",
        user_email: validation.email,
        token_valid: true,
        execution_time_ms: executionTime,
        timestamp: new Date().toISOString(),
      });
    } else {
      logger.warn("Токен восстановления недействителен", {
        type: "password_reset",
        action: "validate_token_failed",
        status: "token_invalid",
        reason: validation.message,
        execution_time_ms: executionTime,
        timestamp: new Date().toISOString(),
      });
    }

    res.json({
      success: true,
      valid: validation.valid,
      email: validation.valid ? validation.email : undefined,
      message: validation.message,
      expiresAt: validation.valid ? validation.expiresAt : undefined,
    });
  } catch (error) {
    logger.error("Ошибка проверки токена восстановления", {
      type: "password_reset",
      action: "validate_token_error",
      token_length: token?.length,
      error_name: error.name,
      error_message: error.message,
      stack_trace: error.stack,
      execution_time_ms: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    });

    res.status(500).json({
      success: false,
      valid: false,
      message: "Ошибка проверки токена",
    });
  }
});

// Установка нового пароля
router.post("/reset-password", async (req, res) => {
  const startTime = Date.now();
  const { token, newPassword } = req.body;

  try {
    logger.info("Начало установки нового пароля", {
      type: "password_reset",
      action: "reset_password_start",
      token_length: token?.length,
      endpoint: req.path,
      method: req.method,
      timestamp: new Date().toISOString(),
    });

    if (!token || !newPassword) {
      logger.warn("Отсутствуют обязательные поля для сброса пароля", {
        type: "password_reset",
        action: "reset_password_failed",
        status: "missing_fields",
        has_token: !!token,
        has_password: !!newPassword,
        execution_time_ms: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      });

      return res.status(400).json({
        success: false,
        message: "Токен и новый пароль обязательны",
        field: !token ? "token" : "newPassword",
      });
    }

    try {
      validatePassword(newPassword);
    } catch (validationError) {
      logger.warn("Невалидный пароль при сбросе", {
        type: "password_reset",
        action: "reset_password_failed",
        status: "invalid_password",
        error_message: validationError.message,
        field: validationError.field,
        execution_time_ms: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      });

      return res.status(400).json({
        success: false,
        message: validationError.message,
        field: "newPassword",
      });
    }

    const validation = await passwordResetService.validateToken(token);

    if (!validation.valid) {
      logger.warn("Недействительный токен при сбросе пароля", {
        type: "password_reset",
        action: "reset_password_failed",
        status: "invalid_token",
        reason: validation.message,
        execution_time_ms: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      });

      return res.status(400).json({
        success: false,
        message: validation.message || "Токен недействителен или устарел",
      });
    }

    const { email, resetId } = validation;

    const users = await query(
      "SELECT login, password FROM usersdata WHERE email = ? AND logic = 'true'",
      [email]
    );

    if (users.length === 0) {
      logger.warn("Пользователь не найден при сбросе пароля", {
        type: "password_reset",
        action: "reset_password_failed",
        status: "user_not_found",
        user_email: email,
        execution_time_ms: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      });

      return res.status(404).json({
        success: false,
        message: "Пользователь не найден",
      });
    }

    const user = users[0];
    const samePassword = await bcrypt.compare(newPassword, user.password);

    if (samePassword) {
      logger.warn("Новый пароль совпадает с текущим", {
        type: "password_reset",
        action: "reset_password_failed",
        status: "password_same",
        user_login: user.login,
        user_email: email,
        execution_time_ms: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      });

      return res.status(400).json({
        success: false,
        message: "Новый пароль должен отличаться от текущего",
        field: "newPassword",
      });
    }

    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await query(
      "UPDATE usersdata SET password = ? WHERE email = ? AND logic = 'true'",
      [hashedPassword, email]
    );

    await passwordResetService.markAsUsed(resetId);
    await query("DELETE FROM sessionsdata WHERE login = ?", [user.login]);

    try {
      await emailService.sendPasswordChanged({
        login: user.login,
        email: email,
        userIp: req.ip || req.connection.remoteAddress,
        userAgent: req.headers["user-agent"] || "Неизвестное устройство",
      });

      logger.info("Уведомление об изменении пароля отправлено", {
        type: "password_reset",
        action: "password_change_email_sent",
        user_login: user.login,
        user_email: email,
        timestamp: new Date().toISOString(),
      });
    } catch (emailError) {
      logger.warn("Не удалось отправить email уведомление", {
        type: "password_reset",
        action: "password_change_email_error",
        user_email: email,
        error_message: emailError.message,
        timestamp: new Date().toISOString(),
      });
    }

    const executionTime = Date.now() - startTime;

    logger.info("Пароль успешно изменен", {
      type: "password_reset",
      action: "reset_password_success",
      user_login: user.login,
      user_email: email,
      execution_time_ms: executionTime,
      timestamp: new Date().toISOString(),
    });

    res.json({
      success: true,
      message:
        "Пароль успешно изменен. Теперь вы можете войти с новым паролем.",
      requireReauth: true,
      emailSent: true,
    });
  } catch (error) {
    logger.error("Ошибка установки нового пароля", {
      type: "password_reset",
      action: "reset_password_error",
      token_length: token?.length,
      error_name: error.name,
      error_message: error.message,
      stack_trace: error.stack,
      execution_time_ms: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    });

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: error.message,
        field: error.field,
      });
    }

    res.status(500).json({
      success: false,
      message: "Ошибка установки нового пароля. Попробуйте позже.",
    });
  }
});

module.exports = router;
