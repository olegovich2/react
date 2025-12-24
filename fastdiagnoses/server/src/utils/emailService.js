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
      emailChangeRequest: this._emailChangeRequestTemplate.bind(this),
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

  _emailChangeRequestTemplate({
    login,
    actualEmail,
    currentEmail,
    newEmail,
    timestamp,
    userIp,
    userAgent,
    reason,
    adminEmail,
  }) {
    const textVersion = `
ЗАПРОС НА СМЕНУ EMAIL - QuickDiagnosis

ТРЕБУЕТСЯ РУЧНОЕ ВМЕШАТЕЛЬСТВО

ДАННЫЕ ПОЛЬЗОВАТЕЛЯ:
- Пользователь: ${login}
- Дата запроса: ${timestamp}
- IP адрес: ${userIp}
- Устройство: ${userAgent}

ДАННЫЕ ДЛЯ СМЕНЫ EMAIL:
- Текущий email (в системе): ${actualEmail}
- Подтверждённый текущий email: ${currentEmail}
- Запрошенный новый email: ${newEmail}

ПРИЧИНА СМЕНЫ EMAIL:
${reason}

ИНСТРУКЦИЯ ДЛЯ АДМИНИСТРАТОРА:
1. Проверьте, что новый email не занят другим пользователем
2. Обновите email в таблице usersdata
3. Уведомите пользователя о выполнении

Это автоматическое уведомление от системы QuickDiagnosis
Email сгенерирован: ${new Date().toISOString()}
    `;

    return {
      from: `"QuickDiagnosis - Система уведомлений" <${process.env.EMAIL_USER}>`,
      to: adminEmail,
      cc: actualEmail,
      subject: `🔧 Запрос на смену email: ${login}`,
      text: textVersion,
      html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Запрос на смену email</title>
    <style>
        body { font-family: Arial, sans-serif; background-color: #f5f5f5; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px; text-align: center; }
        .header h1 { margin: 0; font-size: 24px; }
        .content { padding: 20px 0; }
        .info-box { background: #f8f9fa; border-left: 4px solid #4a90e2; padding: 15px; margin: 15px 0; }
        .info-item { margin: 10px 0; }
        .label { font-weight: bold; color: #333; }
        .value { color: #666; }
        .reason-box { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 15px 0; }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #888; font-size: 12px; text-align: center; }
        .action-buttons { margin-top: 20px; text-align: center; }
        .button { display: inline-block; background: #4a90e2; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin: 0 10px; }
        .warning { color: #e74c3c; font-weight: bold; background: #fdf2f2; padding: 10px; border-radius: 5px; margin: 15px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔧 Запрос на смену email</h1>
            <p>QuickDiagnosis - Административная панель</p>
        </div>
        
        <div class="content">
            <div class="warning">
                ⚠️ ТРЕБУЕТСЯ РУЧНОЕ ВМЕШАТЕЛЬСТВО
            </div>
            
            <div class="info-box">
                <div class="info-item">
                    <span class="label">👤 Пользователь:</span>
                    <span class="value">${login}</span>
                </div>
                <div class="info-item">
                    <span class="label">📅 Дата запроса:</span>
                    <span class="value">${timestamp}</span>
                </div>
                <div class="info-item">
                    <span class="label">🌐 IP адрес:</span>
                    <span class="value">${userIp}</span>
                </div>
                <div class="info-item">
                    <span class="label">🖥️ Устройство:</span>
                    <span class="value">${userAgent.substring(0, 100)}</span>
                </div>
            </div>
            
            <div class="info-box">
                <h3>📧 Данные для смены email</h3>
                <div class="info-item">
                    <span class="label">Текущий email (в системе):</span>
                    <span class="value">${actualEmail}</span>
                </div>
                <div class="info-item">
                    <span class="label">Подтверждённый текущий email:</span>
                    <span class="value">${currentEmail}</span>
                </div>
                <div class="info-item">
                    <span class="label">Запрошенный новый email:</span>
                    <span class="value" style="color: #27ae60; font-weight: bold;">${newEmail}</span>
                </div>
            </div>
            
            <div class="reason-box">
                <h3>📝 Причина смены email:</h3>
                <p>${reason.replace(/\n/g, "<br>")}</p>
            </div>
            
            <div class="action-buttons">
                <p><strong>Действия администратора:</strong></p>
                <p>1. Проверьте, что новый email не занят другим пользователем</p>
                <p>2. Обновите email в таблице usersdata</p>
                <p>3. Уведомите пользователя о выполнении</p>
            </div>
        </div>
        
        <div class="footer">
            <p>Это автоматическое уведомление от системы QuickDiagnosis</p>
            <p>Email сгенерирован: ${new Date().toISOString()}</p>
        </div>
    </div>
</body>
</html>
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

  async sendEmailChangeRequest({
    login,
    actualEmail,
    currentEmail,
    newEmail,
    reason,
    userIp,
    userAgent,
  }) {
    try {
      await this._ensureInitialized();

      const adminEmail = process.env.EMAIL_USER;
      const timestamp = new Date().toLocaleString("ru-RU");

      const mailOptions = this.templates.emailChangeRequest({
        login,
        actualEmail,
        currentEmail,
        newEmail,
        timestamp,
        userIp,
        userAgent,
        reason,
        adminEmail,
      });

      const info = await this.transporter.sendMail(mailOptions);
      console.log(
        `📧 Запрос на смену email отправлен администратору для пользователя: ${login}`
      );
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error("❌ Ошибка отправки запроса смены email:", error);
      throw new Error(
        `Не удалось отправить запрос смены email: ${error.message}`
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
