import React from "react";
import ReactDOM from "react-dom";

import Filter from "./components/Filter";
import arrayListWords from "./list.json";

ReactDOM.render(
  <Filter listWords={arrayListWords} />,
  document.getElementById("container")
);
