const { objectForCreateDom } = require("../utils/constants");
const { objectError } = require("../utils/constants");
const { objectCss } = require("../utils/constants");

// валидация email
const validateEmail = (email) => {
  var re =
    /^(([^<>()[\].,;:\s@"]+(\.[^<>()[\].,;:\s@"]+)*)|(".+"))@(([^<>()[\].,;:\s@"]+\.)+[^<>()[\].,;:\s@"]{2,})$/iu;
  return re.test(String(email).toLowerCase());
};

// функция создания html документа
const docHtml = (object) => {
  const resultObject = {};
  const regularKirillica = /[а-яА-ЯёЁ\s\.\,\!\?\-]/gm;
  let anyconst = objectForCreateDom.htmlNew;
  // проверка логина на длину
  if (!object.body.login || object.body.login.length === 0) {
    anyconst = anyconst.replace("$[inputClassLogin]", objectCss.errors);
    anyconst = anyconst.replace("$[login]", objectCss.empty);
    anyconst = anyconst.replace("$[classPLogin]", objectCss.errorParagraf);
    anyconst = anyconst.replace("$[textPErrorLogin]", objectError.loginNull);
  } else if (object.body.login.length !== 0 && object.body.login.length < 4) {
    anyconst = anyconst.replace("$[inputClassLogin]", objectCss.errors);
    anyconst = anyconst.replace("$[login]", `${object.body.login}`);
    anyconst = anyconst.replace("$[classPLogin]", objectCss.errorParagraf);
    anyconst = anyconst.replace("$[textPErrorLogin]", objectError.loginShort);
  } else if (object.body.login.length !== 0 && object.body.login.length > 20) {
    anyconst = anyconst.replace("$[inputClassLogin]", objectCss.errors);
    anyconst = anyconst.replace("$[login]", `${object.body.login}`);
    anyconst = anyconst.replace("$[classPLogin]", objectCss.errorParagraf);
    anyconst = anyconst.replace("$[textPErrorLogin]", objectError.loginLonger);
  } else if (
    object.body.login.length !== 0 &&
    object.body.login.length >= 4 &&
    object.body.login.length <= 20
  ) {
    anyconst = anyconst.replace("$[inputClassLogin]", objectCss.success);
    anyconst = anyconst.replace("$[login]", `${object.body.login}`);
    anyconst = anyconst.replace("$[classPLogin]", objectCss.empty);
    anyconst = anyconst.replace("$[textPErrorLogin]", objectCss.empty);
    resultObject.login = "успех";
  }
  // проверка пароля на длину
  if (!object.body.password || object.body.password.length === 0) {
    anyconst = anyconst.replace("$[inputClassPassword]", objectCss.errors);
    anyconst = anyconst.replace("$[password]", objectCss.empty);
    anyconst = anyconst.replace("$[classPPassword]", objectCss.errorParagraf);
    anyconst = anyconst.replace(
      "$[textPErrorPassword]",
      objectError.passwordNull
    );
  } else if (regularKirillica.test(object.body.password)) {
    anyconst = anyconst.replace("$[inputClassPassword]", objectCss.errors);
    anyconst = anyconst.replace("$[password]", `${object.body.password}`);
    anyconst = anyconst.replace("$[classPPassword]", objectCss.errorParagraf);
    anyconst = anyconst.replace(
      "$[textPErrorPassword]",
      objectError.passwordKirillica
    );
  } else if (
    object.body.password.length !== 0 &&
    object.body.password.length > 15
  ) {
    anyconst = anyconst.replace("$[inputClassPassword]", objectCss.errors);
    anyconst = anyconst.replace("$[password]", `${object.body.password}`);
    anyconst = anyconst.replace("$[classPPassword]", objectCss.errorParagraf);
    anyconst = anyconst.replace(
      "$[textPErrorPassword]",
      objectError.passwordLonger
    );
  } else if (
    object.body.password.length !== 0 &&
    object.body.password.length <= 4
  ) {
    anyconst = anyconst.replace("$[inputClassPassword]", objectCss.errors);
    anyconst = anyconst.replace("$[password]", `${object.body.password}`);
    anyconst = anyconst.replace("$[classPPassword]", objectCss.errorParagraf);
    anyconst = anyconst.replace(
      "$[textPErrorPassword]",
      objectError.passwordShort
    );
  } else if (
    object.body.password.length !== 0 &&
    object.body.password.length > 4 &&
    object.body.password.length <= 15
  ) {
    if (checkPasswords(object.body.password) === "Простой") {
      anyconst = anyconst.replace("$[inputClassPassword]", objectCss.simply);
      anyconst = anyconst.replace("$[password]", `${object.body.password}`);
      anyconst = anyconst.replace(
        "$[classPPassword]",
        objectCss.simplyParagraf
      );
      anyconst = anyconst.replace(
        "$[textPErrorPassword]",
        objectError.passwordSimple
      );
    }
    if (checkPasswords(object.body.password) === "Средний") {
      anyconst = anyconst.replace("$[inputClassPassword]", objectCss.medium);
      anyconst = anyconst.replace("$[password]", `${object.body.password}`);
      anyconst = anyconst.replace(
        "$[classPPassword]",
        objectCss.mediumParagraf
      );
      anyconst = anyconst.replace(
        "$[textPErrorPassword]",
        objectError.passwordMedium
      );
      resultObject.password = "успех";
    }
    if (checkPasswords(object.body.password) === "Сложный") {
      anyconst = anyconst.replace("$[inputClassPassword]", objectCss.success);
      anyconst = anyconst.replace("$[password]", `${object.body.password}`);
      anyconst = anyconst.replace(
        "$[classPPassword]",
        objectCss.successParagraf
      );
      anyconst = anyconst.replace(
        "$[textPErrorPassword]",
        objectError.passwordHard
      );
      resultObject.password = "успех";
    }
  }
  // участок страницы email
  anyconst = anyconst.replace("$[inputClassEmail]", objectCss.success);
  anyconst = anyconst.replace("$[email]", `${object.body.email}`);
  anyconst = anyconst.replace("$[classEmail]", objectCss.empty);
  anyconst = anyconst.replace("$[textErrorEmail]", objectCss.empty);
  resultObject.email = "успех";

  if (
    resultObject.password === "успех" &&
    resultObject.login === "успех" &&
    resultObject.email === "успех"
  ) {
    const success = {};
    success.login = object.body.login;
    return success;
  }
  return anyconst;
};

