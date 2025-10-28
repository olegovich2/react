import React from "react";
import ReactDOM from "react-dom";

import Shop from "./components/shopExtends";

ReactDOM.render(
  <Shop
    name="ТРЦ 'Мандарин Плаза'"
    storeAddress="г.Гомель, проспект Речицкий 5в"
  />,
  document.getElementById("container")
);
