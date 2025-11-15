import React from "react";
import ReactDOM from "react-dom";

import BrToJsx from "./components/BrToJsx.js";
const text = "первый<br>второй<br/>третий<br />последний";

ReactDOM.render(<BrToJsx text={text} />, document.getElementById("container"));
