const { getTemplate } = require("./templates/htmlTemplates");
const logger = require("../services/LoggerService"); // ← ДОБАВЛЕН ИМПОРТ

exports.sendEmailConfirmationResponse = (res, templateType, clientUrl) => {
  try {
    const html = getTemplate(templateType, clientUrl);
    res.send(html);

    logger.warn("Отправлен HTML шаблон подтверждения email", {
      template_type: templateType,
      client_url: clientUrl,
      endpoint: res.req?.path,
      method: res.req?.method,
      ip: res.req?.ip,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Критическая ошибка рендеринга HTML шаблона", {
      template_type: templateType,
      client_url: clientUrl,
      error_message: error.message,
      error_stack: error.stack?.substring(0, 500),
      endpoint: res.req?.path,
      method: res.req?.method,
      ip: res.req?.ip,
      timestamp: new Date().toISOString(),
    });

    res.status(500).send("Внутренняя ошибка сервера");
  }
};

exports.sendErrorResponse = (res, statusCode, message) => {
  logger.warn("Отправка ошибки клиенту", {
    status_code: statusCode,
    error_message: message,
    endpoint: res.req?.path,
    method: res.req?.method,
    ip: res.req?.ip,
    user_agent: res.req?.headers["user-agent"]?.substring(0, 200),
    timestamp: new Date().toISOString(),
  });

  return res.status(statusCode).json({
    success: false,
    message: message,
  });
};

exports.sendSuccessResponse = (res, data = {}) => {
  // Логируем только важные успешные ответы (можно настроить фильтр)
  const shouldLog =
    res.req?.path?.includes("/api/admin") || // Админские действия
    res.req?.path?.includes("/api/support") || // Техподдержка
    res.statusCode !== 200; // Нестандартные статусы

  if (shouldLog) {
    logger.warn("Успешный ответ клиенту", {
      status_code: res.statusCode,
      endpoint: res.req?.path,
      method: res.req?.method,
      data_keys: Object.keys(data).join(", "),
      ip: res.req?.ip,
      timestamp: new Date().toISOString(),
    });
  }

  return res.json({
    success: true,
    ...data,
  });
};
