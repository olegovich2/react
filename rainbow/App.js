import React from "react";
import ReactDOM from "react-dom";

import RainbowFrame from "./components/RainbowFrame.js";
import arrayColors from "./colors.json";

ReactDOM.render(
  <RainbowFrame colors={arrayColors}>Hello!</RainbowFrame>,
  document.getElementById("container")
);
