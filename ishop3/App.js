import React from "react";
import ReactDOM from "react-dom";

import Shop from "./components/Shop";

const captionTable = "Содержимое онлайн-магазина";

import answersArr from "./answers.json";

ReactDOM.render(
  <Shop caption={captionTable} listProducts={answersArr} />,
  document.getElementById("container")
);