const checkPasswords = (string) => {
  const s_letters = "qwertyuiopasdfghjklzxcvbnm"; // Буквы в нижнем регистре
  const b_letters = "QWERTYUIOPLKJHGFDSAZXCVBNM"; // Буквы в верхнем регистре
  const digits = "0123456789"; // Цифры
  const specials = "!@#$%^&*()_-+=|/.,:;[]{}"; // Спецсимволы
  let is_s = false; // Есть ли в пароле буквы в нижнем регистре
  let is_b = false; // Есть ли в пароле буквы в верхнем регистре
  let is_d = false; // Есть ли в пароле цифры
  let is_sp = false; // Есть ли в пароле спецсимволы
  for (let i = 0; i < string.length; i++) {
    /* Проверяем каждый символ пароля на принадлежность к тому или иному типу */
    if (!is_s && s_letters.indexOf(string[i]) !== -1) is_s = true;
    else if (!is_b && b_letters.indexOf(string[i]) !== -1) is_b = true;
    else if (!is_d && digits.indexOf(string[i]) !== -1) is_d = true;
    else if (!is_sp && specials.indexOf(string[i]) !== -1) is_sp = true;
  }
  let rating = 0;
  let text = "";
  if (is_s) rating++; // Если в пароле есть символы в нижнем регистре, то увеличиваем рейтинг сложности
  if (is_b) rating++; // Если в пароле есть символы в верхнем регистре, то увеличиваем рейтинг сложности
  if (is_d) rating++; // Если в пароле есть цифры, то увеличиваем рейтинг сложности
  if (is_sp) rating++; // Если в пароле есть спецсимволы, то увеличиваем рейтинг сложности
  /* Далее идёт анализ длины пароля и полученного рейтинга, и на основании этого готовится текстовое описание сложности пароля */
  if (string.length < 6 && rating < 3) text = "Простой";
  else if (string.length < 6 && rating >= 3) text = "Средний";
  else if (string.length >= 8 && rating < 3) text = "Средний";
  else if (string.length >= 8 && rating >= 3) text = "Сложный";
  else if (string.length >= 6 && rating === 1) text = "Простой";
  else if (string.length >= 6 && rating > 1 && rating < 4) text = "Средний";
  else if (string.length >= 6 && rating === 4) text = "Сложный";
  return text;
};

// диагнозы, рекомендации
const answerReformatting = (object) => {
  const objectToClient = {};
  const arrayDiagnoses = [];
  let stringDiagnostics = "";
  let stringTreatment = "";
  for (const key in object) {
    if (object.hasOwnProperty(key)) {
      arrayDiagnoses.push(object[key].nameofDiseaseRu);
      stringDiagnostics += `${object[key].diagnostics},`;
      stringTreatment += `${object[key].treatment},`;
    }
  }
  stringDiagnostics = stringDiagnostics.slice(0, -1);
  stringTreatment = stringTreatment.slice(0, -1);
  const arrayDiag = stringDiagnostics.split(",");
  const arrayTreat = stringTreatment.split(",");
  const diagnosticUniqueArray = Array.from(new Set(arrayDiag));
  const treatmentUniqyeArray = Array.from(new Set(arrayTreat));
  objectToClient.title = arrayDiagnoses;
  objectToClient.diagnostic = diagnosticUniqueArray;
  objectToClient.treatment = treatmentUniqyeArray;
  return JSON.stringify(objectToClient);
};

// насколько длинный запрос на БД
const howLongRequest = (str) => {
  let string = `select * from alldiagnoses where nameOfDisease in (?);`;
  let newString = "";
  for (let i = 0; i < str.length; i++) {
    if (str.length === i + 1) newString += "?";
    else newString += "?,";
  }
  string = string.replace("?", newString);
  return string;
};

// обработка результата из БД оригинального изображения
const getOriginIMG = (object) => {
  const newObject = {};
  for (const key in object) {
    if (object.hasOwnProperty(key)) {
      newObject.id = object[key].id;
      newObject.filename = object[key].fileNameOriginIMG.slice(1, -1);
      newObject.originIMG = object[key].originIMG.slice(1, -1);
    }
  }
  return JSON.stringify(newObject);
};

// преобразование данных личной БД
const surveysAndImages = (object) => {
  const newObject = {};
  newObject.surveys = {};
  newObject.images = {};
  for (const key in object) {
    if (object.hasOwnProperty(key)) {
      if (object[key].survey !== null) {
        newObject.surveys[object[key].id] = object[key].survey.slice(1, -1);
      } else {
        newObject.images[object[key].id] = {};
        newObject.images[object[key].id].fileNameOriginIMG = object[
          key
        ].fileNameOriginIMG.slice(1, -1);
        newObject.images[object[key].id].comment = object[key].comment;
        newObject.images[object[key].id].smallIMG = object[key].smallIMG.slice(
          1,
          -1
        );
      }
    }
  }
  return JSON.stringify(newObject);
};

module.exports = {
  validateEmail,
  docHtml,
  answerReformatting,
  howLongRequest,
  getOriginIMG,
  surveysAndImages,
};
