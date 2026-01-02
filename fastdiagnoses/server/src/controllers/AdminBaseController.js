const logger = require("../../services/LoggerService");

class AdminBaseController {
  constructor() {
    this.logger = logger;
  }

  /**
   * Обертка для всех методов контроллеров
   */
  async handleRequest(handler, req, res) {
    const startTime = Date.now();
    const requestId = Math.random().toString(36).substr(2, 9);

    this.logger.info("API запрос начат", {
      request_id: requestId,
      endpoint: req.path,
      method: req.method,
      admin_id: req.admin?.id,
      ip: req.ip,
    });

    try {
      const result = await handler(req, res);

      const responseTime = Date.now() - startTime;

      this.logger.info("API запрос завершен", {
        request_id: requestId,
        endpoint: req.path,
        method: req.method,
        status_code: res.statusCode,
        response_time_ms: responseTime,
        admin_id: req.admin?.id,
      });

      return result;
    } catch (error) {
      const responseTime = Date.now() - startTime;

      this.logger.error("API запрос завершился ошибкой", {
        request_id: requestId,
        endpoint: req.path,
        method: req.method,
        error_message: error.message,
        stack_trace: error.stack?.substring(0, 500),
        response_time_ms: responseTime,
        admin_id: req.admin?.id,
      });

      throw error;
    }
  }

  /**
   * Успешный ответ
   */
  sendSuccess(res, data, status = 200) {
    return res.status(status).json({
      success: true,
      ...data,
    });
  }

  /**
   * Ошибка
   */
  sendError(res, message, status = 500, details = null) {
    this.logger.error("Отправка ошибки клиенту", {
      message,
      status,
      details,
      endpoint: res.req?.path,
      method: res.req?.method,
    });

    return res.status(status).json({
      success: false,
      error: message,
      ...(details && { details }),
    });
  }
}

module.exports = AdminBaseController;
