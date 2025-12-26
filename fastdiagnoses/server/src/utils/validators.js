const path = require("path");
const validator = require("validator");

// Класс ошибки валидации
class ValidationError extends Error {
  constructor(message, field) {
    super(message);
    this.name = "ValidationError";
    this.field = field;
  }
}

// Валидация логина
function validateLogin(login) {
  if (!login || login.trim().length === 0) {
    throw new ValidationError("Логин обязателен", "login");
  }

  if (login.length < 4) {
    throw new ValidationError("Логин должен быть не менее 4 символов", "login");
  }

  if (login.length > 20) {
    throw new ValidationError(
      "Логин должен быть не более 20 символов",
      "login"
    );
  }

  const dangerousChars = new RegExp("[<>/\\\\&'\"]");
  if (dangerousChars.test(login)) {
    throw new ValidationError("Логин содержит недопустимые символы", "login");
  }

  const sqlKeywords = /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|EXEC)\b)/i;
  if (sqlKeywords.test(login)) {
    throw new ValidationError("Логин содержит недопустимые слова", "login");
  }

  return login.trim();
}

// Валидация пароля
function validatePassword(password) {
  if (!password || password.length === 0) {
    throw new ValidationError("Пароль обязателен", "password");
  }

  if (password.length < 6) {
    throw new ValidationError(
      "Пароль должен быть не менее 6 символов",
      "password"
    );
  }

  if (password.length > 50) {
    throw new ValidationError(
      "Пароль должен быть не более 50 символов",
      "password"
    );
  }

  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);

  if (!hasUpperCase || !hasLowerCase || !hasNumbers) {
    throw new ValidationError(
      "Пароль должен содержать заглавные, строчные буквы и цифры",
      "password"
    );
  }

  const cyrillic = /[а-яА-ЯёЁ]/;
  if (cyrillic.test(password)) {
    throw new ValidationError(
      "Пароль не должен содержать кириллицу",
      "password"
    );
  }

  return password;
}

// Валидация кодового слова
function validateSecretWord(secretWord) {
  if (
    !secretWord ||
    typeof secretWord !== "string" ||
    secretWord.trim().length === 0
  ) {
    throw new ValidationError("Кодовое слово обязательно", "secretWord");
  }

  const trimmedWord = secretWord.trim();

  // Длина
  if (trimmedWord.length < 3) {
    throw new ValidationError(
      "Кодовое слово должно быть не менее 3 символов",
      "secretWord"
    );
  }

  if (trimmedWord.length > 50) {
    throw new ValidationError(
      "Кодовое слово должно быть не более 50 символов",
      "secretWord"
    );
  }

  // Только буквы (кириллица и латиница) - без цифр, пробелов, спецсимволов
  if (!/^[а-яёА-ЯЁa-zA-Z]+$/.test(trimmedWord)) {
    throw new ValidationError(
      "Кодовое слово должно содержать только буквы (русские или английские). Без цифр, пробелов и спецсимволов.",
      "secretWord"
    );
  }

  // Проверка на опасные символы (как в validateLogin)
  const dangerousChars = new RegExp("[<>/\\\\&'\"]");
  if (dangerousChars.test(trimmedWord)) {
    throw new ValidationError(
      "Кодовое слово содержит недопустимые символы",
      "secretWord"
    );
  }

  // Проверка на SQL инъекции (как в validateLogin)
  const sqlKeywords = /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|EXEC)\b)/i;
  if (sqlKeywords.test(trimmedWord)) {
    throw new ValidationError(
      "Кодовое слово содержит недопустимые слова",
      "secretWord"
    );
  }

  // Проверка на слишком простые/очевидные слова
  const simpleWords = [
    "пароль",
    "password",
    "код",
    "code",
    "слово",
    "word",
    "секрет",
    "secret",
    "ключ",
    "key",
    "доступ",
    "access",
  ];

  if (simpleWords.includes(trimmedWord.toLowerCase())) {
    throw new ValidationError(
      "Выберите более сложное кодовое слово",
      "secretWord"
    );
  }

  // Проверка на повторяющиеся символы (более 3 подряд)
  if (/(.)\1\1/.test(trimmedWord)) {
    throw new ValidationError(
      "Слишком много повторяющихся символов",
      "secretWord"
    );
  }

  return trimmedWord;
}

// Валидация email
function validateEmail(email) {
  if (!email || email.trim().length === 0) {
    throw new ValidationError("Email обязателен", "email");
  }

  if (!validator.isEmail(email)) {
    throw new ValidationError("Некорректный формат email", "email");
  }

  const disposableDomains = [
    "tempmail",
    "throwaway",
    "guerrillamail",
    "mailinator",
    "yopmail",
    "trashmail",
    "fakeinbox",
    "10minutemail",
  ];

  const domain = email.split("@")[1];
  if (disposableDomains.some((d) => domain.includes(d))) {
    throw new ValidationError("Временные email не поддерживаются", "email");
  }

  return email.trim().toLowerCase();
}

// Валидация опроса
function validateSurvey(survey) {
  if (!survey || typeof survey !== "object") {
    throw new ValidationError("Некорректные данные опроса", "survey");
  }

  const surveyStr = JSON.stringify(survey);
  if (surveyStr.length > 100000) {
    throw new ValidationError("Данные опроса слишком большие", "survey");
  }

  return survey;
}

// Валидация изображения (Buffer)
function validateImageBuffer(buffer, filename) {
  if (!buffer || !Buffer.isBuffer(buffer)) {
    throw new ValidationError("Некорректные данные изображения", "file");
  }

  if (!filename || filename.trim().length === 0) {
    throw new ValidationError("Имя файла обязательно", "filename");
  }

  if (buffer.length > 15 * 1024 * 1024) {
    throw new ValidationError("Файл слишком большой (максимум 15MB)", "file");
  }

  if (buffer.length === 0) {
    throw new ValidationError("Файл пустой", "file");
  }

  const allowedExtensions = [
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".bmp",
    ".tiff",
    ".webp",
    ".svg",
  ];
  const fileExtension = path.extname(filename).toLowerCase();

  if (!allowedExtensions.includes(fileExtension)) {
    throw new ValidationError(
      `Недопустимый формат файла. Разрешенные форматы: ${allowedExtensions.join(
        ", "
      )}`,
      "filename"
    );
  }

  return { buffer, filename };
}

module.exports = {
  ValidationError,
  validateLogin,
  validatePassword,
  validateEmail,
  validateSurvey,
  validateImageBuffer,
  validateSecretWord,
};
