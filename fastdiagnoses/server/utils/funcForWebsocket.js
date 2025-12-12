const WebSocket = require("ws");
const activeClients = []; //активные соединения websocket

// отпправка сообщения из экспресса
const messageToClientFromExpress = (object, message) => {
  activeClients.forEach((client) => {
    if (
      client.readyState === WebSocket.OPEN &&
      client.uniqueID === object.websocketid
    ) {
      client.lastkeepalive = Date.now();
      const objectToClient = {};
      objectToClient.websocketId = client.uniqueID;
      objectToClient.message = message;
      client.send(JSON.stringify(objectToClient));
    }
  });
};

// отправка сообщения в случае ошибки
const messageToclientErrorWrite = (object) => {
  activeClients.forEach((client) => {
    if (
      client.readyState === WebSocket.OPEN &&
      client.uniqueID === object.websocketid
    ) {
      client.lastkeepalive = Date.now();
      const objectToClient = {};
      objectToClient.websocketId = client.uniqueID;
      objectToClient.message = "Передача и запись данных завершилась неудачно";
      client.send(JSON.stringify(objectToClient));
    }
  });
};

// отправка сообщения в случае успешной записи файла
const messageToClientSuccessWrite = (object) => {
  activeClients.forEach((client) => {
    if (
      client.readyState === WebSocket.OPEN &&
      client.uniqueID === object.websocketid
    ) {
      client.lastkeepalive = Date.now();
      const objectToClient = {};
      objectToClient.websocketId = client.uniqueID;
      objectToClient.message = "Запись завершена на 100";
      client.send(JSON.stringify(objectToClient));
      objectToClient.message = "Передача и запись данных успешно завершена";
      client.send(JSON.stringify(objectToClient));
    }
  });
};

// сообщение клиенту
const messageToclient = (object) => {
  activeClients.forEach((client) => {
    if (
      client.readyState === WebSocket.OPEN &&
      client.uniqueID === object.websocketId
    ) {
      client.lastkeepalive = Date.now();
      client.send(JSON.stringify(object));
    }
  });
};

// предварительный обработчик ошибок вебсокета
const onSocketPreError = (error = Error) => {
  console.log(error);
};

// дополнительный обработчик ошибок вебсокета
const onSocketPostError = (error = Error) => {
  console.log(error);
};

module.exports = {
  activeClients,
  messageToClientFromExpress,
  messageToclientErrorWrite,
  messageToClientSuccessWrite,
  messageToclient,
  onSocketPreError,
  onSocketPostError,
};
