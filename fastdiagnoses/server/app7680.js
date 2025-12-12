const express = require("express");
const WebSocket = require("ws");
const path = require("path");
const bodyParser = require("body-parser");
const mysql = require("mysql2");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const sharp = require("sharp");
const { objectForCreateDom } = require("./utils/constants");
const { objectError } = require("./utils/constants");
const secretKey = "uploadfile";
const secretKeyTwo = "sessionkey";
const { poolConfig } = require("./utils/configFile");
const { transporter } = require("./utils/configFile");
const { validateEmail } = require("./utils/functions");
const { docHtml } = require("./utils/functions");
const { answerReformatting } = require("./utils/functions");
const { howLongRequest } = require("./utils/functions");
const { getOriginIMG } = require("./utils/functions");
const { surveysAndImages } = require("./utils/functions");
let pool = mysql.createPool(poolConfig);

// переменные websocket
let directory = ""; //название директории для изменения файла
let countMessage = 0; //счетчик сообщений вебсокета
const { activeClients } = require("./utils/funcForWebsocket");
const { messageToClientFromExpress } = require("./utils/funcForWebsocket");
const { messageToClientSuccessWrite } = require("./utils/funcForWebsocket");
const { messageToclientErrorWrite } = require("./utils/funcForWebsocket");
const { messageToclient } = require("./utils/funcForWebsocket");
const { onSocketPreError } = require("./utils/funcForWebsocket");
const { onSocketPostError } = require("./utils/funcForWebsocket");

// создаем объект приложения
const webserver = express();
const buildPath = path.join(__dirname, "..", "build");
// статические данные с JS, CSS, HTML
webserver.use("/images", express.static(buildPath + "/images"));
webserver.use(express.static(path.join(buildPath, "static")));

webserver.use(express.urlencoded({ extended: false }));

// отдаем html документ
webserver.get("/main", function (request, response) {
  response.setHeader("Content-Type", "text/html");
  response.setHeader("Cache-Control", "no-cache");
  response.sendFile(buildPath + "/index.html");
});

// страница аккаунта
webserver.get("/main/account", function (request, response) {
  response.setHeader("Content-Type", "text/html");
  response.setHeader("Cache-Control", "no-cache");
  response.sendFile(__dirname + "/public" + "/account7680.html");
});

// загрузка файлов на сервер
webserver.post("/downloadToServer", async function (request, response) {
  let connectionSQL = null;
  try {
    const authHeader = request.headers.authorization;
    if (!authHeader) {
      return response.redirect(302, `/main/entry`);
    }
    const token = authHeader.split(" ")[1];
    jwt.verify(token, secretKeyTwo, async (err, user) => {
      if (err) {
        return response.redirect(302, `/main/entry`);
      } else {
        connectionSQL = await newConnectionFactory(pool);
        const contentLength = request.headers["content-length"];
        let body = "";
        let idForCompare = "";
        request.on("data", (chunk) => {
          body += chunk.toString();
          idForCompare = body.slice(
            body.indexOf(":") + 2,
            body.indexOf(",") - 1
          );
          activeClients.forEach((client) => {
            if (
              client.readyState === WebSocket.OPEN &&
              client.uniqueID === idForCompare
            ) {
              client.lastkeepalive = Date.now();
              const objectToClient = {};
              objectToClient.websocketId = client.uniqueID;
              let percentData = Math.round((body.length / contentLength) * 100);
              objectToClient.message = `Получено данных: ${percentData}`;
              client.send(JSON.stringify(objectToClient));
            }
          });
        });
        request.on("end", async () => {
          messageToClientFromExpress(
            JSON.parse(body),
            `Получение данных завершено: ${(body.length / contentLength) * 100}`
          );
          const object = JSON.parse(body);
          const buffer = Buffer.from(object.file, "base64");
          const resizedBuffer = await sharp(buffer).resize(100, 100).toBuffer();
          const smallImage = resizedBuffer.toString("base64");
          messageToClientFromExpress(object, "ДОбавляем данные в таблицу");
          let uploadImagesInPersonalDB = await selectQueryFactory(
            connectionSQL,
            'INSERT INTO  `?` (fileNameOriginIMG, originIMG, comment, smallIMG) VALUES ("?","?","?","?");',
            [
              directory,
              object.filename,
              object.file,
              object.comment,
              smallImage,
            ]
          );
          if (uploadImagesInPersonalDB === "успех") {
            messageToClientSuccessWrite(object);
            response.sendStatus(200);
          }
          connectionSQL.release();
        });
      }
    });
  } catch (error) {
    messageToclientErrorWrite(object);
    response.status(400).send(`${error}`);
  }
});

