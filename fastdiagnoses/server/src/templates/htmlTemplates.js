// HTML шаблоны для email подтверждения
const getClientUrl = () => process.env.CLIENT_URL || "http://localhost:5000";

const HTML_TEMPLATES = {
  ERROR_INVALID_TOKEN: `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Ошибка подтверждения</title>
      <style>
        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
        .error { color: #d32f2f; }
        .success { color: #4caf50; }
        a { color: #2196f3; text-decoration: none; }
        a:hover { text-decoration: underline; }
      </style>
    </head>
    <body>
      <h1 class="error">Ошибка подтверждения</h1>
      <p>Неверный тип токена</p>
      <p><a href="${getClientUrl()}/register">Зарегистрироваться снова</a></p>
    </body>
    </html>
  `,

  ERROR_USER_NOT_FOUND: `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Ошибка подтверждения</title>
      <style>
        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
        .error { color: #d32f2f; }
        .success { color: #4caf50; }
        a { color: #2196f3; text-decoration: none; }
        a:hover { text-decoration: underline; }
      </style>
    </head>
    <body>
      <h1 class="error">Ошибка подтверждения</h1>
      <p>Пользователь не найден или уже активирован</p>
      <p><a href="${getClientUrl()}/login">Перейти к входу</a></p>
    </body>
    </html>
  `,

  SUCCESS_CONFIRMED: `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Email подтвержден</title>
      <style>
        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
        .error { color: #d32f2f; }
        .success { color: #4caf50; }
        a { color: #2196f3; text-decoration: none; }
        a:hover { text-decoration: underline; }
        .loader { margin: 20px auto; width: 50px; height: 50px; border: 5px solid #f3f3f3; border-top: 5px solid #4caf50; border-radius: 50%; animation: spin 1s linear infinite; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      </style>
    </head>
    <body>
      <h1 class="success">Email подтвержден!</h1>
      <p>Теперь вы можете войти в систему</p>
      <div class="loader"></div>
      <p>Автоматический переход через 5 секунд...</p>
      <p><a href="${getClientUrl()}/login">Перейти к входу сейчас</a></p>
      <script>
        setTimeout(() => {
          window.location.href = '${getClientUrl()}/login';
        }, 5000);
      </script>
    </body>
    </html>
  `,

  ERROR_EXPIRED_TOKEN: `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Ошибка подтверждения</title>
      <style>
        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
        .error { color: #d32f2f; }
        .success { color: #4caf50; }
        a { color: #2196f3; text-decoration: none; }
        a:hover { text-decoration: underline; }
      </style>
    </head>
    <body>
      <h1 class="error">Ссылка устарела</h1>
      <p>Ссылка подтверждения недействительна или устарела</p>
      <p><a href="${getClientUrl()}/register">Зарегистрироваться снова</a></p>
    </body>
    </html>
  `,

  ERROR_SERVER: `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Ошибка сервера</title>
      <style>
        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
        .error { color: #d32f2f; }
        a { color: #2196f3; text-decoration: none; }
        a:hover { text-decoration: underline; }
      </style>
    </head>
    <body>
      <h1 class="error">Ошибка подтверждения email</h1>
      <p>Попробуйте позже</p>
      <p><a href="${getClientUrl()}">Вернуться на главную</a></p>
    </body>
    </html>
  `,
};

// Функция для получения шаблона (опционально, можно использовать напрямую)
const getTemplate = (templateName) => {
  if (!HTML_TEMPLATES[templateName]) {
    throw new Error(`Шаблон ${templateName} не найден`);
  }
  return HTML_TEMPLATES[templateName];
};

module.exports = {
  HTML_TEMPLATES,
  getTemplate,
};
