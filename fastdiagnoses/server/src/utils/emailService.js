const nodemailer = require("nodemailer");
require("dotenv").config();

class EmailService {
  constructor() {
    this.transporter = null;
    this.isInitialized = false;

    // Унифицированная цветовая схема
    this.COLORS = {
      primary: "#1890ff",
      primaryDark: "#0050b3",
      primaryLight: "#e6f7ff",
      success: "#52c41a",
      successDark: "#389e0d",
      successLight: "#f6ffed",
      danger: "#f5222d",
      dangerDark: "#cf1322",
      dangerLight: "#fff2f0",
      warning: "#fa8c16",
      warningDark: "#d46b08",
      warningLight: "#fff7e6",
      info: "#1890ff",
      infoDark: "#0050b3",
      infoLight: "#e6f7ff",
      purple: "#722ed1",
      purpleLight: "#f9f0ff",
      cyan: "#13c2c2",
      cyanLight: "#e6fffb",
      gray100: "#f8f9fa",
      gray200: "#e9ecef",
      gray300: "#dee2e6",
      gray600: "#6c757d",
      gray700: "#495057",
      gray800: "#343a40",
      white: "#ffffff",
    };

    // Статусы заявок
    this.STATUS_COLORS = {
      pending: this.COLORS.primary,
      confirmed: this.COLORS.primary,
      in_progress: this.COLORS.warning,
      resolved: this.COLORS.success,
      rejected: this.COLORS.danger,
      cancelled: this.COLORS.gray600,
    };

    // Шаблоны с использованием стрелочных функций для доступа к this
    this.templates = {
      passwordReset: (params) => this._passwordResetTemplate(params),
      passwordChanged: (params) => this._passwordChangedTemplate(params),
      registrationConfirm: (params) =>
        this._registrationConfirmTemplate(params),
      supportRequestCreated: (params) =>
        this._supportRequestCreatedTemplate(params),
      supportRequestConfirmed: (params) =>
        this._supportRequestConfirmedTemplate(params),
      supportStatusChanged: (params) =>
        this._supportStatusChangedTemplate(params),
      supportRequestProcessed: (params) =>
        this._supportRequestProcessedTemplate(params),
      supportEmailChangeNotification: (params) =>
        this._supportEmailChangeNotificationTemplate(params),
      supportAdminResponse: (params) =>
        this._supportAdminResponseTemplate(params),
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

  // ==================== БАЗОВЫЕ СТИЛИ И ШАБЛОНЫ ====================

  _getBaseStyles() {
    return `
      <style>
        /* Базовые стили для лучшей поддержки в почтовых клиентах */
        @media only screen and (max-width: 480px) {
          .container {
            padding: 10px !important;
          }
          .content-box {
            padding: 15px !important;
          }
          .btn {
            padding: 12px 20px !important;
            font-size: 14px !important;
            display: block !important;
            width: 100% !important;
            box-sizing: border-box !important;
          }
          .flex-mobile {
            display: block !important;
          }
          .flex-mobile > * {
            width: 100% !important;
            margin-bottom: 10px !important;
          }
          .text-center-mobile {
            text-align: center !important;
          }
          .hidden-mobile {
            display: none !important;
          }
          .badge {
            display: block !important;
            width: fit-content !important;
            margin-left: auto !important;
            margin-right: auto !important;
          }
          .status-badge {
            display: inline-block !important;
            width: auto !important;
            margin: 5px auto !important;
          }
        }
        
        @media only screen and (min-width: 481px) and (max-width: 600px) {
          .container {
            padding: 15px !important;
          }
          .content-box {
            padding: 20px !important;
          }
          .btn {
            padding: 13px 25px !important;
          }
        }
        
        /* Улучшенная поддержка темной темы */
        @media (prefers-color-scheme: dark) {
          .dark-mode-bg {
            background-color: #1a1a1a !important;
          }
          .dark-mode-text {
            color: #f0f0f0 !important;
          }
        }
        
        /* Безопасные стили для Outlook */
        .outlook-fix {
          mso-table-lspace: 0pt;
          mso-table-rspace: 0pt;
        }
        
        /* Улучшенная типографика */
        body, p, li {
          line-height: 1.6 !important;
        }
        
        h1, h2, h3 {
          line-height: 1.3 !important;
        }
      </style>
    `;
  }

  _getEmailTemplate(content, title = "") {
    return `
      <!DOCTYPE html>
      <html lang="ru">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta name="color-scheme" content="light dark">
        <meta name="supported-color-schemes" content="light dark">
        ${this._getBaseStyles()}
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: ${
        this.COLORS.gray100
      };">
        <div class="container" style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <div class="content-box" style="background-color: ${
            this.COLORS.white
          }; padding: 25px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            ${content}
          </div>
          
          <!-- Футер -->
          <div style="text-align: center; margin-top: 20px; padding: 15px; color: ${
            this.COLORS.gray600
          }; font-size: 12px;">
            <p style="margin: 0 0 5px 0;">Это автоматическое письмо системы QuickDiagnosis</p>
            <p style="margin: 0;">Пожалуйста, не отвечайте на него</p>
            ${
              process.env.CLIENT_URL
                ? `<p style="margin: 5px 0 0 0;"><a href="${process.env.CLIENT_URL}" style="color: ${this.COLORS.gray600}; text-decoration: none;">Перейти в QuickDiagnosis</a></p>`
                : ""
            }
          </div>
        </div>
      </body>
      </html>
    `;
  }

  _createButton(href, text, options = {}) {
    const color = options.color || this.COLORS.primary;
    const isMobile = options.isMobile || false;

    return `
      <a href="${href}" 
         class="btn"
         style="background-color: ${color}; color: ${this.COLORS.white}; 
                padding: ${isMobile ? "12px 20px" : "14px 30px"}; 
                text-decoration: none; border-radius: 6px; 
                font-weight: bold; font-size: ${isMobile ? "14px" : "16px"}; 
                display: inline-block; text-align: center;
                border: none; cursor: pointer; transition: background-color 0.2s;">
        ${text}
      </a>
    `;
  }

  _createBadge(text, color = this.COLORS.primary) {
    return `
      <div class="badge status-badge" style="display: inline-block; background-color: ${color}; 
            color: ${this.COLORS.white}; padding: 6px 12px; 
            border-radius: 20px; font-size: 12px; font-weight: bold;">
        ${text}
      </div>
    `;
  }

  _createAlertBox(content, type = "info", options = {}) {
    const colors = {
      info: {
        bg: this.COLORS.infoLight,
        border: this.COLORS.primary,
        icon: "ℹ️",
      },
      success: {
        bg: this.COLORS.successLight,
        border: this.COLORS.success,
        icon: "✅",
      },
      warning: {
        bg: this.COLORS.warningLight,
        border: this.COLORS.warning,
        icon: "⚠️",
      },
      danger: {
        bg: this.COLORS.dangerLight,
        border: this.COLORS.danger,
        icon: "❌",
      },
    };

    const style = colors[type] || colors.info;
    const title = options.title
      ? `<p style="margin: 0 0 10px 0; font-weight: bold; font-size: 16px;">${options.title}</p>`
      : "";

    return `
      <div style="background-color: ${style.bg}; border-left: 4px solid ${
      style.border
    }; 
            padding: 15px; border-radius: 6px; margin: 20px 0;">
        ${title}
        <p style="margin: 0; color: ${
          type === "danger" ? this.COLORS.dangerDark : this.COLORS.gray800
        };">
          ${style.icon} ${content}
        </p>
      </div>
    `;
  }

  _createInfoBox(items) {
    let itemsHtml = "";
    items.forEach((item, index) => {
      itemsHtml += `
        <p style="margin: ${index === 0 ? "0" : "10px"} 0 5px 0; color: ${
        this.COLORS.gray800
      }; font-weight: bold;">
          ${item.label}
        </p>
        <p style="margin: 0 0 10px 0; color: ${this.COLORS.gray700};">
          ${item.value}
        </p>
      `;
    });

    return `
      <div style="background-color: ${this.COLORS.infoLight}; border-left: 4px solid ${this.COLORS.primary}; 
            padding: 15px; border-radius: 6px; margin: 20px 0;">
        ${itemsHtml}
      </div>
    `;
  }

  // ==================== ШАБЛОНЫ EMAIL ====================

  _passwordResetTemplate({ login, resetUrl, email }) {
    const content = `
      <h2 style="color: ${
        this.COLORS.gray800
      }; text-align: center; margin-top: 0; font-size: 24px;">
        🔐 Восстановление пароля
      </h2>
      
      <p style="font-size: 16px; color: ${this.COLORS.gray700};">
        Здравствуйте, <strong>${login}</strong>!
      </p>
      
      <p style="font-size: 16px; color: ${this.COLORS.gray700};">
        Мы получили запрос на восстановление пароля для вашего аккаунта в QuickDiagnosis.
      </p>
      
      ${this._createAlertBox("Ссылка действительна 1 час", "warning")}
      
      <div style="text-align: center; margin: 30px 0;">
        ${this._createButton(resetUrl, "Восстановить пароль", {
          color: this.COLORS.primary,
        })}
      </div>
      
      <p style="color: ${
        this.COLORS.gray600
      }; font-size: 14px; margin-bottom: 5px;">
        Если кнопка не работает, скопируйте ссылку в браузер:
      </p>
      <div style="color: ${
        this.COLORS.gray700
      }; font-size: 12px; background-color: ${this.COLORS.gray100}; 
           padding: 10px; border-radius: 4px; word-break: break-all; font-family: monospace;">
        ${resetUrl}
      </div>
      
      ${this._createAlertBox(
        "<strong>Важно!</strong> Если вы не запрашивали сброс пароля, просто проигнорируйте это письмо.",
        "danger"
      )}
    `;

    return {
      from: `"QuickDiagnosis - Восстановление пароля" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "🔐 Восстановление пароля в QuickDiagnosis",
      html: this._getEmailTemplate(content, "Восстановление пароля"),
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
    const content = `
      <h2 style="color: ${
        this.COLORS.gray800
      }; text-align: center; margin-top: 0; font-size: 24px;">
        🔐 Пароль изменен в QuickDiagnosis
      </h2>
      
      <p style="font-size: 16px; color: ${this.COLORS.gray700};">
        Здравствуйте, <strong>${login}</strong>!
      </p>
      
      <p style="font-size: 16px; color: ${this.COLORS.gray700};">
        <strong>Пароль для вашего аккаунта был успешно изменен.</strong>
      </p>
      
      ${this._createInfoBox([
        { label: "📅 Дата изменения:", value: timestamp },
        { label: "🌐 IP адрес:", value: userIp },
        { label: "🖥️ Устройство:", value: deviceType },
      ])}
      
      <h3 style="color: ${
        this.COLORS.gray800
      }; margin-top: 25px; font-size: 18px;">
        📋 Что нужно сделать:
      </h3>
      <ol style="color: ${
        this.COLORS.gray700
      }; font-size: 16px; padding-left: 20px;">
        <li style="margin-bottom: 10px;">Перейдите на <a href="${loginUrl}" style="color: ${
      this.COLORS.primary
    };">страницу входа</a></li>
        <li style="margin-bottom: 10px;">Введите ваш <strong style="color: ${
          this.COLORS.gray800
        };">НОВЫЙ пароль</strong></li>
        <li>Сохраните пароль в менеджере паролей для удобства</li>
      </ol>
      
      ${this._createAlertBox(
        "Пароль в этом письме <strong>НЕ указан</strong> в целях безопасности.",
        "danger"
      )}
      
      <div style="text-align: center; margin: 30px 0;">
        ${this._createButton(loginUrl, "Перейти на страницу входа", {
          color: this.COLORS.primary,
        })}
      </div>
    `;

    return {
      from: `"QuickDiagnosis - Безопасность" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "🔐 Пароль изменен в QuickDiagnosis",
      html: this._getEmailTemplate(content, "Пароль изменен"),
    };
  }

  _registrationConfirmTemplate({
    login,
    email,
    activeUserCount,
    maxUsers,
    confirmUrl,
  }) {
    const content = `
      <h2 style="color: ${
        this.COLORS.gray800
      }; text-align: center; margin-top: 0; font-size: 24px;">
        Подтверждение регистрации
      </h2>
      
      <p style="font-size: 16px; color: ${this.COLORS.gray700};">
        Здравствуйте, ${login}!
      </p>
      
      <p style="font-size: 16px; color: ${this.COLORS.gray700};">
        Для завершения регистрации в медицинской системе QuickDiagnosis, пожалуйста, подтвердите ваш email.
      </p>
      
      <div style="background-color: ${
        this.COLORS.infoLight
      }; padding: 15px; border-radius: 6px; margin: 20px 0;">
        <p style="margin: 0; color: ${this.COLORS.gray700};">
          <strong>Информация о лимите:</strong> На этот email активно ${activeUserCount} из ${maxUsers} возможных пользователей.
        </p>
      </div>
      
      <div style="text-align: center; margin: 30px 0;">
        ${this._createButton(confirmUrl, "Подтвердить Email", {
          color: this.COLORS.success,
        })}
      </div>
      
      ${this._createAlertBox(
        "Ссылка действительна в течение 24 часов.",
        "warning"
      )}
      
      <p style="color: ${this.COLORS.gray700}; font-size: 16px;">
        Если вы не регистрировались в QuickDiagnosis, проигнорируйте это письмо.
      </p>
    `;

    return {
      from: `"QuickDiagnosis" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Подтверждение регистрации в QuickDiagnosis",
      html: this._getEmailTemplate(content, "Подтверждение регистрации"),
    };
  }

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

    const content = `
      <h2 style="color: ${
        this.COLORS.gray800
      }; text-align: center; margin-top: 0; font-size: 24px;">
        📨 Подтверждение заявки в техподдержку
      </h2>
      
      <p style="font-size: 16px; color: ${this.COLORS.gray700};">
        Здравствуйте, <strong>${login}</strong>!
      </p>
      
      <p style="font-size: 16px; color: ${this.COLORS.gray700};">
        Вы отправили заявку в техподдержку QuickDiagnosis.
      </p>
      
      ${this._createInfoBox([
        { label: "Номер заявки:", value: requestId },
        {
          label: "Тип проблемы:",
          value: typeNames[requestType] || requestType,
        },
        { label: "Статус:", value: "Ожидает подтверждения" },
      ])}
      
      ${this._createAlertBox(
        "Для продолжения обработки необходимо подтвердить email",
        "warning"
      )}
      
      <div style="text-align: center; margin: 30px 0;">
        ${this._createButton(confirmUrl, "Подтвердить заявку", {
          color: this.COLORS.primary,
        })}
      </div>
      
      <p style="color: ${
        this.COLORS.gray600
      }; font-size: 14px; margin-bottom: 5px;">
        Если кнопка не работает, скопируйте ссылку в браузер:
      </p>
      <div style="color: ${
        this.COLORS.gray700
      }; font-size: 12px; background-color: ${this.COLORS.gray100}; 
           padding: 10px; border-radius: 4px; word-break: break-all; font-family: monospace;">
        ${confirmUrl}
      </div>
      
      ${this._createAlertBox(
        "Без подтверждения email заявка не будет обработана. Ссылка действительна 24 часа.",
        "warning"
      )}
    `;

    return {
      from: `"QuickDiagnosis - Техподдержка" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: `📨 Заявка в техподдержку #${requestId}`,
      html: this._getEmailTemplate(content, "Подтверждение заявки"),
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

    const statusCheckUrl = `${
      process.env.CLIENT_URL || "http://localhost:5000"
    }/support/status/${requestId}`;

    const content = `
      <h2 style="color: ${
        this.COLORS.gray800
      }; text-align: center; margin-top: 0; font-size: 24px;">
        ✅ Заявка подтверждена
      </h2>
      
      <div style="text-align: center; margin: 20px 0;">
        ${this._createBadge(`Заявка №${requestId}`, this.COLORS.success)}
      </div>
      
      <p style="font-size: 16px; color: ${
        this.COLORS.gray700
      }; text-align: center;">
        Здравствуйте, <strong>${login}</strong>!<br>
        Ваша заявка <strong>"${
          typeNames[requestType] || requestType
        }"</strong> успешно подтверждена и принята в работу.
      </p>
      
      ${this._createAlertBox(
        "Что дальше?<br>1. Специалист поддержки рассмотрит вашу заявку<br>2. Вы получите уведомление о начале работы<br>3. Решение будет отправлено на этот email",
        "success",
        { title: "📝 Процесс обработки:" }
      )}
      
      <div style="text-align: center; margin: 30px 0;">
        ${this._createButton(statusCheckUrl, "Проверить статус заявки", {
          color: this.COLORS.primary,
        })}
        <p style="color: ${
          this.COLORS.gray600
        }; font-size: 12px; margin-top: 10px;">
          <strong>ID заявки:</strong> ${requestId}<br>
          Сохраните этот номер для быстрого доступа
        </p>
      </div>
      
      <div style="background-color: ${
        this.COLORS.infoLight
      }; padding: 15px; border-radius: 6px; 
            margin: 20px 0; text-align: center;">
        <p style="margin: 0; color: ${
          this.COLORS.primaryDark
        }; font-weight: bold;">
          🕒 Среднее время обработки: 1-24 часа
        </p>
        <p style="margin: 10px 0 0 0; color: ${this.COLORS.gray700};">
          Вы можете проверить статус заявки в любое время по ссылке выше
        </p>
      </div>
      
      <div style="text-align: center; margin: 30px 0;">
        <p style="color: ${this.COLORS.gray600}; font-size: 14px;">
          Если кнопка не работает, скопируйте ссылку в браузер:
        </p>
        <div style="color: ${
          this.COLORS.gray700
        }; font-size: 12px; background-color: ${this.COLORS.gray100}; 
             padding: 10px; border-radius: 4px; word-break: break-all; font-family: monospace;">
          ${statusCheckUrl}
        </div>
      </div>
    `;

    return {
      from: `"QuickDiagnosis - Техподдержка" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: `✅ Заявка #${requestId} принята в работу`,
      html: this._getEmailTemplate(content, "Заявка подтверждена"),
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

    const content = `
      <h2 style="color: ${
        this.COLORS.gray800
      }; text-align: center; margin-top: 0; font-size: 24px;">
        🔄 Обновление статуса заявки
      </h2>
      
      <div style="text-align: center; margin: 20px 0;">
        ${this._createBadge(
          `Заявка №${requestId}`,
          this.STATUS_COLORS[newStatus] || this.COLORS.primary
        )}
      </div>
      
      <div style="background-color: ${
        this.COLORS.infoLight
      }; padding: 20px; border-radius: 6px; margin: 20px 0; text-align: center;">
        <p style="margin: 0 0 10px 0; font-size: 18px; font-weight: bold; color: ${
          this.COLORS.gray800
        };">
          Статус изменен
        </p>
        <div class="flex-mobile" style="display: flex; justify-content: center; align-items: center; gap: 10px; flex-wrap: wrap;">
          <span style="color: ${this.COLORS.gray600};">${
      statusNames[oldStatus] || oldStatus
    }</span>
          <span style="font-size: 20px; color: ${this.COLORS.gray600};">→</span>
          <span style="color: ${
            this.STATUS_COLORS[newStatus] || this.COLORS.primary
          }; font-weight: bold;">
            ${statusNames[newStatus] || newStatus}
          </span>
        </div>
      </div>
      
      ${
        adminNotes
          ? `
      <div style="background-color: ${this.COLORS.successLight}; border-left: 4px solid ${this.COLORS.success}; padding: 15px; margin: 20px 0;">
        <h3 style="color: ${this.COLORS.successDark}; margin-top: 0; font-size: 16px;">💬 Комментарий специалиста:</h3>
        <p style="color: ${this.COLORS.gray700}; margin: 10px 0 0 0;">${adminNotes}</p>
      </div>
      `
          : ""
      }
      
      ${
        newStatus === "resolved"
          ? `
      ${this._createAlertBox(
        "Ваша заявка была успешно обработана и закрыта. Если проблема осталась, создайте новую заявку.",
        "success",
        { title: "✅ Проблема решена!" }
      )}
      `
          : ""
      }
      
      ${
        newStatus === "rejected"
          ? `
      ${this._createAlertBox(
        "Ваша заявка была отклонена специалистом поддержки.",
        "danger",
        { title: "❌ Заявка отклонена" }
      )}
      `
          : ""
      }
      
      <div style="text-align: center; margin: 30px 0;">
        <p style="color: ${this.COLORS.gray600}; font-size: 14px;">
          Это автоматическое уведомление об изменении статуса вашей заявки.
        </p>
      </div>
    `;

    return {
      from: `"QuickDiagnosis - Техподдержка" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: `🔄 Статус заявки #${requestId} изменен`,
      html: this._getEmailTemplate(content, "Статус изменен"),
    };
  }

  _supportRequestProcessedTemplate({
    login,
    email,
    requestId,
    requestType,
    action,
    reason,
    adminName,
    password = null,
    newEmail = null,
  }) {
    const typeNames = {
      password_reset: "Смена пароля",
      email_change: "Смена email",
      unblock: "Разблокировка аккаунта",
      account_deletion: "Удаление аккаунта",
      other: "Другая проблема",
    };

    const actionNames = {
      approve: "одобрено",
      reject: "отклонено",
    };

    const actionColors = {
      approve: this.COLORS.success,
      reject: this.COLORS.danger,
    };

    const content = `
      <h2 style="color: ${
        this.COLORS.gray800
      }; text-align: center; margin-top: 0; font-size: 24px;">
        📋 Результат обработки заявки
      </h2>
      
      <div style="text-align: center; margin: 20px 0;">
        ${this._createBadge(`Заявка №${requestId}`, actionColors[action])}
      </div>
      
      ${this._createAlertBox(
        `Ваша заявка <strong>"${
          typeNames[requestType] || requestType
        }"</strong> была <strong>${
          actionNames[action]
        }</strong> администратором поддержки.`,
        action === "approve" ? "success" : "danger",
        { title: action === "approve" ? "✅ Одобрено" : "❌ Отклонено" }
      )}
      
      ${
        reason
          ? `
      <div style="margin-top: 15px; padding-top: 15px; border-top: 1px dashed ${this.COLORS.gray300};">
        <p style="margin: 0; font-weight: bold; color: ${this.COLORS.gray700};">Комментарий администратора:</p>
        <p style="margin: 10px 0 0 0; color: ${this.COLORS.gray700};">${reason}</p>
      </div>
      `
          : ""
      }
      
      ${this._createInfoBox([
        { label: "Номер:", value: requestId },
        { label: "Тип:", value: typeNames[requestType] || requestType },
        { label: "Логин:", value: login },
        { label: "Обработал:", value: adminName },
        {
          label: "Дата обработки:",
          value: new Date().toLocaleDateString("ru-RU"),
        },
      ])}
      
      ${
        password
          ? `
      <div style="background-color: ${this.COLORS.purpleLight}; border: 1px solid ${this.COLORS.purple}; padding: 15px; border-radius: 6px; margin: 20px 0;">
        <p style="margin: 0; font-weight: bold; color: ${this.COLORS.purple};">
          🔑 Новый пароль:
        </p>
        <p style="margin: 10px 0; font-size: 18px; font-family: monospace; background-color: ${this.COLORS.purpleLight}; padding: 10px; border-radius: 4px;">
          ${password}
        </p>
        <p style="margin: 0; color: ${this.COLORS.purple}; font-size: 14px;">
          ⚠️ Сохраните этот пароль в безопасном месте и измените его при первом входе.
        </p>
      </div>
      `
          : ""
      }
      
      ${
        newEmail
          ? `
      <div style="background-color: ${this.COLORS.cyanLight}; border: 1px solid ${this.COLORS.cyan}; padding: 15px; border-radius: 6px; margin: 20px 0;">
        <p style="margin: 0; font-weight: bold; color: ${this.COLORS.cyan};">
          📧 Email изменен:
        </p>
        <p style="margin: 10px 0; color: ${this.COLORS.gray700};">
          <strong>Старый email:</strong> ${email}<br>
          <strong>Новый email:</strong> ${newEmail}
        </p>
      </div>
      `
          : ""
      }
      
      <div style="text-align: center; margin: 30px 0;">
        ${this._createButton(
          `${process.env.CLIENT_URL || "http://localhost:5000"}/login`,
          "Перейти на страницу входа",
          { color: this.COLORS.primary }
        )}
      </div>
    `;

    return {
      from: `"QuickDiagnosis - Техподдержка" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: `📋 Результат обработки заявки #${requestId} - ${
        typeNames[requestType] || requestType
      }`,
      html: this._getEmailTemplate(content, "Результат обработки"),
    };
  }

  _supportEmailChangeNotificationTemplate({
    login,
    email,
    requestId,
    adminName,
    oldEmail,
    newEmail,
    isNewEmail = false,
  }) {
    const content = `
      <h2 style="color: ${
        this.COLORS.gray800
      }; text-align: center; margin-top: 0; font-size: 24px;">
        📧 ${isNewEmail ? "Ваш email был изменен" : "Смена email подтверждена"}
      </h2>
      
      <p style="font-size: 16px; color: ${this.COLORS.gray700};">
        ${
          isNewEmail
            ? `Здравствуйте! Ваш email для аккаунта <strong>${login}</strong> был успешно изменен.`
            : `Здравствуйте! Мы уведомляем вас об изменении email для вашего аккаунта <strong>${login}</strong>.`
        }
      </p>
      
      <div style="background-color: ${
        this.COLORS.cyanLight
      }; border: 1px solid ${
      this.COLORS.cyan
    }; padding: 20px; border-radius: 6px; margin: 20px 0;">
        <p style="margin: 0; font-weight: bold; color: ${
          this.COLORS.cyan
        }; text-align: center;">
          📝 Детали изменения:
        </p>
        <div class="flex-mobile" style="display: flex; justify-content: center; align-items: center; gap: 15px; margin: 15px 0; flex-wrap: wrap;">
          <div style="text-align: right;">
            <p style="margin: 5px 0; color: ${
              this.COLORS.gray600
            };">Старый email:</p>
            <p style="margin: 5px 0; color: ${
              this.COLORS.gray600
            };">Новый email:</p>
          </div>
          <div style="text-align: left;">
            <p style="margin: 5px 0; color: ${
              this.COLORS.gray700
            };"><strong>${oldEmail}</strong></p>
            <p style="margin: 5px 0; color: ${
              this.COLORS.success
            };"><strong>${newEmail}</strong></p>
          </div>
        </div>
      </div>
      
      ${
        isNewEmail
          ? this._createAlertBox(
              "Ваш email успешно обновлен. Все дальнейшие уведомления будут приходить на этот адрес.",
              "success"
            )
          : this._createAlertBox(
              "Это был ваш старый email. Данный email больше не привязан к аккаунту.",
              "info"
            )
      }
      
      ${this._createInfoBox([
        { label: "Номер заявки:", value: requestId },
        { label: "Обработал:", value: adminName },
        {
          label: "Дата обработки:",
          value: new Date().toLocaleDateString("ru-RU"),
        },
      ])}
      
      ${
        !isNewEmail
          ? `
      ${this._createAlertBox(
        "Если вы не запрашивали изменение email, немедленно обратитесь в техподдержку!",
        "danger"
      )}
      `
          : ""
      }
    `;

    return {
      from: `"QuickDiagnosis - Техподдержка" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: `📧 Email аккаунта изменен ${isNewEmail ? "(новый email)" : ""}`,
      html: this._getEmailTemplate(content, "Изменение email"),
    };
  }

  _supportAdminResponseTemplate({
    login,
    email,
    requestId,
    adminName,
    adminResponse,
    reason,
  }) {
    const content = `
      <h2 style="color: ${
        this.COLORS.gray800
      }; text-align: center; margin-top: 0; font-size: 24px;">
        📨 Ответ от техподдержки QuickDiagnosis
      </h2>
      
      <p style="font-size: 16px; color: ${this.COLORS.gray700};">
        Здравствуйте, <strong>${login}</strong>!
      </p>
      
      <p style="font-size: 16px; color: ${this.COLORS.gray700};">
        Специалист техподдержки рассмотрел вашу заявку <strong>#${requestId}</strong> и подготовил ответ.
      </p>
      
      <div style="background-color: ${
        this.COLORS.infoLight
      }; border-left: 4px solid ${
      this.COLORS.primary
    }; padding: 15px; margin: 20px 0;">
        <p style="margin: 0; color: ${
          this.COLORS.primaryDark
        }; font-weight: bold;">
          💬 Ответ администратора:
        </p>
        <div style="margin: 10px 0 0 0; padding: 15px; background-color: ${
          this.COLORS.white
        }; border-radius: 4px;">
          <p style="margin: 0; color: ${
            this.COLORS.gray700
          };">${adminResponse}</p>
        </div>
      </div>
      
      ${
        reason
          ? `
      <div style="background-color: ${this.COLORS.successLight}; padding: 15px; border-radius: 6px; margin: 20px 0;">
        <p style="margin: 0; color: ${this.COLORS.successDark}; font-weight: bold;">
          📝 Комментарий:
        </p>
        <p style="margin: 10px 0 0 0; color: ${this.COLORS.gray700};">${reason}</p>
      </div>
      `
          : ""
      }
      
      <div style="text-align: center; margin: 30px 0;">
        <p style="color: ${this.COLORS.gray600}; font-size: 14px;">
          Если у вас остались вопросы, вы можете ответить на это письмо или создать новую заявку.
        </p>
      </div>
    `;

    return {
      from: `"QuickDiagnosis - Техподдержка" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: `📨 Ответ от техподдержки на заявку #${requestId}`,
      html: this._getEmailTemplate(content, "Ответ поддержки"),
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
      const content = `
        <h2 style="color: ${
          this.COLORS.gray800
        }; text-align: center; margin-top: 0; font-size: 24px;">
          🚨 Ваш аккаунт в QuickDiagnosis заблокирован
        </h2>
        
        <p style="font-size: 16px; color: ${this.COLORS.gray700};">
          Уважаемый(ая) <strong>${login}</strong>,
        </p>
        
        ${this._createAlertBox(
          `Ваш аккаунт был заблокирован. Причина: <strong>${reason}</strong>`,
          "danger",
          { title: "⚠️ Блокировка аккаунта" }
        )}
        
        <p style="font-size: 16px; color: ${this.COLORS.gray700};">
          Для разблокировки аккаунта обратитесь в техническую поддержку:
        </p>
        
        <div style="text-align: center; margin: 30px 0;">
          ${this._createButton(supportUrl, "📞 Перейти в техподдержку", {
            color: this.COLORS.danger,
          })}
        </div>
        
        ${this._createInfoBox(
          [
            { label: "Email:", value: email },
            { label: "Логин:", value: login },
            attemptCount
              ? { label: "Неудачных попыток:", value: attemptCount }
              : null,
            {
              label: "Дата блокировки:",
              value: new Date().toLocaleString("ru-RU"),
            },
            ipAddress ? { label: "IP адрес:", value: ipAddress } : null,
          ].filter(Boolean)
        )}
        
        <p style="color: ${this.COLORS.gray700}; font-size: 16px;">
          Если вы не предпринимали этих действий, немедленно обратитесь в техподдержку.
        </p>
      `;

      const mailOptions = {
        from: `"QuickDiagnosis - Безопасность" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: "🚨 Ваш аккаунт в QuickDiagnosis заблокирован",
        html: this._getEmailTemplate(content, "Блокировка аккаунта"),
      };

      await this.transporter.sendMail(mailOptions);
      console.log(`✅ Email о блокировке отправлен: ${email}`);
    } catch (error) {
      console.error("❌ Ошибка отправки email о блокировке:", error);
      throw error;
    }
  }

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

  async sendSupportRequestProcessed({
    login,
    email,
    requestId,
    requestType,
    action,
    reason,
    adminName,
    password = null,
    newEmail = null,
  }) {
    try {
      await this._ensureInitialized();

      const mailOptions = this.templates.supportRequestProcessed({
        login,
        email,
        requestId,
        requestType,
        action,
        reason,
        adminName,
        password,
        newEmail,
      });

      const info = await this.transporter.sendMail(mailOptions);
      console.log(
        `📧 Результат обработки заявки отправлен: ${email} (${requestId}, ${action})`
      );
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error("❌ Ошибка отправки результата заявки:", error);
      throw new Error(
        `Не удалось отправить результат заявки: ${error.message}`
      );
    }
  }

  async sendSupportEmailChangeNotification({
    login,
    email,
    requestId,
    adminName,
    oldEmail,
    newEmail,
    isNewEmail = false,
  }) {
    try {
      await this._ensureInitialized();

      const mailOptions = this.templates.supportEmailChangeNotification({
        login,
        email,
        requestId,
        adminName,
        oldEmail,
        newEmail,
        isNewEmail,
      });

      const info = await this.transporter.sendMail(mailOptions);
      console.log(
        `📧 Уведомление об изменении email отправлено: ${email} (${requestId}, новый: ${isNewEmail})`
      );
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error("❌ Ошибка отправки уведомления об email:", error);
      throw new Error(
        `Не удалось отправить уведомление об email: ${error.message}`
      );
    }
  }

  async sendSupportAccountDeletionWarning({
    login,
    email,
    requestId,
    adminName,
    reason,
    deletionDate,
  }) {
    try {
      await this._ensureInitialized();

      const content = `
        <h2 style="color: ${
          this.COLORS.gray800
        }; text-align: center; margin-top: 0; font-size: 24px;">
          🗑️ Ваш аккаунт будет удален
        </h2>
        
        ${this._createAlertBox(
          `Запрос на удаление аккаунта <strong>${login}</strong> был одобрен администратором поддержки.`,
          "danger",
          { title: "⚠️ Внимание! Ваш аккаунт будет удален" }
        )}
        
        ${
          reason
            ? `
        <div style="margin-top: 15px;">
          <p style="margin: 0; font-weight: bold; color: ${this.COLORS.gray700};">Причина:</p>
          <p style="margin: 10px 0 0 0; color: ${this.COLORS.gray700};">${reason}</p>
        </div>
        `
            : ""
        }
        
        <div style="background-color: ${
          this.COLORS.infoLight
        }; padding: 20px; border-radius: 6px; margin: 20px 0;">
          <p style="margin: 0; color: ${
            this.COLORS.gray800
          }; font-weight: bold; text-align: center;">
            🗓️ Дата удаления:
          </p>
          <p style="margin: 10px 0; font-size: 24px; color: ${
            this.COLORS.danger
          }; text-align: center; font-weight: bold;">
            ${new Date(deletionDate).toLocaleDateString("ru-RU")}
          </p>
        </div>
        
        ${this._createAlertBox(
          "Что будет удалено:<br>• Все ваши диагностические данные<br>• Загруженные изображения и файлы<br>• История активности<br>• Настройки аккаунта",
          "warning",
          { title: "📋 Последствия удаления:" }
        )}
        
        <div style="text-align: center; margin: 30px 0;">
          <p style="color: ${this.COLORS.gray600}; font-size: 14px;">
            Если вы хотите отменить удаление, немедленно обратитесь в техподдержку!
          </p>
        </div>
      `;

      const mailOptions = {
        from: `"QuickDiagnosis - Техподдержка" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: `🗑️ Запрос на удаление аккаунта #${requestId}`,
        html: this._getEmailTemplate(content, "Удаление аккаунта"),
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log(`📧 Предупреждение об удалении отправлено: ${email}`);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error("❌ Ошибка отправки предупреждения об удалении:", error);
      throw new Error(
        `Не удалось отправить предупреждение об удалении: ${error.message}`
      );
    }
  }

  async sendSupportAdminResponse({
    login,
    email,
    requestId,
    adminName,
    adminResponse,
    reason,
  }) {
    try {
      await this._ensureInitialized();

      const mailOptions = this.templates.supportAdminResponse({
        login,
        email,
        requestId,
        adminName,
        adminResponse,
        reason,
      });

      const info = await this.transporter.sendMail(mailOptions);
      console.log(`📧 Ответ администратора отправлен: ${email} (${requestId})`);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error("❌ Ошибка отправки ответа администратора:", error);
      throw new Error(
        `Не удалось отправить ответ администратора: ${error.message}`
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