// парсит request
webserver.use(bodyParser.json());

// аутентификация начало
// отдаем страницу аутентификации
webserver.get("/main/auth", function (request, response) {
  response.setHeader("Content-Type", "text/html");
  response.setHeader("Cache-Control", "no-cache");
  response.sendFile(__dirname + "/public" + "/auth.html");
});

// аутентификация-валидация-токен-почта
webserver.post("/main/auth/variants", async function (request, response) {
  let connectionSQL = null;
  try {
    connectionSQL = await newConnectionFactory(pool);
    // проверка для поля логин
    if (request.body.login) {
      // валидация поля логин
      const loginString = JSON.stringify(request.body.login);
      if (loginString.includes("<script>") || loginString.includes("</script>"))
        throw new Error(objectError.scriptNone);
      if (
        loginString.includes("<") ||
        loginString.includes(">") ||
        loginString.includes("/") ||
        loginString.includes("&")
      )
        throw new Error(objectError.loginwrongSymbol);

      // проверка логина на уникальность
      let answer = await selectQueryFactory(
        connectionSQL,
        `select * from usersdata where login =?;`,
        [request.body.login]
      );
      connectionSQL.release();
      if (answer.length > 0) {
        throw new Error(objectError.loginAlreadyExists);
      }
    }

    // проверка для поля пароль
    if (request.body.password) {
      const passwordString = JSON.stringify(request.body.password);
      if (
        passwordString.includes("<script>") ||
        passwordString.includes("</script>")
      )
        throw new Error(objectError.scriptNone);
      if (
        passwordString.includes("<") ||
        passwordString.includes(">") ||
        passwordString.includes(" ")
      )
        throw new Error(objectError.passwordWrongSymbol);
    }

    // проверка email
    if (!validateEmail(request.body.email)) {
      if (request.body.email.length === 0)
        throw new Error(objectError.emailNull);
      else throw new Error(objectError.emailerrorOne);
    }
    // отправляем страницу
    const newPage = docHtml(request);
    if (typeof newPage === "object") {
      const salt = await bcrypt.genSalt(10);
      const hashPass = await bcrypt.hash(request.body.password, salt);
      const payload = { username: request.body.login };
      const token = jwt.sign(payload, secretKey, { expiresIn: "366d" });
      connectionSQL = await newConnectionFactory(pool);
      let answerInsert = await selectQueryFactory(
        connectionSQL,
        `INSERT INTO usersdata (login, password, email, jwt, logic)
      VALUES(?, ?, ?, ?, ?);`,
        [request.body.login, hashPass, request.body.email, token, "false"]
      );
      // 178.172.195.18
      //   localhost
      if (answerInsert === "успех") {
        connectionSQL.release();
        const mailOptions = {
          from: "trmailforupfile@gmail.com",
          to: `${request.body.email}`,
          subject: "Завершение авторизации",
          html: `<p>Для завершения авторизации - перейдите по ссылке:</p><br><p><a href="http://178.172.195.18:7681/main/auth/final?token=${(request.query.token =
            token)}">http://178.172.195.18:7681/main/auth/final?token=${token}</a></p>`,
        };
        transporter.sendMail(mailOptions, (error, info) => {
          if (error) {
            response.redirect(302, `/main/auth/error?errorMessage=${error}`);
          } else {
            response.redirect(
              302,
              `/main/auth/success?login=${(request.query.login =
                newPage.login)}`
            );
          }
        });
      }
    } else {
      response.setHeader("Content-Type", "text/html");
      response.setHeader("Cache-Control", "no-cache");
      response.status(200).send(`${newPage}`);
    }
  } catch (error) {
    // отправляем текст ошибки
    response.redirect(
      302,
      `/main/auth/error?errorMessage=${(request.query.errorMessage = error)}`
    );
  }
});

