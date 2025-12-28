const nodemailer = require("nodemailer");
require("dotenv").config();

class EmailService {
  constructor() {
    this.transporter = null;
    this.isInitialized = false;
    this.templates = {
      passwordReset: this._passwordResetTemplate.bind(this),
      passwordChanged: this._passwordChangedTemplate.bind(this),
      registrationConfirm: this._registrationConfirmTemplate.bind(this),
      supportRequestCreated: this._supportRequestCreatedTemplate.bind(this),
      supportRequestConfirmed: this._supportRequestConfirmedTemplate.bind(this),
      supportStatusChanged: this._supportStatusChangedTemplate.bind(this),
    };
  }

  async initialize() {
    try {
      if (this.isInitialized) {
        console.log("⚠️ EmailService уже инициализирован");
        return;
      }

      if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        throw new Error("Не указаны EMAIL_USER или EMAIL_PASS в .env файле");
      }

      this.transporter = nodemailer.createTransport({
        service: "Gmail",
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      });

      // Проверка подключения
      await this.transporter.verify();
      this.isInitialized = true;
      console.log("✅ EmailService инициализирован успешно");
    } catch (error) {
      console.error("❌ Ошибка инициализации EmailService:", error.message);
      throw error;
    }
  }

  // ==================== ШАБЛОНЫ EMAIL ====================

  _passwordResetTemplate({ login, resetUrl, email }) {
    return {
      from: `"QuickDiagnosis - Восстановление пароля" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "🔐 Восстановление пароля в QuickDiagnosis",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f8f9fa; padding: 20px;">
          <div style="background-color: white; padding: 25px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <h2 style="color: #2d3748; text-align: center; margin-top: 0;">
              🔐 Восстановление пароля
            </h2>
            
            <p style="font-size: 16px; color: #4a5568;">
              Здравствуйте, <strong>${login}</strong>!
            </p>
            
            <p style="font-size: 16px; color: #4a5568;">
              Мы получили запрос на восстановление пароля для вашего аккаунта в QuickDiagnosis.
            </p>
            
            <div style="background-color: #f0fff4; border: 1px solid #38a169; padding: 15px; border-radius: 6px; margin: 20px 0; text-align: center;">
              <p style="margin: 0; font-weight: bold; color: #22543d;">
                ⏰ Ссылка действительна 1 час
              </p>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" 
                 style="background-color: #4299e1; color: white; padding: 14px 30px; 
                        text-decoration: none; border-radius: 6px; font-weight: bold;
                        font-size: 16px; display: inline-block;">
                Восстановить пароль
              </a>
            </div>
            
            <p style="color: #718096; font-size: 14px; margin-bottom: 5px;">
              Если кнопка не работает, скопируйте ссылку в браузер:
            </p>
            <p style="color: #4a5568; font-size: 12px; background-color: #f7fafc; 
               padding: 10px; border-radius: 4px; word-break: break-all;">
              ${resetUrl}
            </p>
            
            <div style="background-color: #fff5f5; border: 1px solid #fed7d7; padding: 15px; border-radius: 6px; margin: 25px 0;">
              <p style="color: #9b2c2c; margin: 0; font-weight: bold;">
                ⚠️ <strong>Важно!</strong> Если вы не запрашивали сброс пароля, 
                просто проигнорируйте это письмо.
              </p>
              <p style="color: #9b2c2c; margin: 10px 0 0 0;">
                Ваш пароль останется неизменным.
              </p>
            </div>
            
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 25px 0;">
            
            <p style="color: #718096; font-size: 12px; text-align: center; margin: 0;">
              Это автоматическое письмо системы QuickDiagnosis.<br>
              Пожалуйста, не отвечайте на него.
            </p>
          </div>
        </div>
      `,
    };
  }

  _passwordChangedTemplate({
    login,
    email,
    userIp,
    deviceType,
    timestamp,
    loginUrl,
  }) {
    return {
      from: `"QuickDiagnosis - Безопасность" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "🔐 Пароль изменен в QuickDiagnosis",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f8f9fa; padding: 20px; border-radius: 8px;">
          <div style="background-color: white; padding: 25px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <h2 style="color: #2d3748; margin-top: 0; text-align: center;">
              🔐 Пароль изменен в QuickDiagnosis
            </h2>
            
            <p style="font-size: 16px; color: #4a5568;">
              Здравствуйте, <strong>${login}</strong>!
            </p>
            
            <p style="font-size: 16px; color: #4a5568;">
              <strong>Пароль для вашего аккаунта был успешно изменен.</strong>
            </p>
            
            <div style="background-color: #f0fff4; border-left: 4px solid #38a169; padding: 15px; margin: 20px 0;">
              <p style="margin: 5px 0; color: #2d3748;">
                <strong>📅 Дата изменения:</strong> ${timestamp}
              </p>
              <p style="margin: 5px 0; color: #2d3748;">
                <strong>🌐 IP адрес:</strong> ${userIp}
              </p>
              <p style="margin: 5px 0; color: #2d3748;">
                <strong>🖥️ Устройство:</strong> ${deviceType}
              </p>
            </div>
            
            <h3 style="color: #2d3748; margin-top: 25px;">📋 Что нужно сделать:</h3>
            <ol style="color: #4a5568; font-size: 16px; padding-left: 20px;">
              <li style="margin-bottom: 10px;">Перейдите на <a href="${loginUrl}" style="color: #4299e1;">страницу входа</a></li>
              <li style="margin-bottom: 10px;">Введите ваш <strong style="color: #2d3748;">НОВЫЙ пароль</strong></li>
              <li>Сохраните пароль в менеджере паролей для удобства</li>
            </ol>
            
            <div style="background-color: #fff5f5; border: 1px solid #fed7d7; padding: 15px; border-radius: 6px; margin: 25px 0;">
              <p style="color: #9b2c2c; margin: 0; font-weight: bold;">
                ⚠️ <strong>Важно!</strong> Пароль в этом письме <strong>НЕ указан</strong> в целях безопасности.
              </p>
              <p style="color: #9b2c2c; margin: 10px 0 0 0;">
                Если это были не вы, немедленно войдите в аккаунт и смените пароль!
              </p>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${loginUrl}" 
                 style="background-color: #4299e1; color: white; padding: 12px 30px; 
                        text-decoration: none; border-radius: 6px; font-weight: bold;
                        font-size: 16px; display: inline-block;">
                Перейти на страницу входа
              </a>
            </div>
            
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 25px 0;">
            
            <p style="color: #718096; font-size: 14px; text-align: center; margin: 0;">
              Это автоматическое уведомление системы безопасности QuickDiagnosis.<br>
              Пожалуйста, не отвечайте на это письмо.
            </p>
          </div>
        </div>
      `,
    };
  }

  _registrationConfirmTemplate({
    login,
    email,
    activeUserCount,
    maxUsers,
    confirmUrl,
  }) {
    return {
      from: `"QuickDiagnosis" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Подтверждение регистрации в QuickDiagnosis",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Подтверждение регистрации</h2>
          <p>Здравствуйте, ${login}!</p>
          <p>Для завершения регистрации в медицинской системе QuickDiagnosis, пожалуйста, подтвердите ваш email.</p>
          <p><strong>Информация о лимите:</strong> На этот email активно ${activeUserCount} из ${maxUsers} возможных пользователей.</p>
          <p style="text-align: center; margin: 30px 0;">
            <a href="${confirmUrl}" 
               style="background-color: #4CAF50; color: white; padding: 12px 24px; 
                      text-decoration: none; border-radius: 4px; font-weight: bold;">
              Подтвердить Email
            </a>
          </p>
          <p>Ссылка действительна в течение 24 часов.</p>
          <p>Если вы не регистрировались в QuickDiagnosis, проигнорируйте это письмо.</p>
          <hr>
          <p style="color: #666; font-size: 12px;">
            Это автоматическое письмо, пожалуйста, не отвечайте на него.
          </p>
        </div>
      `,
    };
  }

  // В класс EmailService (где другие templates, например после _emailChangeRequestTemplate):
  _supportRequestCreatedTemplate({
    login,
    email,
    requestId,
    confirmUrl,
    requestType,
  }) {
    const typeNames = {
      password_reset: "Смена пароля",
      email_change: "Смена email",
      unblock: "Разблокировка аккаунта",
      account_deletion: "Удаление аккаунта",
      other: "Другая проблема",
    };

    return {
      from: `"QuickDiagnosis - Техподдержка" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: `📨 Заявка в техподдержку #${requestId}`,
      html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f8f9fa; padding: 20px;">
        <div style="background-color: white; padding: 25px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <h2 style="color: #2d3748; text-align: center; margin-top: 0;">
            📨 Подтверждение заявки в техподдержку
          </h2>
          
          <p style="font-size: 16px; color: #4a5568;">
            Здравствуйте, <strong>${login}</strong>!
          </p>
          
          <p style="font-size: 16px; color: #4a5568;">
            Вы отправили заявку в техподдержку QuickDiagnosis.
          </p>
          
          <div style="background-color: #e6f7ff; border: 1px solid #91d5ff; padding: 15px; border-radius: 6px; margin: 20px 0;">
            <p style="margin: 0; font-weight: bold; color: #0050b3;">
              📋 Детали заявки:
            </p>
            <p style="margin: 5px 0 0 0;">
              <strong>Номер заявки:</strong> ${requestId}<br>
              <strong>Тип проблемы:</strong> ${
                typeNames[requestType] || requestType
              }<br>
              <strong>Статус:</strong> Ожидает подтверждения
            </p>
          </div>
          
          <div style="background-color: #f6ffed; border: 1px solid #b7eb8f; padding: 15px; border-radius: 6px; margin: 20px 0; text-align: center;">
            <p style="margin: 0; font-weight: bold; color: #389e0d;">
              ⚠️ Для продолжения обработки необходимо подтвердить email
            </p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${confirmUrl}" 
               style="background-color: #1890ff; color: white; padding: 14px 30px; 
                      text-decoration: none; border-radius: 6px; font-weight: bold;
                      font-size: 16px; display: inline-block;">
              Подтвердить заявку
            </a>
          </div>
          
          <p style="color: #718096; font-size: 14px; margin-bottom: 5px;">
            Если кнопка не работает, скопируйте ссылку в браузер:
          </p>
          <p style="color: #4a5568; font-size: 12px; background-color: #f7fafc; 
             padding: 10px; border-radius: 4px; word-break: break-all;">
            ${confirmUrl}
          </p>
          
          <div style="background-color: #fff7e6; border: 1px solid #ffd591; padding: 15px; border-radius: 6px; margin: 25px 0;">
            <p style="color: #d46b08; margin: 0; font-weight: bold;">
              💡 <strong>Важно!</strong> Без подтверждения email заявка не будет обработана.
            </p>
            <p style="color: #d46b08; margin: 10px 0 0 0;">
              Ссылка действительна 24 часа. После подтверждения с вами свяжется специалист поддержки.
            </p>
          </div>
          
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 25px 0;">
          
          <p style="color: #718096; font-size: 12px; text-align: center; margin: 0;">
            Это автоматическое письмо системы техподдержки QuickDiagnosis.<br>
            Пожалуйста, не отвечайте на него.
          </p>
        </div>
      </div>
    `,
    };
  }

  _supportRequestConfirmedTemplate({ login, email, requestId, requestType }) {
    const typeNames = {
      password_reset: "Смена пароля",
      email_change: "Смена email",
      unblock: "Разблокировка аккаунта",
      account_deletion: "Удаление аккаунта",
      other: "Другая проблема",
    };

    // Ссылка для проверки статуса
    const statusCheckUrl = `${
      process.env.CLIENT_URL || "http://localhost:5000"
    }/support/status/${requestId}`;

    return {
      from: `"QuickDiagnosis - Техподдержка" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: `✅ Заявка #${requestId} принята в работу`,
      html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f8f9fa; padding: 20px;">
      <div style="background-color: white; padding: 25px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
        <h2 style="color: #2d3748; text-align: center; margin-top: 0;">
          ✅ Заявка подтверждена
        </h2>
        
        <div style="text-align: center; margin: 20px 0;">
          <div style="display: inline-block; background-color: #52c41a; color: white; padding: 8px 16px; border-radius: 20px; font-weight: bold;">
            Заявка №${requestId}
          </div>
        </div>
        
        <p style="font-size: 16px; color: #4a5568; text-align: center;">
          Здравствуйте, <strong>${login}</strong>!<br>
          Ваша заявка <strong>"${
            typeNames[requestType] || requestType
          }"</strong> успешно подтверждена и принята в работу.
        </p>
        
        <div style="background-color: #f6ffed; border: 1px solid #b7eb8f; padding: 20px; border-radius: 6px; margin: 25px 0;">
          <h3 style="color: #389e0d; margin-top: 0;">📝 Что дальше?</h3>
          <ol style="color: #4a5568; padding-left: 20px;">
            <li style="margin-bottom: 10px;">Специалист поддержки рассмотрит вашу заявку</li>
            <li style="margin-bottom: 10px;">Вы получите уведомление о начале работы</li>
            <li>Решение будет отправлено на этот email</li>
          </ol>
        </div>
        
        <!-- КНОПКА ДЛЯ ПРОВЕРКИ СТАТУСА -->
        <div style="text-align: center; margin: 30px 0;">
          <a href="${statusCheckUrl}" 
             style="background-color: #4299e1; color: white; padding: 14px 30px; 
                    text-decoration: none; border-radius: 6px; font-weight: bold;
                    font-size: 16px; display: inline-block; margin-bottom: 15px;">
            <i class="fas fa-search" style="margin-right: 8px;"></i> Проверить статус заявки
          </a>
          <p style="color: #718096; font-size: 12px; margin-top: 10px;">
            <strong>ID заявки:</strong> ${requestId}<br>
            <small>Сохраните этот номер для быстрого доступа</small>
          </p>
        </div>
        
        <div style="background-color: #e6f7ff; padding: 15px; border-radius: 6px; margin: 20px 0; text-align: center;">
          <p style="margin: 0; color: #0050b3; font-weight: bold;">
            🕒 Среднее время обработки: 1-24 часа
          </p>
          <p style="margin: 10px 0 0 0; color: #4a5568;">
            Вы можете проверить статус заявки в любое время по ссылке выше
          </p>
        </div>
        
        <div style="background-color: #f0f5ff; border-left: 4px solid #4299e1; padding: 15px; margin: 20px 0;">
          <p style="margin: 0; color: #2d3748; font-weight: bold;">
            📋 Что можно сделать на странице статуса:
          </p>
          <ul style="color: #4a5568; margin: 10px 0 0 0; padding-left: 20px;">
            <li>Посмотреть текущий этап обработки</li>
            <li>Увидеть таймлайн всех этапов заявки</li>
            <li>Узнать примерное время завершения</li>
            <li>Получить советы по дальнейшим действиям</li>
          </ul>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <p style="color: #718096; font-size: 14px;">
            Если кнопка не работает, скопируйте ссылку в браузер:
          </p>
          <p style="color: #4a5568; font-size: 12px; background-color: #f7fafc; 
             padding: 10px; border-radius: 4px; word-break: break-all;">
            ${statusCheckUrl}
          </p>
        </div>
        
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 25px 0;">
        
        <p style="color: #718096; font-size: 12px; text-align: center; margin: 0;">
          Это автоматическое уведомление от техподдержки QuickDiagnosis<br>
          Номер заявки: ${requestId} • ${new Date().toLocaleDateString("ru-RU")}
        </p>
      </div>
    </div>
    `,
    };
  }

  _supportStatusChangedTemplate({
    login,
    email,
    requestId,
    oldStatus,
    newStatus,
    adminNotes,
  }) {
    const statusNames = {
      pending: "Ожидает подтверждения",
      confirmed: "Подтверждена",
      in_progress: "В работе",
      resolved: "Решена",
      rejected: "Отклонена",
      cancelled: "Отменена",
    };

    const statusColors = {
      in_progress: "#fa8c16",
      resolved: "#52c41a",
      rejected: "#f5222d",
      cancelled: "#d9d9d9",
    };

    return {
      from: `"QuickDiagnosis - Техподдержка" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: `🔄 Статус заявки #${requestId} изменен`,
      html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f8f9fa; padding: 20px;">
        <div style="background-color: white; padding: 25px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <h2 style="color: #2d3748; text-align: center; margin-top: 0;">
            🔄 Обновление статуса заявки
          </h2>
          
          <div style="text-align: center; margin: 20px 0;">
            <div style="display: inline-block; background-color: ${
              statusColors[newStatus] || "#1890ff"
            }; color: white; padding: 8px 16px; border-radius: 20px; font-weight: bold;">
              Заявка №${requestId}
            </div>
          </div>
          
          <div style="background-color: #f0f5ff; padding: 20px; border-radius: 6px; margin: 20px 0; text-align: center;">
            <p style="margin: 0 0 10px 0; font-size: 18px; font-weight: bold; color: #2d3748;">
              Статус изменен
            </p>
            <div style="display: flex; justify-content: center; align-items: center; gap: 10px;">
              <span style="color: #8c8c8c;">${
                statusNames[oldStatus] || oldStatus
              }</span>
              <span style="font-size: 20px;">→</span>
              <span style="color: #1890ff; font-weight: bold;">${
                statusNames[newStatus] || newStatus
              }</span>
            </div>
          </div>
          
          ${
            adminNotes
              ? `
          <div style="background-color: #f6ffed; border-left: 4px solid #52c41a; padding: 15px; margin: 20px 0;">
            <h3 style="color: #389e0d; margin-top: 0;">💬 Комментарий специалиста:</h3>
            <p style="color: #4a5568; white-space: pre-line;">${adminNotes}</p>
          </div>
          `
              : ""
          }
          
          ${
            newStatus === "resolved"
              ? `
          <div style="background-color: #f6ffed; border: 1px solid #b7eb8f; padding: 20px; border-radius: 6px; margin: 25px 0; text-align: center;">
            <h3 style="color: #389e0d; margin-top: 0;">✅ Проблема решена!</h3>
            <p style="color: #4a5568;">
              Ваша заявка была успешно обработана и закрыта.<br>
              Если проблема осталась, создайте новую заявку.
            </p>
          </div>
          `
              : ""
          }
          
          ${
            newStatus === "rejected"
              ? `
          <div style="background-color: #fff2f0; border: 1px solid #ffccc7; padding: 20px; border-radius: 6px; margin: 25px 0;">
            <h3 style="color: #cf1322; margin-top: 0;">❌ Заявка отклонена</h3>
            <p style="color: #4a5568;">
              Ваша заявка была отклонена специалистом поддержки.
            </p>
          </div>
          `
              : ""
          }
          
          <div style="text-align: center; margin: 30px 0;">
            <p style="color: #718096; font-size: 14px;">
              Это автоматическое уведомление об изменении статуса вашей заявки.
            </p>
          </div>
          
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 25px 0;">
          
          <p style="color: #718096; font-size: 12px; text-align: center; margin: 0;">
            Техподдержка QuickDiagnosis • Заявка №${requestId}<br>
            ${new Date().toLocaleDateString("ru-RU")}
          </p>
        </div>
      </div>
    `,
    };
  }
  // ==================== МЕТОДЫ ОТПРАВКИ ====================

  async sendPasswordReset({ login, email, resetToken }) {
    try {
      await this._ensureInitialized();

      const resetUrl = `${
        process.env.CLIENT_URL || "http://localhost:5000"
      }/reset-password/${resetToken}`;

      const mailOptions = this.templates.passwordReset({
        login,
        resetUrl,
        email,
      });

      const info = await this.transporter.sendMail(mailOptions);
      console.log(
        `📧 Ссылка для восстановления пароля отправлена на: ${email}`
      );
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error("❌ Ошибка отправки email восстановления пароля:", error);
      throw new Error(
        `Не удалось отправить email восстановления: ${error.message}`
      );
    }
  }

  async sendPasswordChanged({ login, email, userIp, userAgent }) {
    try {
      await this._ensureInitialized();

      let deviceType = "Неизвестное устройство";
      if (userAgent.includes("Mobile")) deviceType = "Мобильное устройство";
      else if (userAgent.includes("Tablet")) deviceType = "Планшет";
      else if (userAgent.includes("Windows"))
        deviceType = "Компьютер (Windows)";
      else if (userAgent.includes("Mac")) deviceType = "Компьютер (Mac)";
      else if (userAgent.includes("Linux")) deviceType = "Компьютер (Linux)";

      const timestamp = new Date().toLocaleString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

      const loginUrl = `${
        process.env.CLIENT_URL || "http://localhost:5000"
      }/login`;

      const mailOptions = this.templates.passwordChanged({
        login,
        email,
        userIp,
        deviceType,
        timestamp,
        loginUrl,
      });

      const info = await this.transporter.sendMail(mailOptions);
      console.log(`📧 Уведомление об изменении пароля отправлено на ${email}`);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error("❌ Ошибка отправки email смены пароля:", error);
      throw new Error(
        `Не удалось отправить email уведомления: ${error.message}`
      );
    }
  }

  async sendRegistrationConfirm({
    login,
    email,
    activeUserCount,
    maxUsers,
    confirmToken,
  }) {
    try {
      await this._ensureInitialized();

      const confirmUrl = `${
        process.env.CLIENT_URL || "http://localhost:5000"
      }/confirm/${confirmToken}`;

      const mailOptions = this.templates.registrationConfirm({
        login,
        email,
        activeUserCount,
        maxUsers,
        confirmUrl,
      });

      const info = await this.transporter.sendMail(mailOptions);
      console.log(`📧 Email подтверждения отправлен на: ${email}`);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error("❌ Ошибка отправки email подтверждения:", error);
      throw new Error(
        `Не удалось отправить email подтверждения: ${error.message}`
      );
    }
  }

  async sendCustomEmail({ to, subject, html, text, from }) {
    try {
      await this._ensureInitialized();

      const mailOptions = {
        from: from || `"QuickDiagnosis" <${process.env.EMAIL_USER}>`,
        to,
        subject,
        html,
        text,
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log(`📧 Письмо отправлено на: ${to}`);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error("❌ Ошибка отправки email:", error);
      throw new Error(`Не удалось отправить email: ${error.message}`);
    }
  }

  async sendAccountBlocked({
    login,
    email,
    reason,
    supportUrl,
    ipAddress,
    userAgent,
    attemptCount,
  }) {
    try {
      const mailOptions = {
        from: `"QuickDiagnosis" <${this.senderEmail}>`,
        to: email,
        subject: "🚨 Ваш аккаунт в QuickDiagnosis заблокирован",
        html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #f8f9fa; padding: 20px; border-radius: 5px; }
            .content { padding: 20px; }
            .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0; }
            .support-btn { 
              display: inline-block; 
              background: #dc3545; 
              color: white; 
              padding: 12px 24px; 
              text-decoration: none; 
              border-radius: 5px; 
              font-weight: bold;
              margin: 20px 0;
            }
            .details { background: #f8f9fa; padding: 15px; border-radius: 5px; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>🚨 QuickDiagnosis - Блокировка аккаунта</h2>
            </div>
            
            <div class="content">
              <p>Уважаемый(ая) <strong>${login}</strong>,</p>
              
              <div class="warning">
                <h3>⚠️ Ваш аккаунт был заблокирован</h3>
                <p>Причина: <strong>${reason}</strong></p>
              </div>
              
              <p>Для разблокировки аккаунта обратитесь в техническую поддержку:</p>
              
              <a href="${supportUrl}" class="support-btn">
                📞 Перейти в техподдержку
              </a>
              
              <div class="details">
                <p><strong>Детали блокировки:</strong></p>
                <ul>
                  <li>Email: ${email}</li>
                  <li>Логин: ${login}</li>
                  ${
                    attemptCount
                      ? `<li>Неудачных попыток: ${attemptCount}</li>`
                      : ""
                  }
                  <li>Дата блокировки: ${new Date().toLocaleString(
                    "ru-RU"
                  )}</li>
                  ${ipAddress ? `<li>IP адрес: ${ipAddress}</li>` : ""}
                </ul>
              </div>
              
              <p>Если вы не предпринимали этих действий, немедленно обратитесь в техподдержку.</p>
              
              <p>С уважением,<br>Команда QuickDiagnosis</p>
            </div>
          </div>
        </body>
        </html>
      `,
      };

      await this.transporter.sendMail(mailOptions);
      console.log(`✅ Email о блокировке отправлен: ${email}`);
    } catch (error) {
      console.error("❌ Ошибка отправки email о блокировке:", error);
      throw error;
    }
  }

  // В классе EmailService (после sendAccountBlocked):

  async sendSupportRequestCreated({
    login,
    email,
    requestId,
    confirmToken,
    requestType,
  }) {
    try {
      await this._ensureInitialized();

      const confirmUrl = `${
        process.env.CLIENT_URL || "http://localhost:3000"
      }/support/confirm/${confirmToken}`;

      const mailOptions = this.templates.supportRequestCreated({
        login,
        email,
        requestId,
        confirmUrl,
        requestType,
      });

      const info = await this.transporter.sendMail(mailOptions);
      console.log(
        `📧 Подтверждение заявки отправлено: ${email} (${requestId})`
      );
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error("❌ Ошибка отправки подтверждения заявки:", error);
      throw new Error(
        `Не удалось отправить подтверждение заявки: ${error.message}`
      );
    }
  }

  async sendSupportRequestConfirmed({ login, email, requestId, requestType }) {
    try {
      await this._ensureInitialized();

      const mailOptions = this.templates.supportRequestConfirmed({
        login,
        email,
        requestId,
        requestType,
      });

      const info = await this.transporter.sendMail(mailOptions);
      console.log(
        `📧 Уведомление о принятии заявки отправлено: ${email} (${requestId})`
      );
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error("❌ Ошибка отправки уведомления о принятии:", error);
      throw new Error(`Не удалось отправить уведомление: ${error.message}`);
    }
  }

  async sendSupportStatusChanged({
    login,
    email,
    requestId,
    oldStatus,
    newStatus,
    adminNotes,
  }) {
    try {
      await this._ensureInitialized();

      const mailOptions = this.templates.supportStatusChanged({
        login,
        email,
        requestId,
        oldStatus,
        newStatus,
        adminNotes,
      });

      const info = await this.transporter.sendMail(mailOptions);
      console.log(
        `📧 Уведомление об изменении статуса отправлено: ${email} (${requestId}: ${oldStatus} → ${newStatus})`
      );
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error("❌ Ошибка отправки уведомления о статусе:", error);
      throw new Error(
        `Не удалось отправить уведомление о статусе: ${error.message}`
      );
    }
  }
  // ==================== ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ====================

  async _ensureInitialized() {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.transporter) {
      throw new Error("EmailService не инициализирован");
    }
  }

  getHealthStatus() {
    return {
      isInitialized: this.isInitialized,
      hasTransporter: !!this.transporter,
      emailUserConfigured: !!process.env.EMAIL_USER,
      timestamp: new Date().toISOString(),
    };
  }

  async testConnection() {
    try {
      await this._ensureInitialized();
      const result = await this.transporter.verify();
      return { success: true, verified: result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async close() {
    if (this.transporter) {
      this.transporter.close();
      this.transporter = null;
      this.isInitialized = false;
      console.log("📧 EmailService завершен");
    }
  }
}

// Создаем singleton экземпляр
const emailService = new EmailService();

module.exports = emailService;
