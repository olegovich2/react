const { getTemplate } = require("./templates/htmlTemplates");

exports.sendEmailConfirmationResponse = (res, templateType, clientUrl) => {
  try {
    const html = getTemplate(templateType, clientUrl);
    res.send(html);
  } catch (error) {
    console.error("Ошибка рендеринга шаблона:", error);
    res.status(500).send("Внутренняя ошибка сервера");
  }
};

exports.sendErrorResponse = (res, statusCode, message) => {
  return res.status(statusCode).json({
    success: false,
    message: message,
  });
};

exports.sendSuccessResponse = (res, data = {}) => {
  return res.json({
    success: true,
    ...data,
  });
};
