import React from "react";
import ReactDOM from "react-dom";

import TableBlock from "./components/TableBlock";

const captionTable = "Содержимое онлайн-магазина";

import answersArr from "./answers.json";

ReactDOM.render(
  <TableBlock caption={captionTable} answers={answersArr} />,
  document.getElementById("container")
);