// аутентификация ошибки
webserver.get("/main/auth/error", function (request, response) {
  try {
    if (request.query.errorMessage) {
      // создание html ошибки
      let errorPage = objectForCreateDom.htmlError;
      errorPage = errorPage.replace(
        "$[status]",
        `${request.query.errorMessage}`
      );
      response.setHeader("Content-Type", "text/html");
      response.setHeader("Cache-Control", "no-store");
      response.status(200).send(`${errorPage}`);
    } else {
      throw new Error(objectError.errorUndefined);
    }
  } catch (error) {
    response.redirect(
      302,
      `/main/auth/error?errorMessage=${(request.query.errorMessage = error)}`
    );
  }
});

// страница успешной аутентификации
webserver.get("/main/auth/success", function (request, response) {
  try {
    if (request.query.login) {
      // создание html успеха
      let successPage = objectForCreateDom.htmlSuccess;
      successPage = successPage.replace("$[login]", `${request.query.login}`);
      response.setHeader("Content-Type", "text/html");
      response.setHeader("Cache-Control", "no-store");
      response.status(200).send(`${successPage}`);
    } else {
      throw new Error(objectError.errorUndefined);
    }
  } catch (error) {
    response.redirect(
      302,
      `/main/auth/error?errorMessage=${(request.query.errorMessage = error)}`
    );
  }
});

// обработчик страницы финальной авторизации
webserver.get("/main/auth/final", async function (request, response) {
  let connectionSQL = null;
  try {
    connectionSQL = await newConnectionFactory(pool);
    if (request.query.token) {
      let answerUpdate = await selectQueryFactory(
        connectionSQL,
        `UPDATE usersdata
     SET logic = REPLACE(logic, 'false', 'true')
     WHERE jwt =?;`,
        [request.query.token]
      );
      if (answerUpdate === "успех") {
        response.redirect(302, `/main/entry`);
      }
      connectionSQL.release();
    }
  } catch (error) {
    response.redirect(
      302,
      `/main/auth/error?errorMessage=${(request.query.errorMessage = error)}`
    );
  }
});

// обработчик страницы входа
webserver.get("/main/entry", async function (request, response) {
  try {
    response.setHeader("Content-Type", "text/html");
    response.setHeader("Cache-Control", "no-store");
    response.sendFile(buildPath + "/index.html");
  } catch (error) {
    response.redirect(
      302,
      `/main/entry/error?errorMessage=${(request.query.errorMessage = error)}`
    );
  }
});

// обработчик ошибок страницы входа
webserver.get("/main/entry/error", function (request, response) {
  try {
    if (request.query.errorMessage) {
      // создание html ошибки
      let errorPage = objectForCreateDom.htmlErrorTwo;
      errorPage = errorPage.replace(
        "$[status]",
        `${request.query.errorMessage}`
      );
      response.setHeader("Content-Type", "text/html");
      response.setHeader("Cache-Control", "no-store");
      response.status(200).send(`${errorPage}`);
    } else {
      throw new Error(objectError.errorUndefined);
    }
  } catch (error) {
    response.redirect(
      302,
      `/main/entry/error?errorMessage=${(request.query.errorMessage = error)}`
    );
  }
});

