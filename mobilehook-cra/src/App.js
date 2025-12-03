import React from "react";
import Mobile from "./components/Mobile/Mobile";
import clientsData from "./data/clients.json";
import "./App.css";

function App() {
  return (
    <div className="App">
      <Mobile initialClients={clientsData} />
    </div>
  );
}

export default App;
