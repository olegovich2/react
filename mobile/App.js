import React from "react";
import ReactDOM from "react-dom";
import Mobile from "./components/Mobile/Mobile";
import clientsData from "./data/clients.json";

ReactDOM.render(
  <Mobile clients={clientsData} />,
  document.getElementById("container")
);