// валидация входа, создание сессии
webserver.post("/entryData", async function (request, response) {
  let connectionSQL = null;
  try {
    connectionSQL = await newConnectionFactory(pool);
    // валидация поля логин
    if (request.body.login) {
      const loginString = JSON.stringify(request.body.login);
      if (loginString.includes("<script>") || loginString.includes("</script>"))
        throw new Error(objectError.scriptNone);
      if (
        loginString.includes("<") ||
        loginString.includes(">") ||
        loginString.includes("/") ||
        loginString.includes("&")
      )
        throw new Error(objectError.loginwrongSymbol);
    } else throw new Error(objectError.loginNull);

    // проверка для поля пароль
    if (request.body.password) {
      const passwordString = JSON.stringify(request.body.password);
      if (
        passwordString.includes("<script>") ||
        passwordString.includes("</script>")
      )
        throw new Error(objectError.scriptNone);
      if (
        passwordString.includes("<") ||
        passwordString.includes(">") ||
        passwordString.includes(" ")
      )
        throw new Error(objectError.passwordWrongSymbol);
    } else throw new Error(objectError.passwordNull);

    // проверка логина на нахождение в таблице
    let answerExistLogin = await selectQueryFactory(
      connectionSQL,
      `select * from usersdata where login =?;`,
      [request.body.login]
    );
    connectionSQL.release();
    if (answerExistLogin.length === 0) {
      throw new Error(objectError.loginPasswordPairNotExist);
    } else if (answerExistLogin[0].logic !== "true") {
      throw new Error(objectError.loginNoActive);
    } else {
      const passwordCompare = await bcrypt.compare(
        request.body.password,
        answerExistLogin[0].password
      );
      if (passwordCompare) {
        createTokenAndWriteToDB(request.body.login, connectionSQL, response);
      } else {
        throw new Error(objectError.loginPasswordPairNotExist);
      }
    }
  } catch (error) {
    response.redirect(
      302,
      `/main/entry/error?errorMessage=${(request.query.errorMessage = error)}`
    );
  } finally {
    connectionSQL.release();
  }
});

// создание сессионного ключа и запись в сессию
const createTokenAndWriteToDB = async (login, connectionSQL, response) => {
  try {
    connectionSQL = await newConnectionFactory(pool);
    const payload = { username: login };
    const token = jwt.sign(payload, secretKeyTwo, { expiresIn: "2h" });
    let insertToSessionTab = await selectQueryFactory(
      connectionSQL,
      `INSERT INTO sessionsdata (login, jwt_access)
      VALUES(?, ?);`,
      [login, token]
    );
    connectionSQL.release();
    if (insertToSessionTab === "успех") {
      connectionSQL = await newConnectionFactory(pool);
      let getDataFromSessionTab = await selectQueryFactory(
        connectionSQL,
        `select * from sessionsdata where jwt_access =?;`,
        [token]
      );
      const objectToClient = getDataFromSessionTab[0];
      response.setHeader("Content-Type", "application/json");
      response.setHeader("Cache-Control", "no-store");
      response.status(200).send(`${JSON.stringify(objectToClient)}`);
    }
  } catch (error) {
    response.redirect(
      302,
      `/main/entry/error?errorMessage=${(request.query.errorMessage = error)}`
    );
  }
};

webserver.use((request, response, next) => {
  try {
    const authHeader = request.headers.authorization;
    if (!authHeader) {
      return response.redirect(302, `/main/entry`);
    }
    const token = authHeader.split(" ")[1];
    jwt.verify(token, secretKeyTwo, (err, user) => {
      if (err) {
        return response.redirect(302, `/main/entry`);
      } else {
        return next();
      }
    });
  } catch (error) {
    response.redirect(
      302,
      `/main/entry/error?errorMessage=${(request.query.errorMessage = error)}`
    );
  }
});
// аутентификация конец

