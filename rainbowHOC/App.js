import React from "react";
import ReactDOM from "react-dom";

import RainbowFrameHOC from "./components/RainbowFrameHOC.js";
import arrayColors from "./colors.json";

ReactDOM.render(
  <RainbowFrameHOC colors={arrayColors}>Hello!</RainbowFrameHOC>,
  document.getElementById("container")
);