// проверка JWT
webserver.post("/checkJWT", (request, response) => {
  response.sendStatus(200);
});

// переход на главную страницу
webserver.post("/toMain", (request, response) => {
  response.redirect(302, `/main`);
});

// отправляем рекомендации на клиент
webserver.post("/searchDiagnoses", async function (request, response) {
  let connectionSQL = null;
  try {
    let string = howLongRequest(request.body.titles);
    connectionSQL = await newConnectionFactory(pool);
    let answerSearch = await selectQueryFactory(
      connectionSQL,
      string,
      request.body.titles
    );
    let json = answerReformatting({ ...answerSearch });
    connectionSQL.release();
    response.setHeader("Content-Type", "application/json");
    response.setHeader("Cache-Control", "no-store");
    response.status(200).send(`${json}`);
  } catch (error) {
    response.status(400).send(`${error}`);
  }
});

// проверка на существование БД, и создание если нету
webserver.post("/justAsk", async function (request, response) {
  let connectionSQL = null;
  try {
    connectionSQL = await newConnectionFactory(pool);
    let answerExistDB = await selectQueryFactory(
      connectionSQL,
      "SHOW Tables like ?;",
      [`'${request.body.login}'`]
    );
    let string = JSON.stringify({ ...answerExistDB });
    connectionSQL.release();
    if (string.includes(request.body.login)) {
      response.sendStatus(200);
    } else {
      connectionSQL = await newConnectionFactory(pool);
      let createTable = await selectQueryFactory(
        connectionSQL,
        "CREATE TABLE `?` ( `id` INT AUTO_INCREMENT PRIMARY KEY COLLATE 'utf8mb4_general_ci', `survey` LONGTEXT NULL DEFAULT NULL COLLATE 'utf8mb4_general_ci', `fileNameOriginIMG` LONGTEXT NULL DEFAULT NULL COLLATE 'utf8mb4_general_ci', `originIMG` LONGTEXT NULL DEFAULT NULL COLLATE 'utf8mb4_general_ci', `comment` LONGTEXT NULL DEFAULT NULL COLLATE 'utf8mb4_general_ci',  `smallIMG` LONGTEXT NULL DEFAULT NULL COLLATE 'utf8mb4_general_ci');",
        [request.body.login]
      );
      if (createTable === "успех") {
        response.sendStatus(200);
      }
      connectionSQL.release();
    }
  } catch (error) {
    response.status(400).send(`${error}`);
  }
});

// заполняем поля в таблице
webserver.post("/toPersonalDB", async function (request, response) {
  let connectionSQL = null;
  try {
    connectionSQL = await newConnectionFactory(pool);
    let insertSurveyToPersonalDB = await selectQueryFactory(
      connectionSQL,
      'INSERT INTO  `?` (survey) VALUES ("?");',
      [request.body.login, request.body.survey]
    );
    if (insertSurveyToPersonalDB === "успех") {
      response.sendStatus(200);
    }
    connectionSQL.release();
  } catch (error) {
    response.status(400).send(`${error}`);
  }
});

// получаем поля из таблицы
webserver.post("/getSurveys", async function (request, response) {
  let connectionSQL = null;
  try {
    connectionSQL = await newConnectionFactory(pool);
    let selectAllFromPersonalDB = await selectQueryFactory(
      connectionSQL,
      "SELECT * FROM  `?`;",
      [request.body.login]
    );
    let result = surveysAndImages({ ...selectAllFromPersonalDB });
    connectionSQL.release();
    response.setHeader("Content-Type", "application/json");
    response.setHeader("Cache-Control", "no-store");
    response.status(200).send(`${result}`);
  } catch (error) {
    console.log(error);

    response.status(400).send(`${error}`);
  }
});

// удаляем строку из таблицы
webserver.post("/deleteRow", async function (request, response) {
  let connectionSQL = null;
  try {
    connectionSQL = await newConnectionFactory(pool);
    let deleteRowFromPersonalDB = await selectQueryFactory(
      connectionSQL,
      "DELETE FROM `?` WHERE id =?;",
      [request.body.login, request.body.id]
    );
    if (deleteRowFromPersonalDB === "успех") {
      response.sendStatus(200);
    }
    connectionSQL.release();
  } catch (error) {
    response.status(400).send(`${error}`);
  }
});

// получаем оригинальное изображение
webserver.post("/originImage", async function (request, response) {
  let connectionSQL = null;
  try {
    connectionSQL = await newConnectionFactory(pool);
    let originImageFromPersonalDB = await selectQueryFactory(
      connectionSQL,
      "SELECT * FROM `?` WHERE id =?;",
      [request.body.login, request.body.id]
    );
    const result = getOriginIMG({ ...originImageFromPersonalDB });
    connectionSQL.release();
    response.setHeader("Content-Type", "application/json");
    response.setHeader("Cache-Control", "no-store");
    response.status(200).send(result);
  } catch (error) {
    response.status(400).send(`${error}`);
  }
});

// переход на страницу аккаунта
webserver.post("/toAccount", (request, response) => {
  response.redirect(302, `/main/account`);
});

// начинаем прослушивать подключения на 7681 порту и создаем константу для апгрейда экспресса и вебсокета
const s = webserver.listen(3000);

// создаем вебсокет на одном порту с экспрессом
const server = new WebSocket.Server({ noServer: true });

// апгрейд вебсокета
s.on("upgrade", (request, socket, head) => {
  socket.on("error", onSocketPreError);
  if (!!request.headers["BadAuth"]) {
    socket.write("HTTP/1.1 401 Unauthorized");
    socket.destroy();
    return;
  }
  server.handleUpgrade(request, socket, head, (ws) => {
    socket.removeListener("error", onSocketPreError);
    server.emit("connection", ws, request);
  });
});

// начинаем слушать соединение и события
server.on("connection", (ws, request) => {
  ws.on("error", onSocketPostError);
  ws.on("message", (msg, isBinary) => {
    const objectFromClient = JSON.parse(new TextDecoder("utf-8").decode(msg));
    if (objectFromClient.message === "Соединение установлено") {
      ws.uniqueID = objectFromClient.websocketId;
      activeClients.push(ws);
      countMessage++;
      messageToclient(objectFromClient);
    } else if (countMessage === 1) {
      directory = objectFromClient.message;
      objectFromClient.message = "Получено название директории";
      countMessage++;
      messageToclient(objectFromClient);
    } else if (objectFromClient.message === "CLOSE") {
      objectFromClient.message = "Передача данных завершена";
      directory = "";
      countMessage = 0;
      activeClients.forEach((client) => {
        if (
          Date.now() > client.lastkeepalive &&
          client.uniqueID === objectFromClient.websocketId
        ) {
          client.close(1000, "Соединение с сервером закрыто");
        }
      });
    }
  });
  ws.on("close", () => {
    activeClients.forEach((client, i) => {
      if (client.readyState !== WebSocket.CLOSE) {
        activeClients.splice(i, 1);
      }
    });
  });
});

// работа с БД
// возвращает соединение с БД, взятое из пула соединений
function newConnectionFactory(pool) {
  return new Promise((resolve, reject) => {
    pool.getConnection(function (err, connection) {
      if (err) {
        reject(err);
      } else {
        resolve(connection);
      }
    });
  });
}

// выполняет SQL-запрос на чтение, возвращает массив прочитанных строк
function selectQueryFactory(connection, queryText, queryValues) {
  return new Promise((resolve, reject) => {
    connection.query(queryText, queryValues, function (err, results, fields) {
      if (err) {
        reject(err);
      } else {
        if (fields === undefined) {
          resolve("успех");
        } else {
          resolve(results);
        }
      }
    });
  });
}
